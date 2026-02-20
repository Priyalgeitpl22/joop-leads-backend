import { Prisma, PrismaClient } from "@prisma/client";
import { IAddUser, ICreateUser } from "../models/user.model";

const prisma = new PrismaClient();

/* -------------------- Select -------------------- */
const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  profilePicture: true,
  isVerified: true,
  isActive: true,
  lastLoginAt: true,
  timezone: true,
  createdAt: true,
  updatedAt: true,
  orgId: true,
};

export type UserResponse = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

/* -------------------- Service -------------------- */
export class UserService {
  static getByOrg(orgId: string): Promise<UserResponse[]> {
    return prisma.user.findMany({ where: { orgId, isDeleted: false }, select: userSelect });
  }

  static getById(id: string, orgId: string): Promise<UserResponse | null> {
    return prisma.user.findFirst({
      where: { id, orgId, isDeleted: false },
      select: userSelect,
    });
  }

  static getByEmail(email: string): Promise<UserResponse | null> {
    return prisma.user.findFirst({ where: { email, isDeleted: false }, select: userSelect });
  }

  static create(data: IAddUser): Promise<UserResponse> {
    return prisma.user.create({ data: {
      email: data.email,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role,
      isVerified: false,
      isActive: false,
      password: 'Test@123',
      organization: {
        connect: {
          id: data.orgId,
        },
      },
    }, select: userSelect });  
  }

  static update(id: string, data: Prisma.UserUpdateInput): Promise<UserResponse> {
    return prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  }

  static delete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { isDeleted: true , deletedAt: new Date() },
    });
  }

  static search(orgId: string, q: string): Promise<UserResponse[]> {
    return prisma.user.findMany({
      where: {
        orgId,
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } },
        ],
        isDeleted: false,
      },
      select: userSelect,
    });
  }
}
