import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* -------------------- Select -------------------- */
const orgSelect = {
  id: true,
  name: true,
  domain: true,
  createdAt: true,
  updatedAt: true,
};

export type OrganizationResponse = Prisma.OrganizationGetPayload<{
  select: typeof orgSelect;
}>;

/* -------------------- Service -------------------- */
export class OrganizationService {
  static getById(id: string): Promise<OrganizationResponse | null> {
    return prisma.organization.findUnique({
      where: { id },
      select: orgSelect,
    });
  }

  static create(data: Prisma.OrganizationCreateInput): Promise<OrganizationResponse> {
    return prisma.organization.create({ data, select: orgSelect });
  }

  static update(id: string, data: Prisma.OrganizationUpdateInput): Promise<OrganizationResponse> {
    return prisma.organization.update({ where: { id }, data, select: orgSelect });
  }
}
