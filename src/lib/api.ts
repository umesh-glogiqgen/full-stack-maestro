/**
 * Single data-access layer for the platform. Every screen talks to the
 * backend through these functions, so swapping the transport later only
 * touches this file.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AllocationWeights } from "@/lib/allocation";

export type Worker = Database["public"]["Tables"]["workers"]["Row"];
export type Booking = Database["public"]["Tables"]["bookings"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Review = Database["public"]["Tables"]["reviews"]["Row"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];
export type AvailabilityStatus = Database["public"]["Enums"]["availability_status"];

const unwrap = <T,>({ data, error }: { data: T | null; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
};

export const listServices = async (): Promise<Service[]> =>
  unwrap(await supabase.from("services").select("*").order("name"));

export const listWorkers = async (): Promise<Worker[]> =>
  unwrap(await supabase.from("workers").select("*").order("full_name"));

export const getWorker = async (id: string): Promise<Worker | null> => {
  const { data, error } = await supabase.from("workers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

export const getWorkerByUser = async (userId: string): Promise<Worker | null> => {
  const { data, error } = await supabase
    .from("workers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
};

export const updateWorker = async (id: string, patch: Partial<Worker>) => {
  const { error } = await supabase.from("workers").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
};

export const listBookings = async (): Promise<Booking[]> =>
  unwrap(await supabase.from("bookings").select("*").order("created_at", { ascending: false }));

export const listBookingsForWorker = async (workerId: string): Promise<Booking[]> =>
  unwrap(
    await supabase
      .from("bookings")
      .select("*")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: false }),
  );

export const listBookingsForCustomer = async (customerId: string): Promise<Booking[]> =>
  unwrap(
    await supabase
      .from("bookings")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  );

export type NewBooking = Database["public"]["Tables"]["bookings"]["Insert"];

export const createBooking = async (booking: NewBooking): Promise<Booking> => {
  const { data, error } = await supabase.from("bookings").insert(booking).select().single();
  if (error) throw new Error(error.message);
  return data;
};

/**
 * Updates a booking status and keeps the worker's workload counters in sync,
 * which is what feeds the fair allocation algorithm.
 */
export const setBookingStatus = async (booking: Booking, status: BookingStatus) => {
  const patch: Database["public"]["Tables"]["bookings"]["Update"] = { status };
  if (status === "completed") patch.payment = "paid";
  const { error } = await supabase.from("bookings").update(patch).eq("id", booking.id);
  if (error) throw new Error(error.message);
  await recomputeWorkerCounters(booking.worker_id);
};

export const recomputeWorkerCounters = async (workerId: string) => {
  const { data: rows, error } = await supabase
    .from("bookings")
    .select("status, price, created_at")
    .eq("worker_id", workerId);
  if (error) throw new Error(error.message);
  const list = rows ?? [];
  const since = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const completed = list.filter((b) => b.status === "completed");
  await supabase
    .from("workers")
    .update({
      pending_jobs: list.filter((b) => b.status === "pending").length,
      active_jobs: list.filter((b) => b.status === "accepted" || b.status === "in_progress").length,
      completed_jobs: completed.length,
      recent_jobs: list.filter((b) => new Date(b.created_at).getTime() > since).length,
      total_earnings: completed.reduce((sum, b) => sum + Number(b.price), 0),
    })
    .eq("id", workerId);
};

export const listReviews = async (workerId?: string): Promise<Review[]> => {
  let query = supabase.from("reviews").select("*").order("created_at", { ascending: false });
  if (workerId) query = query.eq("worker_id", workerId);
  return unwrap(await query);
};

export const submitReview = async (input: {
  booking: Booking;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
}) => {
  const { error } = await supabase.from("reviews").insert({
    booking_id: input.booking.id,
    worker_id: input.booking.worker_id,
    customer_id: input.customerId,
    customer_name: input.customerName,
    rating: input.rating,
    comment: input.comment,
  });
  if (error) throw new Error(error.message);

  const all = await listReviews(input.booking.worker_id);
  const avg = all.reduce((s, r) => s + r.rating, 0) / (all.length || 1);
  await supabase
    .from("workers")
    .update({ rating: Math.round(avg * 10) / 10, rating_count: all.length })
    .eq("id", input.booking.worker_id);
};

export const listFavorites = async (customerId: string) =>
  unwrap(await supabase.from("favorites").select("*").eq("customer_id", customerId));

export const toggleFavorite = async (customerId: string, workerId: string, on: boolean) => {
  if (on) {
    const { error } = await supabase
      .from("favorites")
      .insert({ customer_id: customerId, worker_id: workerId });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("customer_id", customerId)
      .eq("worker_id", workerId);
    if (error) throw new Error(error.message);
  }
};

export const getWeights = async (): Promise<AllocationWeights> => {
  const { data, error } = await supabase.from("allocation_weights").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return {
    skill: data?.skill ?? 30,
    distance: data?.distance ?? 20,
    availability: data?.availability ?? 15,
    workload: data?.workload ?? 15,
    recent_jobs: data?.recent_jobs ?? 10,
    rating: data?.rating ?? 5,
    experience: data?.experience ?? 5,
  };
};

export const saveWeights = async (w: AllocationWeights) => {
  const { error } = await supabase.from("allocation_weights").update(w).eq("id", 1);
  if (error) throw new Error(error.message);
};

export const setVerification = async (workerId: string, verification: VerificationStatus) => {
  const { error } = await supabase.from("workers").update({ verification }).eq("id", workerId);
  if (error) throw new Error(error.message);
};

export const listProfiles = async () =>
  unwrap(await supabase.from("profiles").select("*").order("created_at", { ascending: false }));

/** Approximate coordinates for the towns used in the prototype. */
export const LOCATIONS: Record<string, { lat: number; lng: number }> = {
  Tadepalligudem: { lat: 16.815, lng: 81.523 },
  Nidadavolu: { lat: 16.908, lng: 81.67 },
  Bhimavaram: { lat: 16.5449, lng: 81.5212 },
  Tanuku: { lat: 16.755, lng: 81.68 },
  Eluru: { lat: 16.7107, lng: 81.0952 },
};
