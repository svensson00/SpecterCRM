/**
 * Complete Import Orchestration Script
 *
 * This script orchestrates the complete import process:
 * 1. Test database connection
 * 2. Verify tenant and user
 * 3. Build user mappings
 * 4. Import Organizations
 * 5. Import Contacts (with emails and phones)
 * 6. Import Deals
 * 7. Import Activities
 *
 * Usage Examples:
 *
 * Local development:
 *   npm run import -- --tenant=<tenant-id> --user=<admin-user-id>
 *
 * With custom import directory:
 *   npm run import -- --tenant=xxx --user=yyy --import-dir=/path/to/csv/files
 *
 * Using environment variables (recommended for Docker/cloud):
 *   TENANT_ID=xxx ADMIN_USER_ID=yyy IMPORT_DIR=/data/import npm run import
 *
 * Remote/Cloud deployment:
 *   DATABASE_URL=postgresql://... TENANT_ID=xxx ADMIN_USER_ID=yyy IMPORT_DIR=/tmp/import npm run import
 */

import { PrismaClient } from '@prisma/client';
import { importOrganizationsFromCSV, saveOrganizationMapping } from './import-organizations';
import { importContactsFromCSV, saveContactMapping } from './import-contacts';
import { importDealsFromCSV, saveDealMapping } from './import-deals';
import { importActivitiesFromCSV } from './import-activities';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface ImportConfig {
  tenantId: string;
  adminUserId: string;
  importDir: string;
  mappingsDir: string;
  dryRun: boolean;
  clearExisting: boolean;
  importJobId?: string;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ImportConfig {
  const args = process.argv.slice(2);

  let tenantId = process.env.TENANT_ID || '';
  let adminUserId = process.env.ADMIN_USER_ID || '';
  let importDir = process.env.IMPORT_DIR || '';
  let importJobId = process.env.IMPORT_JOB_ID;
  let dryRun = false;
  let clearExisting = process.env.CLEAR_EXISTING === 'true' || false;

  for (const arg of args) {
    if (arg.startsWith('--tenant=')) {
      tenantId = arg.split('=')[1];
    } else if (arg.startsWith('--user=')) {
      adminUserId = arg.split('=')[1];
    } else if (arg.startsWith('--import-dir=')) {
      importDir = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--clear-existing') {
      clearExisting = true;
    }
  }

  if (!tenantId || !adminUserId) {
    console.error('Error: Missing required parameters');
    console.error('Usage: npm run import -- --tenant=<tenant-id> --user=<admin-user-id> [--import-dir=<path>] [--clear-existing]');
    console.error('Or set TENANT_ID, ADMIN_USER_ID, and optionally IMPORT_DIR, CLEAR_EXISTING environment variables');
    process.exit(1);
  }

  // Default to relative path if not specified
  if (!importDir) {
    importDir = path.join(__dirname, '../../../import');
  }

  // Resolve to absolute path if relative
  importDir = path.resolve(importDir);

  const mappingsDir = path.join(importDir, 'mappings');

  // Verify import directory exists
  if (!fs.existsSync(importDir)) {
    console.error(`Error: Import directory does not exist: ${importDir}`);
    console.error('Please create the directory or specify a valid path with --import-dir or IMPORT_DIR');
    process.exit(1);
  }

  return {
    tenantId,
    adminUserId,
    importDir,
    mappingsDir,
    dryRun,
    clearExisting,
    importJobId
  };
}

/**
 * Update import job status
 */
async function updateJobStatus(
  jobId: string | undefined,
  data: {
    status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    currentFile?: string | null;
    filesProcessed?: number;
    recordsImported?: number;
    errorMessage?: string | null;
    startedAt?: Date;
    completedAt?: Date;
  }
): Promise<void> {
  if (!jobId) return; // No job to update

  try {
    await prisma.importJob.update({
      where: { id: jobId },
      data,
    });
  } catch (error: any) {
    console.error(`Warning: Failed to update job status: ${error.message}`);
    // Don't throw - job status updates are non-critical
  }
}

/**
 * Test database connection
 */
async function testDatabaseConnection(): Promise<void> {
  console.log('Testing database connection...');

  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✓ Database connection successful');

    const databaseUrl = process.env.DATABASE_URL || '';
    if (databaseUrl) {
      // Extract host info for display (hide credentials)
      const urlMatch = databaseUrl.match(/@([^:/@]+)/);
      const host = urlMatch ? urlMatch[1] : 'unknown';
      console.log(`✓ Connected to: ${host}`);
    }
  } catch (error: any) {
    console.error('✗ Database connection failed!');
    console.error('Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check DATABASE_URL environment variable is set correctly');
    console.error('2. Verify database server is running and accessible');
    console.error('3. Ensure firewall rules allow connection from this machine');
    console.error('4. Confirm database credentials are correct');
    throw error;
  }
}

/**
 * Verify tenant and user exist
 */
async function verifyConfig(config: ImportConfig): Promise<{ tenantName: string; userEmail: string; currency: string }> {
  console.log('Verifying configuration...');

  const tenant = await prisma.tenant.findUnique({
    where: { id: config.tenantId },
    select: { id: true, name: true, slug: true, currency: true }
  });

  if (!tenant) {
    throw new Error(`Tenant not found: ${config.tenantId}`);
  }

  const user = await prisma.user.findUnique({
    where: { id: config.adminUserId },
    select: { id: true, email: true, role: true }
  });

  if (!user) {
    throw new Error(`User not found: ${config.adminUserId}`);
  }

  if (user.role !== 'ADMIN') {
    console.warn(`Warning: User ${user.email} is not an admin`);
  }

  console.log(`✓ Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`✓ Import user: ${user.email}`);
  console.log(`✓ Default currency: ${tenant.currency}`);

  return {
    tenantName: tenant.name,
    userEmail: user.email,
    currency: tenant.currency
  };
}

/**
 * Clear all existing data for a tenant (DESTRUCTIVE!)
 */
async function clearExistingData(tenantId: string): Promise<void> {
  console.log('\n⚠️  CLEARING ALL EXISTING DATA ⚠️');
  console.log('='.repeat(70));

  try {
    // Delete in order to respect foreign key constraints
    console.log('Deleting activities...');
    const deletedActivities = await prisma.activity.deleteMany({
      where: { tenantId }
    });
    console.log(`  ✓ Deleted ${deletedActivities.count} activities`);

    console.log('Deleting notes...');
    const deletedNotes = await prisma.note.deleteMany({
      where: { tenantId }
    });
    console.log(`  ✓ Deleted ${deletedNotes.count} notes`);

    console.log('Deleting deals...');
    const deletedDeals = await prisma.deal.deleteMany({
      where: { tenantId }
    });
    console.log(`  ✓ Deleted ${deletedDeals.count} deals`);

    console.log('Deleting contact phones...');
    const deletedPhones = await prisma.contactPhone.deleteMany({
      where: { contact: { tenantId } }
    });
    console.log(`  ✓ Deleted ${deletedPhones.count} contact phones`);

    console.log('Deleting contact emails...');
    const deletedEmails = await prisma.contactEmail.deleteMany({
      where: { contact: { tenantId } }
    });
    console.log(`  ✓ Deleted ${deletedEmails.count} contact emails`);

    console.log('Deleting contacts...');
    const deletedContacts = await prisma.contact.deleteMany({
      where: { tenantId }
    });
    console.log(`  ✓ Deleted ${deletedContacts.count} contacts`);

    console.log('Deleting organizations...');
    const deletedOrgs = await prisma.organization.deleteMany({
      where: { tenantId }
    });
    console.log(`  ✓ Deleted ${deletedOrgs.count} organizations`);

    console.log('Deleting audit logs...');
    const deletedAuditLogs = await prisma.auditLog.deleteMany({
      where: { tenantId }
    });
    console.log(`  ✓ Deleted ${deletedAuditLogs.count} audit logs`);

    console.log('\n✓ All existing data cleared successfully');
    console.log('='.repeat(70));
  } catch (error: any) {
    console.error('✗ Error clearing data:', error.message);
    throw error;
  }
}

/**
 * Build user mappings from known patterns
 */
async function buildUserMappings(tenantId: string): Promise<{ mapping: Map<string, string>; users: any[] }> {
  const mapping = new Map<string, string>();

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, firstName: true, lastName: true }
  });

  console.log('\nAvailable users in tenant:');
  users.forEach(u => {
    console.log(`  - ${u.email} (${u.firstName} ${u.lastName})`);
  });

  // Common username patterns from SuiteCRM export
  // YOU SHOULD CUSTOMIZE THIS based on your CSV data
  const usernamePatterns = [
    { old: 'magnussvensson', email: 'magnus.svensson@eyevinn.se' }, // Map to first user
    { old: 'borisasadanin', email: 'boris.asadanin@eyevinn.se' },
    { old: 'alexanderbjorneheim', email: 'alexander.bjorneheim@eyevinn.se' },
    { old: 'jonasbirme', email: 'jonas.birme@eyevinn.se' },
    { old: 'tomasrapp', email: 'tomas.rapp@eyevinn.se' },
    { old: 'adminalex', email: 'alexander.bjorneheim@eyevinn.se' },
    { old: '1', fallback: true }, // System user -> first admin
  ];

  // Old UUIDs from SuiteCRM
  const oldUserIds = [
    { oldId: 'aa965b03-becb-7821-8519-68ff576136fb', username: 'magnussvensson' },
    { oldId: 'ebbf2708-f9cb-bff7-195e-68ff579f1d95', username: 'borisasadanin' },
  ];

  // Build mappings
  for (const pattern of usernamePatterns) {
    if (pattern.fallback) {
      const admin = users[0];
      if (admin) {
        mapping.set(pattern.old, admin.id);
      }
    } else if (pattern.email) {
      const user = users.find(u => u.email === pattern.email);
      if (user) {
        mapping.set(pattern.old, user.id);
      }
    }
  }

  // Map old UUIDs
  for (const oldUser of oldUserIds) {
    const newUserId = mapping.get(oldUser.username);
    if (newUserId) {
      mapping.set(oldUser.oldId, newUserId);
    }
  }

  return { mapping, users };
}

/**
 * Display field mappings for all entity types
 */
function displayFieldMappings(): void {
  console.log('\n' + '='.repeat(70));
  console.log('FIELD MAPPINGS REVIEW');
  console.log('='.repeat(70));
  console.log('\nThe following CSV columns will be mapped to SpecterCRM fields:\n');

  console.log('📋 ORGANIZATIONS (Organizations.csv)');
  console.log('  CSV Column                → SpecterCRM Field');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  Name                      → name (required)');
  console.log('  Website                   → website');
  console.log('  Billing Address Street    → address');
  console.log('  Billing Address City      → city');
  console.log('  Billing Address Postalcode → zip');
  console.log('  Billing Address Country   → country');
  console.log('  Assigned User             → ownerUserId (mapped via user mapping)');
  console.log('  Date Created              → createdAt (parsed)');
  console.log('  Date Modified             → updatedAt (parsed)');
  console.log('  Deleted                   → (skips if = "1")');
  console.log('');

  console.log('👤 CONTACTS (Contacts.csv)');
  console.log('  CSV Column                → SpecterCRM Field');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  First Name                → firstName (required)');
  console.log('  Last Name                 → lastName (required)');
  console.log('  Job Title                 → jobTitle');
  console.log('  Account Name              → primaryOrganizationId (lookup by name)');
  console.log('  Email Address             → contactEmails (isPrimary: true)');
  console.log('  Non Primary E-mails       → contactEmails (isPrimary: false)');
  console.log('  Mobile                    → contactPhones (type: Mobile)');
  console.log('  Office Phone              → contactPhones (type: Office)');
  console.log('  Home                      → contactPhones (type: Home)');
  console.log('  Other Phone               → contactPhones (type: Other)');
  console.log('  Assigned User             → ownerUserId (mapped via user mapping)');
  console.log('  Date Created              → createdAt (parsed)');
  console.log('  Date Modified             → updatedAt (parsed)');
  console.log('  Deleted                   → (skips if = "1")');
  console.log('');

  console.log('💰 DEALS (Deals.csv)');
  console.log('  CSV Column                → SpecterCRM Field');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  Opportunity Name          → title (required)');
  console.log('  Account Name              → organizationId (lookup by name)');
  console.log('  Opportunity Amount        → amount (parsed: "SE0,00" → 0.00)');
  console.log('  Currency                  → currency (extracted from amount or field)');
  console.log('  Expected Close Date       → expectedCloseDate (parsed)');
  console.log('  Sales Stage               → stage (mapped to enum: LEAD/PROSPECT/QUOTE/WON/LOST)');
  console.log('  Probability (%)           → probability (0-100)');
  console.log('  lostreason                → reasonLost (if stage = LOST)');
  console.log('  Assigned User             → ownerUserId (mapped via user mapping)');
  console.log('  Date Created              → createdAt (parsed)');
  console.log('  Date Modified             → updatedAt (parsed)');
  console.log('  Deleted                   → (skips if = "1")');
  console.log('');

  console.log('📅 ACTIVITIES (Activities.csv)');
  console.log('  CSV Column                → SpecterCRM Field');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  Subject                   → subject (required)');
  console.log('  Description               → description');
  console.log('  Meeting Type              → type (inferred from subject if empty)');
  console.log('  Due Date                  → dueAt (parsed)');
  console.log('  Status                    → isCompleted ("Held"/"Completed" → true)');
  console.log('  Account Name              → organizationId (lookup by name)');
  console.log('  Related Opportunity       → dealId (lookup by old ID mapping)');
  console.log('  Assigned User             → ownerUserId (mapped via user mapping)');
  console.log('  Date Created              → createdAt (parsed)');
  console.log('  Date Modified             → updatedAt (parsed)');
  console.log('  Deleted                   → (skips if = "1")');
  console.log('');

  console.log('📝 KEY TRANSFORMATIONS:');
  console.log('  • Dates: "10/17/2025 08:32" → ISO DateTime');
  console.log('  • Currency: "SE0,00" → 0.00 (currency: SE)');
  console.log('  • Sales Stage: "Closed Won" → DealStage.WON');
  console.log('  • Activity Type: Inferred from subject keywords if not provided');
  console.log('  • Email Validation: Invalid emails are skipped');
  console.log('  • Duplicates: Organizations with same name are skipped');
  console.log('');
  console.log('='.repeat(70));
}

/**
 * Display user mappings for review
 */
function displayUserMappings(mapping: Map<string, string>, users: any[]): void {
  console.log('\n' + '='.repeat(70));
  console.log('USER MAPPINGS REVIEW');
  console.log('='.repeat(70));
  console.log('\nThe following SuiteCRM users will be mapped to SpecterCRM users:\n');

  // Group by target user ID
  const mappingsByUser = new Map<string, string[]>();
  mapping.forEach((newUserId, oldUserName) => {
    if (!mappingsByUser.has(newUserId)) {
      mappingsByUser.set(newUserId, []);
    }
    mappingsByUser.get(newUserId)!.push(oldUserName);
  });

  // Display grouped mappings
  mappingsByUser.forEach((oldNames, newUserId) => {
    const user = users.find(u => u.id === newUserId);
    if (user) {
      console.log(`  ${user.firstName} ${user.lastName} (${user.email})`);
      oldNames.forEach(oldName => {
        // Only show non-UUID values for clarity
        if (!oldName.includes('-')) {
          console.log(`    ← ${oldName}`);
        }
      });
    }
  });

  console.log(`\n✓ Total mappings: ${mapping.size}`);
  console.log('='.repeat(70));
}

/**
 * Prompt user for confirmation
 */
function promptConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const response = answer.trim().toLowerCase();
      resolve(response === 'y' || response === 'yes');
    });
  });
}

/**
 * Ensure mappings directory exists
 */
function ensureMappingsDir(mappingsDir: string): void {
  if (!fs.existsSync(mappingsDir)) {
    fs.mkdirSync(mappingsDir, { recursive: true });
    console.log(`✓ Created mappings directory: ${mappingsDir}`);
  }
}

/**
 * Main import orchestration
 */
async function runImport() {
  const config = parseArgs();

  console.log('='.repeat(70));
  console.log('SpecterCRM Complete Data Import');
  console.log('='.repeat(70));
  console.log();
  console.log(`Import directory: ${config.importDir}`);
  console.log();

  try {
    // Mark job as running
    await updateJobStatus(config.importJobId, {
      status: 'RUNNING',
      startedAt: new Date(),
    });

    // Test database connection first
    await testDatabaseConnection();
    console.log();

    // Verify configuration
    const { tenantName, userEmail, currency } = await verifyConfig(config);
    console.log();

    if (config.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be imported\n');
      return;
    }

    // Check existing data
    console.log('Checking existing data in tenant...');
    const existingOrgs = await prisma.organization.count({ where: { tenantId: config.tenantId } });
    const existingContacts = await prisma.contact.count({ where: { tenantId: config.tenantId } });
    const existingDeals = await prisma.deal.count({ where: { tenantId: config.tenantId } });
    const existingActivities = await prisma.activity.count({ where: { tenantId: config.tenantId } });

    console.log(`  Organizations: ${existingOrgs}`);
    console.log(`  Contacts: ${existingContacts}`);
    console.log(`  Deals: ${existingDeals}`);
    console.log(`  Activities: ${existingActivities}`);
    console.log();

    const hasExistingData = existingOrgs > 0 || existingContacts > 0 || existingDeals > 0 || existingActivities > 0;

    if (config.clearExisting && hasExistingData) {
      console.log('🗑️  Clear existing data flag is SET');
      console.log('⚠️  WARNING: This will DELETE ALL existing data in the tenant!');
      console.log('⚠️  Organizations, Contacts, Deals, and Activities will be PERMANENTLY REMOVED!');

      // Only wait for confirmation if not running from web UI
      if (!config.importJobId) {
        console.log('\nPress Ctrl+C to cancel, or wait 10 seconds to continue...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
      } else {
        console.log('(Running from web UI - user already confirmed)\n');
      }

      await clearExistingData(config.tenantId);
    } else if (hasExistingData && !config.importJobId) {
      // Only warn and wait if running from CLI
      console.log('⚠️  Warning: Tenant already has data!');
      console.log('This import will ADD to existing data, not replace it.');
      console.log('To clear existing data first, use the --clear-existing flag.');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    ensureMappingsDir(config.mappingsDir);

    // Step 1: Build user mappings
    console.log('='.repeat(70));
    console.log('Step 1/5: Building user mappings');
    console.log('='.repeat(70));
    const { mapping: userMapping, users } = await buildUserMappings(config.tenantId);

    // Only show interactive confirmation if not running from web UI (no job ID)
    if (!config.importJobId) {
      // Display field mappings for review
      displayFieldMappings();

      // Display user mappings for review
      displayUserMappings(userMapping, users);

      // Prompt for confirmation
      console.log('\nReview the field and user mappings above.');
      console.log('These mappings will be used to import your SuiteCRM data.');
      const confirmed = await promptConfirmation('\nDo you want to proceed with the import? (y/n): ');

      if (!confirmed) {
        console.log('\n❌ Import cancelled by user.');
        console.log('\nTo customize mappings:');
        console.log('  • Field mappings: Edit import-*.ts files in backend/src/scripts/');
        console.log('  • User mappings: Edit usernamePatterns in run-import.ts (lines 133-137)\n');
        return;
      }

      console.log('\n✓ Import confirmed, proceeding...\n');
    } else {
      console.log('✓ Running from web UI, skipping confirmation prompt\n');
    }

    // Step 2: Import Organizations
    console.log('='.repeat(70));
    console.log('Step 2/5: Importing Organizations');
    console.log('='.repeat(70));
    await updateJobStatus(config.importJobId, {
      currentFile: 'Organizations.csv',
      filesProcessed: 0,
    });
    const orgStats = await importOrganizationsFromCSV(
      path.join(config.importDir, 'Organizations.csv'),
      config.tenantId,
      config.adminUserId,
      { users: userMapping }
    );
    await saveOrganizationMapping(
      orgStats.idMapping,
      path.join(config.mappingsDir, 'organizations.json')
    );
    await updateJobStatus(config.importJobId, {
      filesProcessed: 1,
      recordsImported: orgStats.success,
    });

    // Step 3: Import Contacts
    console.log('\n' + '='.repeat(70));
    console.log('Step 3/5: Importing Contacts');
    console.log('='.repeat(70));
    await updateJobStatus(config.importJobId, {
      currentFile: 'Contacts.csv',
    });
    const contactStats = await importContactsFromCSV(
      path.join(config.importDir, 'Contacts.csv'),
      config.tenantId,
      config.adminUserId,
      {
        organizations: orgStats.idMapping,
        users: userMapping
      }
    );
    await saveContactMapping(
      contactStats.idMapping,
      path.join(config.mappingsDir, 'contacts.json')
    );
    await updateJobStatus(config.importJobId, {
      filesProcessed: 2,
      recordsImported: orgStats.success + contactStats.success,
    });

    // Step 4: Import Deals
    console.log('\n' + '='.repeat(70));
    console.log('Step 4/5: Importing Deals');
    console.log('='.repeat(70));
    await updateJobStatus(config.importJobId, {
      currentFile: 'Deals.csv',
    });
    const dealStats = await importDealsFromCSV(
      path.join(config.importDir, 'Deals.csv'),
      config.tenantId,
      config.adminUserId,
      {
        organizations: orgStats.idMapping,
        users: userMapping
      },
      currency
    );
    await saveDealMapping(
      dealStats.idMapping,
      path.join(config.mappingsDir, 'deals.json')
    );
    await updateJobStatus(config.importJobId, {
      filesProcessed: 3,
      recordsImported: orgStats.success + contactStats.success + dealStats.success,
    });

    // Step 5: Import Activities
    console.log('\n' + '='.repeat(70));
    console.log('Step 5/5: Importing Activities');
    console.log('='.repeat(70));
    await updateJobStatus(config.importJobId, {
      currentFile: 'Activities.csv',
    });
    const activityStats = await importActivitiesFromCSV(
      path.join(config.importDir, 'Activities.csv'),
      config.tenantId,
      config.adminUserId,
      {
        organizations: orgStats.idMapping,
        users: userMapping,
        deals: dealStats.idMapping
      }
    );
    await updateJobStatus(config.importJobId, {
      filesProcessed: 4,
      recordsImported: orgStats.success + contactStats.success + dealStats.success + activityStats.success,
    });

    // Final summary
    console.log('\n' + '='.repeat(70));
    console.log('IMPORT COMPLETE!');
    console.log('='.repeat(70));
    console.log();
    console.log(`Tenant: ${tenantName}`);
    console.log(`Imported by: ${userEmail}`);
    console.log();
    console.log('Summary:');
    console.log(`  Organizations: ${orgStats.success} of ${orgStats.total} (${orgStats.errors} errors, ${orgStats.skipped} skipped)`);
    console.log(`  Contacts:      ${contactStats.success} of ${contactStats.total} (${contactStats.errors} errors, ${contactStats.skipped} skipped)`);
    console.log(`  Deals:         ${dealStats.success} of ${dealStats.total} (${dealStats.errors} errors, ${dealStats.skipped} skipped)`);
    console.log(`  Activities:    ${activityStats.success} of ${activityStats.total} (${activityStats.errors} errors, ${activityStats.skipped} skipped)`);
    console.log();
    console.log('Total records imported:',
      orgStats.success + contactStats.success + dealStats.success + activityStats.success
    );
    console.log();

    const totalErrors = orgStats.errors + contactStats.errors + dealStats.errors + activityStats.errors;
    if (totalErrors > 0) {
      console.log(`⚠️  ${totalErrors} total errors occurred during import.`);
      console.log('Review the error details above to see which records failed.');
      console.log();
    } else {
      console.log('✓ All records imported successfully!');
      console.log();
    }

    console.log('ID mappings saved to:', config.mappingsDir);
    console.log();

    // Mark job as completed
    await updateJobStatus(config.importJobId, {
      status: 'COMPLETED',
      currentFile: null,
      completedAt: new Date(),
    });

  } catch (error: any) {
    console.error('\n❌ Import failed:');
    console.error(error.message);
    console.error();
    console.error('Stack trace:');
    console.error(error.stack);

    // Mark job as failed
    await updateJobStatus(config.importJobId, {
      status: 'FAILED',
      errorMessage: error.message,
      completedAt: new Date(),
    });

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run import
runImport();
