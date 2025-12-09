/**
 * Express Application Configuration
 * Sets up middleware, routes, and error handling
 */

import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';

/**
 * Create and configure Express application
 * @returns {Express} Configured Express app
 */
export function createApp() {
  const app = express();

  // ============================================
  // MIDDLEWARE
  // ============================================

  // Enable CORS for cross-origin requests (React plugin will call this API)
  app.use(cors());

  // Parse JSON request bodies
  app.use(express.json());

  // Log all incoming requests (simple logging middleware)
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  // ============================================
  // ROUTES
  // ============================================

  registerRoutes(app);

  // ============================================
  // ERROR HANDLING
  // ============================================

  // 404 handler - catches routes that don't exist
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.path,
    });
  });

  // Global error handler - catches any errors in routes
  app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}

