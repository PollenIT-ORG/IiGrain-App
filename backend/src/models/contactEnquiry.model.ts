import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";

// Messages submitted through the website contact form.

export interface PublicEnquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: Date;
}

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  message: true,
  is_read: true,
  created_at: true,
};

export async function createEnquiry(p: {
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
}): Promise<PublicEnquiry> {
  return prisma.contact_enquiries.create({
    data: {
      name: p.name,
      email: p.email,
      phone: p.phone,
      subject: p.subject,
      message: p.message,
    },
    select: SELECT,
  });
}

export interface ListEnquiriesFilters {
  unreadOnly?: boolean;
  search?: string;
  limit: number;
  offset: number;
}

export async function listEnquiries(
  f: ListEnquiriesFilters
): Promise<{ rows: PublicEnquiry[]; total: number; unread: number }> {
  const where: Prisma.contact_enquiriesWhereInput = {
    deleted_at: null,
    ...(f.unreadOnly ? { is_read: false } : {}),
    ...(f.search
      ? {
          OR: [
            { name: { contains: f.search, mode: "insensitive" } },
            { email: { contains: f.search, mode: "insensitive" } },
            { subject: { contains: f.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total, unread] = await Promise.all([
    prisma.contact_enquiries.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: f.limit,
      skip: f.offset,
      select: SELECT,
    }),
    prisma.contact_enquiries.count({ where }),
    prisma.contact_enquiries.count({ where: { deleted_at: null, is_read: false } }),
  ]);
  return { rows, total, unread };
}

export async function markEnquiryRead(
  id: string,
  isRead: boolean
): Promise<boolean> {
  const { count } = await prisma.contact_enquiries.updateMany({
    where: { id, deleted_at: null },
    data: { is_read: isRead, updated_at: new Date() },
  });
  return count > 0;
}

export async function softDeleteEnquiry(id: string): Promise<boolean> {
  const now = new Date();
  const { count } = await prisma.contact_enquiries.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: now, updated_at: now },
  });
  return count > 0;
}
