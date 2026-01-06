import { PrismaClient, DealStage } from '@prisma/client';
import * as fs from 'fs';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface DealCSVRow {
  'Opportunity Name': string;
  'ID': string;
  'Account Name': string;
  'Opportunity Amount': string;
  'Amount': string;
  'Currency': string;
  'Expected Close Date': string;
  'Sales Stage': string;
  'Probability (%)': string;
  'lostreason': string;
  'Assigned to': string;
  'Assigned User': string;
  'Date Created': string;
  'Date Modified': string;
  'Deleted': string;
}

interface ImportMappings {
  organizations: Map<string, string>;
  users: Map<string, string>;
}

interface ImportStats {
  total: number;
  success: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ row: number; reason: string; data: any }>;
  idMapping: Map<string, string>;
}

/**
 * Parse date from SuiteCRM format
 */
function parseSuiteCRMDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;

  try {
    const [datePart] = dateStr.split(' ');
    const [month, day, year] = datePart.split('/');

    // For expected close date, we don't need time
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day)
    );
  } catch (error) {
    console.warn(`Failed to parse date: ${dateStr}`, error);
    return null;
  }
}

/**
 * Parse currency amount from SuiteCRM format
 * Examples: "SE0,00", "USD1000.50", "1000"
 */
function parseAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === '') return 0;

  try {
    // Remove currency codes (2-3 letter codes at start)
    let cleaned = amountStr.replace(/^[A-Z]{2,3}/, '');

    // Replace comma with dot for decimal
    cleaned = cleaned.replace(',', '.');

    // Remove any spaces
    cleaned = cleaned.replace(/\s/g, '');

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  } catch (error) {
    console.warn(`Failed to parse amount: ${amountStr}`, error);
    return 0;
  }
}

/**
 * Map SuiteCRM sales stage to DealStage enum
 */
function mapSalesStage(salesStage: string): DealStage {
  if (!salesStage) return DealStage.LEAD;

  const stageLower = salesStage.toLowerCase();

  // Closed Won
  if (stageLower.includes('closed won') || stageLower.includes('won')) {
    return DealStage.WON;
  }

  // Closed Lost
  if (stageLower.includes('closed lost') || stageLower.includes('lost')) {
    return DealStage.LOST;
  }

  // Prospect/Qualification
  if (stageLower.includes('prospect') || stageLower.includes('qualification')) {
    return DealStage.PROSPECT;
  }

  // Quote/Proposal/Negotiation
  if (
    stageLower.includes('quote') ||
    stageLower.includes('proposal') ||
    stageLower.includes('negotiation')
  ) {
    return DealStage.QUOTE;
  }

  // Default to LEAD
  return DealStage.LEAD;
}

/**
 * Extract currency code from amount or currency field
 */
function extractCurrency(currencyField: string, amountField: string, defaultCurrency: string): string {
  // Check currency field first
  if (currencyField && currencyField !== "'-99" && currencyField.length === 3) {
    return currencyField.toUpperCase();
  }

  // Try to extract from amount string (e.g., "SE0,00" -> "SE")
  if (amountField) {
    const match = amountField.match(/^([A-Z]{2,3})/);
    if (match) {
      return match[1];
    }
  }

  // Fallback to default
  return defaultCurrency;
}

/**
 * Find organization by name
 */
async function findOrganizationByName(
  accountName: string,
  tenantId: string
): Promise<string | null> {
  if (!accountName || accountName.trim() === '') return null;

  const org = await prisma.organization.findFirst({
    where: {
      tenantId,
      name: accountName.trim()
    },
    select: { id: true }
  });

  return org?.id || null;
}

/**
 * Import a single deal record
 */
async function importDeal(
  row: DealCSVRow,
  rowNumber: number,
  tenantId: string,
  systemUserId: string,
  mappings: ImportMappings,
  defaultCurrency: string
): Promise<{ success: boolean; newId?: string; error?: string }> {
  try {
    // Skip deleted records
    if (row.Deleted === '1') {
      return { success: false, error: 'Record marked as deleted' };
    }

    // Validate required fields
    if (!row['Opportunity Name'] || row['Opportunity Name'].trim() === '') {
      return { success: false, error: 'Missing required field: Opportunity Name' };
    }
    if (!row['Account Name'] || row['Account Name'].trim() === '') {
      return { success: false, error: 'Missing required field: Account Name' };
    }

    // Find organization
    const organizationId = await findOrganizationByName(row['Account Name'], tenantId);

    if (!organizationId) {
      return { success: false, error: `Organization not found: ${row['Account Name']}` };
    }

    // Parse dates
    const expectedCloseDate = parseSuiteCRMDate(row['Expected Close Date']);
    const createdAt = parseSuiteCRMDate(row['Date Created']);
    const updatedAt = parseSuiteCRMDate(row['Date Modified']);

    // Parse amount (try both fields)
    const amountStr = row['Opportunity Amount'] || row['Amount'] || '';
    const amount = parseAmount(amountStr);

    // Extract currency
    const currency = extractCurrency(row.Currency, amountStr, defaultCurrency);

    // Map sales stage
    const stage = mapSalesStage(row['Sales Stage']);

    // Parse probability
    let probability = 50; // Default
    if (row['Probability (%)']) {
      const parsed = parseInt(row['Probability (%)']);
      if (!isNaN(parsed)) {
        probability = Math.max(0, Math.min(100, parsed));
      }
    }

    // Get reason lost if applicable
    const reasonLost = stage === DealStage.LOST ? row.lostreason?.trim() || null : null;

    // Map owner user
    let ownerUserId: string | null = null;
    if (row['Assigned User']) {
      ownerUserId = mappings.users.get(row['Assigned User']) || null;
    }
    if (!ownerUserId && row['Assigned to']) {
      ownerUserId = mappings.users.get(row['Assigned to']) || null;
    }

    // Create deal
    const deal = await prisma.deal.create({
      data: {
        tenantId,
        title: row['Opportunity Name'].trim(),
        organizationId: organizationId,
        amount: amount,
        currency: currency,
        expectedCloseDate: expectedCloseDate,
        stage: stage,
        probability: probability,
        reasonLost: reasonLost,
        ownerUserId: ownerUserId,
        createdByUserId: systemUserId,
        updatedByUserId: systemUserId,
        createdAt: createdAt || new Date(),
        updatedAt: updatedAt || new Date(),
      }
    });

    console.log(`✓ Imported deal ${rowNumber}: ${deal.title} (${deal.id}) - ${currency} ${amount}, Stage: ${stage}`);
    return { success: true, newId: deal.id };

  } catch (error: any) {
    console.error(`✗ Failed to import deal ${rowNumber}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
export async function importDealsFromCSV(
  csvFilePath: string,
  tenantId: string,
  systemUserId: string,
  mappings: ImportMappings,
  defaultCurrency: string = 'USD'
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: 0,
    success: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    idMapping: new Map()
  };

  const rows: DealCSVRow[] = [];

  // First, read all rows
  // Use latin1 encoding to handle Swedish/European characters (ö, ä, å, etc.)
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath, { encoding: 'latin1' })
      .pipe(csv({
        skipLines: 0,
        // Strip BOM if present
        mapHeaders: ({ header }: { header: string }) => header.replace(/^\uFEFF/, '')
      }))
      .on('data', (row: DealCSVRow) => {
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

    const result = await importDeal(
      row,
      rowNumber,
      tenantId,
      systemUserId,
      mappings,
      defaultCurrency
    );

    if (result.success) {
      stats.success++;
      if (result.newId && row.ID) {
        stats.idMapping.set(row.ID, result.newId);
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

  console.log('\n=== Deals Import Summary ===');
  console.log(`Total rows: ${stats.total}`);
  console.log(`Successfully imported: ${stats.success}`);
  console.log(`Skipped (deleted): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`ID mappings created: ${stats.idMapping.size}`);

  if (stats.errorDetails.length > 0) {
    console.log('\n=== Error Details ===');
    stats.errorDetails.slice(0, 10).forEach(err => {
      console.log(`Row ${err.row}: ${err.reason}`);
      console.log(`  Title: ${err.data['Opportunity Name']}`);
      console.log(`  Organization: ${err.data['Account Name']}`);
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
export async function saveDealMapping(
  mapping: Map<string, string>,
  outputPath: string
): Promise<void> {
  const mappingObj = Object.fromEntries(mapping);
  fs.writeFileSync(outputPath, JSON.stringify(mappingObj, null, 2));
  console.log(`✓ Saved deal ID mapping to ${outputPath}`);
}
