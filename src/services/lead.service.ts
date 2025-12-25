import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* -------------------- Select -------------------- */
const leadSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  orgId: true,
  createdAt: true,
  updatedAt: true,
  isVerified: true,
  isUnsubscribed: true,
};

export type LeadResponse = Prisma.LeadGetPayload<{ select: typeof leadSelect }>;

/* -------------------- Service -------------------- */
export class LeadService {
  static getById(id: string, orgId: string): Promise<LeadResponse | null> {
    return prisma.lead.findFirst({
      where: { id, orgId },
      select: leadSelect,
    });
  }

  static getAll(orgId: string): Promise<LeadResponse[]> {
    return prisma.lead.findMany({
      where: { orgId },
      // select: leadSelect,
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: true, 
        campaigns: true,
      },
    });
  }

  static create(data: Prisma.LeadCreateInput): Promise<LeadResponse> {
    return prisma.lead.create({ data, select: leadSelect });
  }

  static update(id: string, orgId: string, data: Prisma.LeadUpdateInput): Promise<LeadResponse> {
    return prisma.lead.update({
      where: { id, orgId },
      data,
      select: leadSelect,
    });
  }

  static deleteMany(ids: string[]): Promise<Prisma.BatchPayload> {
    return prisma.lead.deleteMany({ where: { id: { in: ids } } });
  }

  static search(orgId: string, query: string): Promise<LeadResponse[]> {
    return prisma.lead.findMany({
      where: {
        orgId,
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { firstName: { contains: query, mode: "insensitive" } },
          { lastName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: leadSelect,
    });
  }

  static filter(orgId: string, filters: any): Promise<LeadResponse[]> {
    const where: any = { orgId };
    if (filters.status !== undefined) where.isVerified = filters.status === "true";
    if (filters.startDate || filters.endDate) where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    return prisma.lead.findMany({ where, select: leadSelect });
  }

  static unsubscribe(email: string): Promise<Prisma.BatchPayload> {
    return prisma.lead.updateMany({
      where: { email },
      data: { isUnsubscribed: true, unsubscribedAt: new Date() },
    });
  }
}
