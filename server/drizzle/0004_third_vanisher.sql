CREATE TABLE "job_employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"employee_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_pattern_employees" (
	"id" serial PRIMARY KEY NOT NULL,
	"pattern_id" integer NOT NULL,
	"employee_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_employees" ADD CONSTRAINT "job_employees_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_pattern_employees" ADD CONSTRAINT "recurring_pattern_employees_pattern_id_recurring_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "public"."recurring_patterns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: carry every existing single-employee assignment over into the new join tables
-- BEFORE the old columns are dropped below, so no existing job/pattern assignment is lost by
-- this schema change. One row per non-null jobs.employee_id / recurring_patterns.default_employee_id.
INSERT INTO "job_employees" ("job_id", "employee_id")
SELECT "id", "employee_id" FROM "jobs" WHERE "employee_id" IS NOT NULL;
--> statement-breakpoint
INSERT INTO "recurring_pattern_employees" ("pattern_id", "employee_id")
SELECT "id", "default_employee_id" FROM "recurring_patterns" WHERE "default_employee_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "jobs" DROP COLUMN "employee_id";--> statement-breakpoint
ALTER TABLE "recurring_patterns" DROP COLUMN "default_employee_id";