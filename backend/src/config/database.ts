import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prismaBase = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
  errorFormat: 'minimal',
});

// Add connection error handling
prismaBase.$connect()
  .then(() => logger.info('Database connected successfully'))
  .catch((error) => logger.error('Database connection error:', error));

// Handle disconnect events
process.on('beforeExit', async () => {
  await prismaBase.$disconnect();
});

const prisma = prismaBase.$extends({
  query: {
    $allOperations: async ({ operation, model, args, query }) => {
      const before = Date.now();
      const result = await query(args);
      const after = Date.now();
      logger.debug(`Query ${model}.${operation} took ${after - before}ms`);
      return result;
    },
  },
});

export default prisma;
