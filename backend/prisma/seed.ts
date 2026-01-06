import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Configurable via environment variables
  const tenantName = process.env.SEED_TENANT_NAME || 'Demo Company';
  const tenantSlug = process.env.SEED_TENANT_SLUG || 'demo';
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@demo.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
  const salesEmail = process.env.SEED_SALES_EMAIL || 'sales@demo.com';
  const salesPassword = process.env.SEED_SALES_PASSWORD || 'Sales123!';

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: {},
    create: {
      name: tenantName,
      slug: tenantSlug,
    },
  });

  console.log(`Created tenant: ${tenant.name}`);

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
    },
  });

  console.log(`Created admin user: ${adminUser.email}`);

  const salesUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: salesEmail } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: salesEmail,
      passwordHash: await bcrypt.hash(salesPassword, 12),
      firstName: 'Sales',
      lastName: 'Rep',
      role: 'USER',
    },
  });

  console.log(`Created sales user: ${salesUser.email}`);

  const activityTypes = ['Call', 'Meeting', 'Lunch', 'Email', 'Note'];
  for (const typeName of activityTypes) {
    await prisma.activityType.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: typeName } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: typeName,
      },
    });
  }

  console.log('Created activity types');

  const org1 = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: 'Acme Corporation',
      website: 'https://acme.example.com',
      street: '123 Main St',
      city: 'San Francisco',
      zip: '94102',
      country: 'USA',
      ownerUserId: salesUser.id,
      createdByUserId: adminUser.id,
    },
  });

  const org2 = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: 'TechStart Inc',
      website: 'https://techstart.example.com',
      street: '456 Innovation Ave',
      city: 'Austin',
      zip: '78701',
      country: 'USA',
      ownerUserId: salesUser.id,
      createdByUserId: adminUser.id,
    },
  });

  const org3 = await prisma.organization.create({
    data: {
      tenantId: tenant.id,
      name: 'Global Solutions Ltd',
      website: 'https://globalsolutions.example.com',
      city: 'New York',
      zip: '10001',
      country: 'USA',
      ownerUserId: adminUser.id,
      createdByUserId: adminUser.id,
    },
  });

  console.log('Created organizations');

  const contact1 = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'CEO',
      contactRole: 'Decision Maker',
      primaryOrganizationId: org1.id,
      ownerUserId: salesUser.id,
      createdByUserId: adminUser.id,
      emails: {
        create: [
          { email: 'john.doe@acme.example.com', isPrimary: true },
          { email: 'jdoe@acme.example.com', isPrimary: false },
        ],
      },
      phones: {
        create: [
          { phone: '+1-555-0101', type: 'Mobile', isPrimary: true },
          { phone: '+1-555-0102', type: 'Office', isPrimary: false },
        ],
      },
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Jane',
      lastName: 'Smith',
      jobTitle: 'CTO',
      contactRole: 'Influencer',
      primaryOrganizationId: org1.id,
      ownerUserId: salesUser.id,
      createdByUserId: adminUser.id,
      emails: {
        create: [{ email: 'jane.smith@acme.example.com', isPrimary: true }],
      },
      phones: {
        create: [{ phone: '+1-555-0201', type: 'Mobile', isPrimary: true }],
      },
    },
  });

  const contact3 = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Bob',
      lastName: 'Johnson',
      jobTitle: 'Founder',
      contactRole: 'Decision Maker',
      primaryOrganizationId: org2.id,
      ownerUserId: salesUser.id,
      createdByUserId: adminUser.id,
      emails: {
        create: [{ email: 'bob@techstart.example.com', isPrimary: true }],
      },
    },
  });

  console.log('Created contacts');

  const deal1 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      title: 'Enterprise Platform License',
      organizationId: org1.id,
      amount: 150000,
      currency: 'USD',
      expectedCloseDate: new Date('2025-02-15'),
      stage: 'QUOTE',
      probability: 75,
      ownerUserId: salesUser.id,
      createdByUserId: adminUser.id,
      contacts: {
        create: [
          { contactId: contact1.id },
          { contactId: contact2.id },
        ],
      },
    },
  });

  const deal2 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      title: 'Startup Package',
      organizationId: org2.id,
      amount: 25000,
      currency: 'USD',
      expectedCloseDate: new Date('2025-01-30'),
      stage: 'PROSPECT',
      probability: 50,
      ownerUserId: salesUser.id,
      createdByUserId: adminUser.id,
      contacts: {
        create: [{ contactId: contact3.id }],
      },
    },
  });

  const deal3 = await prisma.deal.create({
    data: {
      tenantId: tenant.id,
      title: 'Professional Services',
      organizationId: org3.id,
      amount: 75000,
      currency: 'USD',
      stage: 'WON',
      probability: 100,
      ownerUserId: adminUser.id,
      createdByUserId: adminUser.id,
    },
  });

  console.log('Created deals');

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      type: 'Call',
      subject: 'Discovery Call',
      description: 'Initial discovery call to understand requirements',
      isCompleted: true,
      completedAt: new Date(),
      relatedOrganizationId: org1.id,
      relatedDealId: deal1.id,
      ownerUserId: salesUser.id,
      createdByUserId: salesUser.id,
      contacts: {
        create: [{ contactId: contact1.id }],
      },
    },
  });

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      type: 'Meeting',
      subject: 'Product Demo',
      description: 'Schedule product demonstration',
      dueAt: new Date('2025-01-20'),
      isCompleted: false,
      relatedOrganizationId: org1.id,
      relatedDealId: deal1.id,
      ownerUserId: salesUser.id,
      createdByUserId: salesUser.id,
      contacts: {
        create: [
          { contactId: contact1.id },
          { contactId: contact2.id },
        ],
      },
    },
  });

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      type: 'Email',
      subject: 'Follow-up',
      description: 'Send follow-up email with proposal',
      dueAt: new Date('2025-01-18'),
      isCompleted: false,
      relatedOrganizationId: org2.id,
      relatedDealId: deal2.id,
      ownerUserId: salesUser.id,
      createdByUserId: salesUser.id,
      contacts: {
        create: [{ contactId: contact3.id }],
      },
    },
  });

  console.log('Created activities');

  await prisma.note.create({
    data: {
      tenantId: tenant.id,
      content: 'Very interested in enterprise features. Budget approved.',
      entityType: 'DEAL',
      entityId: deal1.id,
      createdByUserId: salesUser.id,
    },
  });

  await prisma.note.create({
    data: {
      tenantId: tenant.id,
      content: 'Key decision maker. Prefers email communication.',
      entityType: 'CONTACT',
      entityId: contact1.id,
      createdByUserId: salesUser.id,
    },
  });

  await prisma.note.create({
    data: {
      tenantId: tenant.id,
      content: 'Fortune 500 company. High priority account.',
      entityType: 'ORGANIZATION',
      entityId: org1.id,
      createdByUserId: adminUser.id,
    },
  });

  console.log('Created notes');

  console.log('\n=== Seed completed successfully ===');
  console.log('\nDemo credentials:');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Sales: ${salesEmail} / ${salesPassword}`);
  console.log(`\nTenant: ${tenantSlug}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
