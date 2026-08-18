import { sql } from "drizzle-orm";
import { pgTable, text, integer, serial, real, boolean } from "drizzle-orm/pg-core";

// Kept as `text` (ISO-8601 strings written by the app via `new Date().toISOString()`) rather
// than a native Postgres `timestamp` column, so read/write behavior for createdAt/updatedAt is
// unchanged for both the routers (which set updatedAt explicitly as a string) and the client
// (which consumes these as strings) — this port intentionally avoids a format change here.
const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`now()`),
};

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  // JSON-encoded array of ServiceType strings.
  serviceTypes: text("service_types").notNull().default("[]"),
  defaultFrequency: text("default_frequency").notNull().default("weekly"),
  preferredDay: text("preferred_day"),
  preferredTimeWindow: text("preferred_time_window"),
  defaultDurationHours: real("default_duration_hours"),
  defaultEmployeeId: integer("default_employee_id"),
  accessNotes: text("access_notes").notNull().default(""),
  billingRate: real("billing_rate").notNull().default(0),
  billingRateType: text("billing_rate_type").notNull().default("per-visit"),
  status: text("status").notNull().default("active"),
  notes: text("notes").notNull().default(""),
  ...timestamps,
});

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  // JSON-encoded array of ServiceType strings.
  qualifiedServiceTypes: text("qualified_service_types").notNull().default("[]"),
  hourlyPayRate: real("hourly_pay_rate"),
  status: text("status").notNull().default("active"),
  // JSON-encoded array of { day: DayOfWeek, startTime: string, endTime: string }.
  availability: text("availability").notNull().default("[]"),
  ...timestamps,
});

export const employeeTimeOff = pgTable("employee_time_off", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  reason: text("reason").notNull().default(""),
  ...timestamps,
});

export const recurringPatterns = pgTable("recurring_patterns", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(),
  frequency: text("frequency").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(), // HH:mm
  durationHours: real("duration_hours").notNull(),
  active: boolean("active").notNull().default(true),
  // YYYY-MM-DD. Used only by "every-3-weeks" (a 3-week cycle needs a fixed reference point to
  // know which week is "week 1" — unlike fortnightly, which gets away with global ISO-week
  // parity). Null falls back to this pattern's createdAt date. Nullable rather than required so
  // existing weekly/fortnightly/monthly patterns don't need one.
  anchorDate: text("anchor_date"),
  ...timestamps,
});

// Many-to-many: which employee(s) a recurring pattern is assigned to (a house that always gets
// cleaned by two people at once, e.g.). `patternId` is a real FK with cascade — this row's only
// purpose is describing that one pattern's assignment, so it should vanish with it.
// `employeeId` deliberately has no FK, same rationale as jobs.employeeId below: deleting an
// employee should unassign them from patterns, not silently break/cascade-delete pattern history
// that isn't really "theirs" to take down. See `employees.remove` (force-delete path).
export const recurringPatternEmployees = pgTable("recurring_pattern_employees", {
  id: serial("id").primaryKey(),
  patternId: integer("pattern_id")
    .notNull()
    .references(() => recurringPatterns.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(),
  scheduledDate: text("scheduled_date").notNull(), // YYYY-MM-DD — the CURRENT date this job is on (moves on reschedule).
  // The date this job was originally generated for by a recurring pattern (set once, never changes).
  // Lets `generateWeek` tell "already generated, then rescheduled elsewhere" apart from "never generated" —
  // without it, rescheduling a pattern-generated job out of a week would make that week's regeneration
  // recreate a duplicate at the old slot. Null for one-off/manually-added jobs.
  originalDate: text("original_date"),
  startTime: text("start_time").notNull(), // HH:mm
  plannedDurationHours: real("planned_duration_hours").notNull(),
  status: text("status").notNull().default("scheduled"),
  actualHours: real("actual_hours"),
  completionNotes: text("completion_notes"),
  recurringPatternId: integer("recurring_pattern_id"),
  // Tracks whether the CLIENT has flagged an issue with this job's scheduled slot — independent
  // of the job's own lifecycle `status` above. Set by the owner on the roster after hearing back
  // from a client (by phone/text, outside the app) in response to a "heads-up" message; never
  // set automatically and never blocks any other flow.
  clientResponseStatus: text("client_response_status").notNull().default("confirmed"),
  ...timestamps,
});

// Many-to-many: which employee(s) a job is assigned to — most jobs have one, but some houses
// get cleaned by two people at once (one client, one visit, one time slot, multiple cleaners).
// `jobId` is a real FK with cascade — this row's only purpose is describing that one job's
// assignment, so it should vanish when the job itself is deleted (unlike the old
// `jobs.employeeId`, which was deliberately not an FK — see the note that used to live here,
// now on `employeeId` below). `employeeId` has no FK: deleting an employee should unassign them
// from a job, not orphan/cascade-delete the job's own history. See `employees.remove`
// (force-delete path), which deletes the employee's rows here rather than the job itself.
export const jobEmployees = pgTable("job_employees", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull(),
});

// One row per approved week, keyed by the Monday (`weekStart`, YYYY-MM-DD) that identifies the
// week the same way Roster.tsx/generateWeek already do. A purely owner-facing go/no-go marker —
// approving a week never touches any job's `status`/`clientResponseStatus`, it's independent
// state for her own tracking. No row = not approved; deleting the row (`weekApprovals.unapprove`)
// revokes approval, e.g. after a late cancellation. `approvedAt` follows this file's
// timestamp-as-text convention (see the `timestamps` helper comment above) rather than a native
// `timestamp` column.
export const weekApprovals = pgTable("week_approvals", {
  weekStart: text("week_start").primaryKey(), // YYYY-MM-DD, Monday of the approved week.
  approvedAt: text("approved_at").notNull(),
});
