#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');

// Configuration for your APIs
const API_CONFIGS = [
  {
    name: 'jsonplaceholder_user',
    description: 'Get user information from JSONPlaceholder',
    baseUrl: 'https://jsonplaceholder.typicode.com',
    path: '/users/{id}',
    parameters: [
      {
        name: 'id',
        type: 'string',
        description: 'User ID',
        required: true
      }
    ]
  },
  {
    name: 'jsonplaceholder_post',
    description: 'Get post information from JSONPlaceholder',
    baseUrl: 'https://jsonplaceholder.typicode.com',
    path: '/posts/{id}',
    parameters: [
      {
        name: 'id',
        type: 'string',
        description: 'Post ID',
        required: true
      }
    ]
  },
  {
    name: 'httpbin_uuid',
    description: 'Get UUID from httpbin',
    baseUrl: 'https://httpbin.org',
    path: '/uuid',
    parameters: []
  },
  {
    name: 'httpbin_status',
    description: 'Get specific HTTP status from httpbin',
    baseUrl: 'https://httpbin.org',
    path: '/status/{code}',
    parameters: [
      {
        name: 'code',
        type: 'string',
        description: 'HTTP status code (e.g., 200, 404, 500)',
        required: true
      }
    ]
  },
  {
    name: 'httpbin_delay',
    description: 'Get response after delay from httpbin',
    baseUrl: 'https://httpbin.org',
    path: '/delay/{seconds}',
    parameters: [
      {
        name: 'seconds',
        type: 'string',
        description: 'Number of seconds to delay (1-10)',
        required: true
      }
    ]
  },
  {
    name: 'top_news_headlines',
    description: 'Get top 10 news headlines from NewsAPI.org',
    baseUrl: 'https://newsapi.org',
    path: '/v2/top-headlines',
    parameters: [
      {
        name: 'country',
        type: 'string',
        description: 'Country code (e.g., us, gb, in)',
        required: true
      }
    ]
  }
];

class ApiMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'api-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: API_CONFIGS.map(config => ({
          name: config.name,
          description: config.description,
          inputSchema: {
            type: 'object',
            properties: config.parameters.reduce((props, param) => {
              props[param.name] = {
                type: param.type,
                description: param.description
              };
              return props;
            }, {}),
            required: config.parameters.filter(p => p.required).map(p => p.name)
          }
        }))
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // Find the API configuration
      const apiConfig = API_CONFIGS.find(config => config.name === name);
      if (!apiConfig) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      try {
        const result = await this.callApi(apiConfig, args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `API call failed: ${error.message}`
        );
      }
    });
  }

  async callApi(config, args) {
    // Special handling for top_news_headlines
    if (config.name === 'top_news_headlines') {
      const country = args.country || 'us';
      const apiKey = process.env.NEWSAPI_KEY;
      try {
        const response = await axios.get('https://newsapi.org/v2/top-headlines', {
          params: { country, apiKey }
        });
        if (response.data.status !== 'ok') {
          throw new Error(response.data.message || 'Unknown error from NewsAPI');
        }
        const articles = response.data.articles || [];
        if (articles.length === 0) {
          return { message: `No news headlines found for country code "${country}".` };
        }
        // Format as markdown table with title and link
        let table = '| # | Headline | Link |\n|---|----------|------|\n';
        articles.forEach((a, i) => {
          const title = a.title ? a.title.replace(/\|/g, '-') : '';
          const link = a.url ? `[Link](${a.url})` : '';
          table += `| ${i + 1} | ${title} | ${link} |\n`;
        });
        return {
          status: response.status,
          statusText: response.statusText,
          country,
          table,
          headlines: articles.map(a => a.title)
        };
      } catch (error) {
        throw new Error('Failed to fetch news headlines: ' + error.message);
      }
    }
    // Replace path parameters
    let url = config.baseUrl + config.path;
    
    // Replace path parameters in the URL
    for (const param of config.parameters) {
      if (param.required && !args[param.name]) {
        throw new Error(`Missing required parameter: ${param.name}`);
      }
      
      if (args[param.name]) {
        url = url.replace(`{${param.name}}`, encodeURIComponent(args[param.name]));
      }
    }

    // Validate that all required parameters are provided
    const missingParams = config.parameters
      .filter(p => p.required && !args[p.name])
      .map(p => p.name);
    
    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }

    console.log(`[API Call] ${config.name}: ${url}`);

    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'MCP-API-Server/1.0'
        }
      });

      return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      if (error.response) {
        // Server responded with error status
        return {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers,
          error: true
        };
      } else if (error.request) {
        // Network error
        throw new Error(`Network error: ${error.message}`);
      } else {
        // Other error
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP API Server running on stdio');
  }
}

// Start the server
const server = new ApiMcpServer();
server.run().catch(console.error);