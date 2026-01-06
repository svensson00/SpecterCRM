import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface OrganizationCSVRow {
  'Name': string;
  'ID': string;
  'Website': string;
  'Billing Street': string;
  'Billing City': string;
  'Billing Postal Code': string;
  'Billing Country': string;
  'Assigned to': string;
  'Assigned User': string;
  'Date Created': string;
  'Date Modified': string;
  'Deleted': string;
}

interface UserMapping {
  users: Map<string, string>;
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
 * Parse date from SuiteCRM format
 */
function parseSuiteCRMDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;

  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [month, day, year] = datePart.split('/');
    const [hours, minutes] = timePart.split(':');

    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours || '0'),
      parseInt(minutes || '0')
    );
  } catch (error) {
    console.warn(`Failed to parse date: ${dateStr}`, error);
    return null;
  }
}

/**
 * Import a single organization record
 */
async function importOrganization(
  row: OrganizationCSVRow,
  rowNumber: number,
  tenantId: string,
  systemUserId: string,
  userMapping: UserMapping
): Promise<{ success: boolean; newId?: string; error?: string }> {
  try {
    // Skip deleted records
    if (row.Deleted === '1') {
      return { success: false, error: 'Record marked as deleted' };
    }

    // Validate required fields
    if (!row.Name || row.Name.trim() === '') {
      return { success: false, error: 'Missing required field: Name' };
    }

    // Check if organization already exists (by name in tenant)
    const existing = await prisma.organization.findFirst({
      where: {
        tenantId,
        name: row.Name.trim()
      }
    });

    if (existing) {
      console.log(`⊘ Organization already exists (row ${rowNumber}): ${row.Name}`);
      return { success: false, newId: existing.id, error: 'Already exists' };
    }

    // Parse dates
    const createdAt = parseSuiteCRMDate(row['Date Created']);
    const updatedAt = parseSuiteCRMDate(row['Date Modified']);

    // Map owner user
    let ownerUserId: string | null = null;
    if (row['Assigned User']) {
      ownerUserId = userMapping.users.get(row['Assigned User']) || null;
    }
    if (!ownerUserId && row['Assigned to']) {
      ownerUserId = userMapping.users.get(row['Assigned to']) || null;
    }

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        tenantId,
        name: row.Name.trim(),
        website: row.Website?.trim() || null,
        street: row['Billing Street']?.trim() || null,
        city: row['Billing City']?.trim() || null,
        zip: row['Billing Postal Code']?.trim() || null,
        country: row['Billing Country']?.trim() || null,
        ownerUserId: ownerUserId,
        createdByUserId: systemUserId,
        updatedByUserId: systemUserId,
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
      }
    });

    console.log(`✓ Imported organization ${rowNumber}: ${organization.name} (${organization.id})`);
    return { success: true, newId: organization.id };

  } catch (error: any) {
    console.error(`✗ Failed to import organization ${rowNumber}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
export async function importOrganizationsFromCSV(
  csvFilePath: string,
  tenantId: string,
  systemUserId: string,
  userMapping: UserMapping
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: 0,
    success: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    idMapping: new Map()
  };

  const rows: OrganizationCSVRow[] = [];

  // First, read all rows
  // Use latin1 encoding to handle Swedish/European characters (ö, ä, å, etc.)
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath, { encoding: 'latin1' })
      .pipe(csv({
        skipLines: 0,
        // Strip BOM if present
        mapHeaders: ({ header }: { header: string }) => header.replace(/^\uFEFF/, '')
      }))
      .on('data', (row: OrganizationCSVRow) => {
        rows.push(row);
      })
      .on('end', () => resolve())
      .on('error', reject);
  });

  // Then process sequentially
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    stats.total++;

    const result = await importOrganization(
      row,
      rowNumber,
      tenantId,
      systemUserId,
      userMapping
    );

    if (result.success) {
      stats.success++;
      if (result.newId && row.ID) {
        stats.idMapping.set(row.ID, result.newId);
      }
    } else if (result.error === 'Record marked as deleted') {
      stats.skipped++;
    } else if (result.error === 'Already exists' && result.newId) {
      stats.skipped++;
      // Still add to mapping for reference
      if (row.ID) {
        stats.idMapping.set(row.ID, result.newId);
      }
    } else {
      stats.errors++;
      stats.errorDetails.push({
        row: rowNumber,
        reason: result.error || 'Unknown error',
        data: row
      });
    }
  }

  console.log('\n=== Organizations Import Summary ===');
  console.log(`Total rows: ${stats.total}`);
  console.log(`Successfully imported: ${stats.success}`);
  console.log(`Skipped (deleted/existing): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`ID mappings created: ${stats.idMapping.size}`);

  if (stats.errorDetails.length > 0) {
    console.log('\n=== Error Details ===');
    stats.errorDetails.slice(0, 10).forEach(err => {
      console.log(`Row ${err.row}: ${err.reason}`);
      console.log(`  Name: ${err.data.Name}`);
    });
    if (stats.errorDetails.length > 10) {
      console.log(`... and ${stats.errorDetails.length - 10} more errors`);
    }
  }

  return stats;
}

/**
 * Save ID mapping to file
 */
export async function saveOrganizationMapping(
  mapping: Map<string, string>,
  outputPath: string
): Promise<void> {
  const mappingObj = Object.fromEntries(mapping);
  fs.writeFileSync(outputPath, JSON.stringify(mappingObj, null, 2));
  console.log(`✓ Saved organization ID mapping to ${outputPath}`);
}
