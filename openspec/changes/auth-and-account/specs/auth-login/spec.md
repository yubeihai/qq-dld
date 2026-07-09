### Requirement: JWT Token Signing

The system SHALL support signing a JWT token with an account id as the payload, with configurable expiry (default 24h).

#### Scenario: Sign and Verify Token

- WHEN a valid account id is provided to AuthModule.sign()
- THEN a valid JWT token string is returned
- WHEN that token is passed to AuthModule.verify()
- THEN the decoded payload containing the account id is returned

#### Scenario: Expired Token Rejection

- WHEN an expired JWT token is passed to AuthModule.verify()
- THEN an error is thrown and the request is rejected

#### Scenario: Invalid Signature Rejection

- WHEN a token signed with a different secret is passed to AuthModule.verify()
- THEN an error is thrown and the request is rejected

### Requirement: Auth Middleware

The system SHALL provide middleware that extracts and validates the JWT from the Authorization header (Bearer scheme), attaching the decoded payload to `req.user`.

#### Scenario: Protected Route Access

- WHEN a request with a valid Bearer token is made to a protected route
- THEN the request passes through to the route handler with `req.user` populated

#### Scenario: Missing Token

- WHEN a request without an Authorization header is made to a protected route
- THEN a 401 response is returned

#### Scenario: Invalid Token

- WHEN a request with an invalid or expired Bearer token is made to a protected route
- THEN a 401 response is returned
