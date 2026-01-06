# SpecterCRM - Debugging Guide

## Quick Verification Steps

### 1. Verify Backend is Running

```bash
# From the backend directory
cd /Users/magnus/claude/specter-crm/backend
npm run dev
```

You should see:
```
info: Database connected successfully
info: Server running on port 3000
info: Environment: development
info: Health check: http://localhost:3000/health
```

Test the backend:
```bash
curl http://localhost:3000/health
```

### 2. Verify Frontend is Running

```bash
# From the frontend directory (in a new terminal)
cd /Users/magnus/claude/specter-crm/frontend
npm run dev
```

You should see:
```
VITE v6.4.1  ready in XXX ms

➜  Local:   http://localhost:5173/
```

### 3. Test Authentication

Open your browser to http://localhost:5173/login

Login with:
- **Email**: admin@demo.com
- **Password**: Admin123!

Check browser console (F12) for any errors.

### 4. Test API Endpoints

After logging in, open browser DevTools (F12) > Network tab

Navigate to each page and verify API calls:

- **/organizations** - Should call `GET /api/organizations?page=1&limit=20`
- **/contacts** - Should call `GET /api/contacts?page=1&limit=20`
- **/deals** - Should call `GET /api/deals?page=1&limit=20`
- **/pipeline** - Should call `GET /api/deals?limit=1000`

All should return 200 status with data like:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": X,
    "totalPages": Y
  }
}
```

### 5. Verify Database Has Data

```bash
# Connect to database
cd /Users/magnus/claude/specter-crm/backend
npx prisma studio
```

This will open Prisma Studio at http://localhost:5555 where you can view all database records.

Or check via API:
```bash
# Get auth token first (login via UI and check Application > Local Storage > accessToken)
# Then test:
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3000/api/organizations
```

## Common Issues and Solutions

### Issue: "No data showing on any list page"

**Causes:**
1. Backend not running
2. Database has no data
3. Authentication token expired/invalid
4. API proxy not configured

**Solutions:**
1. Ensure backend is running on port 3000
2. Re-seed database: `cd backend && npm run seed`
3. Log out and log back in to get fresh token
4. Check vite.config.ts has proxy configured

### Issue: "Search not working"

**Causes:**
1. Search parameter not being sent to API
2. Backend search implementation issue

**Debug:**
- Open Network tab
- Type in search box
- Verify API call includes `search=yourterm` parameter
- Check API response

### Issue: "Dropdowns empty (Organizations, Contacts, Users)"

**Causes:**
1. Query not fetching data
2. Wrong data path access

**Debug:**
- Check React DevTools > Components
- Find the form component
- Check the `organizations`/`contacts`/`users` query data
- Verify it has `data.data` array

### Issue: "401 Unauthorized errors"

**Causes:**
1. Not logged in
2. Token expired
3. Token not being sent

**Solutions:**
1. Log out and log back in
2. Check localStorage has `accessToken`
3. Check Network tab shows Authorization header on API calls

### Issue: "CORS errors"

**Solutions:**
- Backend should allow `http://localhost:5173` origin
- Check backend CORS configuration in `src/index.ts`

### Issue: "Pipeline not showing deals"

**Debug:**
1. Check `/api/deals` returns data
2. Check deals have valid `stage` values (LEAD, PROSPECT, QUOTE, WON, LOST)
3. Check React DevTools for `deals` query data

### Issue: "Reports showing 'No data'"

**Causes:**
1. Insufficient data in database
2. Date ranges exclude all data

**Solutions:**
1. Ensure database has deals with various stages
2. Create some test deals in WON/LOST status

## Database Reset

If you need to reset and re-seed the database:

```bash
cd /Users/magnus/claude/specter-crm/backend

# Reset database
npx prisma db push --force-reset

# Seed with demo data
npm run seed
```

This will create:
- 1 tenant (demo)
- 2 users (admin@demo.com, sales@demo.com)
- 3 organizations
- 3 contacts
- 3 deals
- 3 activities
- Activity types (Call, Email, Meeting, Task)

## API Test Commands

```bash
# Set your token (get from browser localStorage)
TOKEN="your_access_token_here"

# Test Organizations
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/organizations

# Test Contacts
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/contacts

# Test Deals
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/deals

# Test Users (admin only)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users

# Test Reports
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/reports/pipeline
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/reports/win-rate
```

## Browser Console Debugging

Open DevTools Console and run:

```javascript
// Check if authenticated
console.log('Access Token:', localStorage.getItem('accessToken'));

// Manually test API call
fetch('/api/organizations', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
})
.then(r => r.json())
.then(data => console.log('Organizations:', data));

// Test contacts
fetch('/api/contacts', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
})
.then(r => r.json())
.then(data => console.log('Contacts:', data));

// Test deals
fetch('/api/deals', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
})
.then(r => r.json())
.then(data => console.log('Deals:', data));
```

## Still Having Issues?

1. Clear browser cache and localStorage
2. Restart both frontend and backend servers
3. Check for any console errors (red text in browser DevTools)
4. Check for any terminal errors in backend/frontend processes
5. Verify database connection string in `backend/.env`
6. Ensure PostgreSQL database is running and accessible
