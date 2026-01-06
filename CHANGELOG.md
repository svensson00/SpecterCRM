# SpecterCRM - Recent Fixes

## Summary of Changes

### Fixed Issues

#### 1. **Deals List Page - Complete Rewrite** ✓
**Problem:** Deals page was showing a Kanban board instead of a list view, with no search functionality.

**Fixed:**
- Rewrote `/frontend/src/pages/Deals.tsx` as a proper list view
- Added search input for filtering deals
- Added pagination (20 deals per page)
- Added stage badges with color coding
- Shows deal details: organization, amount, probability, expected close date

**Location:** The Kanban board view is now exclusively on `/pipeline` page

#### 2. **Pipeline Stages** ✓
**Problem:** Pipeline had incorrect stages (QUALIFIED, NEGOTIATION) that don't match the database schema.

**Fixed:** `/frontend/src/components/PipelineBoard.tsx`
- Removed invalid stages
- Updated to correct stages: LEAD → PROSPECT → QUOTE → WON/LOST
- Fixed data fetching to access `res.data.data` properly

#### 3. **Owner Dropdowns in All Forms** ✓
**Problem:** All form dropdowns for selecting owners were empty because they accessed `users?.users` instead of `users?.data`.

**Fixed:**
- `/frontend/src/pages/OrganizationForm.tsx` - Line 184
- `/frontend/src/pages/ContactForm.tsx` - Line 337
- `/frontend/src/pages/DealForm.tsx` - Line 310
- `/frontend/src/pages/ActivityForm.tsx` - Line 304

**Change:** Updated all to use `users?.data?.map(...)` to correctly access the users array

#### 4. **Password Reset Flow** ✓
**Added:**
- `/frontend/src/pages/ForgotPassword.tsx` - Request password reset
- `/frontend/src/pages/ResetPassword.tsx` - Set new password with token
- Added routes and API methods
- Added "Forgot password?" link to login page

#### 5. **Global Search Component** ✓
**Added:** `/frontend/src/components/GlobalSearch.tsx`
- Search across Organizations, Contacts, and Deals
- Typeahead dropdown with results
- Color-coded badges for each entity type
- Integrated into navigation bar
- Minimum 2 characters to trigger search

### Already Working Features

These features were already implemented correctly and should be working:

#### Organization Management
- ✅ List view with search and pagination
- ✅ Create/Edit form with owner dropdown
- ✅ Detail view with Edit/Delete buttons
- ✅ CSV export
- ✅ Related contacts, deals, activities, notes

#### Contact Management
- ✅ List view with search and pagination
- ✅ Create/Edit form with organization and owner dropdowns
- ✅ Multiple emails and phones support
- ✅ Primary email/phone selection
- ✅ Detail view with Edit/Delete buttons
- ✅ CSV export

#### Deal Management
- ✅ List view with search and pagination (NOW FIXED)
- ✅ Create/Edit form with organization, contact, and owner dropdowns
- ✅ Stage selection
- ✅ Probability and amount tracking
- ✅ "Reason Lost" field when stage is LOST
- ✅ Detail view with Edit/Delete buttons
- ✅ CSV export

#### Pipeline (Kanban Board)
- ✅ Drag-and-drop deals between stages
- ✅ Shows deal count and total value per stage
- ✅ Click deal to view details
- ✅ Proper stage names (NOW FIXED)

#### Activity Management
- ✅ List view with filtering (all/pending/completed)
- ✅ Create/Edit form with:
  - Organization dropdown
  - Deal dropdown (filtered by organization)
  - Contact selection (filtered by organization)
  - Owner dropdown
  - Activity type (from admin-configured types)
- ✅ Toggle completion status
- ✅ Detail view with Edit/Delete
- ✅ CSV export

#### Reports
- ✅ Win Rate Overview
- ✅ Sales Cycle Time
- ✅ Pipeline by Stage
- ✅ Activity Volume
- ✅ Top Accounts by Revenue
- ✅ Revenue Forecast (6 months)

#### Admin Features
- ✅ User Management
- ✅ Activity Types Configuration
- ✅ Audit Logs

#### Other Features
- ✅ Deduplication (detect and merge duplicates)
- ✅ Notes on Organizations, Contacts, Deals
- ✅ Multi-tenant architecture
- ✅ Role-based access (Admin/User)

## File Structure

### New Files
```
frontend/src/pages/ForgotPassword.tsx
frontend/src/pages/ResetPassword.tsx
frontend/src/components/GlobalSearch.tsx
frontend/src/utils/csv.ts
DEBUGGING.md
CHANGELOG.md (this file)
```

### Modified Files
```
frontend/src/App.tsx - Added password reset routes
frontend/src/pages/Login.tsx - Added forgot password link
frontend/src/pages/Deals.tsx - Complete rewrite as list view
frontend/src/pages/OrganizationForm.tsx - Fixed users dropdown
frontend/src/pages/ContactForm.tsx - Fixed users dropdown
frontend/src/pages/DealForm.tsx - Fixed users dropdown
frontend/src/pages/ActivityForm.tsx - Fixed users dropdown
frontend/src/components/PipelineBoard.tsx - Fixed stages and data loading
frontend/src/components/Layout.tsx - Added GlobalSearch
frontend/src/lib/api.ts - Added password reset API methods
```

## Testing Checklist

### Authentication
- [ ] Can login with admin@demo.com / Admin123!
- [ ] Can login with sales@demo.com / Sales123!
- [ ] Can logout
- [ ] Can request password reset
- [ ] Can reset password with token

### Organizations
- [ ] List shows organizations
- [ ] Search works
- [ ] Can create new organization
- [ ] Owner dropdown shows users
- [ ] Can edit organization
- [ ] Can delete organization (with warning)
- [ ] Can export to CSV

### Contacts
- [ ] List shows contacts
- [ ] Search works
- [ ] Can create new contact
- [ ] Organization dropdown shows organizations
- [ ] Owner dropdown shows users
- [ ] Can add multiple emails/phones
- [ ] Can set primary email/phone
- [ ] Can edit contact
- [ ] Can delete contact
- [ ] Can export to CSV

### Deals
- [ ] List shows deals with stage badges
- [ ] Search works
- [ ] Can create new deal
- [ ] Organization dropdown shows organizations
- [ ] Contact selection shows contacts from selected org
- [ ] Owner dropdown shows users
- [ ] Stage dropdown has correct stages (LEAD, PROSPECT, QUOTE, WON, LOST)
- [ ] "Reason Lost" field appears when stage is LOST
- [ ] Can edit deal
- [ ] Can delete deal
- [ ] Can export to CSV

### Pipeline
- [ ] Shows correct stages (Lead, Prospect, Quote, Won, Lost)
- [ ] Deals appear in correct stage columns
- [ ] Shows deal count per stage
- [ ] Shows total value per stage
- [ ] Can drag deals between stages
- [ ] Click deal navigates to detail page

### Activities
- [ ] List shows activities
- [ ] Can filter by all/pending/completed
- [ ] Can create new activity
- [ ] Organization dropdown shows organizations
- [ ] Deal dropdown shows deals from selected org
- [ ] Contact selection shows contacts from selected org
- [ ] Owner dropdown shows users
- [ ] Activity type dropdown shows types
- [ ] Can toggle completion
- [ ] Can edit activity
- [ ] Can delete activity
- [ ] Can export to CSV

### Reports
- [ ] Win Rate Overview shows metrics
- [ ] Sales Cycle Time shows data
- [ ] Pipeline by Stage table populated
- [ ] Activity Volume table populated
- [ ] Top Accounts table populated
- [ ] Revenue Forecast table populated

### Global Search
- [ ] Search box visible in navigation
- [ ] Typing shows dropdown (min 2 chars)
- [ ] Results show organizations (blue badge)
- [ ] Results show contacts (green badge)
- [ ] Results show deals (purple badge)
- [ ] Clicking result navigates to detail page
- [ ] Clicking outside closes dropdown

### Admin (admin user only)
- [ ] Can view users
- [ ] Can edit user details
- [ ] Can change user role
- [ ] Can deactivate users
- [ ] Can manage activity types
- [ ] Can view audit logs

## Known Limitations

1. **Email Sending**: Password reset emails are not actually sent (SMTP not configured). In production, configure email service.

2. **File Uploads**: No document/file attachment support yet.

3. **Custom Fields**: No support for custom fields per entity.

4. **Email Integration**: No email integration (Gmail, Outlook, etc.).

5. **Calendar Integration**: No calendar sync.

6. **Mobile App**: Web-only, no native mobile app.

## Database Connection

Current database configuration (from `.env`):
```
DATABASE_URL="postgresql://spectercrm_user:spectercrm_pass_2025@172.232.131.169:10542/spectercrm?schema=public"
```

**Demo Data:**
- Tenant: demo
- Admin User: admin@demo.com / Admin123!
- Sales User: sales@demo.com / Sales123!

## Development URLs

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:3000
- **Backend Health**: http://localhost:3000/health
- **Prisma Studio**: http://localhost:5555 (run `npx prisma studio`)

## Next Steps / Future Enhancements

Potential features to add:
1. Email templates and SMTP configuration
2. Advanced filtering and saved views
3. Custom fields per entity
4. Document attachments
5. Email integration (Gmail, Outlook)
6. Calendar integration
7. Mobile responsive improvements
8. Bulk operations (import, export, update)
9. Dashboard widgets customization
10. Advanced reporting with charts
