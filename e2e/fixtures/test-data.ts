/**
 * Seed data constants matching backend/prisma/seed.ts
 */
export const SEED = {
  TENANT: {
    name: 'Demo Company',
    slug: 'demo',
  },
  ADMIN: {
    email: 'admin@demo.com',
    password: 'Admin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'ADMIN',
  },
  SALES: {
    email: 'sales@demo.com',
    password: 'Sales123!',
    firstName: 'Sales',
    lastName: 'Rep',
    role: 'USER',
  },
  ACTIVITY_TYPES: ['Call', 'Meeting', 'Lunch', 'Email', 'Note'],
  ORGANIZATIONS: {
    acme: {
      name: 'Acme Corporation',
      website: 'https://acme.example.com',
      street: '123 Main St',
      city: 'San Francisco',
      zip: '94102',
      country: 'USA',
    },
    techstart: {
      name: 'TechStart Inc',
      website: 'https://techstart.example.com',
      street: '456 Innovation Ave',
      city: 'Austin',
      zip: '78701',
      country: 'USA',
    },
    global: {
      name: 'Global Solutions Ltd',
      website: 'https://globalsolutions.example.com',
      city: 'New York',
      zip: '10001',
      country: 'USA',
    },
  },
  CONTACTS: {
    john: {
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'CEO',
      contactRole: 'Decision Maker',
      email: 'john.doe@acme.example.com',
      email2: 'jdoe@acme.example.com',
      phone: '+1-555-0101',
      phone2: '+1-555-0102',
    },
    jane: {
      firstName: 'Jane',
      lastName: 'Smith',
      jobTitle: 'CTO',
      contactRole: 'Influencer',
      email: 'jane.smith@acme.example.com',
      phone: '+1-555-0201',
    },
    bob: {
      firstName: 'Bob',
      lastName: 'Johnson',
      jobTitle: 'Founder',
      contactRole: 'Decision Maker',
      email: 'bob@techstart.example.com',
    },
  },
  DEALS: {
    enterprise: {
      title: 'Enterprise Platform License',
      amount: 150000,
      currency: 'USD',
      stage: 'QUOTE',
      probability: 75,
    },
    startup: {
      title: 'Startup Package',
      amount: 25000,
      currency: 'USD',
      stage: 'PROSPECT',
      probability: 50,
    },
    professional: {
      title: 'Professional Services',
      amount: 75000,
      currency: 'USD',
      stage: 'WON',
      probability: 100,
    },
  },
  ACTIVITIES: {
    discovery: {
      type: 'Call',
      subject: 'Discovery Call',
      description: 'Initial discovery call to understand requirements',
      isCompleted: true,
    },
    demo: {
      type: 'Meeting',
      subject: 'Product Demo',
      description: 'Schedule product demonstration',
      isCompleted: false,
    },
    followup: {
      type: 'Email',
      subject: 'Follow-up',
      description: 'Send follow-up email with proposal',
      isCompleted: false,
    },
  },
};

/**
 * Test-specific data for create operations (with unique timestamps to avoid collisions)
 * Suffix is generated ONCE at import time so every access returns the same value.
 */
const suffix = Date.now().toString().slice(-6);

export const TEST_DATA = {
  ORGANIZATION: {
    name: `E2E Test Corp ${suffix}`,
    website: 'https://e2e-test.example.com',
    city: 'Seattle',
    zip: '98101',
    country: 'USA',
  },
  CONTACT: {
    firstName: 'E2E',
    lastName: `Testsson${suffix}`,
    jobTitle: 'Test Manager',
    email: `e2e.test.${suffix}@example.com`,
    phone: '+1-555-9999',
  },
  DEAL: {
    title: `E2E Test Engagement ${suffix}`,
    amount: 50000,
    currency: 'USD',
    stage: 'LEAD',
    probability: 25,
  },
  ACTIVITY: {
    type: 'Meeting',
    subject: `E2E Test Meeting ${suffix}`,
    description: 'Test meeting created by E2E tests',
  },
  ACTIVITY_TYPE: {
    name: `Workshop ${suffix}`,
  },
};
