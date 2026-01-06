# SpecterCRM - Production-Quality Multi-Tenant CRM

A modern, multi-tenant CRM application built with TypeScript, React, Express, and PostgreSQL.

## Features

- **Multi-tenant SaaS architecture** with complete data isolation
- **Complete CRM entities**: Organizations, Contacts, Deals, Activities, Notes
- **CSV import** with web-based UI for bulk data import
- **Deal Pipeline** with drag-and-drop stage management
- **Advanced deduplication** for Organizations and Contacts
- **Comprehensive reporting** including win rate, cycle time, forecasting
- **Audit logging** for all critical operations
- **Role-based access control** (Admin & User roles)
- **RESTful API** with JWT authentication
- **Modern React frontend** with TypeScript and Tailwind CSS
- **Production-ready** with health check endpoints

## Tech Stack

### Backend
- Node.js 20.x + Express.js
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT authentication with refresh tokens
- Bcrypt password hashing
- Helmet.js security
- Rate limiting

### Frontend
- React 18.x
- TypeScript
- Vite
- TanStack Query (React Query)
- React Router v7
- Tailwind CSS
- Axios

## Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or yarn

## Installation

### 1. Clone and Install Dependencies

```bash
# Backend
cd specter-crm/backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment Variables

**Backend** - Copy `.env.example` to `.env` and configure:

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your database credentials and secrets. See `backend/.env.example` for all available options.

**Frontend** - For development, create `.env.local`:

```bash
cd frontend
echo "VITE_API_URL=http://localhost:3000/api" > .env.local
```

### 3. Initialize Database

```bash
cd backend

# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Seed demo data
npm run db:seed
```

This will create:
- Default tenant: "Demo Company" (slug: demo)
- Admin user: `admin@demo.com` / `Admin123!`
- Sales user: `sales@demo.com` / `Sales123!`
- Sample organizations, contacts, deals, and activities

**Customize Seed Data** (optional):
You can configure the seed by setting environment variables in `.env`:
```bash
SEED_TENANT_NAME="Your Company"
SEED_TENANT_SLUG="yourcompany"
SEED_ADMIN_EMAIL="admin@yourcompany.com"
SEED_ADMIN_PASSWORD="YourSecurePassword123!"
SEED_SALES_EMAIL="sales@yourcompany.com"
SEED_SALES_PASSWORD="SalesPassword123!"
```

**IMPORTANT**: Change these passwords after first login!

### 4. Start Development Servers

**Backend**:
```bash
cd backend
npm run dev
```
Server runs on: http://localhost:3000

**Frontend**:
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:5173

## API Documentation

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Register new user (admin only)
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Organizations
- `GET /api/organizations` - List organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization details
- `PATCH /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization
- `GET /api/organizations/:id/contacts` - Get related contacts
- `GET /api/organizations/:id/deals` - Get related deals
- `GET /api/organizations/:id/activities` - Get related activities
- `GET /api/organizations/:id/notes` - Get notes
- `POST /api/organizations/:id/notes` - Add note

### Contacts
- `GET /api/contacts` - List contacts
- `POST /api/contacts` - Create contact
- `GET /api/contacts/:id` - Get contact details
- `PATCH /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Delete contact
- `GET /api/contacts/:id/notes` - Get notes
- `POST /api/contacts/:id/notes` - Add note

### Deals
- `GET /api/deals` - List deals
- `POST /api/deals` - Create deal
- `GET /api/deals/:id` - Get deal details
- `PATCH /api/deals/:id` - Update deal
- `PATCH /api/deals/:id/stage` - Update deal stage
- `DELETE /api/deals/:id` - Delete deal
- `GET /api/deals/pipeline/summary` - Get pipeline summary
- `GET /api/deals/:id/notes` - Get notes
- `POST /api/deals/:id/notes` - Add note

### Activities
- `GET /api/activities` - List activities
- `POST /api/activities` - Create activity
- `GET /api/activities/:id` - Get activity details
- `PATCH /api/activities/:id` - Update activity
- `PATCH /api/activities/:id/complete` - Toggle complete status
- `DELETE /api/activities/:id` - Delete activity

### Reports
- `GET /api/reports/pipeline` - Pipeline by stage
- `GET /api/reports/win-rate` - Win rate metrics
- `GET /api/reports/cycle-time` - Average cycle time
- `GET /api/reports/activity-volume` - Activity volume metrics
- `GET /api/reports/top-accounts` - Top accounts by revenue
- `GET /api/reports/forecast` - Monthly forecast

### Deduplication
- `GET /api/duplicates?entityType=ORGANIZATION|CONTACT` - Get duplicate suggestions
- `POST /api/duplicates/merge` - Merge duplicate records
- `POST /api/duplicates/dismiss` - Dismiss suggestion
- `POST /api/duplicates/detect/organizations` - Detect organization duplicates (admin)
- `POST /api/duplicates/detect/contacts` - Detect contact duplicates (admin)

### CSV Import
- `POST /api/import/start` - Start CSV import job (admin only)
- `GET /api/import/jobs` - List import jobs
- `GET /api/import/jobs/:id` - Get import job status
- `GET /api/import/jobs/:id/logs` - Get import job logs

## Project Structure

```
specter-crm/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema
│   │   └── seed.ts            # Seed data
│   ├── src/
│   │   ├── config/            # Database config
│   │   ├── controllers/       # Request handlers
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Helpers, validation schemas
│   │   ├── app.ts            # Express app setup
│   │   └── index.ts          # Entry point
│   ├── .env                   # Environment variables
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/        # Reusable components
    │   ├── contexts/          # React contexts (Auth)
    │   ├── lib/              # API client
    │   ├── pages/            # Route pages
    │   ├── App.tsx           # Main app component
    │   └── main.tsx          # Entry point
    ├── index.html
    ├── tailwind.config.js
    └── package.json
```

## Security Features

- **Password hashing** with bcrypt (cost factor 12)
- **JWT authentication** with access and refresh tokens
- **Token rotation** on refresh
- **Rate limiting** (configurable, production defaults: 1000 req/15min, 10 auth attempts/15min)
- **CSRF protection** via Helmet.js
- **Security headers** (XSS, CSP, HSTS, X-Frame-Options)
- **Input validation** with Zod
- **SQL injection prevention** via Prisma
- **Multi-tenant isolation** enforced at database level
- **CORS configuration** with multiple origin support

## Multi-Tenancy

Every database record includes a `tenant_id` field. Prisma middleware automatically filters all queries by the current user's tenant, ensuring complete data isolation between tenants.

## Audit Logging

The system logs:
- Record creation, updates, deletions
- Owner changes
- Deal stage changes
- Deal amount changes
- Activity status changes
- User creation/role changes
- Merge operations

Audit logs include:
- User who performed the action
- Entity type and ID
- Action type
- Before/after data (JSON)
- Timestamp

## CSV Import

The application provides a web-based CSV import tool for bulk data migration:

### Supported Entity Types
- Organizations
- Contacts
- Deals
- Activities

### Features
- Web-based file upload with drag-and-drop
- Automatic field mapping with customization
- UTF-8 and Latin-1 encoding support (for international characters)
- Background processing with real-time status updates
- Optional "clear existing data" with confirmation
- Detailed import logs
- Validation and error reporting

### Usage
1. Navigate to Settings → Import Data (admin only)
2. Upload CSV files for each entity type
3. Review and adjust field mappings
4. Optionally clear existing data
5. Start import and monitor progress

## Deduplication

### Detection
- **Organizations**: Matches by exact domain OR fuzzy name matching (Levenshtein distance)
- **Contacts**: Matches by exact email OR fuzzy name within same organization
- Similarity threshold: 85%

### Merge Process
1. Detect duplicates and create suggestions
2. Review suggestions in UI
3. Select primary record
4. System automatically:
   - Updates all foreign key references
   - Merges related records (deals, activities, notes)
   - Deletes duplicate record
   - Creates audit log entry

## Testing

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd frontend
npm test
```

## Production Deployment

### Backend

1. **Build the application**:
```bash
cd backend
npm run build
```

2. **Set production environment variables** in `.env`:
   - Change JWT secrets to cryptographically random values
   - Set `NODE_ENV=production`
   - Update `CORS_ORIGIN` to production frontend URL
   - Configure database connection with connection pooling

3. **Run database migrations**:
```bash
npm run db:migrate
```

4. **Start the server**:
```bash
npm start
```

### Frontend

1. **Build for production**:
```bash
cd frontend
npm run build
```

2. **Serve the `dist` folder** with a static file server (nginx, Apache, etc.) or CDN

## Health Check Endpoints

The application provides health check endpoints for monitoring:

- **`GET /health`** - Basic application health
- **`GET /health/ready`** - Database connectivity check
- **`GET /health/startup`** - Startup probe

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/ready
curl http://localhost:3000/health/startup
```

## Database Management

```bash
# Open Prisma Studio (database GUI)
npm run db:studio

# Create a new migration
npm run db:migrate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Troubleshooting

### Database Connection Issues
- Verify database credentials in `.env`
- Ensure PostgreSQL instance is running and accessible
- Check `DATABASE_URL` format and connection parameters
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

### Frontend Can't Connect to Backend
- Verify backend is running on port 3000
- Check CORS settings match your frontend URL
- Verify `VITE_API_URL` environment variable
- Check browser console for CORS errors

### Authentication Issues
- Check JWT secrets are set in `.env`
- Verify token expiration times are reasonable
- Clear browser localStorage and login again
- Check rate limiting isn't blocking requests

### CSV Import Issues
- Ensure CSV files use UTF-8 or Latin-1 encoding
- Verify file names match expected pattern (organizations.csv, contacts.csv, etc.)
- Check import logs for detailed error messages
- Ensure sufficient disk space for file uploads

## License

MIT

## Support

For issues and questions, please create an issue in the project repository.
