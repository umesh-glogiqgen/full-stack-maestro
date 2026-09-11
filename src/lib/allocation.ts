/**
 * Fair Work Allocation Algorithm.
 *
 * Ranks cooperative members using a weighted, transparent score instead of
 * simply picking the nearest or highest-rated worker.
 */

export type Availability = "available" | "busy" | "unavailable";
export type Verification = "pending" | "verified" | "rejected" | "suspended";

export interface AllocationWeights {
  skill: number;
  distance: number;
  availability: number;
  workload: number;
  recent_jobs: number;
  rating: number;
  experience: number;
}

export const DEFAULT_WEIGHTS: AllocationWeights = {
  skill: 30,
  distance: 20,
  availability: 15,
  workload: 15,
  recent_jobs: 10,
  rating: 5,
  experience: 5,
};

export interface ScorableWorker {
  id: string;
  full_name: string;
  primary_skill: string;
  additional_skills: string[];
  experience_years: number;
  location: string;
  latitude: number;
  longitude: number;
  service_radius_km: number;
  availability: Availability;
  verification: Verification;
  rating: number;
  active_jobs: number;
  pending_jobs: number;
  recent_jobs: number;
  completed_jobs: number;
}

export interface ScoreBreakdown {
  skill: number;
  distance: number;
  availability: number;
  workload: number;
  recentJobs: number;
  rating: number;
  experience: number;
}

export interface ScoredWorker<T extends ScorableWorker = ScorableWorker> {
  worker: T;
  score: number;
  breakdown: ScoreBreakdown;
  distanceKm: number;
  workloadPercent: number;
  reasons: string[];
  eligible: boolean;
  excludedReason?: string;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

/** Related-skill map used when the worker has no exact match. */
const RELATED: Record<string, string[]> = {
  Electrician: ["AC Repair", "Appliance Repair", "Home Maintenance"],
  Plumber: ["Home Maintenance", "Appliance Repair"],
  Carpenter: ["Home Maintenance", "Painter"],
  Painter: ["Home Maintenance", "Carpenter"],
  Cleaner: ["Pest Control", "Home Maintenance"],
  "AC Repair": ["Electrician", "Appliance Repair"],
  "Appliance Repair": ["Electrician", "AC Repair"],
  Gardener: ["Cleaner", "Home Maintenance"],
  "Pest Control": ["Cleaner"],
  "Home Maintenance": ["Plumber", "Carpenter", "Electrician", "Painter"],
};

export function workloadPercent(w: ScorableWorker): number {
  const capacity = 6;
  return Math.min(100, Math.round(((w.active_jobs + w.pending_jobs) / capacity) * 100));
}

export function workloadLabel(percent: number): {
  label: string;
  tone: "success" | "info" | "warning" | "destructive";
} {
  if (percent <= 30) return { label: "Low", tone: "success" };
  if (percent <= 70) return { label: "Medium", tone: "info" };
  if (percent <= 90) return { label: "High", tone: "warning" };
  return { label: "Very High", tone: "destructive" };
}

function skillScore(w: ScorableWorker, service: string): number {
  if (!service) return 70;
  if (w.primary_skill === service) return 100;
  if (w.additional_skills.includes(service)) return 80;
  if ((RELATED[service] ?? []).includes(w.primary_skill)) return 55;
  return 0;
}

export interface ScoreOptions {
  service: string;
  customerLat: number;
  customerLng: number;
  weights?: AllocationWeights;
}

export function scoreWorker<T extends ScorableWorker>(
  worker: T,
  opts: ScoreOptions,
): ScoredWorker<T> {
  const weights = opts.weights ?? DEFAULT_WEIGHTS;
  const distanceKm = haversineKm(
    opts.customerLat,
    opts.customerLng,
    Number(worker.latitude),
    Number(worker.longitude),
  );
  const wl = workloadPercent(worker);

  const skill = skillScore(worker, opts.service);
  const maxRange = Math.max(worker.service_radius_km, 25);
  const distance = Math.max(0, Math.round(100 - (distanceKm / maxRange) * 100));
  const availability =
    worker.availability === "available" ? 100 : worker.availability === "busy" ? 45 : 0;
  const workload = Math.max(0, 100 - wl);
  const recentJobs = Math.max(0, 100 - Math.min(worker.recent_jobs, 12) * 8);
  const rating = worker.rating_safe();
  const experience = Math.min(100, worker.experience_years * 10);

  const breakdown: ScoreBreakdown = {
    skill,
    distance,
    availability,
    workload,
    recentJobs,
    rating,
    experience,
  };

  const totalWeight =
    weights.skill +
    weights.distance +
    weights.availability +
    weights.workload +
    weights.recent_jobs +
    weights.rating +
    weights.experience || 100;

  const raw =
    skill * weights.skill +
    distance * weights.distance +
    availability * weights.availability +
    workload * weights.workload +
    recentJobs * weights.recent_jobs +
    rating * weights.rating +
    experience * weights.experience;

  const score = Math.round((raw / totalWeight) * 10) / 10;

  let eligible = true;
  let excludedReason: string | undefined;
  if (worker.verification !== "verified") {
    eligible = false;
    excludedReason = "Not verified by the cooperative";
  } else if (worker.availability === "unavailable") {
    eligible = false;
    excludedReason = "Currently unavailable";
  } else if (skill === 0) {
    eligible = false;
    excludedReason = "No relevant skill for this service";
  } else if (distanceKm > worker.service_radius_km) {
    eligible = false;
    excludedReason = "Outside their service area";
  }

  const reasons: string[] = [];
  if (skill === 100) reasons.push("Exact skill match");
  else if (skill >= 80) reasons.push("Listed as an additional skill");
  else if (skill > 0) reasons.push("Related skill");
  if (distanceKm <= 5) reasons.push(`Nearby (${distanceKm} km away)`);
  else reasons.push(`${distanceKm} km away, within service area`);
  if (worker.availability === "available") reasons.push("Currently available");
  if (wl <= 30) reasons.push("Lower current workload");
  else if (wl <= 70) reasons.push("Moderate workload");
  if (worker.recent_jobs <= 4) reasons.push("Fewer recent assignments");
  if (worker.rating >= 4.3) reasons.push(`Good rating (${worker.rating})`);
  if (worker.experience_years >= 5)
    reasons.push(`${worker.experience_years} years of experience`);
  reasons.push("Verified cooperative member");

  return { worker, score, breakdown, distanceKm, workloadPercent: wl, reasons, eligible, excludedReason };
}

export function rankWorkers<T extends ScorableWorker>(
  workers: T[],
  opts: ScoreOptions,
): ScoredWorker<T>[] {
  return workers
    .map((w) => scoreWorker(w, opts))
    .filter((s) => s.eligible)
    .sort((a, b) => b.score - a.score);
}
