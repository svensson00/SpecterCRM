import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface ContactCSVRow {
  'First Name': string;
  'Last Name': string;
  'ID': string;
  'Job Title': string;
  'Account Name': string;
  'Email Address': string;
  'Non Primary E-mails': string;
  'Mobile': string;
  'Office Phone': string;
  'Home': string;
  'Other Phone': string;
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
    const [datePart, timePart] = dateStr.split(' ');
    const [month, day, year] = datePart.split('/');
    const [hours, minutes] = (timePart || '00:00').split(':');

    return new Date(
      parseInt(year),
      parseInt(month) - 1,
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
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse comma-separated emails
 */
function parseEmails(emailString: string): string[] {
  if (!emailString || emailString.trim() === '') return [];

  return emailString
    .split(',')
    .map(e => e.trim())
    .filter(e => e && isValidEmail(e));
}

/**
 * Clean phone number (basic cleanup)
 */
function cleanPhone(phone: string): string | null {
  if (!phone || phone.trim() === '') return null;
  return phone.trim();
}

/**
 * Find organization by name
 */
async function findOrganizationByName(
  accountName: string,
  tenantId: string,
  _orgMapping: Map<string, string>
): Promise<string | null> {
  if (!accountName || accountName.trim() === '') return null;

  // Try direct lookup in database
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
 * Import a single contact record
 */
async function importContact(
  row: ContactCSVRow,
  rowNumber: number,
  tenantId: string,
  systemUserId: string,
  mappings: ImportMappings
): Promise<{ success: boolean; newId?: string; error?: string }> {
  try {
    // Skip deleted records
    if (row.Deleted === '1') {
      return { success: false, error: 'Record marked as deleted' };
    }

    // Validate required fields
    if (!row['First Name'] || row['First Name'].trim() === '') {
      return { success: false, error: 'Missing required field: First Name' };
    }
    if (!row['Last Name'] || row['Last Name'].trim() === '') {
      return { success: false, error: 'Missing required field: Last Name' };
    }
    if (!row['Account Name'] || row['Account Name'].trim() === '') {
      return { success: false, error: 'Missing required field: Account Name' };
    }

    // Find organization
    const organizationId = await findOrganizationByName(
      row['Account Name'],
      tenantId,
      mappings.organizations
    );

    if (!organizationId) {
      return { success: false, error: `Organization not found: ${row['Account Name']}` };
    }

    // Parse dates
    const createdAt = parseSuiteCRMDate(row['Date Created']);
    const updatedAt = parseSuiteCRMDate(row['Date Modified']);

    // Map owner user
    let ownerUserId: string | null = null;
    if (row['Assigned User']) {
      ownerUserId = mappings.users.get(row['Assigned User']) || null;
    }
    if (!ownerUserId && row['Assigned to']) {
      ownerUserId = mappings.users.get(row['Assigned to']) || null;
    }

    // Prepare emails
    const primaryEmail = row['Email Address']?.trim();
    const nonPrimaryEmails = parseEmails(row['Non Primary E-mails']);

    const emails: Array<{ email: string; isPrimary: boolean }> = [];
    if (primaryEmail && isValidEmail(primaryEmail)) {
      emails.push({ email: primaryEmail, isPrimary: true });
    }
    nonPrimaryEmails.forEach(email => {
      if (email !== primaryEmail) { // Avoid duplicates
        emails.push({ email, isPrimary: false });
      }
    });

    // Prepare phones
    const phones: Array<{ phone: string; type: string; isPrimary: boolean }> = [];

    const mobile = cleanPhone(row.Mobile);
    if (mobile) {
      phones.push({ phone: mobile, type: 'Mobile', isPrimary: true });
    }

    const office = cleanPhone(row['Office Phone']);
    if (office) {
      phones.push({ phone: office, type: 'Office', isPrimary: !mobile });
    }

    const home = cleanPhone(row.Home);
    if (home) {
      phones.push({ phone: home, type: 'Home', isPrimary: false });
    }

    const other = cleanPhone(row['Other Phone']);
    if (other) {
      phones.push({ phone: other, type: 'Other', isPrimary: false });
    }

    // Create contact with emails and phones in a transaction
    const contact = await prisma.$transaction(async (tx) => {
      const newContact = await tx.contact.create({
        data: {
          tenantId,
          firstName: row['First Name'].trim(),
          lastName: row['Last Name'].trim(),
          jobTitle: row['Job Title']?.trim() || null,
          contactRole: null, // We'll map this if you have role data
          primaryOrganizationId: organizationId,
          ownerUserId: ownerUserId,
          createdByUserId: systemUserId,
          updatedByUserId: systemUserId,
          createdAt: createdAt || new Date(),
          updatedAt: updatedAt || new Date(),
        }
      });

      // Create email records
      if (emails.length > 0) {
        await tx.contactEmail.createMany({
          data: emails.map(e => ({
            contactId: newContact.id,
            email: e.email,
            isPrimary: e.isPrimary
          }))
        });
      }

      // Create phone records
      if (phones.length > 0) {
        await tx.contactPhone.createMany({
          data: phones.map(p => ({
            contactId: newContact.id,
            phone: p.phone,
            type: p.type,
            isPrimary: p.isPrimary
          }))
        });
      }

      return newContact;
    });

    console.log(`✓ Imported contact ${rowNumber}: ${contact.firstName} ${contact.lastName} (${contact.id}) - ${emails.length} emails, ${phones.length} phones`);
    return { success: true, newId: contact.id };

  } catch (error: any) {
    console.error(`✗ Failed to import contact ${rowNumber}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main import function
 */
export async function importContactsFromCSV(
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

  const rows: ContactCSVRow[] = [];

  // First, read all rows
  // Use latin1 encoding to handle Swedish/European characters (ö, ä, å, etc.)
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(csvFilePath, { encoding: 'latin1' })
      .pipe(csv({
        skipLines: 0,
        // Strip BOM if present
        mapHeaders: ({ header }: { header: string }) => header.replace(/^\uFEFF/, '')
      }))
      .on('data', (row: ContactCSVRow) => {
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

    const result = await importContact(
      row,
      rowNumber,
      tenantId,
      systemUserId,
      mappings
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

  console.log('\n=== Contacts Import Summary ===');
  console.log(`Total rows: ${stats.total}`);
  console.log(`Successfully imported: ${stats.success}`);
  console.log(`Skipped (deleted): ${stats.skipped}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`ID mappings created: ${stats.idMapping.size}`);

  if (stats.errorDetails.length > 0) {
    console.log('\n=== Error Details ===');
    stats.errorDetails.slice(0, 10).forEach(err => {
      console.log(`Row ${err.row}: ${err.reason}`);
      console.log(`  Name: ${err.data['First Name']} ${err.data['Last Name']}`);
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
export async function saveContactMapping(
  mapping: Map<string, string>,
  outputPath: string
): Promise<void> {
  const mappingObj = Object.fromEntries(mapping);
  fs.writeFileSync(outputPath, JSON.stringify(mappingObj, null, 2));
  console.log(`✓ Saved contact ID mapping to ${outputPath}`);
}
