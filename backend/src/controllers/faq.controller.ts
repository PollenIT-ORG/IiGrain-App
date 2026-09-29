import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as faqService from "../services/faq.service.js";
import type {
  CreateFaqBody,
  UpdateFaqBody,
  ListFaqsQuery,
  ReorderFaqsBody,
} from "../validators/faq.schema.js";

/** The help screen list. Public: it is read before and after signing in. */
export const publicFaqs = asyncHandler(async (_req, res) => {
  const faqs = await faqService.getPublicFaqs();
  return ApiResponse.send(res, 200, "FAQs fetched.", { faqs });
});

export const listFaqs = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListFaqsQuery;
  const { faqs, meta } = await faqService.getFaqs({
    page: q.page,
    limit: q.limit,
    status: q.status,
    search: q.search,
  });
  return ApiResponse.send(res, 200, "FAQs fetched.", { faqs }, meta);
});

export const getFaq = asyncHandler(async (req, res) => {
  const faq = await faqService.getFaq(req.params.id);
  return ApiResponse.send(res, 200, "FAQ fetched.", { faq });
});

export const createFaq = asyncHandler(async (req, res) => {
  const body = req.body as CreateFaqBody;
  const faq = await faqService.addFaq(body);
  return ApiResponse.send(res, 201, "FAQ created successfully.", { faq });
});

export const updateFaq = asyncHandler(async (req, res) => {
  const body = req.body as UpdateFaqBody;
  const faq = await faqService.editFaq(req.params.id, body);
  return ApiResponse.send(res, 200, "FAQ updated successfully.", { faq });
});

export const deleteFaq = asyncHandler(async (req, res) => {
  await faqService.removeFaq(req.params.id);
  return ApiResponse.send(res, 200, "FAQ deleted successfully.");
});

export const reorderFaqs = asyncHandler(async (req, res) => {
  const { items } = req.body as ReorderFaqsBody;
  await faqService.reorder(items);
  return ApiResponse.send(res, 200, "FAQs reordered.");
});
