## ADDED Requirements

### Requirement: Frontend pages

The web package SHALL have Vue3 pages for login, accounts, modules, and logs, using Vant4 components and Vant Tabbar navigation.

#### Scenario: Login page displays QR
Given the web app is loaded
When the user navigates to Login page
Then a QR code placeholder and login button are displayed

#### Scenario: Account management
Given the user is logged in
When navigating to Accounts page
Then a list of accounts is displayed with add/delete options

#### Scenario: Module dashboard
Given the user is logged in
When navigating to Modules page
Then the module list is displayed with run buttons

#### Scenario: Logs page
Given the user is logged in
When navigating to Logs page
Then recent execution logs are displayed
