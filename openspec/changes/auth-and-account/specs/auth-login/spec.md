## ADDED Requirements

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

### Requirement: QR Login Session Management

The system SHALL support concurrent QR login sessions, each with a unique session ID, independent qrsig cookie, and in-memory state. No browser or puppeteer dependency is used — QQ ptlogin2 HTTP APIs are called directly.

#### Scenario: Start QR Login

- WHEN a client sends POST /api/auth/qr/start
- THEN the system requests a QR code from QQ ptlogin2 ptqrshow endpoint
- AND returns a response containing a sessionId and a base64-encoded QR image

#### Scenario: Concurrent Sessions

- WHEN multiple clients start QR login simultaneously
- THEN each session has an independent sessionId, qrsig, and cookie jar
- AND polling one session does not affect another

#### Scenario: Session Expiry

- WHEN a QR session exceeds 2 minutes without successful login
- THEN the session status becomes expired
- AND the session is eligible for cleanup

### Requirement: QR Login Status Polling

The system SHALL poll QQ ptlogin2 ptqrlogin endpoint using ptqrtoken (hash33 of qrsig) and return scan status to the client.

#### Scenario: Waiting for Scan

- WHEN the QR code has not been scanned (QQ returns code 66)
- THEN the status endpoint returns {status: "waiting"}

#### Scenario: Scanned Awaiting Confirmation

- WHEN the QR code has been scanned but not confirmed on mobile (QQ returns code 67)
- THEN the status endpoint returns {status: "scanned"}

#### Scenario: Login Success

- WHEN the user confirms login on mobile (QQ returns code 0)
- THEN the system completes the OAuth chain (login_jump → dld.qzapp.z.qq.com redirect) to collect game-site cookies
- AND extracts uin (QQ number) from cookies to identify/create/update the account
- AND signs a JWT token
- AND the status endpoint returns {status: "success", token, account}

#### Scenario: QR Code Expired

- WHEN the QR code has expired (QQ returns code 65)
- THEN the status endpoint returns {status: "expired"}

### Requirement: Account Auto-Identification

The system SHALL automatically identify accounts by QQ number (uin) extracted from login cookies. The uin is extracted from the `uin` or `pt2gguin` cookie (stripping the `o` prefix).

#### Scenario: New Account

- WHEN login succeeds and no existing account has the extracted uin
- THEN a new account is created with uin, nickname, and cookies

#### Scenario: Existing Account Re-login

- WHEN login succeeds and an account with the same uin already exists
- THEN the existing account's cookies are updated (not duplicated)
