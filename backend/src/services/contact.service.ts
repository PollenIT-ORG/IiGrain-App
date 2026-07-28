import ApiError from "../utils/ApiError.js";
import { broadcastToAdmins } from "./realtime.service.js";
import {
  createEnquiry,
  listEnquiries,
  markEnquiryRead,
  softDeleteEnquiry,
  type PublicEnquiry,
} from "../models/contactEnquiry.model.js";

export async function submitEnquiry(input: {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
}): Promise<PublicEnquiry> {
  const enquiry = await createEnquiry({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    subject: input.subject?.trim() || null,
    message: input.message.trim(),
  });
  broadcastToAdmins("contact_enquiries", { enquiryId: enquiry.id });
  return enquiry;
}

export interface ListInput {
  page: number;
  limit: number;
  unreadOnly?: boolean;
  search?: string;
}

export async function getEnquiries(input: ListInput) {
  const { rows, total, unread } = await listEnquiries({
    unreadOnly: input.unreadOnly,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    enquiries: rows,
    unreadCount: unread,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function setRead(id: string, isRead: boolean): Promise<void> {
  const ok = await markEnquiryRead(id, isRead);
  if (!ok) throw ApiError.notFound("Enquiry not found.");
  broadcastToAdmins("contact_enquiries", { enquiryId: id });
}

export async function removeEnquiry(id: string): Promise<void> {
  const ok = await softDeleteEnquiry(id);
  if (!ok) throw ApiError.notFound("Enquiry not found.");
  broadcastToAdmins("contact_enquiries", { enquiryId: id });
}
