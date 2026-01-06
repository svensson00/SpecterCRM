import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { NoteEntityType } from '@prisma/client';

export class NoteService {
  static async create(
    data: {
      content: string;
      entityType: NoteEntityType;
      entityId: string;
    },
    tenantId: string,
    createdByUserId: string
  ) {
    const entityExists = await this.validateEntity(data.entityType, data.entityId, tenantId);

    if (!entityExists) {
      throw new AppError(404, `${data.entityType} not found`);
    }

    const note = await prisma.note.create({
      data: {
        content: data.content,
        entityType: data.entityType,
        entityId: data.entityId,
        tenantId,
        createdByUserId,
      },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return note;
  }

  static async findByEntity(entityType: NoteEntityType, entityId: string, tenantId: string) {
    const notes = await prisma.note.findMany({
      where: { tenantId, entityType, entityId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notes;
  }

  static async findById(id: string, tenantId: string) {
    const note = await prisma.note.findFirst({
      where: { id, tenantId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!note) {
      throw new AppError(404, 'Note not found');
    }

    return note;
  }

  static async update(
    id: string,
    content: string,
    tenantId: string,
    updatedByUserId: string
  ) {
    await this.findById(id, tenantId);

    const note = await prisma.note.update({
      where: { id },
      data: { content, updatedByUserId },
      include: {
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return note;
  }

  static async delete(id: string, tenantId: string) {
    await this.findById(id, tenantId);
    await prisma.note.delete({ where: { id } });
  }

  private static async validateEntity(
    entityType: NoteEntityType,
    entityId: string,
    tenantId: string
  ): Promise<boolean> {
    switch (entityType) {
      case 'ORGANIZATION':
        return !!(await prisma.organization.findFirst({ where: { id: entityId, tenantId } }));
      case 'CONTACT':
        return !!(await prisma.contact.findFirst({ where: { id: entityId, tenantId } }));
      case 'DEAL':
        return !!(await prisma.deal.findFirst({ where: { id: entityId, tenantId } }));
      default:
        return false;
    }
  }
}
