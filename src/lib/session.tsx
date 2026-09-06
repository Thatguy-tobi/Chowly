"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Who you are and where you are, held in the browser.
 *
 * Requirement 6 asks for a way to act as the customer and as the waiter, with
 * no login — a switch is enough. So there is no authentication here: the role
 * is simply a value the person can flip.
 *
 * The restaurant is remembered PER ROLE rather than shared. Somebody can be a
 * customer sitting at Mood Lagos and a waiter working at Terra Kulture, and
 * switching role should carry each side back to where it was rather than
 * dragging the other one along with it.
 *
 * The one exception: the first time the waiter view is used it has no
 * restaurant of its own, so it inherits the customer's. That way a stranger
 * following the walkthrough places an order and then finds it waiting in the
 * queue, instead of landing on an empty screen at some other restaurant. The
 * default only ever fills a blank; it never overrides a choice already made.
 *
 * None of this is the source of truth for anything that matters. Orders,
 * payments and complaints live in Postgres. This only decides what you are
 * looking at.
 */

export type Role = "customer" | "waiter";

export type Session = {
  role: Role;
  customer: {
    restaurantId: string | null;
    customerId: string | null;
    name: string | null;
    tableNumber: number | null;
  };
  waiter: {
    restaurantId: string | null;
  };
};

const EMPTY: Session = {
  role: "customer",
  customer: { restaurantId: null, customerId: null, name: null, tableNumber: null },
  waiter: { restaurantId: null },
};

const STORAGE_KEY = "chowly.session";

type SessionContextValue = {
  session: Session;
  /** True once the browser's stored session has been read. */
  ready: boolean;
  /** The restaurant the CURRENT role is looking at. */
  restaurantId: string | null;
  setRole: (role: Role) => void;
  /** Sets the restaurant for the current role only. */
  setRestaurant: (restaurantId: string) => void;
  setCustomer: (details: { customerId: string; name: string; tableNumber: number; restaurantId: string }) => void;
  reset: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function read(): Session {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Session>;
    // Merge onto EMPTY so a session stored by an older version of the app
    // cannot leave a field undefined and crash a component.
    return {
      role: parsed.role === "waiter" ? "waiter" : "customer",
      customer: { ...EMPTY.customer, ...parsed.customer },
      waiter: { ...EMPTY.waiter, ...parsed.waiter },
    };
  } catch {
    return EMPTY;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(EMPTY);
  const [ready, setReady] = useState(false);

  // Read on mount rather than during render: the server has no localStorage,
  // and reading it while rendering would make the markup mismatch.
  useEffect(() => {
    setSession(read());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session, ready]);

  const setRole = useCallback((role: Role) => {
    setSession((s) => {
      if (role === "waiter" && !s.waiter.restaurantId && s.customer.restaurantId) {
        // First visit to the waiter view — start where the customer is.
        return { ...s, role, waiter: { restaurantId: s.customer.restaurantId } };
      }
      return { ...s, role };
    });
  }, []);

  const setRestaurant = useCallback((restaurantId: string) => {
    setSession((s) =>
      s.role === "waiter"
        ? { ...s, waiter: { restaurantId } }
        : // Moving to a different restaurant means a different table, so the
          // seated details no longer apply. The customer record itself is kept.
          { ...s, customer: { ...s.customer, restaurantId, tableNumber: null } }
    );
  }, []);

  const setCustomer = useCallback(
    (details: { customerId: string; name: string; tableNumber: number; restaurantId: string }) => {
      setSession((s) => ({ ...s, customer: { ...details } }));
    },
    []
  );

  const reset = useCallback(() => setSession(EMPTY), []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      ready,
      restaurantId:
        session.role === "waiter" ? session.waiter.restaurantId : session.customer.restaurantId,
      setRole,
      setRestaurant,
      setCustomer,
      reset,
    }),
    [session, ready, setRole, setRestaurant, setCustomer, reset]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
