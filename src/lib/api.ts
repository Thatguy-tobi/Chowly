import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { firstError } from "./validation";

/**
 * Shared plumbing for the route handlers.
 *
 * Prisma returns Decimal objects for money columns. They do not survive
 * JSON.stringify in a useful form, so every amount is converted to a number on
 * the way out. Prices here are whole naira, well inside the safe integer range,
 * so nothing is lost by doing that.
 */

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(serialise(data), { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Turn any thrown value into a response, without leaking internals. */
export function handleError(error: unknown) {
  if (error instanceof ZodError) return fail(firstError(error), 422);
  console.error(error);
  return fail("Something went wrong handling that request", 500);
}

type Decimalish = { toNumber: () => number };

function isDecimal(v: unknown): v is Decimalish {
  return (
    typeof v === "object" &&
    v !== null &&
    "toNumber" in v &&
    typeof (v as Decimalish).toNumber === "function"
  );
}

/** Recursively replace Prisma Decimals with plain numbers. */
export function serialise<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (isDecimal(value)) return value.toNumber() as unknown as T;
  if (value instanceof Date) return value as T;
  if (Array.isArray(value)) return value.map(serialise) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialise(v);
    }
    return out as T;
  }
  return value;
}
