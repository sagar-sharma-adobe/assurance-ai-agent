/**
 * Route Aggregator
 * Combines all route modules and exports them for use in app.js
 */

import healthRoutes from './health.routes.js';
import sessionRoutes from './session.routes.js';
import chatRoutes from './chat.routes.js';

/**
 * Register all routes with the Express app
 * @param {Express} app - Express application instance
 */
export function registerRoutes(app) {
  // Health check endpoint
  app.use('/api', healthRoutes);

  // Session management endpoints
  app.use('/api/session', sessionRoutes);

  // Chat endpoint
  app.use('/api/chat', chatRoutes);

  console.log('✅ Routes registered');
}

