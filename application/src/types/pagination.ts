export const DEFAULT_PAGE_LIMIT = 20;
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
