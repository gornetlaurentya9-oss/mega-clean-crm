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
  defaultEmployeeId: integer("default_employee_id"),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id"),
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
  ...timestamps,
});
