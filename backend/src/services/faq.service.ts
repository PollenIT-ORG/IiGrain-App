import ApiError from "../utils/ApiError.js";
import { broadcastToAdmins } from "./realtime.service.js";
import {
  listActiveFaqs,
  listFaqs,
  findFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
  nextSortOrder,
  type PublicFaq,
} from "../models/faq.model.js";

/** The help screen list: live, switched on, in order. */
export async function getPublicFaqs(): Promise<PublicFaq[]> {
  return listActiveFaqs();
}

interface ListInput {
  page: number;
  limit: number;
  status?: "active" | "inactive";
  search?: string;
}

export async function getFaqs(input: ListInput): Promise<{
  faqs: PublicFaq[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { rows, total } = await listFaqs({
    status: input.status,
    search: input.search,
    limit: input.limit,
    offset: (input.page - 1) * input.limit,
  });
  return {
    faqs: rows,
    meta: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
}

export async function getFaq(id: string): Promise<PublicFaq> {
  const faq = await findFaqById(id);
  if (!faq) throw ApiError.notFound("FAQ not found.");
  return faq;
}

interface CreateInput {
  question: string;
  answer: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function addFaq(input: CreateInput): Promise<PublicFaq> {
  // Left blank, a new entry goes to the bottom rather than fighting for 0.
  const sortOrder = input.sortOrder ?? (await nextSortOrder());
  const faq = await createFaq({
    question: input.question,
    answer: input.answer,
    sortOrder,
    isActive: input.isActive ?? true,
  });
  broadcastToAdmins("faqs");
  return faq;
}

interface UpdateInput {
  question?: string;
  answer?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function editFaq(
  id: string,
  input: UpdateInput
): Promise<PublicFaq> {
  const updated = await updateFaq(id, input);
  if (!updated) throw ApiError.notFound("FAQ not found.");
  broadcastToAdmins("faqs");
  return updated;
}

export async function removeFaq(id: string): Promise<void> {
  const ok = await deleteFaq(id);
  if (!ok) throw ApiError.notFound("FAQ not found.");
  broadcastToAdmins("faqs");
}

/** Every id has to be a live FAQ, otherwise the whole reorder is refused. */
export async function reorder(
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  const moved = await reorderFaqs(items);
  if (moved !== items.length) {
    throw ApiError.notFound("One of those FAQs no longer exists. Refresh and try again.");
  }
  broadcastToAdmins("faqs");
}
