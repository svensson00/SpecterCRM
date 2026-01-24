import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface ActivityCSVRow {
  'Subject': string;
  'ID': string;
  'Description': string;
  'Status': string;
  'Start Date': string;
  'Meeting Type': string;
  'Parent Type': string;
  'Parent ID': string;
  'assigned_user_id': string;
  'Assigned to': string;
  'Date Created': string;
  'Date Modified': string;
  'Deleted': string;
}

interface ImportMappings {
  organizations: Map<string, string>; // oldId -> newId
  users: Map<string, string>; // oldIdentifier -> newId
  deals: Map<string, string>; // oldId -> newId
}

interface ImportStats {
  total: number;
  success: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ row: number; reason: string; data: any }>;
  idMapping: Map<string, string>; // oldId -> newId
}

/**
 * Parse date from SuiteCRM format (MM/DD/YYYY HH:mm) to ISO DateTime
 */
function parseSuiteCRMDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;

  try {
    // Format: "08/30/2024 00:00"
    const [datePart, timePart] = dateStr.split(' ');
    const [month, day, year] = datePart.split('/');
    const [hours, minutes] = timePart.split(':');

    return new Date(
      parseInt(year),
      parseInt(month) - 1, // JS months are 0-indexed
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    );
  } catch (error) {
    console.warn(`Failed to parse date: ${dateStr}`, error);
    return null;
  }
}

/**
 * Determine if activity is completed based on status
 */
function isActivityCompleted(status: string): boolean {
  const completedStatuses = ['Held', 'Completed', 'Complete'];
  return completedStatuses.includes(status);
}

/**
 * Map activity type from CSV to standardized type
 */
function mapActivityType(meetingType: string, subject: string): string {
  // If meeting type is provided, use it
  if (meetingType && meetingType !== 'SuiteCRM') {
    return meetingType;
  }

  // Otherwise, try to infer from subject
  const subjectLower = subject.toLowerCase();

  if (subjectLower.includes('call') || subjectLower.includes('phone')) {
    return 'Call';
  }
  if (subjectLower.includes('email')) {
    return 'Email';
  }
  if (subjectLower.includes('meeting') || subjectLower.includes('möte')) {
    return 'Meeting';
  }
  if (subjectLower.includes('task') || subjectLower.includes('todo')) {
    return 'Task';
  }

  // Default to Meeting
  return 'Meeting';
}

/**
 * Resolve organization ID from Parent Type and Parent ID
 */
async function resolveRelatedOrganization(
  parentType: string,
  parentId: string,
  mappings: ImportMappings
): Promise<string | null> {
  // If parent is directly an Account/Organization
  if (parentType === 'Accounts') {
    const newOrgId = mappings.organizations.get(parentId);
    if (newOrgId) {
      return newOrgId;
    }
    console.warn(`Organization not found in mapping for old ID: ${parentId}`);
    return null;
  }

  // If parent is a Deal (Opportunities), get the organization from the deal
  if (parentType === 'Opportunities') {
    const newDealId = mappings.deals.get(parentId);
    if (newDealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: newDealId },
        select: { organizationId: true }
      });
      return deal?.organizationId || null;
    }
    console.warn(`Deal not found in mapping for old ID: ${parentId}`);
    return null;
  }

  // If parent is a Contact, get their primary organization
  if (parentType === 'Contacts') {
    // Note: We'd need a contact mapping for this
    // For now, skip
    console.warn(`Contact parent type not yet supported: ${parentId}`);
    return null;
  }

  return null;
}

/**
 * Import a single activity record
 */
async function importActivity(
  row: ActivityCSVRow,
  rowNumber: number,
  tenantId: string,
  systemUserId: string,
  mappings: ImportMappings
): Promise<{ success: boolean; error?: string; newId?: string; oldId?: string }> {
  try {
    // Skip deleted records
    if (row.Deleted === '1') {
      return { success: false, error: 'Record marked as deleted' };
    }

    // Validate required fields
    if (!row.Subject || row.Subject.trim() === '') {
      return { success: false, error: 'Missing required field: Subject' };
    }

    // Parse dates
    const dueAt = parseSuiteCRMDate(row['Start Date']);
    const createdAt = parseSuiteCRMDate(row['Date Created']);
    const updatedAt = parseSuiteCRMDate(row['Date Modified']);

    // Determine completion status
    const isCompleted = isActivityCompleted(row.Status);
    const completedAt = isCompleted ? dueAt : null;

    // Map activity type
    const activityType = mapActivityType(row['Meeting Type'], row.Subject);

    // Map owner user
    let ownerUserId: string | null = null;
    if (row.assigned_user_id) {
      ownerUserId = mappings.users.get(row.assigned_user_id) || null;
    }
    // Fallback: try username mapping
    if (!ownerUserId && row['Assigned to']) {
      ownerUserId = mappings.users.get(row['Assigned to']) || null;
    }

    // Resolve related organization
    const relatedOrganizationId = await resolveRelatedOrganization(
      row['Parent Type'],
      row['Parent ID'],
      mappings
    );

    // Resolve related deal (if parent is an opportunity)
    let relatedDealId: string | null = null;
    if (row['Parent Type'] === 'Opportunities' && row['Parent ID']) {
      relatedDealId = mappings.deals.get(row['Parent ID']) || null;
    }

    // Create activity
    const activity = await prisma.activity.create({
      data: {
        tenantId,
        type: activityType,
        subject: row.Subject.trim(),
        description: row.Description?.trim() || null,
        dueAt: dueAt,
        isCompleted: isCompleted,
        completedAt: completedAt,
        ownerUserId: ownerUserId,
        relatedOrganizationId: relatedOrganizationId,
        relatedDealId: relatedDealId,
        createdByUserId: systemUserId,
        updatedByUserId: systemUserId,
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
      }
    });

    console.log(`✓ Imported activity ${rowNumber}: ${activity.subject} (${activity.id})`);
    return { success: true, newId: activity.id, oldId: row.ID };

  } catch (error: any) {
    console.error(`✗ Failed to import activity ${rowNumber}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
async function importActivitiesFromCSV(
  csvFilePath: string,
  tenantId: string,
  systemUserId: string,
  mappings: ImportMappings
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: 0,
    success: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    idMapping: new Map()
  };

  // First, collect all rows from the CSV
  const rows: ActivityCSVRow[] = await new Promise((resolve, reject) => {
    const collectedRows: ActivityCSVRow[] = [];

    fs.createReadStream(csvFilePath, { encoding: 'latin1' })
      .pipe(csv({
        skipLines: 0,
        // Strip BOM if present
        mapHeaders: ({ header }: { header: string }) => header.replace(/^\uFEFF/, '')
      }))
      .on('data', (row: ActivityCSVRow) => {
        collectedRows.push(row);
      })
      .on('end', () => {
        resolve(collectedRows);
      })
      .on('error', (error) => {
        reject(error);
      });
  });

  // Now process rows sequentially
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    stats.total++;

    const result = await importActivity(
      row,
      rowNumber,
      tenantId,
      systemUserId,
      mappings
    );

    if (result.success) {
      stats.success++;
      if (result.oldId && result.newId) {
        stats.idMapping.set(result.oldId, result.newId);
      }
    } else if (result.error === 'Record marked as deleted') {
      stats.skipped++;
    } else {
      stats.errors++;
      stats.errorDetails.push({
        row: rowNumber,
        reason: result.error || 'Unknown error',
        data: row
      });
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Total rows: ${stats.total}`);
  console.log(`Successfully imported: ${stats.success}`);
  console.log(`Skipped (deleted): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);

  if (stats.errorDetails.length > 0) {
    console.log('\n=== Error Details ===');
    stats.errorDetails.slice(0, 10).forEach(err => {
      console.log(`Row ${err.row}: ${err.reason}`);
      console.log(`  Subject: ${err.data.Subject}`);
    });
    if (stats.errorDetails.length > 10) {
      console.log(`... and ${stats.errorDetails.length - 10} more errors`);
    }
  }

  console.log(`ID mappings created: ${stats.idMapping.size}`);
  return stats;
}

/**
 * Save ID mapping to file
 */
export async function saveActivityMapping(
  mapping: Map<string, string>,
  outputPath: string
): Promise<void> {
  const mappingObj = Object.fromEntries(mapping);
  fs.writeFileSync(outputPath, JSON.stringify(mappingObj, null, 2));
  console.log(`✓ Saved activity ID mapping to ${outputPath}`);
}

/**
 * Create or ensure activity types exist
 */
async function ensureActivityTypes(tenantId: string): Promise<void> {
  const defaultTypes = ['Call', 'Email', 'Meeting', 'Task', 'Demo'];

  for (const typeName of defaultTypes) {
    await prisma.activityType.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: typeName
        }
      },
      update: {},
      create: {
        tenantId,
        name: typeName,
        isActive: true
      }
    });
  }

  console.log(`✓ Ensured ${defaultTypes.length} activity types exist`);
}

/**
 * Example usage with sample mappings
 */
async function main() {
  const tenantId = 'your-tenant-id'; // Replace with actual tenant ID
  const systemUserId = 'your-admin-user-id'; // Replace with admin user ID

  // Example: Load mappings from previous import steps
  // In reality, these would be loaded from files or database
  const mappings: ImportMappings = {
    organizations: new Map([
      ['3e5f3186-0dbd-0ea0-38db-68f1ff6f0c31', 'new-org-id-1'],
      ['e0b76113-b9bf-af22-b777-68f1ff5d0024', 'new-org-id-2'],
    ]),
    users: new Map([
      ['aa965b03-becb-7821-8519-68ff576136fb', 'new-user-id-1'],
      ['magnussvensson', 'new-user-id-1'],
      ['ebbf2708-f9cb-bff7-195e-68ff579f1d95', 'new-user-id-2'],
      ['borisasadanin', 'new-user-id-2'],
    ]),
    deals: new Map([
      // Add deal mappings if needed
    ])
  };

  try {
    // Ensure activity types exist
    await ensureActivityTypes(tenantId);

    // Import activities
    const csvPath = path.join(__dirname, '../../import/Activities.csv');
    const stats = await importActivitiesFromCSV(
      csvPath,
      tenantId,
      systemUserId,
      mappings
    );

    console.log('\n✓ Import completed successfully');
    console.log(`Success rate: ${((stats.success / stats.total) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export {
  importActivitiesFromCSV,
  ImportMappings,
  ImportStats,
  parseSuiteCRMDate,
  mapActivityType,
  isActivityCompleted
};
