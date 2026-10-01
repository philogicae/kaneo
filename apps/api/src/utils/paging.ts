import { z } from "../openapi";

// Query-string numeric parser: the value arrives as a string, so parse and
// range-check it instead of letting Number()/NaN reach the SQL clause.
export const pagingNumber = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, "Expected a positive integer")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));

export const listPagingQuery = z.object({
  limit: pagingNumber(1, 200)
    .optional()
    .openapi({ description: "Maximum number of items to return." }),
  offset: pagingNumber(0, 1_000_000).optional().openapi({
    description: "Number of items to skip; use with limit to page.",
  }),
});
