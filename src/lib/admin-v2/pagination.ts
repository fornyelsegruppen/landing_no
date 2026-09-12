export const ADMIN_LIST_PAGE_SIZE = 25;
export const ADMIN_LIST_MAX_PAGE = 10_000;

export type AdminListPagination = {
  page?: number;
  limit?: number;
};

export type AdminListPaginationMeta = {
  hasNextPage: boolean;
  hasPrevPage: boolean;
  page: number;
  totalDocs: number;
  totalPages: number;
};

export function parseAdminListPage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0
    ? Math.min(page, ADMIN_LIST_MAX_PAGE)
    : 1;
}

export function normalizeAdminListPagination(
  input: AdminListPagination = {},
): Required<AdminListPagination> {
  const page =
    Number.isSafeInteger(input.page) && Number(input.page) > 0
      ? Math.min(Number(input.page), ADMIN_LIST_MAX_PAGE)
      : 1;
  const limit =
    Number.isInteger(input.limit) && Number(input.limit) > 0
      ? Math.min(Number(input.limit), 50)
      : ADMIN_LIST_PAGE_SIZE;
  return { page, limit };
}

export function adminListPaginationMeta(
  totalDocs: number,
  input: AdminListPagination = {},
): AdminListPaginationMeta {
  const { page, limit } = normalizeAdminListPagination(input);
  const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
  const currentPage = Math.min(page, totalPages);
  return {
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
    page: currentPage,
    totalDocs,
    totalPages,
  };
}

export function adminListPageHref(
  pathname: string,
  params: Record<string, string | string[] | undefined>,
  page: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value))
      value.forEach((entry) => query.append(key, entry));
    else if (value !== undefined && value !== "") query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  else query.delete("page");
  const serialized = query.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}
