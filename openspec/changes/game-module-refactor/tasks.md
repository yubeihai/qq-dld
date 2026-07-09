## 1. Module Architecture

- [x] 1.1 Create packages/server/src/modules/module-base.ts (abstract class)
- [x] 1.2 Create game domain types in packages/shared/src/types/
- [x] 1.3 Create ModuleRegistry in packages/server/src/modules/registry.ts
- [x] 1.4 Create ModuleExecutor in packages/server/src/modules/executor.ts

## 2. Ported Modules

- [x] 2.1 Port daily-gift module (fetch daily reward)
- [x] 2.2 Port friend-fight module (friend operations + fight)
- [x] 2.3 Port adventure module (exploration)

## 3. Fastify Integration

- [x] 3.1 Update modules route in Fastify server to use ModuleRegistry

## 4. Verification

- [x] 4.1 npm run build passes
