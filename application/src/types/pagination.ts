/** Shared pagination contract for the list endpoints that return a top-level
 *  `meta` sibling next to `data`:
 *  { success, message, data: {...}, meta: { page, limit, total, totalPages } } */

export const DEFAULT_PAGE_LIMIT = 20;
/** Backend caps `limit` at 100. */
export const MAX_PAGE_LIMIT = 100;

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface RawPageMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
}

/** Query params for a paginated request. `search` is omitted when blank so we
 *  never send `search=`. */
export const toPageParams = (
  query?: PageQuery,
): Record<string, string | number> => {
  const search = query?.search?.trim();
  const limit = Math.min(query?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  return {
    page: Math.max(query?.page ?? 1, 1),
    limit,
    ...(search ? { search } : {}),
  };
};

/** Tolerates a backend that omits `meta` (older deployment) by deriving a
 *  single-page meta from the returned item count. */
export const normalizePageMeta = (
  raw: RawPageMeta | undefined,
  itemCount: number,
  query?: PageQuery,
): PageMeta => {
  const page = raw?.page ?? Math.max(query?.page ?? 1, 1);
  const limit = raw?.limit ?? Math.min(query?.limit ?? DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT);
  const total = raw?.total ?? itemCount;
  const totalPages =
    raw?.totalPages ?? (limit > 0 ? Math.max(Math.ceil(total / limit), 1) : 1);
  return { page, limit, total, totalPages };
};

export const hasNextPage = (meta: PageMeta | null): boolean =>
  !!meta && meta.page < meta.totalPages;

/** Merge a freshly fetched page into the existing list: page 1 (or a new search)
 *  replaces, later pages append while de-duplicating by id. */
export const mergePage = <T>(
  existing: T[] | null,
  incoming: T[],
  page: number,
  getId: (item: T) => string,
): T[] => {
  if (page <= 1 || !existing) {
    return incoming;
  }
  const seen = new Set(existing.map(getId));
  return [...existing, ...incoming.filter(item => !seen.has(getId(item)))];
};
