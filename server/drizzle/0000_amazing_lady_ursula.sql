CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"service_types" text DEFAULT '[]' NOT NULL,
	"default_frequency" text DEFAULT 'weekly' NOT NULL,
	"preferred_day" text,
	"preferred_time_window" text,
	"default_duration_hours" real,
	"default_employee_id" integer,
	"access_notes" text DEFAULT '' NOT NULL,
	"billing_rate" real DEFAULT 0 NOT NULL,
	"billing_rate_type" text DEFAULT 'per-visit' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_time_off" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"qualified_service_types" text DEFAULT '[]' NOT NULL,
	"hourly_pay_rate" real,
	"status" text DEFAULT 'active' NOT NULL,
	"availability" text DEFAULT '[]' NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"employee_id" integer,
	"service_type" text NOT NULL,
	"scheduled_date" text NOT NULL,
	"original_date" text,
	"start_time" text NOT NULL,
	"planned_duration_hours" real NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"actual_hours" real,
	"completion_notes" text,
	"recurring_pattern_id" integer,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_patterns" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"service_type" text NOT NULL,
	"frequency" text NOT NULL,
	"day_of_week" text NOT NULL,
	"start_time" text NOT NULL,
	"duration_hours" real NOT NULL,
	"default_employee_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT now() NOT NULL,
	"updated_at" text DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_time_off" ADD CONSTRAINT "employee_time_off_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_patterns" ADD CONSTRAINT "recurring_patterns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;