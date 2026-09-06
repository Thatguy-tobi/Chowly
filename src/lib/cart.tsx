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
import { estimateWaitMinutes } from "./wait-time";

/**
 * What the customer has chosen but not yet submitted.
 *
 * The cart is kept in the browser and never reaches the database — an order
 * only exists once it is placed. It survives a refresh, though, because losing
 * a half-built order to a stray reload would be miserable.
 *
 * The totals and the wait shown here are a preview computed with exactly the
 * same function the server uses when the order is placed, so the number the
 * customer agrees to is the number they are quoted.
 */

export type CartLine = {
  itemId: string;
  name: string;
  emoji: string | null;
  price: number;
  preparationTimeMinutes: number;
  categoryType: "FOOD" | "DRINK";
  quantity: number;
};

type CartState = { restaurantId: string | null; lines: CartLine[] };

const EMPTY: CartState = { restaurantId: null, lines: [] };
const STORAGE_KEY = "chowly.cart";

type CartContextValue = {
  lines: CartLine[];
  restaurantId: string | null;
  count: number;
  total: number;
  estimatedWaitMinutes: number;
  add: (item: Omit<CartLine, "quantity">, restaurantId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  remove: (itemId: string) => void;
  clear: () => void;
  quantityOf: (itemId: string) => number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (Array.isArray(parsed?.lines)) setState(parsed);
      }
    } catch {
      /* a corrupt cart is not worth crashing over */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, ready]);

  const add = useCallback((item: Omit<CartLine, "quantity">, restaurantId: string) => {
    setState((s) => {
      // Items from two different restaurants cannot go in one order, so
      // choosing from a new menu starts a fresh cart.
      const base = s.restaurantId === restaurantId ? s.lines : [];
      const existing = base.find((l) => l.itemId === item.itemId);
      const lines = existing
        ? base.map((l) => (l.itemId === item.itemId ? { ...l, quantity: l.quantity + 1 } : l))
        : [...base, { ...item, quantity: 1 }];
      return { restaurantId, lines };
    });
  }, []);

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setState((s) => ({
      ...s,
      lines:
        quantity <= 0
          ? s.lines.filter((l) => l.itemId !== itemId)
          : s.lines.map((l) => (l.itemId === itemId ? { ...l, quantity } : l)),
    }));
  }, []);

  const remove = useCallback((itemId: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.itemId !== itemId) }));
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo<CartContextValue>(() => {
    const total = state.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
    return {
      lines: state.lines,
      restaurantId: state.restaurantId,
      count: state.lines.reduce((n, l) => n + l.quantity, 0),
      total,
      estimatedWaitMinutes: estimateWaitMinutes(state.lines),
      add,
      setQuantity,
      remove,
      clear,
      quantityOf: (itemId) => state.lines.find((l) => l.itemId === itemId)?.quantity ?? 0,
    };
  }, [state, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
