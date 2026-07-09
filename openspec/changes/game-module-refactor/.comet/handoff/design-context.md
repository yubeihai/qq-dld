# Comet Design Handoff

- Change: game-module-refactor
- Phase: design
- Mode: compact
- Context hash: 6faa721b4e18a31cbb1fa96e035420be10dede85e2f95201a6916ba68be00fde

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/game-module-refactor/proposal.md

- Source: openspec/changes/game-module-refactor/proposal.md
- Lines: 1-29
- SHA256: 213356286c138dce7402a3432ca4aa1b1a4e803dc5a0e12a96e3d0099834e17a

```md
## Why

The 38 game modules in `src/actions/*.js` are monolithic single files mixing HTML parsing, business logic, and data access. This makes them hard to maintain, test, and extend. A 4-layer architecture (parser/service/repository/data) in TypeScript provides clear separation of concerns, type safety, and testability.

## What Changes

- Create module architecture: ModuleBase abstract class, ModuleRegistry, ModuleExecutor
- Create game domain types in packages/shared (module metadata, action results, etc.)
- Port 3-5 representative modules to demonstrate the 4-layer pattern:
  - daily-gift (simple: fetch reward)
  - friend-fight (medium: fight logic + friend management)
  - adventure (medium: exploration + rewards)
- Wire module execution into Fastify server (change 4)
- Remaining modules follow the same pattern incrementally

## Capabilities

### New Capabilities
- `game-modules`: Module architecture (abstractions, registry, executor) and the 4-layer refactor pattern for game action modules

### Modified Capabilities
- (none)

## Impact

- packages/server/src/modules/: module architecture + individual module directories
- packages/shared/src/types/: new game domain types (ModuleMeta, ActionResult, etc.)
- packages/server/src/routes/modules.ts: wire up real execution
- Existing src/actions/*.js: preserved during transition

```

## openspec/changes/game-module-refactor/design.md

- Source: openspec/changes/game-module-refactor/design.md
- Lines: 1-33
- SHA256: 6cd88a963cd1b30f6237d353255c1b9791e18caeaca9ffd166b76946da49f46d

```md
## Context

After changes 1-4, the project has TypeScript monorepo (change 1), data layer (change 2), auth (change 3), and Fastify server (change 4). The 38 game modules remain as legacy JS in `src/actions/`. This change transitions them to the new architecture.

## Goals & Non-Goals

Goals:
- ModuleBase abstract class with TypeScript types
- ModuleRegistry for module registration and lookup
- ModuleExecutor for running modules with DataLayer access
- Parser/Service/Repository layer pattern per module
- 3-5 modules ported to demonstrate: daily-gift, friend-fight, adventure
- Module execution wired into Fastify server routes

Non-Goals:
- Porting all 38 modules (follows same pattern; can be done incrementally)
- Changing game logic behavior (preserve existing behavior)

## Decisions

### D1: ModuleBase as abstract class
`ModuleBase` provides `run(params) => Promise<ActionResult>`. Subclasses implement `execute()`. Shared utilities: request helper, HTML extractor, delay.

### D2: Parser pattern
Each module has its own parser function (pure function: HTML string → parsed data). Clean testing boundary.

### D3: Registry and Executor
`ModuleRegistry` maps moduleId → ModuleBase instance. `ModuleExecutor` handles logging, error handling, timing.

## Risks

- Behavior preservation: the port must not change game interaction behavior
- Request client: existing game-client.js handles cookies + throttling; the new modules need to reuse or wrap it

```

## openspec/changes/game-module-refactor/tasks.md

- Source: openspec/changes/game-module-refactor/tasks.md
- Lines: 1-20
- SHA256: 2d09049041dc67b6b09fb789ee21b7114822b306cb4ce163279fc5ab7dc839e4

```md
## 1. Module Architecture

- [ ] 1.1 Create packages/server/src/modules/module-base.ts (abstract class)
- [ ] 1.2 Create game domain types in packages/shared/src/types/
- [ ] 1.3 Create ModuleRegistry in packages/server/src/modules/registry.ts
- [ ] 1.4 Create ModuleExecutor in packages/server/src/modules/executor.ts

## 2. Ported Modules

- [ ] 2.1 Port daily-gift module (fetch daily reward)
- [ ] 2.2 Port friend-fight module (friend operations + fight)
- [ ] 2.3 Port adventure module (exploration)

## 3. Fastify Integration

- [ ] 3.1 Update modules route in Fastify server to use ModuleRegistry

## 4. Verification

- [ ] 4.1 npm run build passes

```

## openspec/changes/game-module-refactor/specs/game-modules/spec.md

- Source: openspec/changes/game-module-refactor/specs/game-modules/spec.md
- Lines: 1-29
- SHA256: fa16856b073551dadfc671563577b13ea18304baaca455d594422d45dcd565a4

```md
## ADDED Requirements

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

```
