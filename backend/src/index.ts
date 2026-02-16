import { execSync } from 'child_process';
import app from './app';
import { logger } from './utils/logger';
import prisma from './config/database';
import { closeAllSessions } from './mcp';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Apply schema changes to database (idempotent)
    logger.info('Running prisma db push...');
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    logger.info('Database schema up to date');

    // Ensure database is connected before starting server
    await prisma.$connect();
    logger.info('Database connected successfully');

    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await closeAllSessions();
        await prisma.$disconnect();
        logger.info('Server closed');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
