import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface MeetingParticipantCSVRow {
  'ID': string;           // Activity ID (old)
  'Email Address': string;
  'First Name': string;
  'Last Name': string;
  // Second 'ID' column is the Contact ID (old)
}

interface ImportMappings {
  activities: Map<string, string>; // oldActivityId -> newActivityId
  contacts: Map<string, string>;   // oldContactId -> newContactId
}

interface ImportStats {
  total: number;
  success: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ row: number; reason: string; data: any }>;
  linkedActivities: Set<string>;
  linkedContacts: Set<string>;
}

/**
 * Import meeting participants from CSV
 * Links contacts to activities based on the Meetings.csv file
 */
async function importMeetingParticipantsFromCSV(
  csvFilePath: string,
  mappings: ImportMappings
): Promise<ImportStats> {
  const stats: ImportStats = {
    total: 0,
    success: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
    linkedActivities: new Set(),
    linkedContacts: new Set()
  };

  return new Promise((resolve, reject) => {
    let rowNumber = 0;
    const processedPairs = new Set<string>(); // Track activity-contact pairs to avoid duplicates

    // Use latin1 encoding to handle Swedish/European characters
    fs.createReadStream(csvFilePath, { encoding: 'latin1' })
      .pipe(csv({
        skipLines: 0,
        // Map headers - note there are two 'ID' columns
        mapHeaders: ({ header, index }: { header: string; index: number }) => {
          const cleanHeader = header.replace(/^\uFEFF/, '');
          // The second 'ID' column (index 4) is the Contact ID
          if (cleanHeader === 'ID' && index === 4) {
            return 'Contact ID';
          }
          return cleanHeader;
        }
      }))
      .on('data', async (row: any) => {
        rowNumber++;
        stats.total++;

        const oldActivityId = row['ID'];
        const oldContactId = row['Contact ID'];
        const email = row['Email Address'];
        const firstName = row['First Name'];
        const lastName = row['Last Name'];

        // Skip rows with empty activity ID or contact ID
        if (!oldActivityId || oldActivityId.trim() === '') {
          stats.skipped++;
          return;
        }

        if (!oldContactId || oldContactId.trim() === '') {
          // Log only if there's meaningful contact info but no ID
          if (email || firstName || lastName) {
            console.warn(`Row ${rowNumber}: Contact has no ID (${firstName} ${lastName} <${email}>), skipping`);
          }
          stats.skipped++;
          return;
        }

        // Look up the new activity ID
        const newActivityId = mappings.activities.get(oldActivityId);
        if (!newActivityId) {
          stats.errors++;
          stats.errorDetails.push({
            row: rowNumber,
            reason: `Activity not found in mapping: ${oldActivityId}`,
            data: row
          });
          return;
        }

        // Look up the new contact ID
        const newContactId = mappings.contacts.get(oldContactId);
        if (!newContactId) {
          stats.errors++;
          stats.errorDetails.push({
            row: rowNumber,
            reason: `Contact not found in mapping: ${oldContactId} (${firstName} ${lastName})`,
            data: row
          });
          return;
        }

        // Check if this pair has already been processed (avoid duplicates)
        const pairKey = `${newActivityId}:${newContactId}`;
        if (processedPairs.has(pairKey)) {
          stats.skipped++;
          return;
        }
        processedPairs.add(pairKey);

        try {
          // Check if the link already exists
          const existing = await prisma.activityContact.findUnique({
            where: {
              activityId_contactId: {
                activityId: newActivityId,
                contactId: newContactId
              }
            }
          });

          if (existing) {
            stats.skipped++;
            return;
          }

          // Create the activity-contact link
          await prisma.activityContact.create({
            data: {
              activityId: newActivityId,
              contactId: newContactId
            }
          });

          stats.success++;
          stats.linkedActivities.add(newActivityId);
          stats.linkedContacts.add(newContactId);

          console.log(`✓ Row ${rowNumber}: Linked contact ${firstName} ${lastName} to activity ${newActivityId}`);

        } catch (error: any) {
          // Handle unique constraint violation (shouldn't happen with our check, but just in case)
          if (error.code === 'P2002') {
            stats.skipped++;
          } else {
            stats.errors++;
            stats.errorDetails.push({
              row: rowNumber,
              reason: error.message,
              data: row
            });
          }
        }
      })
      .on('end', () => {
        console.log('\n=== Meeting Participants Import Summary ===');
        console.log(`Total rows: ${stats.total}`);
        console.log(`Successfully linked: ${stats.success}`);
        console.log(`Skipped (duplicates/empty): ${stats.skipped}`);
        console.log(`Errors: ${stats.errors}`);
        console.log(`Unique activities with participants: ${stats.linkedActivities.size}`);
        console.log(`Unique contacts linked: ${stats.linkedContacts.size}`);

        if (stats.errorDetails.length > 0) {
          console.log('\n=== Error Details ===');
          stats.errorDetails.slice(0, 10).forEach(err => {
            console.log(`Row ${err.row}: ${err.reason}`);
          });
          if (stats.errorDetails.length > 10) {
            console.log(`... and ${stats.errorDetails.length - 10} more errors`);
          }
        }

        resolve(stats);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Load ID mapping from JSON file
 */
function loadMapping(filePath: string): Map<string, string> {
  if (!fs.existsSync(filePath)) {
    console.warn(`Mapping file not found: ${filePath}`);
    return new Map();
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return new Map(Object.entries(data));
}

/**
 * Main function for standalone execution
 */
async function main() {
  const args = process.argv.slice(2);

  let importDir = process.env.IMPORT_DIR || '';
  let mappingsDir = '';

  for (const arg of args) {
    if (arg.startsWith('--import-dir=')) {
      importDir = arg.split('=')[1];
    }
  }

  if (!importDir) {
    importDir = require('path').join(__dirname, '../../../import');
  }

  mappingsDir = require('path').join(importDir, 'mappings');

  console.log('='.repeat(70));
  console.log('Meeting Participants Import');
  console.log('='.repeat(70));
  console.log(`Import directory: ${importDir}`);
  console.log(`Mappings directory: ${mappingsDir}`);

  try {
    // Load mappings
    console.log('\nLoading ID mappings...');
    const activityMapping = loadMapping(require('path').join(mappingsDir, 'activities.json'));
    const contactMapping = loadMapping(require('path').join(mappingsDir, 'contacts.json'));

    console.log(`  Activities mapping: ${activityMapping.size} entries`);
    console.log(`  Contacts mapping: ${contactMapping.size} entries`);

    if (activityMapping.size === 0 || contactMapping.size === 0) {
      console.error('\n❌ Error: Mappings are empty. Please run the full import first.');
      process.exit(1);
    }

    // Import meeting participants
    const csvPath = require('path').join(importDir, 'Meetings.csv');

    if (!fs.existsSync(csvPath)) {
      console.log(`\n⚠️  Meetings.csv not found at ${csvPath}`);
      console.log('Skipping meeting participants import.');
      return;
    }

    console.log(`\nImporting from: ${csvPath}`);

    const stats = await importMeetingParticipantsFromCSV(
      csvPath,
      {
        activities: activityMapping,
        contacts: contactMapping
      }
    );

    console.log('\n✓ Import completed');
    console.log(`Success rate: ${((stats.success / (stats.total - stats.skipped)) * 100).toFixed(1)}%`);

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
  importMeetingParticipantsFromCSV,
  loadMapping,
  ImportMappings,
  ImportStats
};
