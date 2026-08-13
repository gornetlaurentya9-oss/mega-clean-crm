export const SERVICE_TYPES = [
  "Deep cleaning",
  "Regular cleaning – commercial",
  "Regular cleaning – domestic",
  "Carpet cleaning",
] as const;

export const FREQUENCIES = ["weekly", "fortnightly", "monthly", "one-off"] as const;
export const CLIENT_STATUSES = ["active", "paused", "inactive"] as const;
export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export const BILLING_RATE_TYPES = ["per-hour", "per-visit"] as const;
export const JOB_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "cancelled-partial", "rescheduled"] as const;
export const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

export const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};
