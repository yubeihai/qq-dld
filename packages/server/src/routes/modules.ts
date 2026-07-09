import { FastifyPluginAsync } from 'fastify';
import { ModuleRegistry } from '../modules/registry';
import { ModuleExecutor } from '../modules/executor';
import { DailyGiftModule } from '../modules/daily-gift';
import { FriendFightModule } from '../modules/friend-fight';
import { AdventureModule } from '../modules/adventure';

ModuleRegistry.register(new DailyGiftModule());
ModuleRegistry.register(new FriendFightModule());
ModuleRegistry.register(new AdventureModule());

const executor = new ModuleExecutor();

export const moduleRoutes: FastifyPluginAsync = async (server) => {
  server.get('/api/modules', async (_request, reply) => {
    const modules = ModuleRegistry.getAll().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      category: m.category,
    }));
    reply.send({ modules });
  });

  server.post('/api/run/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await executor.runModule(id);
      reply.send({ success: true, moduleId: id, result });
    } catch (error) {
      reply.status(500).send({ success: false, moduleId: id, error: String(error) });
    }
  });

  server.post('/api/run', async (_request, reply) => {
    try {
      const results = await executor.runAll();
      reply.send({ success: true, results });
    } catch (error) {
      reply.status(500).send({ success: false, error: String(error) });
    }
  });
};
