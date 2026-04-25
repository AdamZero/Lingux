export interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize);

  return {
    code: 0,
    message: 'success',
    data: {
      items,
      total,
      page,
      pageSize,
      totalPages,
    },
  };
}
