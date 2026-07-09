# fastify-server Specification

## Purpose
TBD - created by archiving change api-server-fastify. Update Purpose after archive.
## Requirements
### Requirement: Fastify Server

The project SHALL provide a Fastify v4 HTTP server at `packages/server/src/server.ts` that:
- Registers @fastify/cors for cross-origin requests
- Registers an auth plugin wrapping AuthModule for JWT verification
- Registers route plugins for status, accounts, logs, and modules (stub)
- Registers a scheduler plugin integrated with node-schedule
- Registers a centralized error handler
- Listens on the port specified by `PORT` env var, defaulting to 3001
- The server MUST be startable via `start()` function from `packages/server/src/index.ts`
- The `start()` function MUST initialize DataLayer before starting
- All route handlers MUST have schema validation via TypeBox
- API responses MUST be structured JSON: `{ success: boolean, data?: any, error?: string }`

#### Scenario: Fastify server responds on port 3001
Given the server is started
When a GET /api/status request is sent
Then the server responds with 200
And the response body contains `{ success: true, data: { status: "ok" } }`

#### Scenario: Auth plugin protects authenticated routes
Given the server is started
When a GET /api/accounts request is sent without Authorization header
Then the server responds with 401

#### Scenario: Valid JWT allows access to protected routes
Given the server is started
And a valid JWT token exists
When a GET /api/accounts request is sent with Authorization: Bearer <token>
Then the server responds with 200

#### Scenario: Schema validation rejects invalid input
Given the server is started
And an authenticated session
When a POST /api/accounts request is sent with empty body
Then the server responds with 400

#### Scenario: Error handler returns structured errors
Given the server is started
When a GET /api/nonexistent request is sent
Then the server responds with 404
And the response body contains `{ success: false, error: "Route not found" }`

