/** A page request as every list route takes it. */
type PageInput = { page: number; pageSize: number };

/** Rows to skip for the requested page. */
export const pageOffset = ({ page, pageSize }: PageInput) => (page - 1) * pageSize;

/** The pagination block of a list response. */
export const paginationOf = ({ page, pageSize }: PageInput, totalItems: number) => ({
  page,
  pageSize,
  totalItems,
  totalPages: totalItems ? Math.ceil(totalItems / pageSize) : 0,
});
