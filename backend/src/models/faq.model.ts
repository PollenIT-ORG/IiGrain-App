import { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { softDelete } from "../db/softDelete.js";

export interface PublicFaq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const FAQ_SELECT = {
  id: true,
  question: true,
  answer: true,
  sort_order: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.faqsSelect;

export interface ListFaqsFilters {
  status?: "active" | "inactive";
  search?: string;
  limit: number;
  offset: number;
}

/** What the app reads: live and switched on, in the order the panel set. */
export async function listActiveFaqs(): Promise<PublicFaq[]> {
  return prisma.faqs.findMany({
    where: { deleted_at: null, is_active: true },
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    select: FAQ_SELECT,
  });
}

/** What the panel reads: everything, switched off ones included. */
export async function listFaqs(
  filters: ListFaqsFilters
): Promise<{ rows: PublicFaq[]; total: number }> {
  const where: Prisma.faqsWhereInput = { deleted_at: null };
  if (filters.status) where.is_active = filters.status === "active";
  if (filters.search) {
    where.OR = [
      { question: { contains: filters.search, mode: "insensitive" } },
      { answer: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.faqs.findMany({
      where,
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
      take: filters.limit,
      skip: filters.offset,
      select: FAQ_SELECT,
    }),
    prisma.faqs.count({ where }),
  ]);
  return { rows, total };
}

export async function findFaqById(id: string): Promise<PublicFaq | null> {
  return prisma.faqs.findFirst({
    where: { id, deleted_at: null },
    select: FAQ_SELECT,
  });
}

/** One past the current highest, so a new entry lands at the bottom. */
export async function nextSortOrder(): Promise<number> {
  const last = await prisma.faqs.findFirst({
    where: { deleted_at: null },
    orderBy: { sort_order: "desc" },
    select: { sort_order: true },
  });
  return (last?.sort_order ?? -1) + 1;
}

interface CreateFaqParams {
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

export async function createFaq(p: CreateFaqParams): Promise<PublicFaq> {
  return prisma.faqs.create({
    data: {
      question: p.question,
      answer: p.answer,
      sort_order: p.sortOrder,
      is_active: p.isActive,
    },
    select: FAQ_SELECT,
  });
}

interface UpdateFaqParams {
  question?: string;
  answer?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function updateFaq(
  id: string,
  p: UpdateFaqParams
): Promise<PublicFaq | null> {
  const data: Prisma.faqsUncheckedUpdateManyInput = {};
  if (p.question !== undefined) data.question = p.question;
  if (p.answer !== undefined) data.answer = p.answer;
  if (p.sortOrder !== undefined) data.sort_order = p.sortOrder;
  if (p.isActive !== undefined) data.is_active = p.isActive;

  if (Object.keys(data).length === 0) return findFaqById(id);
  data.updated_at = new Date();

  const { count } = await prisma.faqs.updateMany({
    where: { id, deleted_at: null },
    data,
  });
  if (!count) return null;
  return findFaqById(id);
}

export async function deleteFaq(id: string): Promise<boolean> {
  return (await softDelete("faqs", id)) > 0;
}

/**
 * One statement for the whole list rather than one per row, so a long reorder
 * is a single round trip. Returns how many rows actually moved, which tells the
 * caller whether every id in the request was real.
 */
export async function reorderFaqs(
  items: { id: string; sortOrder: number }[]
): Promise<number> {
  if (items.length === 0) return 0;
  const values = Prisma.join(
    items.map((i) => Prisma.sql`(${i.id}::uuid, ${i.sortOrder}::int)`)
  );
  return prisma.$executeRaw(Prisma.sql`
    UPDATE faqs AS f
       SET sort_order = v.sort_order,
           updated_at = now()
      FROM (VALUES ${values}) AS v(id, sort_order)
     WHERE f.id = v.id
       AND f.deleted_at IS NULL;`);
}
