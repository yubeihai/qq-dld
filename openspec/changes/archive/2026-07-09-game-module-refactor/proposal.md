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
