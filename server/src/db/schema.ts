import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
};

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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

export const employeeTimeOff = sqliteTable("employee_time_off", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(), // YYYY-MM-DD
  endDate: text("end_date").notNull(), // YYYY-MM-DD
  reason: text("reason").notNull().default(""),
  ...timestamps,
});

export const recurringPatterns = sqliteTable("recurring_patterns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  serviceType: text("service_type").notNull(),
  frequency: text("frequency").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(), // HH:mm
  durationHours: real("duration_hours").notNull(),
  defaultEmployeeId: integer("default_employee_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
