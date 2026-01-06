# SpecterCRM Data Import Guide

Complete guide for importing SuiteCRM data into SpecterCRM.

## Overview

This directory contains CSV files exported from SuiteCRM and scripts to import them into your SpecterCRM instance.

**Total Records:**
- Organizations: ~741 records
- Contacts: ~2,183 records (with emails and phones)
- Deals: ~706 records
- Activities: ~2,467 records

**Estimated Import Time:** 5-15 minutes depending on hardware

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Get Your Tenant and User IDs

```bash
# Start the backend if not running
npm run dev

# In another terminal, use Prisma Studio
npm run db:studio
```

In Prisma Studio:
- Find your **Tenant** → Copy the ID
- Find your **User** (must be an admin) → Copy the ID

### 3. Run the Import

```bash
# Using environment variables (recommended)
TENANT_ID=your-tenant-id ADMIN_USER_ID=your-user-id npm run import

# Or with command-line arguments
npm run import -- --tenant=your-tenant-id --user=your-user-id
```

**Note**: The import will show you the **field mappings** (CSV columns → SpecterCRM fields) and **user mappings** (SuiteCRM users → SpecterCRM users) and ask for confirmation before proceeding. Review the mappings carefully and type `y` to continue or `n` to cancel.

### Advanced Usage (Cloud/Docker)

For cloud deployments or custom file locations:

```bash
# Custom import directory
IMPORT_DIR=/custom/path TENANT_ID=xxx ADMIN_USER_ID=yyy npm run import

# Remote database
DATABASE_URL="postgresql://..." TENANT_ID=xxx ADMIN_USER_ID=yyy npm run import

# See "Cloud & Docker Deployment" section below for detailed examples
```

### 4. Verify Import

After import completes, verify your data:
```bash
npm run db:studio
```

## UTF-8 and International Character Support

The import script fully supports UTF-8 encoding and international characters. CSV files are read with UTF-8 encoding, ensuring proper handling of:
- Accented characters (é, ñ, ü, etc.)
- Scandinavian characters (å, ä, ö, æ, ø)
- Cyrillic, Greek, Arabic, Chinese, Japanese, Korean, and other Unicode characters
- Special symbols and emojis

**Important:** Ensure your CSV files are saved with UTF-8 encoding:
- **Excel (Windows)**: Save as "CSV UTF-8 (Comma delimited)"
- **Excel (Mac)**: Save as "CSV UTF-8"
- **Google Sheets**: File → Download → CSV will automatically use UTF-8
- **LibreOffice/OpenOffice**: Save with "Unicode (UTF-8)" encoding

If you see garbled characters after import, your CSV file may be using a different encoding (like Windows-1252 or ISO-8859-1). Re-export it with UTF-8 encoding.

## Cloud & Docker Deployment

The import script is flexible and can run in various environments:

### Running with Custom Import Directory

If your CSV files are in a different location:

```bash
# Using command-line argument
npm run import -- --tenant=xxx --user=yyy --import-dir=/path/to/csv/files

# Using environment variable
IMPORT_DIR=/path/to/csv/files TENANT_ID=xxx ADMIN_USER_ID=yyy npm run import
```

### Running in Docker Container

When backend is running in a Docker container:

1. **Copy CSV files to container** (or mount a volume):
```bash
# Option 1: Copy files
docker cp ./import backend-container:/tmp/import

# Option 2: Mount volume (in docker-compose.yml)
volumes:
  - ./import:/data/import
```

2. **Run import inside container**:
```bash
# Using npm script (from backend directory)
docker exec -it backend-container sh
cd /app/backend
IMPORT_DIR=/tmp/import TENANT_ID=xxx ADMIN_USER_ID=yyy npm run import

# Or using standalone script (from anywhere)
docker exec -it backend-container node /app/backend/import-standalone.js \
  --tenant=xxx --user=yyy --import-dir=/tmp/import
```

### Running Against Remote Database

When connecting to a cloud-hosted database:

```bash
# Set DATABASE_URL to point to your remote database
DATABASE_URL="postgresql://user:pass@remote-host:5432/db" \
TENANT_ID=xxx \
ADMIN_USER_ID=yyy \
IMPORT_DIR=/local/path/to/csv \
npm run import
```

**Example for remote PostgreSQL:**
```bash
DATABASE_URL="postgresql://myuser:mypass@db.example.com:5432/spectercrm?schema=public" \
TENANT_ID=cm5abc123 \
ADMIN_USER_ID=cm5def456 \
IMPORT_DIR=/Users/me/csv-exports \
npm run import
```

### Connection Testing

The script automatically tests the database connection before starting. If connection fails, it will show:
- Connection error details
- Troubleshooting steps
- Host information (without exposing credentials)

### Environment Variables Summary

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes* | PostgreSQL connection string | `postgresql://...` |
| `TENANT_ID` | Yes | Target tenant ID | `cm5abc123` |
| `ADMIN_USER_ID` | Yes | Admin user ID performing import | `cm5def456` |
| `IMPORT_DIR` | No | Directory containing CSV files | `/data/import` |

*Required unless already set in backend `.env` file

### Standalone Script

For maximum flexibility, a standalone script is available at `backend/import-standalone.js`:

```bash
# Make it executable (first time only)
chmod +x backend/import-standalone.js

# Run from anywhere
cd /any/directory
/path/to/backend/import-standalone.js \
  --tenant=xxx \
  --user=yyy \
  --import-dir=/path/to/csv

# Or with environment variables
DATABASE_URL="postgresql://..." \
TENANT_ID=xxx \
ADMIN_USER_ID=yyy \
IMPORT_DIR=/path/to/csv \
node /path/to/backend/import-standalone.js
```

Benefits:
- Can run from any directory
- Works in CI/CD pipelines
- Perfect for automated imports
- No need to cd into backend directory

## Field Mappings Reference

Before running the import, you can review these field mappings. The import script will also display these for confirmation.

### Organizations CSV Columns
| CSV Column | SpecterCRM Field | Notes |
|------------|-----------------|-------|
| Name | name | Required, must be unique per tenant |
| Website | website | |
| Billing Address Street | address | |
| Billing Address City | city | |
| Billing Address Postalcode | zip | |
| Billing Address Country | country | |
| Assigned User | ownerUserId | Mapped via user mapping |
| Date Created | createdAt | Parsed from MM/DD/YYYY HH:mm |
| Date Modified | updatedAt | Parsed from MM/DD/YYYY HH:mm |
| Deleted | (skipped) | Records with Deleted=1 are skipped |

### Contacts CSV Columns
| CSV Column | SpecterCRM Field | Notes |
|------------|-----------------|-------|
| First Name | firstName | Required |
| Last Name | lastName | Required |
| Job Title | jobTitle | |
| Account Name | primaryOrganizationId | Looked up by organization name |
| Email Address | contactEmails | Created with isPrimary: true |
| Non Primary E-mails | contactEmails | Created with isPrimary: false |
| Mobile | contactPhones | Type: Mobile, isPrimary: true |
| Office Phone | contactPhones | Type: Office |
| Home | contactPhones | Type: Home |
| Other Phone | contactPhones | Type: Other |
| Assigned User | ownerUserId | Mapped via user mapping |
| Date Created | createdAt | Parsed from MM/DD/YYYY HH:mm |
| Date Modified | updatedAt | Parsed from MM/DD/YYYY HH:mm |
| Deleted | (skipped) | Records with Deleted=1 are skipped |

### Deals CSV Columns
| CSV Column | SpecterCRM Field | Notes |
|------------|-----------------|-------|
| Opportunity Name | title | Required |
| Account Name | organizationId | Looked up by organization name |
| Opportunity Amount | amount | Parsed: "SE0,00" → 0.00 |
| Currency | currency | Extracted from amount string or field |
| Expected Close Date | expectedCloseDate | Parsed from MM/DD/YYYY |
| Sales Stage | stage | Mapped to enum (see below) |
| Probability (%) | probability | 0-100 |
| lostreason | reasonLost | Only if stage = LOST |
| Assigned User | ownerUserId | Mapped via user mapping |
| Date Created | createdAt | Parsed from MM/DD/YYYY HH:mm |
| Date Modified | updatedAt | Parsed from MM/DD/YYYY HH:mm |
| Deleted | (skipped) | Records with Deleted=1 are skipped |

**Sales Stage Mapping:**
- "Closed Won" → WON
- "Closed Lost" → LOST
- "Prospecting", "Qualification" → PROSPECT
- "Proposal", "Negotiation" → QUOTE
- Other → LEAD

### Activities CSV Columns
| CSV Column | SpecterCRM Field | Notes |
|------------|-----------------|-------|
| Subject | subject | Required |
| Description | description | |
| Meeting Type | type | Inferred from subject if empty |
| Due Date | dueAt | Parsed from MM/DD/YYYY HH:mm |
| Status | isCompleted | "Held"/"Completed" → true |
| Account Name | organizationId | Looked up by organization name |
| Related Opportunity | dealId | Looked up via deal ID mapping |
| Assigned User | ownerUserId | Mapped via user mapping |
| Date Created | createdAt | Parsed from MM/DD/YYYY HH:mm |
| Date Modified | updatedAt | Parsed from MM/DD/YYYY HH:mm |
| Deleted | (skipped) | Records with Deleted=1 are skipped |

**Activity Type Inference (when Meeting Type is empty):**
- Subject contains "call", "phone" → Call
- Subject contains "email" → Email
- Subject contains "meeting", "möte" → Meeting
- Subject contains "task", "todo" → Task
- Default → Meeting

## What Gets Imported

### Organizations (741 records)
- ✅ Name (required, unique per tenant)
- ✅ Website
- ✅ Address (street, city, zip, country)
- ✅ Owner assignment
- ✅ Created/updated timestamps

### Contacts (2,183 records)
- ✅ First and last name
- ✅ Job title
- ✅ Primary organization link
- ✅ Email addresses (primary + non-primary)
- ✅ Phone numbers (mobile, office, home, other)
- ✅ Owner assignment
- ✅ Created/updated timestamps

### Deals (706 records)
- ✅ Title
- ✅ Organization link
- ✅ Amount and currency
- ✅ Expected close date
- ✅ Sales stage (mapped to: LEAD, PROSPECT, QUOTE, WON, LOST)
- ✅ Probability
- ✅ Reason lost (if applicable)
- ✅ Owner assignment
- ✅ Created/updated timestamps

### Activities (2,467 records)
- ✅ Subject and description
- ✅ Type (Call, Email, Meeting, Task)
- ✅ Due date
- ✅ Completion status
- ✅ Related organization
- ✅ Related deal
- ✅ Owner assignment
- ✅ Created/updated timestamps

## Import Process Details

The import runs in 5 steps:

### Step 1: Build User Mappings
- Automatically maps SuiteCRM usernames to your SpecterCRM users
- Default mappings in `run-import.ts` (customize if needed)
- **Interactive Review**: Displays all mappings and prompts for confirmation before proceeding
- You can cancel at this point if mappings need adjustment

### Step 2: Import Organizations
- Creates organization records
- Saves old ID → new ID mapping
- Skips duplicates (by name)
- Skips deleted records

### Step 3: Import Contacts
- Links to organizations from Step 2
- Creates email records (separate table)
- Creates phone records (separate table)
- Validates email addresses
- Skips if organization not found

### Step 4: Import Deals
- Links to organizations from Step 2
- Parses currency amounts (handles "SE0,00" format)
- Maps sales stages to enum
- Uses tenant default currency as fallback

### Step 5: Import Activities
- Links to organizations and deals
- Infers activity type from subject if needed
- Maps completion status
- Creates activity types automatically

## Data Transformations

### Date Parsing
```
Input:  "10/17/2025 08:32"
Output: 2025-10-17T08:32:00.000Z (ISO DateTime)
```

### Currency Amount Parsing
```
Input:  "SE0,00"        → Output: 0.00 (currency: SE)
Input:  "USD1000.50"    → Output: 1000.50 (currency: USD)
Input:  "'-99"          → Uses tenant default currency
```

### Sales Stage Mapping
```
"Closed Won"            → DealStage.WON
"Closed Lost"           → DealStage.LOST
"Prospecting"           → DealStage.PROSPECT
"Qualification"         → DealStage.PROSPECT
"Proposal"              → DealStage.QUOTE
"Negotiation"           → DealStage.QUOTE
Default                 → DealStage.LEAD
```

### Activity Type Inference
If Meeting Type is not provided, infers from subject:
```
"call", "phone"         → Call
"email"                 → Email
"meeting", "möte"       → Meeting
"task", "todo"          → Task
Default                 → Meeting
```

### Activity Status Mapping
```
"Held", "Completed"     → isCompleted: true, completedAt: dueAt
Other statuses          → isCompleted: false
```

## Validation & Error Handling

### What Gets Skipped
- ❌ Records marked as Deleted (Deleted=1)
- ❌ Records missing required fields (name, first name, last name, etc.)
- ❌ Contacts/Deals with organizations that don't exist
- ❌ Records with invalid email addresses
- ❌ Duplicate organizations (same name in tenant)

### Error Reporting
Each import step shows:
```
=== Import Summary ===
Total rows: 2467
Successfully imported: 2245
Skipped (deleted): 156
Errors: 66

=== Error Details ===
Row 123: Organization not found: Acme Corp
  Subject: Follow-up call
```

Errors are logged with:
- Row number
- Reason for failure
- Original data for debugging

## Customization

### Field and User Mapping Review

**Interactive Review**: Before importing, the script displays:
1. **Field mappings** for all entity types (Organizations, Contacts, Deals, Activities)
2. **User mappings** (SuiteCRM users → SpecterCRM users)

Then it asks for confirmation before proceeding.

**Example output:**

```
======================================================================
FIELD MAPPINGS REVIEW
======================================================================

The following CSV columns will be mapped to SpecterCRM fields:

📋 ORGANIZATIONS (Organizations.csv)
  CSV Column                → SpecterCRM Field
  ─────────────────────────────────────────────────────────────
  Name                      → name (required)
  Website                   → website
  Billing Address Street    → address
  ...

👤 CONTACTS (Contacts.csv)
  CSV Column                → SpecterCRM Field
  ─────────────────────────────────────────────────────────────
  First Name                → firstName (required)
  Last Name                 → lastName (required)
  ...

💰 DEALS (Deals.csv)
  ...

📅 ACTIVITIES (Activities.csv)
  ...

📝 KEY TRANSFORMATIONS:
  • Dates: "10/17/2025 08:32" → ISO DateTime
  • Currency: "SE0,00" → 0.00 (currency: SE)
  • Sales Stage: "Closed Won" → DealStage.WON
  • Activity Type: Inferred from subject keywords if not provided
  • Email Validation: Invalid emails are skipped
  • Duplicates: Organizations with same name are skipped

======================================================================
USER MAPPINGS REVIEW
======================================================================

The following SuiteCRM users will be mapped to SpecterCRM users:

  John Doe (admin@example.com)
    ← magnussvensson
    ← adminalex
    ← 1

  Jane Smith (user@example.com)
    ← borisasadanin

✓ Total mappings: 5
======================================================================

Review the field and user mappings above.
These mappings will be used to import your SuiteCRM data.

Do you want to proceed with the import? (y/n):
```

### Customizing Mappings

If you need to change how fields or users are mapped:

**Field Mappings** - Edit the individual import scripts:
- `backend/src/scripts/import-organizations.ts` - Organization fields
- `backend/src/scripts/import-contacts.ts` - Contact fields
- `backend/src/scripts/import-deals.ts` - Deal fields
- `backend/src/scripts/import-activities.ts` - Activity fields

**User Mappings** - Edit `backend/src/scripts/run-import.ts` lines 133-137:

```typescript
const usernamePatterns = [
  { old: 'magnussvensson', email: 'your-user@email.com' },
  { old: 'borisasadanin', email: 'another-user@email.com' },
  // Add your mappings here
];
```

The script shows available users when it runs:
```
Available users in tenant:
  - admin@example.com (John Doe)
  - user@example.com (Jane Smith)
```

**Important**: If you cancel the import (`n`) after reviewing mappings, you can:
1. Edit the mapping files as needed
2. Run the import again - it will show the updated mappings for review

### Activity Types

Activity types are created automatically. You can customize in `import-activities.ts`:

```typescript
const defaultTypes = ['Call', 'Email', 'Meeting', 'Task', 'Demo'];
```

## Advanced Options

### Dry Run Mode

Test the import without actually importing data:

```bash
npm run import:dry-run
```

### Import Individual Entities

You can import entities separately by modifying `run-import.ts` to comment out steps you don't want.

### Batch Processing

For very large datasets, you can modify the scripts to process in batches:

```typescript
// In import-organizations.ts
const BATCH_SIZE = 100;
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  // Process batch...
}
```

## Troubleshooting

### "Organization not found"
**Cause:** Contact or Deal references an organization that wasn't imported

**Solutions:**
1. Check Organizations.csv has the organization
2. Verify organization name matches exactly
3. Check if organization import had errors

### "User not found" or Missing Owners
**Cause:** User mapping is incorrect

**Solutions:**
1. Check available users in your tenant
2. Update user mappings in `run-import.ts`
3. Re-run import (it will skip already-imported records)

### "Invalid date format"
**Cause:** Date in CSV is in unexpected format

**Solutions:**
1. Verify CSV is UTF-8 encoded
2. Check date format is MM/DD/YYYY HH:mm
3. Look for special characters in date field

### Import Hangs or Runs Slowly
**Causes:** Large dataset, slow database, memory constraints

**Solutions:**
1. Ensure PostgreSQL has adequate resources
2. Consider batch processing (see Advanced Options)
3. Run import during low-traffic periods

### "Duplicate organization"
**Cause:** Organization with same name already exists

**Result:** Skipped (not an error), existing organization used for relationships

## Post-Import Tasks

### 1. Verify Data Counts

```bash
npm run db:studio
```

Check that counts match expectations:
- Organizations: ~741
- Contacts: ~2,183
- Deals: ~706
- Activities: ~2,467

### 2. Review Activity Types

In SpecterCRM admin panel:
- Settings → Activity Types
- Activate/deactivate types as needed
- Add custom types if required

### 3. Review Owners

Some records may not have owners if user mapping was incomplete:
- Filter records by "no owner"
- Bulk assign to appropriate users

### 4. Run Duplicate Detection

After import, run duplicate detection:
- Organizations: Check for similar names
- Contacts: Check for similar names/emails

### 5. Audit Log Review

Check audit logs for import activity:
- Admin → Audit Logs
- Filter by date/time of import
- Verify all changes were made by import user

## ID Mappings

ID mappings are saved to `import/mappings/`:
- `organizations.json` - Old SuiteCRM ID → New SpecterCRM ID
- `contacts.json`
- `deals.json`

These files are useful for:
- Debugging relationship issues
- Re-running partial imports
- Importing additional data later

## Import Summary Output

After successful import, you'll see:

```
======================================================================
IMPORT COMPLETE!
======================================================================

Tenant: Your Company
Imported by: admin@example.com

Summary:
  Organizations: 741 of 741 (0 errors, 0 skipped)
  Contacts:      2156 of 2183 (5 errors, 22 skipped)
  Deals:         698 of 706 (3 errors, 5 skipped)
  Activities:    2401 of 2467 (10 errors, 56 skipped)

Total records imported: 5996

✓ All records imported successfully!

ID mappings saved to: /path/to/import/mappings
```

## Data Privacy & Security

⚠️ **Important:** The CSV files contain sensitive business data

- Store CSV files securely
- Don't commit CSV files to version control (already in .gitignore)
- Delete CSV files after import if no longer needed
- Restrict access to mapping files (contain ID relationships)

## Support

If you encounter issues:

1. Check error messages in console output
2. Review `import/mappings/*.json` for ID mappings
3. Verify tenant and user IDs are correct
4. Check PostgreSQL logs for constraint violations
5. Enable debug logging in import scripts if needed

## Script Files

Located in `backend/src/scripts/`:

- `run-import.ts` - Main orchestration script
- `import-organizations.ts` - Organizations import
- `import-contacts.ts` - Contacts import (with emails/phones)
- `import-deals.ts` - Deals import
- `import-activities.ts` - Activities import

All scripts include:
- TypeScript types for CSV rows
- Validation logic
- Error handling
- Progress reporting
- ID mapping generation
