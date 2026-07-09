# game-modules Specification

## Purpose
TBD - created by archiving change game-module-refactor. Update Purpose after archive.
## Requirements
### Requirement: ModuleBase and ModuleRegistry

The system SHALL provide ModuleBase abstract class and ModuleRegistry for module registration and execution.

#### Scenario: Module registration
Given a module class extending ModuleBase
When it is registered in ModuleRegistry
Then it is retrievable by moduleId

#### Scenario: Module execution
Given a registered module
When ModuleExecutor runs it
Then the result is returned with status, data, and timing info

### Requirement: Ported modules

The system SHALL port at least 3 modules to the 4-layer architecture: daily-gift, friend-fight, adventure.

#### Scenario: daily-gift executes
Given daily-gift module is registered
When it runs
Then it calls the daily gift API and returns the result

#### Scenario: friend-fight executes
Given friend-fight module is registered
When it runs
Then it fetches friend list, fights each, and returns results

