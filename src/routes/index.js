/**
 * Route Aggregator
 * Combines all route modules and exports them for use in app.js
 */

import healthRoutes from './health.routes.js';
import sessionRoutes from './session.routes.js';
import chatRoutes from './chat.routes.js';
import eventsRoutes from "./events.routes.js";
import knowledgeRoutes from "./knowledge.routes.js";

/**
 * Register all routes with the Express app
 * @param {Express} app - Express application instance
 */
export function registerRoutes(app) {
  // Health check endpoint
  app.use("/api", healthRoutes);

  // Session management endpoints
  app.use("/api/session", sessionRoutes);

  // Chat endpoint
  app.use("/api/chat", chatRoutes);

  // Events endpoints (for Assurance event upload and search)
  app.use("/api/events", eventsRoutes);

  // Knowledge base endpoints (RAG - document loading and search)
  app.use("/api/knowledge", knowledgeRoutes);

  console.log("✅ Routes registered");
}

