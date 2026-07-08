const express = require('express');
const path = require('path');
const { createAuthRoutes } = require('./routes/auth');
const { createModuleRoutes } = require('./routes/modules');
const { createLogRoutes } = require('./routes/logs');
const { createTaskRoutes } = require('./routes/tasks');
const { createFriendRoutes } = require('./routes/friends');
const { createSchedulerRoutes } = require('./routes/scheduler');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  app.use('/api/auth', createAuthRoutes());
  app.use('/api/modules', createModuleRoutes());
  app.use('/api/logs', createLogRoutes());
  app.use('/api/tasks', createTaskRoutes());
  app.use('/api/friends', createFriendRoutes());
  app.use('/api/scheduler', createSchedulerRoutes());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
