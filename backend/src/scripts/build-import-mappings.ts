import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface OrganizationCSVRow {
  'Name': string;
  'ID': string;
  'Assigned to': string;
  'Assigned User': string;
}

interface _UserCSVRow {
  'Assigned to': string;
  'Assigned User': string;
}

/**
 * Build organization ID mapping from imported data
 * Assumes organizations have been imported with their old ID stored somewhere
 * or we can match by name
 */
async function buildOrganizationMapping(
  csvPath: string,
  tenantId: string
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const pendingOperations: Promise<void>[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row: OrganizationCSVRow) => {
        const oldId = row.ID;
        const name = row.Name;

        if (!oldId || !name) return;

        // Queue async operation to be awaited later
        const operation = (async () => {
          // Find organization by name in tenant
          const org = await prisma.organization.findFirst({
            where: {
              tenantId,
              name: name.trim()
            },
            select: { id: true }
          });

          if (org) {
            mapping.set(oldId, org.id);
            console.log(`Mapped org: ${name} (${oldId} -> ${org.id})`);
          } else {
            console.warn(`Organization not found: ${name}`);
          }
        })();
        pendingOperations.push(operation);
      })
      .on('end', async () => {
        // Wait for all async operations to complete before resolving
        await Promise.all(pendingOperations);
        console.log(`✓ Built organization mapping: ${mapping.size} entries`);
        resolve(mapping);
      })
      .on('error', reject);
  });
}

/**
 * Build user ID mapping
 * Maps both the user ID and username to the new user ID
 */
async function buildUserMapping(tenantId: string): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();

  // Get all users in the tenant
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true
    }
  });

  // Common username patterns from CSV
  const usernamePatterns = [
    { old: 'magnussvensson', email: 'magnus@example.com' },
    { old: 'borisasadanin', email: 'boris@example.com' },
    { old: 'adminalex', email: 'alex@example.com' },
    { old: '1', fallback: true }, // System user
  ];

  // Map known patterns
  for (const pattern of usernamePatterns) {
    if (pattern.fallback) {
      // Map to first admin user
      const admin = users.find(u => u.email.includes('admin')) || users[0];
      if (admin) {
        mapping.set(pattern.old, admin.id);
        console.log(`Mapped user: ${pattern.old} -> ${admin.email} (${admin.id})`);
      }
    } else {
      const user = users.find(u => u.email === pattern.email);
      if (user) {
        mapping.set(pattern.old, user.id);
        console.log(`Mapped user: ${pattern.old} -> ${user.email} (${user.id})`);
      }
    }
  }

  // Also add old UUIDs if we can determine them
  // This would require storing the old ID during user creation
  // For now, we'll map common UUID patterns to users
  const oldUserIds = [
    { oldId: 'aa965b03-becb-7821-8519-68ff576136fb', username: 'magnussvensson' },
    { oldId: 'ebbf2708-f9cb-bff7-195e-68ff579f1d95', username: 'borisasadanin' },
  ];

  for (const oldUser of oldUserIds) {
    const newUserId = mapping.get(oldUser.username);
    if (newUserId) {
      mapping.set(oldUser.oldId, newUserId);
      console.log(`Mapped user UUID: ${oldUser.oldId} -> ${newUserId}`);
    }
  }

  console.log(`✓ Built user mapping: ${mapping.size} entries`);
  return mapping;
}

/**
 * Build deal ID mapping (if deals have been imported)
 */
async function buildDealMapping(
  csvPath: string,
  tenantId: string,
  orgMapping: Map<string, string>
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>();
  const pendingOperations: Promise<void>[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row: any) => {
        const oldId = row.ID;
        const title = row['Opportunity Name'];
        const accountName = row['Account Name'];

        if (!oldId || !title) return;

        // Queue async operation to be awaited later
        const operation = (async () => {
          // Find organization first
          const orgOldId = await findOrgOldIdByName(accountName, csvPath);
          const orgNewId = orgOldId ? orgMapping.get(orgOldId) : null;

          if (!orgNewId) {
            console.warn(`Cannot map deal ${title}: organization ${accountName} not found`);
            return;
          }

          // Find deal by title and organization
          const deal = await prisma.deal.findFirst({
            where: {
              tenantId,
              organizationId: orgNewId,
              title: title.trim()
            },
            select: { id: true }
          });

          if (deal) {
            mapping.set(oldId, deal.id);
            console.log(`Mapped deal: ${title} (${oldId} -> ${deal.id})`);
          }
        })();
        pendingOperations.push(operation);
      })
      .on('end', async () => {
        // Wait for all async operations to complete before resolving
        await Promise.all(pendingOperations);
        console.log(`✓ Built deal mapping: ${mapping.size} entries`);
        resolve(mapping);
      })
      .on('error', reject);
  });
}

/**
 * Helper to find organization old ID by name from CSV
 */
async function findOrgOldIdByName(name: string, csvPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    fs.createReadStream(csvPath.replace('Deals.csv', 'Organizations.csv'))
      .pipe(csv())
      .on('data', (row: OrganizationCSVRow) => {
        if (row.Name === name) {
          resolve(row.ID);
        }
      })
      .on('end', () => resolve(null));
  });
}

/**
 * Save mappings to JSON files for reuse
 */
async function saveMappings(
  organizations: Map<string, string>,
  users: Map<string, string>,
  deals: Map<string, string>
): Promise<void> {
  const outputDir = path.join(__dirname, '../../import/mappings');

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save as JSON
  fs.writeFileSync(
    path.join(outputDir, 'organizations.json'),
    JSON.stringify(Object.fromEntries(organizations), null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'users.json'),
    JSON.stringify(Object.fromEntries(users), null, 2)
  );

  fs.writeFileSync(
    path.join(outputDir, 'deals.json'),
    JSON.stringify(Object.fromEntries(deals), null, 2)
  );

  console.log(`✓ Saved mappings to ${outputDir}`);
}

/**
 * Load mappings from JSON files
 */
export async function loadMappings(): Promise<{
  organizations: Map<string, string>;
  users: Map<string, string>;
  deals: Map<string, string>;
}> {
  const outputDir = path.join(__dirname, '../../import/mappings');

  const organizations = new Map<string, string>(
    Object.entries(
      JSON.parse(fs.readFileSync(path.join(outputDir, 'organizations.json'), 'utf-8'))
    ) as [string, string][]
  );

  const users = new Map<string, string>(
    Object.entries(
      JSON.parse(fs.readFileSync(path.join(outputDir, 'users.json'), 'utf-8'))
    ) as [string, string][]
  );

  const deals = new Map<string, string>(
    Object.entries(
      JSON.parse(fs.readFileSync(path.join(outputDir, 'deals.json'), 'utf-8'))
    ) as [string, string][]
  );

  return { organizations, users, deals };
}

/**
 * Main function to build all mappings
 */
async function main() {
  const tenantId = process.env.TENANT_ID || 'your-tenant-id';
  const importDir = path.join(__dirname, '../../import');

  try {
    console.log('Building import mappings...\n');

    // Build user mapping first (doesn't depend on anything)
    const userMapping = await buildUserMapping(tenantId);

    // Build organization mapping
    const orgMapping = await buildOrganizationMapping(
      path.join(importDir, 'Organizations.csv'),
      tenantId
    );

    // Build deal mapping
    const dealMapping = await buildDealMapping(
      path.join(importDir, 'Deals.csv'),
      tenantId,
      orgMapping
    );

    // Save mappings
    await saveMappings(orgMapping, userMapping, dealMapping);

    console.log('\n✓ All mappings built successfully');

  } catch (error) {
    console.error('Failed to build mappings:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { buildOrganizationMapping, buildUserMapping, buildDealMapping };
