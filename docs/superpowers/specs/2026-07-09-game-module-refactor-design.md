---
comet_change: game-module-refactor
role: technical-design
canonical_spec: openspec
archived-with: 2026-07-09-game-module-refactor
status: final
---

# Game Module Refactor — Technical Design

## Approach

1. ModuleBase abstract class with run() lifecycle
2. ModuleRegistry: Map<moduleId, ModuleBase> with register() and get()
3. ModuleExecutor: runs module, wraps in try/catch, logs via ExecLogRepo
4. Per-module layers: parser.ts (HTML→data), service.ts (business logic)
5. Wire into Fastify POST /api/run/:moduleId

## Implementation Plan

1. Create types in shared (ModuleMeta, ActionResult, ModuleStatus)
2. Create ModuleBase → ModuleRegistry → ModuleExecutor
3. Port daily-gift (simplest module)
4. Port friend-fight
5. Update Fastify routes
6. Build verify

