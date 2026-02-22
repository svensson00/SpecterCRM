import { describe, it, expect } from 'vitest';
import {
  passwordSchema,
  emailSchema,
  paginationSchema,
  loginSchema,
  registerSchema,
  organizationSchema,
  contactSchema,
  dealSchema,
  activitySchema,
  noteSchema,
  changeOwnPasswordSchema,
  changeUserPasswordSchema,
} from '../validation';

describe('passwordSchema', () => {
  it('should accept valid password with all requirements', () => {
    expect(() => passwordSchema.parse('Password1!')).not.toThrow();
    expect(() => passwordSchema.parse('Test1234#')).not.toThrow();
    expect(() => passwordSchema.parse('Admin@2024')).not.toThrow();
  });

  it('should reject password shorter than 8 characters', () => {
    expect(() => passwordSchema.parse('Test1!')).toThrow('Password must be at least 8 characters');
  });

  it('should reject password without uppercase letter', () => {
    expect(() => passwordSchema.parse('password1!')).toThrow('Password must contain at least one uppercase letter');
  });

  it('should reject password without number', () => {
    expect(() => passwordSchema.parse('Password!')).toThrow('Password must contain at least one number');
  });

  it('should reject password without special character', () => {
    expect(() => passwordSchema.parse('Password1')).toThrow('Password must contain at least one special character');
  });

  it('should accept various special characters', () => {
    expect(() => passwordSchema.parse('Password1!')).not.toThrow();
    expect(() => passwordSchema.parse('Password1@')).not.toThrow();
    expect(() => passwordSchema.parse('Password1#')).not.toThrow();
    expect(() => passwordSchema.parse('Password1$')).not.toThrow();
    expect(() => passwordSchema.parse('Password1%')).not.toThrow();
  });
});

describe('emailSchema', () => {
  it('should accept valid email addresses', () => {
    expect(() => emailSchema.parse('test@example.com')).not.toThrow();
    expect(() => emailSchema.parse('user+tag@domain.co.uk')).not.toThrow();
    expect(() => emailSchema.parse('first.last@company.io')).not.toThrow();
  });

  it('should reject invalid email addresses', () => {
    expect(() => emailSchema.parse('notanemail')).toThrow('Invalid email address');
    expect(() => emailSchema.parse('missing@domain')).toThrow('Invalid email address');
    expect(() => emailSchema.parse('@nodomain.com')).toThrow('Invalid email address');
    expect(() => emailSchema.parse('noatsign.com')).toThrow('Invalid email address');
  });

  it('should reject empty string', () => {
    expect(() => emailSchema.parse('')).toThrow('Invalid email address');
  });
});

describe('paginationSchema', () => {
  it('should apply default values when fields are missing', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.sortOrder).toBe('desc');
  });

  it('should coerce strings to numbers for page and limit', () => {
    const result = paginationSchema.parse({ page: '5', limit: '50' });
    expect(result.page).toBe(5);
    expect(result.limit).toBe(50);
  });

  it('should accept valid pagination parameters', () => {
    const result = paginationSchema.parse({ page: 2, limit: 100, sortBy: 'name', sortOrder: 'asc' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(100);
    expect(result.sortBy).toBe('name');
    expect(result.sortOrder).toBe('asc');
  });

  it('should reject non-positive page numbers', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    expect(() => paginationSchema.parse({ page: -1 })).toThrow();
  });

  it('should reject non-positive limit', () => {
    expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
    expect(() => paginationSchema.parse({ limit: -10 })).toThrow();
  });

  it('should reject limit exceeding 10000', () => {
    expect(() => paginationSchema.parse({ limit: 10001 })).toThrow();
  });

  it('should accept limit at max boundary', () => {
    const result = paginationSchema.parse({ limit: 10000 });
    expect(result.limit).toBe(10000);
  });

  it('should reject invalid sortOrder', () => {
    expect(() => paginationSchema.parse({ sortOrder: 'invalid' })).toThrow();
  });

  it('should handle sortBy as optional', () => {
    const result = paginationSchema.parse({});
    expect(result.sortBy).toBeUndefined();
  });
});

describe('loginSchema', () => {
  it('should accept valid login credentials', () => {
    const result = loginSchema.parse({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe('anypassword');
  });

  it('should reject invalid email', () => {
    expect(() => loginSchema.parse({
      email: 'notanemail',
      password: 'password',
    })).toThrow('Invalid email address');
  });

  it('should reject empty password', () => {
    expect(() => loginSchema.parse({
      email: 'user@example.com',
      password: '',
    })).toThrow('Password is required');
  });

  it('should reject missing email', () => {
    expect(() => loginSchema.parse({
      password: 'password',
    })).toThrow();
  });

  it('should reject missing password', () => {
    expect(() => loginSchema.parse({
      email: 'user@example.com',
    })).toThrow();
  });
});

describe('registerSchema', () => {
  it('should accept valid registration data', () => {
    const result = registerSchema.parse({
      email: 'newuser@example.com',
      password: 'Password123!',
      firstName: 'John',
      lastName: 'Doe',
      role: 'USER',
    });
    expect(result.email).toBe('newuser@example.com');
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.role).toBe('USER');
  });

  it('should apply default role USER when not specified', () => {
    const result = registerSchema.parse({
      email: 'newuser@example.com',
      password: 'Password123!',
    });
    expect(result.role).toBe('USER');
  });

  it('should accept ADMIN role', () => {
    const result = registerSchema.parse({
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'ADMIN',
    });
    expect(result.role).toBe('ADMIN');
  });

  it('should reject weak password without uppercase', () => {
    expect(() => registerSchema.parse({
      email: 'user@example.com',
      password: 'password123!',
    })).toThrow('Password must contain at least one uppercase letter');
  });

  it('should reject weak password without number', () => {
    expect(() => registerSchema.parse({
      email: 'user@example.com',
      password: 'Password!',
    })).toThrow('Password must contain at least one number');
  });

  it('should reject weak password without special character', () => {
    expect(() => registerSchema.parse({
      email: 'user@example.com',
      password: 'Password123',
    })).toThrow('Password must contain at least one special character');
  });

  it('should reject weak password too short', () => {
    expect(() => registerSchema.parse({
      email: 'user@example.com',
      password: 'Pass1!',
    })).toThrow('Password must be at least 8 characters');
  });

  it('should reject invalid email', () => {
    expect(() => registerSchema.parse({
      email: 'invalidemail',
      password: 'Password123!',
    })).toThrow('Invalid email address');
  });

  it('should reject invalid role', () => {
    expect(() => registerSchema.parse({
      email: 'user@example.com',
      password: 'Password123!',
      role: 'SUPERUSER',
    })).toThrow();
  });

  it('should accept optional firstName and lastName', () => {
    const result = registerSchema.parse({
      email: 'user@example.com',
      password: 'Password123!',
    });
    expect(result.firstName).toBeUndefined();
    expect(result.lastName).toBeUndefined();
  });
});

describe('organizationSchema', () => {
  it('should accept valid organization data', () => {
    const result = organizationSchema.parse({
      name: 'Acme Corp',
      website: 'https://acme.com',
      street: '123 Main St',
      city: 'Springfield',
      zip: '12345',
      country: 'USA',
      ownerUserId: 'user-123',
    });
    expect(result.name).toBe('Acme Corp');
    expect(result.website).toBe('https://acme.com');
  });

  it('should reject empty name', () => {
    expect(() => organizationSchema.parse({
      name: '',
    })).toThrow('Organization name is required');
  });

  it('should reject missing name', () => {
    expect(() => organizationSchema.parse({
      website: 'https://example.com',
    })).toThrow();
  });

  it('should accept empty string for website', () => {
    const result = organizationSchema.parse({
      name: 'Test Org',
      website: '',
    });
    expect(result.website).toBe('');
  });

  it('should reject invalid URL for website', () => {
    expect(() => organizationSchema.parse({
      name: 'Test Org',
      website: 'not-a-url',
    })).toThrow();
  });

  it('should accept valid URL for website', () => {
    const result = organizationSchema.parse({
      name: 'Test Org',
      website: 'https://example.com',
    });
    expect(result.website).toBe('https://example.com');
  });

  it('should accept optional fields as undefined', () => {
    const result = organizationSchema.parse({
      name: 'Minimal Org',
    });
    expect(result.street).toBeUndefined();
    expect(result.city).toBeUndefined();
    expect(result.zip).toBeUndefined();
    expect(result.country).toBeUndefined();
    expect(result.ownerUserId).toBeUndefined();
  });
});

describe('contactSchema', () => {
  it('should accept valid contact data', () => {
    const result = contactSchema.parse({
      firstName: 'John',
      lastName: 'Doe',
      jobTitle: 'CTO',
      contactRole: 'Decision Maker',
      primaryOrganizationId: 'org-123',
      ownerUserId: 'user-456',
      emails: [
        { email: 'john@example.com', isPrimary: true },
      ],
      phones: [
        { phone: '+1234567890', type: 'work', isPrimary: true },
      ],
    });
    expect(result.firstName).toBe('John');
    expect(result.lastName).toBe('Doe');
    expect(result.emails).toHaveLength(1);
    expect(result.phones).toHaveLength(1);
  });

  it('should reject empty firstName', () => {
    expect(() => contactSchema.parse({
      firstName: '',
      lastName: 'Doe',
      primaryOrganizationId: 'org-123',
    })).toThrow('First name is required');
  });

  it('should reject empty lastName', () => {
    expect(() => contactSchema.parse({
      firstName: 'John',
      lastName: '',
      primaryOrganizationId: 'org-123',
    })).toThrow('Last name is required');
  });

  it('should reject missing primaryOrganizationId', () => {
    expect(() => contactSchema.parse({
      firstName: 'John',
      lastName: 'Doe',
      primaryOrganizationId: '',
    })).toThrow();
  });

  it('should accept optional fields as undefined', () => {
    const result = contactSchema.parse({
      firstName: 'John',
      lastName: 'Doe',
      primaryOrganizationId: 'org-123',
    });
    expect(result.jobTitle).toBeUndefined();
    expect(result.contactRole).toBeUndefined();
    expect(result.ownerUserId).toBeUndefined();
    expect(result.emails).toBeUndefined();
    expect(result.phones).toBeUndefined();
  });

  it('should validate email format in emails array', () => {
    expect(() => contactSchema.parse({
      firstName: 'John',
      lastName: 'Doe',
      primaryOrganizationId: 'org-123',
      emails: [
        { email: 'invalid-email', isPrimary: true },
      ],
    })).toThrow('Invalid email address');
  });

  it('should apply default isPrimary false for emails', () => {
    const result = contactSchema.parse({
      firstName: 'John',
      lastName: 'Doe',
      primaryOrganizationId: 'org-123',
      emails: [
        { email: 'john@example.com' },
      ],
    });
    expect(result.emails![0].isPrimary).toBe(false);
  });

  it('should apply default isPrimary false for phones', () => {
    const result = contactSchema.parse({
      firstName: 'John',
      lastName: 'Doe',
      primaryOrganizationId: 'org-123',
      phones: [
        { phone: '+1234567890' },
      ],
    });
    expect(result.phones![0].isPrimary).toBe(false);
  });
});

describe('dealSchema', () => {
  it('should accept valid deal data', () => {
    const result = dealSchema.parse({
      title: 'Big Enterprise Deal',
      organizationId: 'org-123',
      contactIds: ['contact-1', 'contact-2'],
      amount: 50000,
      currency: 'EUR',
      expectedCloseDate: '2024-12-31T23:59:59Z',
      stage: 'PROSPECT',
      probability: 75,
      ownerUserId: 'user-456',
    });
    expect(result.title).toBe('Big Enterprise Deal');
    expect(result.stage).toBe('PROSPECT');
    expect(result.probability).toBe(75);
  });

  it('should apply default stage LEAD', () => {
    const result = dealSchema.parse({
      title: 'New Deal',
      organizationId: 'org-123',
    });
    expect(result.stage).toBe('LEAD');
  });

  it('should apply default currency USD', () => {
    const result = dealSchema.parse({
      title: 'New Deal',
      organizationId: 'org-123',
    });
    expect(result.currency).toBe('USD');
  });

  it('should reject empty title', () => {
    expect(() => dealSchema.parse({
      title: '',
      organizationId: 'org-123',
    })).toThrow('Deal title is required');
  });

  it('should reject empty organizationId', () => {
    expect(() => dealSchema.parse({
      title: 'Deal',
      organizationId: '',
    })).toThrow();
  });

  it('should reject invalid stage', () => {
    expect(() => dealSchema.parse({
      title: 'Deal',
      organizationId: 'org-123',
      stage: 'INVALID_STAGE',
    })).toThrow();
  });

  it('should accept all valid stages', () => {
    const stages = ['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST'];
    stages.forEach(stage => {
      const result = dealSchema.parse({
        title: 'Deal',
        organizationId: 'org-123',
        stage,
      });
      expect(result.stage).toBe(stage);
    });
  });

  it('should reject probability below 0', () => {
    expect(() => dealSchema.parse({
      title: 'Deal',
      organizationId: 'org-123',
      probability: -1,
    })).toThrow();
  });

  it('should reject probability above 100', () => {
    expect(() => dealSchema.parse({
      title: 'Deal',
      organizationId: 'org-123',
      probability: 101,
    })).toThrow();
  });

  it('should accept probability at boundaries', () => {
    const result1 = dealSchema.parse({
      title: 'Deal',
      organizationId: 'org-123',
      probability: 0,
    });
    expect(result1.probability).toBe(0);

    const result2 = dealSchema.parse({
      title: 'Deal',
      organizationId: 'org-123',
      probability: 100,
    });
    expect(result2.probability).toBe(100);
  });

  it('should accept empty string for expectedCloseDate', () => {
    const result = dealSchema.parse({
      title: 'Deal',
      organizationId: 'org-123',
      expectedCloseDate: '',
    });
    expect(result.expectedCloseDate).toBe('');
  });

  it('should accept null for expectedCloseDate', () => {
    const result = dealSchema.parse({
      title: 'Deal',
      organizationId: 'org-123',
      expectedCloseDate: null,
    });
    expect(result.expectedCloseDate).toBeNull();
  });

  it('should accept optional fields as undefined', () => {
    const result = dealSchema.parse({
      title: 'Minimal Deal',
      organizationId: 'org-123',
    });
    expect(result.contactIds).toBeUndefined();
    expect(result.amount).toBeUndefined();
    expect(result.expectedCloseDate).toBeUndefined();
    expect(result.probability).toBeUndefined();
    expect(result.reasonLost).toBeUndefined();
    expect(result.ownerUserId).toBeUndefined();
  });
});

describe('activitySchema', () => {
  it('should accept valid activity data', () => {
    const result = activitySchema.parse({
      type: 'Meeting',
      subject: 'Quarterly Review',
      description: 'Review progress and next steps',
      dueAt: '2024-12-31T14:00:00Z',
      relatedOrganizationId: 'org-123',
      organizationIds: ['org-123', 'org-456'],
      relatedDealId: 'deal-789',
      contactIds: ['contact-1', 'contact-2'],
      ownerUserId: 'user-456',
    });
    expect(result.type).toBe('Meeting');
    expect(result.subject).toBe('Quarterly Review');
  });

  it('should reject empty type', () => {
    expect(() => activitySchema.parse({
      type: '',
      subject: 'Test',
    })).toThrow('Activity type is required');
  });

  it('should reject empty subject', () => {
    expect(() => activitySchema.parse({
      type: 'Call',
      subject: '',
    })).toThrow('Subject is required');
  });

  it('should reject missing type', () => {
    expect(() => activitySchema.parse({
      subject: 'Test',
    })).toThrow();
  });

  it('should reject missing subject', () => {
    expect(() => activitySchema.parse({
      type: 'Call',
    })).toThrow();
  });

  it('should accept empty string for dueAt', () => {
    const result = activitySchema.parse({
      type: 'Task',
      subject: 'Follow up',
      dueAt: '',
    });
    expect(result.dueAt).toBe('');
  });

  it('should accept optional fields as undefined', () => {
    const result = activitySchema.parse({
      type: 'Email',
      subject: 'Introduction',
    });
    expect(result.description).toBeUndefined();
    expect(result.dueAt).toBeUndefined();
    expect(result.relatedOrganizationId).toBeUndefined();
    expect(result.organizationIds).toBeUndefined();
    expect(result.relatedDealId).toBeUndefined();
    expect(result.contactIds).toBeUndefined();
    expect(result.ownerUserId).toBeUndefined();
  });
});

describe('noteSchema', () => {
  it('should accept valid note data for ORGANIZATION', () => {
    const result = noteSchema.parse({
      content: 'Important note about this organization',
      entityType: 'ORGANIZATION',
      entityId: 'org-123',
    });
    expect(result.content).toBe('Important note about this organization');
    expect(result.entityType).toBe('ORGANIZATION');
    expect(result.entityId).toBe('org-123');
  });

  it('should accept valid note data for CONTACT', () => {
    const result = noteSchema.parse({
      content: 'Met at conference',
      entityType: 'CONTACT',
      entityId: 'contact-456',
    });
    expect(result.entityType).toBe('CONTACT');
  });

  it('should accept valid note data for DEAL', () => {
    const result = noteSchema.parse({
      content: 'Negotiation notes',
      entityType: 'DEAL',
      entityId: 'deal-789',
    });
    expect(result.entityType).toBe('DEAL');
  });

  it('should reject empty content', () => {
    expect(() => noteSchema.parse({
      content: '',
      entityType: 'ORGANIZATION',
      entityId: 'org-123',
    })).toThrow('Note content is required');
  });

  it('should reject missing content', () => {
    expect(() => noteSchema.parse({
      entityType: 'ORGANIZATION',
      entityId: 'org-123',
    })).toThrow();
  });

  it('should reject invalid entityType', () => {
    expect(() => noteSchema.parse({
      content: 'Test note',
      entityType: 'INVALID_TYPE',
      entityId: 'entity-123',
    })).toThrow();
  });

  it('should reject empty entityId', () => {
    expect(() => noteSchema.parse({
      content: 'Test note',
      entityType: 'ORGANIZATION',
      entityId: '',
    })).toThrow();
  });

  it('should reject missing entityId', () => {
    expect(() => noteSchema.parse({
      content: 'Test note',
      entityType: 'ORGANIZATION',
    })).toThrow();
  });
});

describe('changeOwnPasswordSchema', () => {
  it('should accept valid password change data', () => {
    const result = changeOwnPasswordSchema.parse({
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!',
    });
    expect(result.currentPassword).toBe('OldPassword123!');
    expect(result.newPassword).toBe('NewPassword456!');
  });

  it('should reject empty currentPassword', () => {
    expect(() => changeOwnPasswordSchema.parse({
      currentPassword: '',
      newPassword: 'NewPassword123!',
    })).toThrow('Current password is required');
  });

  it('should reject weak newPassword', () => {
    expect(() => changeOwnPasswordSchema.parse({
      currentPassword: 'OldPassword123!',
      newPassword: 'weak',
    })).toThrow();
  });

  it('should reject missing currentPassword', () => {
    expect(() => changeOwnPasswordSchema.parse({
      newPassword: 'NewPassword123!',
    })).toThrow();
  });

  it('should reject missing newPassword', () => {
    expect(() => changeOwnPasswordSchema.parse({
      currentPassword: 'OldPassword123!',
    })).toThrow();
  });
});

describe('changeUserPasswordSchema', () => {
  it('should accept valid new password', () => {
    const result = changeUserPasswordSchema.parse({
      newPassword: 'NewPassword123!',
    });
    expect(result.newPassword).toBe('NewPassword123!');
  });

  it('should reject weak password', () => {
    expect(() => changeUserPasswordSchema.parse({
      newPassword: 'weakpass',
    })).toThrow();
  });

  it('should reject missing newPassword', () => {
    expect(() => changeUserPasswordSchema.parse({})).toThrow();
  });

  it('should reject password without uppercase', () => {
    expect(() => changeUserPasswordSchema.parse({
      newPassword: 'password123!',
    })).toThrow('Password must contain at least one uppercase letter');
  });

  it('should reject password without number', () => {
    expect(() => changeUserPasswordSchema.parse({
      newPassword: 'Password!',
    })).toThrow('Password must contain at least one number');
  });

  it('should reject password without special character', () => {
    expect(() => changeUserPasswordSchema.parse({
      newPassword: 'Password123',
    })).toThrow('Password must contain at least one special character');
  });

  it('should reject password too short', () => {
    expect(() => changeUserPasswordSchema.parse({
      newPassword: 'Pass1!',
    })).toThrow('Password must be at least 8 characters');
  });
});
