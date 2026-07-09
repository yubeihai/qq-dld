### Requirement: Account CRUD

The system SHALL support adding, listing, and removing accounts with associated cookies.

#### Scenario: Add Account

- WHEN a new account with uin and cookies is added via AccountService.add()
- THEN the account is persisted in the database with status 'active'

#### Scenario: List Accounts

- WHEN AccountService.list() is called
- THEN an array of all accounts is returned, excluding cookie values for security

#### Scenario: Remove Account

- WHEN an existing account is removed via AccountService.remove()
- THEN the account and all associated data (module configs, logs) are deleted (CASCADE)

### Requirement: Cookie Persistence

Each account SHALL store its own login cookies in the accounts table, used for game API requests.

#### Scenario: Store and Retrieve Cookies

- WHEN cookies are saved for an account via AccountService.updateCookies()
- THEN the cookies are persisted and retrievable
- WHEN AccountService.getCookies() is called for that account
- THEN the stored cookies are returned

#### Scenario: Switch Active Account

- WHEN a different account is selected via AccountService.switch()
- THEN the active account id is persisted in settings
- WHEN the application requests the current account
- THEN the selected account's cookies are used for game API requests
