# SpecterCRM Quick Start Guide

## ✅ What's Been Completed

Your SpecterCRM application is fully set up and ready to run!

### Database
- ✅ PostgreSQL database configured
- ✅ Schema deployed (19 tables)
- ✅ Demo data seeded

### Backend
- ✅ Full REST API with TypeScript
- ✅ JWT authentication with refresh tokens
- ✅ All CRUD operations for Organizations, Contacts, Deals, Activities, Notes
- ✅ Audit logging system
- ✅ Deduplication detection & merge
- ✅ Reporting & dashboards
- ✅ Dependencies installed

### Frontend
- ✅ React 18 + TypeScript + Vite
- ✅ Authentication flows
- ✅ All entity views (list + detail)
- ✅ Deal pipeline board
- ✅ Dashboard with reports
- ✅ Dependencies installed

## 🚀 Start the Application

### 1. Start Backend (Terminal 1)

```bash
cd backend
npm run dev
```

Expected output:
```
Server running on port 3000
Database connected successfully
```

Backend will be available at: **http://localhost:3000**

### 2. Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Expected output:
```
VITE ready in X ms
Local: http://localhost:5173/
```

Frontend will be available at: **http://localhost:5173**

## 🔑 Demo Credentials

### Admin Account
- Email: `admin@demo.com`
- Password: `Admin123!`
- Access: Full admin rights, can create users, configure settings

### Sales Account
- Email: `sales@demo.com`
- Password: `Sales123!`
- Access: Standard user, can manage CRM records

**IMPORTANT**: Change these passwords after first login!

> **Note**: The seed data (tenant name, emails, passwords) can be customized via environment variables in `.env`. See `backend/.env.example` for available options like `SEED_TENANT_NAME`, `SEED_ADMIN_EMAIL`, etc.

## 📊 Demo Data Available

After logging in, you'll find:

- **3 Organizations**:
  - Acme Corporation (San Francisco)
  - TechStart Inc (Austin)
  - Global Solutions Ltd (New York)

- **3 Contacts** across these organizations

- **3 Deals** in various pipeline stages:
  - Enterprise Platform License ($150,000 - Quote stage)
  - Startup Package ($25,000 - Prospect stage)
  - Professional Services ($75,000 - Won)

- **3 Activities** (calls, meetings, emails)

- **3 Notes** attached to various entities

## 🎯 Key Features to Try

### 1. Dashboard
Navigate to Dashboard to see:
- Win rate metrics
- Average cycle time
- Pipeline summary by stage
- Top accounts by revenue

### 2. Organizations
- View all organizations
- Click on any organization to see details
- See related contacts, deals, and activities
- Add notes

### 3. Contacts
- Browse all contacts
- View contact details with emails and phones
- See which organization they belong to

### 4. Deals
- List all deals with filtering
- View deal details
- See related organization and contacts

### 5. Pipeline Board
- Visual Kanban-style pipeline
- Drag deals between stages (buttons to move stages)
- See stage summaries

### 6. Activities
- View all activities
- Filter by pending/completed
- Mark activities as complete

## 📁 Project Structure

```
specter-crm/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Auth, validation, errors
│   │   ├── routes/          # API endpoints
│   │   └── utils/           # Helpers
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Demo data
│   └── .env                 # Environment config
└── frontend/
    ├── src/
    │   ├── pages/           # Route components
    │   ├── components/      # Reusable UI
    │   ├── contexts/        # React context (Auth)
    │   └── lib/             # API client
    └── index.html
```

## 🔧 Common Tasks

### View Database
```bash
cd backend
npm run db:studio
```
Opens Prisma Studio at http://localhost:5555

### Check API Health
```bash
curl http://localhost:3000/health
```

### Run Backend Tests
```bash
cd backend
npm test
```

### Build for Production

Backend:
```bash
cd backend
npm run build
npm start
```

Frontend:
```bash
cd frontend
npm run build
# Serve the dist/ folder
```

## 🐛 Troubleshooting

### Backend won't start
- Check if port 3000 is available
- Verify `.env` file exists in backend/
- Check database connection

### Frontend won't start
- Check if port 5173 is available
- Verify Vite proxy is configured
- Clear node_modules and reinstall

### Can't login
- Verify backend is running
- Check browser console for errors
- Try clearing localStorage

### Database issues
```bash
cd backend
# Regenerate Prisma client
npm run db:generate

# Reset and reseed (WARNING: deletes all data)
npx prisma migrate reset --force
```

## 📝 Next Steps

1. **Explore the API**
   - Check README.md for full API documentation
   - All endpoints require authentication except /auth/login

2. **Customize**
   - Update branding in frontend
   - Add custom fields to entities
   - Configure business rules

3. **Deploy**
   - Follow production deployment guide in README.md
   - Update environment variables
   - Set up CI/CD pipeline

## 🔒 Security Notes

- Demo passwords are simple for testing
- In production, change all JWT secrets
- Use environment-specific `.env` files
- Never commit `.env` to version control
- Password policy: min 8 chars, 1 uppercase, 1 number, 1 special character

## 📚 Documentation

- Full README: `README.md`
- API Routes: See README.md "API Documentation" section
- Database Schema: `backend/prisma/schema.prisma`

## 🎉 You're All Set!

Your SpecterCRM application is ready to use. Start both servers and login with the demo credentials to explore all features.

**Happy CRM-ing!** 🚀
