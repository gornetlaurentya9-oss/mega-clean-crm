CREATE TABLE `clients` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`service_types` text DEFAULT '[]' NOT NULL,
	`default_frequency` text DEFAULT 'weekly' NOT NULL,
	`preferred_day` text,
	`preferred_time_window` text,
	`default_duration_hours` real,
	`default_employee_id` integer,
	`access_notes` text DEFAULT '' NOT NULL,
	`billing_rate` real DEFAULT 0 NOT NULL,
	`billing_rate_type` text DEFAULT 'per-visit' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employee_time_off` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_id` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`qualified_service_types` text DEFAULT '[]' NOT NULL,
	`hourly_pay_rate` real,
	`status` text DEFAULT 'active' NOT NULL,
	`availability` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`employee_id` integer,
	`service_type` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`start_time` text NOT NULL,
	`planned_duration_hours` real NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`actual_hours` real,
	`completion_notes` text,
	`recurring_pattern_id` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recurring_patterns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`service_type` text NOT NULL,
	`frequency` text NOT NULL,
	`day_of_week` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_hours` real NOT NULL,
	`default_employee_id` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade
);
