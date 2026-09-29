import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { getClock, formatDateTime } from "../utils/datetime.js";
import { broadcastToAdmins } from "./realtime.service.js";
import { notifyOrgManagers } from "./notification.service.js";
import { sendContactReplyEmail } from "./mailer.service.js";
import { contactReplyEmail } from "./emailTemplates.js";
import {
  createEnquiry,
  listEnquiries,
  findEnquiryById,
  setEnquiryRead,
  setEnquiryResolved,
  deleteEnquiry,
  deleteEnquiries,
  createEnquiryReply,
  listEnquiryReplies,
  type PublicEnquiry,
  type PublicEnquiryReply,
} from "../models/contactEnquiry.model.js";

interface CreateInput {
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
}

/**
 * Public: anyone can send one, including somebody whose account was switched
 * off and who therefore cannot sign in to report it. Nothing about the caller
 * is trusted, so only the validated body is stored.
 */
export async function submitEnquiry(input: CreateInput): Promise<PublicEnquiry> {
  const enquiry = await createEnquiry({
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    subject: input.subject,
    message: input.message,
  });

  // Telling the office is a nicety; a failure there must not lose the message.
  try {
    await notifyOrgManagers({
      type: "contact_enquiry",
      title: "New contact enquiry",
      body: `${enquiry.name}: ${enquiry.subject}`,
      data: { enquiryId: enquiry.id },
    });
  } catch (err) {
    logger.warn("Could not notify managers of a contact enquiry", err);
  }

  broadcastToAdmins("contact_enquiries");
  return enquiry;
}

interface ListInput {
  page: number;
  limit: number;
  status?: "read" | "unread" | "resolved" | "open";
  search?: string;
}

export async function getEnquiries(input: ListInput): Promise<{
  enquiries: PublicEnquiry[];
  unread: number;
  open: number;
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { rows, total, unread, open } = await listEnquiries({
    status: input.status,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    enquiries: rows,
    unread,
    open,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

/** Opening one marks it read, which is what the unread badge counts. */
export async function getEnquiry(
  id: string
): Promise<{ enquiry: PublicEnquiry; replies: PublicEnquiryReply[] }> {
  const enquiry = await findEnquiryById(id);
  if (!enquiry) throw ApiError.notFound("Enquiry not found.");
  const replies = await listEnquiryReplies(id);
  if (!enquiry.is_read) {
    const updated = await setEnquiryRead(id, true);
    broadcastToAdmins("contact_enquiries");
    return { enquiry: updated ?? enquiry, replies };
  }
  return { enquiry, replies };
}

export async function changeEnquiryRead(
  id: string,
  isRead: boolean
): Promise<PublicEnquiry> {
  const updated = await setEnquiryRead(id, isRead);
  if (!updated) throw ApiError.notFound("Enquiry not found.");
  broadcastToAdmins("contact_enquiries");
  return updated;
}

export async function changeEnquiryResolved(
  id: string,
  isResolved: boolean
): Promise<PublicEnquiry> {
  const updated = await setEnquiryResolved(id, isResolved);
  if (!updated) throw ApiError.notFound("Enquiry not found.");
  broadcastToAdmins("contact_enquiries");
  return updated;
}

export async function removeEnquiry(id: string): Promise<void> {
  const ok = await deleteEnquiry(id);
  if (!ok) throw ApiError.notFound("Enquiry not found.");
  broadcastToAdmins("contact_enquiries");
}

/**
 * Ids already gone are simply not counted, so a stale selection removes what it
 * can rather than failing the lot.
 */
export async function removeEnquiries(ids: string[]): Promise<number> {
  const removed = await deleteEnquiries(ids);
  if (removed > 0) broadcastToAdmins("contact_enquiries");
  return removed;
}

interface ReplyInput {
  subject: string;
  message: string;
  resolve?: boolean;
}

interface ReplyContent {
  name: string;
  subject: string;
  message: string;
  enquirySubject: string | null;
  enquiryMessage: string;
  enquiryDate: string;
}

// Built in one place so the preview and the email that goes out cannot drift.
async function replyContent(
  enquiry: PublicEnquiry,
  input: ReplyInput
): Promise<ReplyContent> {
  const clock = await getClock();
  return {
    name: enquiry.name,
    subject: input.subject,
    message: input.message,
    enquirySubject: enquiry.subject,
    enquiryMessage: enquiry.message,
    enquiryDate: formatDateTime(enquiry.created_at, clock),
  };
}

/**
 * Answers an enquiry by email and keeps a copy. Only the subject and the
 * message are written in the panel; the logo, the greeting and the quoted
 * enquiry come from the template, so every reply leaves looking the same.
 */
export async function replyToEnquiry(
  id: string,
  input: ReplyInput,
  actorId: string
): Promise<{ enquiry: PublicEnquiry; reply: PublicEnquiryReply }> {
  const enquiry = await findEnquiryById(id);
  if (!enquiry) throw ApiError.notFound("Enquiry not found.");

  const { sent, error } = await sendContactReplyEmail({
    to: enquiry.email,
    ...(await replyContent(enquiry, input)),
  });
  // Nothing is recorded unless it actually went, so the thread can never show
  // an answer the producer was never sent.
  if (!sent) {
    throw ApiError.badRequest(
      error ? `The reply was not sent. ${error}` : "The reply could not be sent."
    );
  }

  const reply = await createEnquiryReply({
    enquiryId: enquiry.id,
    toEmail: enquiry.email,
    subject: input.subject,
    message: input.message,
    sentBy: actorId,
  });

  // Answering it is reading it. Resolving happens only when the panel asked.
  const updated = input.resolve
    ? await setEnquiryResolved(id, true)
    : await setEnquiryRead(id, true);
  broadcastToAdmins("contact_enquiries");
  return { enquiry: updated ?? enquiry, reply };
}

/** The very email the reply would send, rendered but not sent. */
export async function previewEnquiryReply(
  id: string,
  input: ReplyInput
): Promise<{ subject: string; html: string }> {
  const enquiry = await findEnquiryById(id);
  if (!enquiry) throw ApiError.notFound("Enquiry not found.");
  const content = contactReplyEmail(await replyContent(enquiry, input));
  return { subject: content.subject, html: content.html };
}
