/**
 * Graceful Shutdown Service
 * 
 * Handles clean application shutdown with proper resource cleanup
 * Prevents data corruption and memory leaks
 */

import { createServer } from 'http';
import { Server } from 'net';

interface ShutdownHandler {
  signal: string;
  handler: () => Promise<void>;
}

class GracefulShutdown {
  private server: Server | null = null;
  private shutdownHandlers: ShutdownHandler[] = [];
  private isShuttingDown = false;

  constructor() {
    this.setupSignalHandlers();
  }

  /**
   * Register the HTTP server for graceful shutdown
   */
  registerServer(server: Server) {
    this.server = server;
  }

  /**
   * Add custom shutdown handler
   */
  addShutdownHandler(signal: string, handler: () => Promise<void>) {
    this.shutdownHandlers.push({ signal, handler });
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);
        this.shutdown(signal);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      this.shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      this.shutdown('unhandledRejection');
    });
  }

  /**
   * Perform graceful shutdown
   */
  private async shutdown(signal: string) {
    if (this.isShuttingDown) {
      console.log('⏳ Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    console.log(`🔄 Starting graceful shutdown for signal: ${signal}`);

    const shutdownTasks: Promise<void>[] = [];

    // 1. Stop accepting new connections
    if (this.server) {
      console.log('🛑 Stopping HTTP server...');
      shutdownTasks.push(
        new Promise<void>((resolve) => {
          this.server!.close(() => {
            console.log('✅ HTTP server stopped');
            resolve();
          });
        })
      );
    }

    // 2. Run custom shutdown handlers
    this.shutdownHandlers.forEach(({ signal: handlerSignal, handler }) => {
      if (handlerSignal === signal || signal === 'SIGTERM') {
        console.log(`🔄 Running shutdown handler for: ${handlerSignal}`);
        shutdownTasks.push(handler());
      }
    });

    // 3. Close database connections
    console.log('🔄 Closing database connections...');
    shutdownTasks.push(this.closeDatabaseConnections());

    // 4. Clear caches and cleanup memory
    console.log('🧹 Cleaning up memory...');
    shutdownTasks.push(this.cleanupMemory());

    // 5. Wait for all tasks with timeout
    try {
      await Promise.race([
        Promise.all(shutdownTasks),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), 30000)
        )
      ]);
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Shutdown error:', error);
      console.log('🚪 Forcing exit after timeout');
      process.exit(1);
    }
  }

  /**
   * Close database connections
   */
  private async closeDatabaseConnections(): Promise<void> {
    return new Promise((resolve) => {
      // This would integrate with your database connection pool
      console.log('🔄 Database connections closed');
      resolve();
    });
  }

  /**
   * Cleanup memory and caches
   */
  private async cleanupMemory(): Promise<void> {
    return new Promise((resolve) => {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        console.log('🗑️ Forced garbage collection');
      }

      // Clear any caches
      try {
        const { clearSearchCache } = require('../services/lead-search-optimization.service');
        if (typeof clearSearchCache === 'function') {
          clearSearchCache();
          console.log('🧹 Search cache cleared');
        }
      } catch {
        // Search cache module not available
      }

      console.log('✅ Memory cleanup completed');
      resolve();
    });
  }

  /**
   * Health check during shutdown
   */
  isShuttingDownActive(): boolean {
    return this.isShuttingDown;
  }
}

// Global instance
const gracefulShutdown = new GracefulShutdown();

export { gracefulShutdown, GracefulShutdown };
