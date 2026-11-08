/*
 * SmartQueue AI's queue rules, ported from its source so the Laboratory's simulator behaves like
 * the real system: calculateAnalytics in src/utils/aiEngine.ts, and updateEstimatedWaitTimes and
 * callNext in src/context/QueueContext.tsx. Every value this produces is a simulation.
 */

/** Service codes and average durations from SmartQueue AI's src/data/initialData.ts. */
export const SERVICES = [
  { code: "GEN", name: "General Enquiry", minutes: 6 },
  { code: "DOC", name: "Document Verification", minutes: 12 },
  { code: "FEE", name: "Fee Payment", minutes: 8 },
  { code: "TEC", name: "Technical Support", minutes: 15 },
] as const;

export type ServiceCode = (typeof SERVICES)[number]["code"];
export type Congestion = "Low" | "Moderate" | "High" | "Severe";

export interface SimToken {
  number: string;
  seq: number;
  service: ServiceCode;
  priority: boolean;
}

export interface SimCounter {
  id: number;
  open: boolean;
  serving: SimToken | null;
}

const minutesFor = (service: ServiceCode) => SERVICES.find((s) => s.code === service)!.minutes;

export function makeToken(seq: number, service: ServiceCode, priority: boolean): SimToken {
  return { number: `${priority ? "PRI" : service}-${seq}`, seq, service, priority };
}

/** Priority first, then the earliest to join. */
export function queueOrder(tokens: readonly SimToken[]): SimToken[] {
  return [...tokens].sort((a, b) => Number(b.priority) - Number(a.priority) || a.seq - b.seq);
}

export function congestionLevel(waiting: number, openCounters: number): Congestion {
  const ratio = waiting / Math.max(1, openCounters);
  if (ratio > 5) return "Severe";
  if (ratio >= 3) return "High";
  if (ratio >= 1.5) return "Moderate";
  return "Low";
}

export function clearanceMinutes(tokens: readonly SimToken[], openCounters: number): number {
  const backlog = tokens.reduce((sum, t) => sum + minutesFor(t.service), 0);
  return Math.round(backlog / Math.max(1, openCounters));
}

/** Estimated wait for the token at `position` in queue order (2 is the source's base offset). */
export function estimatedWait(token: SimToken, position: number, openCounters: number): number {
  const minutes = 2 + position * minutesFor(token.service);
  return Math.max(1, Math.round(minutes / Math.max(1, openCounters)));
}
