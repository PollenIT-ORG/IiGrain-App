import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";

export interface PublicEnquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  is_resolved: boolean;
  resolved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const ENQUIRY_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  subject: true,
  message: true,
  is_read: true,
  is_resolved: true,
  resolved_at: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.contact_enquiriesSelect;

interface CreateEnquiryParams {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
}

export async function createEnquiry(
  p: CreateEnquiryParams
): Promise<PublicEnquiry> {
  return prisma.contact_enquiries.create({
    data: {
      name: p.name,
      email: p.email,
      phone: p.phone,
      subject: p.subject,
      message: p.message,
    },
    select: ENQUIRY_SELECT,
  });
}

export interface ListEnquiriesFilters {
  status?: "read" | "unread" | "resolved" | "open";
  search?: string;
  limit: number;
  offset: number;
}

export async function listEnquiries(
  filters: ListEnquiriesFilters
): Promise<{
  rows: PublicEnquiry[];
  total: number;
  unread: number;
  open: number;
}> {
  const where: Prisma.contact_enquiriesWhereInput = { deleted_at: null };
  // read and unread are about opening it; resolved and open are about dealing
  // with it, so the two pairs filter different columns.
  if (filters.status === "read" || filters.status === "unread") {
    where.is_read = filters.status === "read";
  } else if (filters.status === "resolved" || filters.status === "open") {
    where.is_resolved = filters.status === "resolved";
  }
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
      { message: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [rows, total, unread, open] = await Promise.all([
    prisma.contact_enquiries.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: filters.limit,
      skip: filters.offset,
      select: ENQUIRY_SELECT,
    }),
    prisma.contact_enquiries.count({ where }),
    // Both badges count the whole table, not just this page or this filter.
    prisma.contact_enquiries.count({ where: { deleted_at: null, is_read: false } }),
    prisma.contact_enquiries.count({ where: { deleted_at: null, is_resolved: false } }),
  ]);
  return { rows, total, unread, open };
}

export async function findEnquiryById(id: string): Promise<PublicEnquiry | null> {
  return prisma.contact_enquiries.findFirst({
    where: { id, deleted_at: null },
    select: ENQUIRY_SELECT,
  });
}

export async function setEnquiryRead(
  id: string,
  isRead: boolean
): Promise<PublicEnquiry | null> {
  const { count } = await prisma.contact_enquiries.updateMany({
    where: { id, deleted_at: null },
    data: { is_read: isRead, updated_at: new Date() },
  });
  if (!count) return null;
  return findEnquiryById(id);
}

export async function setEnquiryResolved(
  id: string,
  isResolved: boolean
): Promise<PublicEnquiry | null> {
  const { count } = await prisma.contact_enquiries.updateMany({
    where: { id, deleted_at: null },
    data: {
      is_resolved: isResolved,
      resolved_at: isResolved ? new Date() : null,
      // Resolving something implies it was read, so the two never disagree.
      ...(isResolved ? { is_read: true } : {}),
      updated_at: new Date(),
    },
  });
  if (!count) return null;
  return findEnquiryById(id);
}

export async function deleteEnquiry(id: string): Promise<boolean> {
  return (await softDelete("contact_enquiries", id)) > 0;
}

/** Returns how many were actually removed, so the caller can report it. */
export async function deleteEnquiries(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { count } = await prisma.contact_enquiries.updateMany({
    where: { id: { in: ids }, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  return count;
}

export interface PublicEnquiryReply {
  id: string;
  enquiry_id: string;
  to_email: string;
  subject: string;
  message: string;
  sent_by: string | null;
  sent_by_name: string | null;
  created_at: Date;
}

const REPLY_SELECT = {
  id: true,
  enquiry_id: true,
  to_email: true,
  subject: true,
  message: true,
  sent_by: true,
  created_at: true,
  users: { select: { full_name: true, email: true } },
} satisfies Prisma.contact_enquiry_repliesSelect;

type ReplyRow = Prisma.contact_enquiry_repliesGetPayload<{
  select: typeof REPLY_SELECT;
}>;

// The sender is carried as a name as well as an id, so the thread still says
// who answered once that account is gone.
function toPublicReply(row: ReplyRow): PublicEnquiryReply {
  return {
    id: row.id,
    enquiry_id: row.enquiry_id,
    to_email: row.to_email,
    subject: row.subject,
    message: row.message,
    sent_by: row.sent_by,
    sent_by_name: row.users?.full_name ?? row.users?.email ?? null,
    created_at: row.created_at,
  };
}

interface CreateReplyParams {
  enquiryId: string;
  toEmail: string;
  subject: string;
  message: string;
  sentBy: string | null;
}

export async function createEnquiryReply(
  p: CreateReplyParams
): Promise<PublicEnquiryReply> {
  const row = await prisma.contact_enquiry_replies.create({
    data: {
      enquiry_id: p.enquiryId,
      to_email: p.toEmail,
      subject: p.subject,
      message: p.message,
      sent_by: p.sentBy,
    },
    select: REPLY_SELECT,
  });
  return toPublicReply(row);
}

/** The thread under one enquiry, oldest first, the way it was written. */
export async function listEnquiryReplies(
  enquiryId: string
): Promise<PublicEnquiryReply[]> {
  const rows = await prisma.contact_enquiry_replies.findMany({
    where: { enquiry_id: enquiryId, deleted_at: null },
    orderBy: { created_at: "asc" },
    select: REPLY_SELECT,
  });
  return rows.map(toPublicReply);
}
