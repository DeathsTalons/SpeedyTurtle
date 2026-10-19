// Loads business settings (fees, schedule, stores) from the database
// and turns them into the shapes the pricing/schedule logic expects.
import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { FeeTier } from "@/lib/pricing";
import type { Override, ScheduleInput, SlotTemplate } from "@/lib/schedule";
import { addDays, availableSlots, localDate } from "@/lib/schedule";
import type { Store, LatLng } from "@/lib/stores";
import { nearestStore, storesForOrder } from "@/lib/stores";
import type { Chain } from "@/lib/stores";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = () => supabaseAdmin() as any;

export type Settings = {
  authBufferPct: number;
  orderCutoffHours: number;
  bookingDaysAhead: number;
  maxOrdersPerWeek: number;
  secondStoreFeeCents: number;
  meijerExtraBufferPct: number;
  availableUntil: string | null;
  asapCapacity: number;
};

export async function getFeeTiers(): Promise<FeeTier[]> {
  const { data, error } = await db().from("fee_tiers").select("*").order("min_items");
  if (error) throw error;
  return data.map((t: any) => ({ minItems: t.min_items, maxItems: t.max_items, feeCents: t.fee_cents, label: t.label }));
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from("settings").select("*").single();
  if (error) throw error;
  return {
    authBufferPct: data.auth_buffer_pct,
    orderCutoffHours: data.order_cutoff_hours,
    bookingDaysAhead: data.booking_days_ahead,
    maxOrdersPerWeek: data.max_orders_per_week,
    secondStoreFeeCents: data.second_store_fee_cents ?? 0,
    meijerExtraBufferPct: data.meijer_extra_buffer_pct ?? 10,
    availableUntil: data.available_until ?? null,
    asapCapacity: data.asap_capacity ?? 2,
  };
}

export async function getStores(): Promise<(Store & { externalLocationId: string | null; address: string | null; allowSecondStore: boolean })[]> {
  const { data, error } = await db().from("stores").select("*").eq("active", true);
  if (error) throw error;
  return data.map((s: any) => ({
    id: s.id, chain: s.chain, name: s.name, active: s.active,
    latitude: s.latitude, longitude: s.longitude,
    externalLocationId: s.external_location_id, address: s.address, allowSecondStore: s.allow_second_store ?? true,
  }));
}

export async function storesFor(home: LatLng | null) {
  const stores = await getStores();
  return {
    kroger: nearestStore("kroger", stores, home)?.store as (typeof stores)[number] | undefined,
    meijer: nearestStore("meijer", stores, home)?.store as (typeof stores)[number] | undefined,
  };
}

/** Stores for an order that starts at `primary`, keyed by chain. */
export async function orderStores(home: LatLng | null, primary: Chain) {
  const stores = await getStores();
  const { primary: main, addOn } = storesForOrder(primary, stores, home);
  return (primary === "kroger" ? { kroger: main, meijer: addOn } : { kroger: addOn, meijer: main }) as {
    kroger?: (typeof stores)[number];
    meijer?: (typeof stores)[number];
  };
}

export type Availability = { open: boolean; until: string | null; taken: number; capacity: number };

/** Is Cody taking same-day ASAP orders right now? */
export async function getAvailability(now = new Date()): Promise<Availability> {
  const s = await getSettings();
  const live = !!s.availableUntil && new Date(s.availableUntil).getTime() > now.getTime();
  if (!live) return { open: false, until: null, taken: 0, capacity: s.asapCapacity };
  const { count } = await db().from("orders").select("id", { count: "exact", head: true })
    .eq("asap", true).in("status", ["placed", "shopping", "delivering"]).eq("delivery_date", localDate(now));
  const taken = count ?? 0;
  return { open: taken < s.asapCapacity, until: s.availableUntil, taken, capacity: s.asapCapacity };
}

export async function getScheduleInput(now = new Date()): Promise<ScheduleInput> {
  const settings = await getSettings();
  const today = localDate(now);
  const last = addDays(today, settings.bookingDaysAhead);

  const [templates, weekly, overrides, orders] = await Promise.all([
    db().from("slot_templates").select("*").eq("active", true).order("sort_order"),
    db().from("weekly_schedule").select("*"),
    db().from("schedule_overrides").select("*").gte("date", today).lte("date", last),
    db().from("orders").select("delivery_date, slot_template_id").neq("status", "canceled").gte("delivery_date", today).lte("delivery_date", last),
  ]);
  for (const r of [templates, weekly, overrides, orders]) if (r.error) throw r.error;

  const counts = new Map<string, number>();
  for (const o of orders.data) {
    const k = `${o.delivery_date}#${o.slot_template_id}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  return {
    now,
    daysAhead: settings.bookingDaysAhead,
    cutoffHours: settings.orderCutoffHours,
    weekly: Object.fromEntries(weekly.data.map((w: any) => [w.weekday, w.is_open])),
    templates: templates.data.map((t: any): SlotTemplate => ({
      id: t.id, label: t.label, startTime: t.start_time, endTime: t.end_time, capacity: t.capacity, active: t.active,
    })),
    overrides: overrides.data.map((o: any): Override => ({
      date: o.date, slotTemplateId: o.slot_template_id, isOpen: o.is_open, note: o.note,
    })),
    bookings: [...counts].map(([k, count]) => {
      const [date, id] = k.split("#");
      return { date, slotTemplateId: Number(id), count };
    }),
  };
}

export async function getAvailableSlots(now = new Date()) {
  return availableSlots(await getScheduleInput(now));
}
