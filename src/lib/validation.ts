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

/* ------------------------------------------------------------------ admin */

// "HH:mm" on a 24-hour clock. Opening hours describe a time of day that repeats
// rather than a moment in time (change 011), so they are validated as text in
// that shape instead of being parsed into a date.
const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time such as 09:00 or 22:30");

export const createRestaurantSchema = z.object({
  name: z.string().trim().min(2, "Give the restaurant a name").max(80),
  address: z.string().trim().min(5, "Give the restaurant an address").max(160),
  phone: z.string().trim().min(7, "That phone number looks too short").max(20),
  email: z.email("That does not look like an email address"),
  openingTime: clockTime,
  closingTime: clockTime,
});

export const createStaffSchema = z.object({
  restaurantId: z.string().min(1),
  firstName: z.string().trim().min(2, "Give the staff member a first name").max(40),
  lastName: z.string().trim().min(2, "Give the staff member a surname").max(40),
  phone: z.string().trim().min(7, "That phone number looks too short").max(20),
  role: z.enum(["WAITER", "CHEF", "BARTENDER"]),
});

export const createMenuSchema = z.object({
  restaurantId: z.string().min(1),
  name: z.string().trim().min(2, "Give the menu a name").max(80),
  description: z.string().trim().max(300).optional().nullable(),
});

export const createMenuItemSchema = z.object({
  menuId: z.string().min(1),
  categoryId: z.string().min(1, "Choose a category"),
  name: z.string().trim().min(2, "Give the item a name").max(80),
  description: z.string().trim().max(300).optional().nullable(),
  // Whole naira. Every price in this application is an integer, so the
  // arithmetic in an order stays exact.
  price: z
    .number({ error: "Enter a price" })
    .int("Prices are whole naira")
    .min(1, "A price must be more than nothing")
    .max(10_000_000),
  preparationTimeMinutes: z
    .number({ error: "Enter how long this takes to prepare" })
    .int()
    .min(1, "Preparation time must be at least a minute")
    .max(240, "Over four hours is not a menu item"),
  emoji: z.string().trim().max(8).optional().nullable(),
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
