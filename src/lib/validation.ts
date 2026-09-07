import { z } from "zod";

/**
 * Request validation. Every route parses its body through one of these, so a
 * malformed or hostile request is rejected before it reaches the database
 * rather than relying on Postgres to catch it.
 */

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(60),
  tableNumber: z.number().int().min(1, "Table number must be 1 or more").max(200),
  restaurantId: z.string().min(1),
});

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  restaurantId: z.string().min(1),
  // The message matters: without it a missing table number surfaces to the
  // customer as "expected number, received null".
  tableNumber: z
    .number({ error: "We need your table number before the order can be sent" })
    .int()
    .min(1, "Table number must be 1 or more")
    .max(200),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        quantity: z.number().int().min(1, "Quantity must be at least 1").max(20),
      })
    )
    .min(1, "An order needs at least one item"),
});

export const recordPreparationSchema = z
  .object({
    chefId: z.string().min(1).nullable().optional(),
    bartenderId: z.string().min(1).nullable().optional(),
  })
  .refine((v) => v.chefId || v.bartenderId, {
    message: "Record at least one of the chef or the bartender",
  });

export const updateStatusSchema = z.object({
  status: z.enum(["PREPARING", "SERVED"]),
});

export const createComplaintSchema = z.object({
  complaintText: z.string().trim().min(5, "Please describe the problem").max(1000),
});

export const resolveComplaintSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]),
});

export const createRatingSchema = z.object({
  value: z.number().int().min(1, "Rating must be 1 to 5").max(5, "Rating must be 1 to 5"),
  comment: z.string().trim().max(500).optional().nullable(),
});

export const createPaymentSchema = z.object({
  method: z.enum(["CARD", "BANK_TRANSFER", "CASH"]),
});

/** Flatten a Zod error into a single readable sentence for the UI. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That request was not valid";
}
