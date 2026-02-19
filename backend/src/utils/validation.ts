import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const emailSchema = z.string().email('Invalid email address');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['ADMIN', 'USER']).default('USER'),
});

export const organizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  website: z.string().url().optional().or(z.literal('')),
  street: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export const contactSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  jobTitle: z.string().optional(),
  contactRole: z.string().optional(),
  primaryOrganizationId: z.string().min(1, 'Organization is required'),
  ownerUserId: z.string().optional(),
  emails: z.array(
    z.object({
      email: emailSchema,
      isPrimary: z.boolean().default(false),
    })
  ).optional(),
  phones: z.array(
    z.object({
      phone: z.string(),
      type: z.string().optional(),
      isPrimary: z.boolean().default(false),
    })
  ).optional(),
});

export const dealSchema = z.object({
  title: z.string().min(1, 'Deal title is required'),
  organizationId: z.string().min(1, 'Organization is required'),
  contactIds: z.array(z.string()).optional(),
  amount: z.number().optional(),
  currency: z.string().default('USD'),
  expectedCloseDate: z.string().datetime().optional().or(z.literal('')).or(z.null()),
  stage: z.enum(['LEAD', 'PROSPECT', 'QUOTE', 'WON', 'LOST']).default('LEAD'),
  probability: z.number().min(0).max(100).optional(),
  reasonLost: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export const activitySchema = z.object({
  type: z.string().min(1, 'Activity type is required'),
  subject: z.string().min(1, 'Subject is required'),
  description: z.string().optional(),
  dueAt: z.string().datetime().optional().or(z.literal('')),
  relatedOrganizationId: z.string().optional(),
  organizationIds: z.array(z.string()).optional(),
  relatedDealId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  ownerUserId: z.string().optional(),
});

export const noteSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
  entityType: z.enum(['ORGANIZATION', 'CONTACT', 'DEAL']),
  entityId: z.string().min(1, 'Entity ID is required'),
});

export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

export const changeUserPasswordSchema = z.object({
  newPassword: passwordSchema,
});
