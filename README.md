# MCP API Server

A Model Context Protocol (MCP) server that provides tools to call multiple APIs with GET requests and path parameters.

## Features

- Support for multiple API endpoints
- Path parameter substitution
- Configurable API definitions
- Error handling and validation
- JSON response formatting

## Installation

1. Clone or create the project directory
2. Install dependencies:

```bash
npm install
```

## Configuration

The server comes pre-configured with several example APIs:

- **jsonplaceholder_user**: Get user info from JSONPlaceholder
- **jsonplaceholder_post**: Get post info from JSONPlaceholder  
- **httpbin_uuid**: Get UUID from httpbin
- **httpbin_status**: Get specific HTTP status codes
- **httpbin_delay**: Get response after delay

To add your own APIs, modify the `API_CONFIGS` array in `server.js`:

```javascript
const API_CONFIGS = [
  {
    name: 'your_api_name',
    description: 'Description of your API',
    baseUrl: 'https://your-api.com',
    path: '/endpoint/{param}',
    parameters: [
      {
        name: 'param',
        type: 'string',
        description: 'Parameter description',
        required: true
      }
    ]
  }
];
```

## Usage

### Running the Server

```bash
npm start
```

The server runs on stdio transport and communicates via MCP protocol.

### Available Tools

1. **jsonplaceholder_user**
   - Get user by ID
   - Parameters: `id` (required)
   - Example: `{"id": "1"}`

2. **jsonplaceholder_post**
   - Get post by ID
   - Parameters: `id` (required)
   - Example: `{"id": "1"}`

3. **httpbin_uuid**
   - Generate UUID
   - No parameters required

4. **httpbin_status**
   - Test HTTP status codes
   - Parameters: `code` (required)
   - Example: `{"code": "200"}`

5. **httpbin_delay**
   - Test delayed responses
   - Parameters: `seconds` (required, 1-10)
   - Example: `{"seconds": "3"}`

### Example Responses

```json
{
  "status": 200,
  "statusText": "OK",
  "data": {
    "id": 1,
    "name": "Leanne Graham",
    "username": "Bret",
    "email": "Sincere@april.biz"
  },
  "headers": {
    "content-type": "application/json; charset=utf-8"
  }
}
```

## Integration with MCP Clients

To use this server with an MCP client (like Claude Desktop), add it to your MCP configuration:

```json
{
  "mcpServers": {
    "api-server": {
      "command": "node",
      "args": ["/path/to/your/server.js"]
    }
  }
}
```

## Adding New APIs

1. Add a new configuration object to `API_CONFIGS`
2. Define the API name, description, base URL, and path
3. Specify parameters with types and requirements
4. Restart the server

## Error Handling

The server handles various error scenarios:

- Missing required parameters
- Network timeouts
- HTTP error responses
- Invalid API configurations

## Requirements

- Node.js 18+ 
- @modelcontextprotocol/sdk
- axios

## License

MIT