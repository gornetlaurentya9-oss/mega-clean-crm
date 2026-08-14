// Fixed service type list — not user-editable in Phase 1.
export const SERVICE_TYPES = [
  "Deep cleaning",
  "Regular cleaning – commercial",
  "Regular cleaning – domestic",
  "Carpet cleaning",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const FREQUENCIES = ["weekly", "fortnightly", "monthly", "one-off"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const CLIENT_STATUSES = ["active", "paused", "inactive"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const BILLING_RATE_TYPES = ["per-hour", "per-visit"] as const;
export type BillingRateType = (typeof BILLING_RATE_TYPES)[number];

// "cancelled" = cancelled before any work was done — no hours, nothing owed, never billed.
// "cancelled-partial" = cancelled after partial (or disputed-after-complete) work — carries
// actualHours and still counts toward billing/invoicing. See README for the full rationale.
export const JOB_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "cancelled-partial",
  "rescheduled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// Tracks whether the client has flagged an issue with a scheduled job's time (via the roster's
// "Mark: client requested change" toggle) — independent of the job's own JOB_STATUSES lifecycle.
export const CLIENT_RESPONSE_STATUSES = ["confirmed", "change-requested"] as const;
export type ClientResponseStatus = (typeof CLIENT_RESPONSE_STATUSES)[number];

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
