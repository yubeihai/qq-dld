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
