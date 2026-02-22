import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load backend .env file
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const prisma = new PrismaClient();

/**
 * Truncates CRM data tables in dependency order while preserving:
 * - Tenant
 * - User
 * - RefreshToken
 * - ActivityType
 * - ContactRole
 */
export async function resetDatabase() {
  console.log('Resetting database...');

  try {
    // Truncate in dependency order (children first, then parents)
    await prisma.note.deleteMany({});
    console.log('  Truncated Note');

    await prisma.dealContact.deleteMany({});
    console.log('  Truncated DealContact');

    await prisma.activityContact.deleteMany({});
    console.log('  Truncated ActivityContact');

    await prisma.activityOrganization.deleteMany({});
    console.log('  Truncated ActivityOrganization');

    await prisma.activity.deleteMany({});
    console.log('  Truncated Activity');

    await prisma.deal.deleteMany({});
    console.log('  Truncated Deal');

    await prisma.contactPhone.deleteMany({});
    console.log('  Truncated ContactPhone');

    await prisma.contactEmail.deleteMany({});
    console.log('  Truncated ContactEmail');

    await prisma.contact.deleteMany({});
    console.log('  Truncated Contact');

    await prisma.organization.deleteMany({});
    console.log('  Truncated Organization');

    await prisma.duplicateSuggestion.deleteMany({});
    console.log('  Truncated DuplicateSuggestion');

    await prisma.auditLog.deleteMany({});
    console.log('  Truncated AuditLog');

    await prisma.savedFilter.deleteMany({});
    console.log('  Truncated SavedFilter');

    await prisma.importJob.deleteMany({});
    console.log('  Truncated ImportJob');

    console.log('Database reset complete');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running standalone
if (require.main === module) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
