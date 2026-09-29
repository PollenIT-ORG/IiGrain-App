import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as enquiryService from "../services/contactEnquiry.service.js";
import type {
  CreateContactEnquiryBody,
  ListContactEnquiriesQuery,
  SetEnquiryReadBody,
  SetEnquiryResolvedBody,
  BulkDeleteEnquiriesBody,
  ReplyToEnquiryBody,
} from "../validators/contactEnquiry.schema.js";

/**
 * Public. Only the id and the time are echoed back: the caller already knows
 * what they typed, and returning the stored row would let anyone confirm what
 * landed on an address that is not theirs.
 */
export const submitEnquiry = asyncHandler(async (req, res) => {
  const body = req.body as CreateContactEnquiryBody;
  const enquiry = await enquiryService.submitEnquiry(body);
  return ApiResponse.send(
    res,
    201,
    "Thanks for getting in touch. Our team will reply by email.",
    { id: enquiry.id, createdAt: enquiry.created_at }
  );
});

export const listEnquiries = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListContactEnquiriesQuery;
  const { enquiries, unread, open, meta } = await enquiryService.getEnquiries({
    page: q.page,
    limit: q.limit,
    status: q.status,
    search: q.search,
  });
  return ApiResponse.send(
    res,
    200,
    "Enquiries fetched.",
    { enquiries, unread, open },
    meta
  );
});

export const getEnquiry = asyncHandler(async (req, res) => {
  const { enquiry, replies } = await enquiryService.getEnquiry(req.params.id);
  return ApiResponse.send(res, 200, "Enquiry fetched.", { enquiry, replies });
});

export const setEnquiryRead = asyncHandler(async (req, res) => {
  const { isRead } = req.body as SetEnquiryReadBody;
  const enquiry = await enquiryService.changeEnquiryRead(req.params.id, isRead);
  const label = isRead ? "read" : "unread";
  return ApiResponse.send(res, 200, `Enquiry marked ${label}.`, { enquiry });
});

export const setEnquiryResolved = asyncHandler(async (req, res) => {
  const { isResolved } = req.body as SetEnquiryResolvedBody;
  const enquiry = await enquiryService.changeEnquiryResolved(req.params.id, isResolved);
  const label = isResolved ? "resolved" : "reopened";
  return ApiResponse.send(res, 200, `Enquiry ${label}.`, { enquiry });
});

export const bulkDeleteEnquiries = asyncHandler(async (req, res) => {
  const { ids } = req.body as BulkDeleteEnquiriesBody;
  const removed = await enquiryService.removeEnquiries(ids);
  return ApiResponse.send(
    res,
    200,
    `${removed} enquir${removed === 1 ? "y" : "ies"} deleted.`,
    { removed }
  );
});

export const deleteEnquiry = asyncHandler(async (req, res) => {
  await enquiryService.removeEnquiry(req.params.id);
  return ApiResponse.send(res, 200, "Enquiry deleted successfully.");
});

/** Sends the reply and records it under the enquiry. */
export const replyToEnquiry = asyncHandler(async (req, res) => {
  const body = req.body as ReplyToEnquiryBody;
  const { enquiry, reply } = await enquiryService.replyToEnquiry(
    req.params.id,
    body,
    req.user!.sub
  );
  return ApiResponse.send(res, 201, "Reply sent.", { enquiry, reply });
});

/** What that email will look like, so nobody sends one blind. */
export const previewEnquiryReply = asyncHandler(async (req, res) => {
  const body = req.body as ReplyToEnquiryBody;
  const preview = await enquiryService.previewEnquiryReply(req.params.id, body);
  return ApiResponse.send(res, 200, "Preview ready.", preview);
});
