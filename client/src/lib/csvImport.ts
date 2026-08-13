import Papa from "papaparse";
import { SERVICE_TYPES, FREQUENCIES, CLIENT_STATUSES, EMPLOYEE_STATUSES, BILLING_RATE_TYPES, DAYS_OF_WEEK } from "./constants";

// -- CSV column specs -------------------------------------------------------
// Kept here as the single source of truth for both the Import page and the README docs.

export const CLIENT_CSV_COLUMNS = [
  "name",
  "phone",
  "address",
  "email",
  "serviceTypes",
  "defaultFrequency",
  "preferredDay",
  "preferredTimeWindow",
  "defaultDurationHours",
  "defaultEmployeeName",
  "accessNotes",
  "billingRate",
  "billingRateType",
  "status",
  "notes",
] as const;

export const EMPLOYEE_CSV_COLUMNS = ["name", "phone", "qualifiedServiceTypes", "hourlyPayRate", "status"] as const;

export interface ParsedRow<T> {
  rowNumber: number; // 1-based spreadsheet row, header is row 1 so first data row is 2
  raw: Record<string, string>;
  data: T | null; // non-null only when there are no blocking errors
  errors: string[]; // block commit
  warnings: string[]; // shown, don't block commit
  isDuplicate: boolean; // matches an existing record (or an earlier row in this file) on name+phone
}

function normalizeRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.trim().toLowerCase()] = (v ?? "").toString().trim();
  }
  return out;
}

function matchEnum<T extends readonly string[]>(value: string, allowed: T): T[number] | undefined {
  const v = value.trim().toLowerCase();
  return allowed.find((a) => a.toLowerCase() === v);
}

function parseListField<T extends readonly string[]>(
  value: string,
  allowed: T,
  fieldLabel: string
): { values: T[number][]; errors: string[] } {
  const errors: string[] = [];
  if (!value.trim()) return { values: [], errors };
  const parts = value
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const values: T[number][] = [];
  for (const p of parts) {
    const match = matchEnum(p, allowed);
    if (!match) errors.push(`${fieldLabel}: unrecognized value "${p}" (expected one of: ${allowed.join(", ")})`);
    else values.push(match);
  }
  return { values, errors };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dupeKey(name: string, phone: string) {
  return `${name.trim().toLowerCase()}|${phone.trim().toLowerCase()}`;
}

function parseCsvText(csvText: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data.map(normalizeRow);
}

export interface ClientCsvRow {
  name: string;
  phone: string;
  address: string;
  email: string;
  serviceTypes: string[];
  defaultFrequency: (typeof FREQUENCIES)[number];
  preferredDay: (typeof DAYS_OF_WEEK)[number] | null;
  preferredTimeWindow: string;
  defaultDurationHours: number | null;
  defaultEmployeeId: number | null;
  accessNotes: string;
  billingRate: number;
  billingRateType: (typeof BILLING_RATE_TYPES)[number];
  status: (typeof CLIENT_STATUSES)[number];
  notes: string;
}

export function parseClientsCsv(
  csvText: string,
  existing: { name: string; phone: string }[],
  employees: { id: number; name: string }[]
): ParsedRow<ClientCsvRow>[] {
  const rows = parseCsvText(csvText);
  const seenInFile = new Set<string>();
  const existingKeys = new Set(existing.map((c) => dupeKey(c.name, c.phone)));

  return rows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = raw["name"] ?? "";
    const phone = raw["phone"] ?? "";
    if (!name) errors.push("Name is required");
    if (!phone) errors.push("Phone is required");

    const email = raw["email"] ?? "";
    if (email && !EMAIL_RE.test(email)) errors.push(`Invalid email "${email}"`);

    const { values: serviceTypes, errors: serviceTypeErrors } = parseListField(
      raw["servicetypes"] ?? "",
      SERVICE_TYPES,
      "Service types"
    );
    errors.push(...serviceTypeErrors);

    let defaultFrequency: (typeof FREQUENCIES)[number] = "weekly";
    const freqRaw = raw["defaultfrequency"] ?? "";
    if (freqRaw) {
      const match = matchEnum(freqRaw, FREQUENCIES);
      if (!match) errors.push(`Frequency: unrecognized value "${freqRaw}" (expected one of: ${FREQUENCIES.join(", ")})`);
      else defaultFrequency = match;
    }

    let preferredDay: (typeof DAYS_OF_WEEK)[number] | null = null;
    const dayRaw = raw["preferredday"] ?? "";
    if (dayRaw) {
      const match = matchEnum(dayRaw, DAYS_OF_WEEK);
      if (!match) errors.push(`Preferred day: unrecognized value "${dayRaw}" (expected one of: ${DAYS_OF_WEEK.join(", ")})`);
      else preferredDay = match;
    }

    let defaultDurationHours: number | null = null;
    const durationRaw = raw["defaultdurationhours"] ?? "";
    if (durationRaw) {
      const n = Number(durationRaw);
      if (!Number.isFinite(n) || n <= 0) errors.push(`Duration: "${durationRaw}" is not a positive number`);
      else defaultDurationHours = n;
    }

    let defaultEmployeeId: number | null = null;
    const employeeNameRaw = raw["defaultemployeename"] ?? "";
    if (employeeNameRaw) {
      const match = employees.find((e) => e.name.trim().toLowerCase() === employeeNameRaw.trim().toLowerCase());
      if (!match) {
        // Graceful field-level failure — doesn't block the rest of the row (employee assignment is optional).
        warnings.push(`Default employee: no employee named "${employeeNameRaw}" found — leaving unassigned`);
      } else {
        defaultEmployeeId = match.id;
      }
    }

    let billingRate = 0;
    const rateRaw = raw["billingrate"] ?? "";
    if (rateRaw) {
      const n = Number(rateRaw);
      if (!Number.isFinite(n) || n < 0) errors.push(`Billing rate: "${rateRaw}" is not a valid non-negative number`);
      else billingRate = n;
    }

    let billingRateType: (typeof BILLING_RATE_TYPES)[number] = "per-visit";
    const rateTypeRaw = raw["billingratetype"] ?? "";
    if (rateTypeRaw) {
      const match = matchEnum(rateTypeRaw, BILLING_RATE_TYPES);
      if (!match) errors.push(`Billing rate type: unrecognized value "${rateTypeRaw}" (expected one of: ${BILLING_RATE_TYPES.join(", ")})`);
      else billingRateType = match;
    }

    let status: (typeof CLIENT_STATUSES)[number] = "active";
    const statusRaw = raw["status"] ?? "";
    if (statusRaw) {
      const match = matchEnum(statusRaw, CLIENT_STATUSES);
      if (!match) errors.push(`Status: unrecognized value "${statusRaw}" (expected one of: ${CLIENT_STATUSES.join(", ")})`);
      else status = match;
    }

    const key = dupeKey(name, phone);
    const isDuplicate = !!name && !!phone && (existingKeys.has(key) || seenInFile.has(key));
    if (name && phone) seenInFile.add(key);
    if (isDuplicate) warnings.push("Matches an existing client (same name + phone) — will be skipped");

    const data: ClientCsvRow | null =
      errors.length === 0
        ? {
            name,
            phone,
            address: raw["address"] ?? "",
            email,
            serviceTypes,
            defaultFrequency,
            preferredDay,
            preferredTimeWindow: raw["preferredtimewindow"] ?? "",
            defaultDurationHours,
            defaultEmployeeId,
            accessNotes: raw["accessnotes"] ?? "",
            billingRate,
            billingRateType,
            status,
            notes: raw["notes"] ?? "",
          }
        : null;

    return { rowNumber, raw, data, errors, warnings, isDuplicate };
  });
}

export interface EmployeeCsvRow {
  name: string;
  phone: string;
  qualifiedServiceTypes: string[];
  hourlyPayRate: number | null;
  status: (typeof EMPLOYEE_STATUSES)[number];
}

export function parseEmployeesCsv(
  csvText: string,
  existing: { name: string; phone: string }[]
): ParsedRow<EmployeeCsvRow>[] {
  const rows = parseCsvText(csvText);
  const seenInFile = new Set<string>();
  const existingKeys = new Set(existing.map((e) => dupeKey(e.name, e.phone)));

  return rows.map((raw, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = raw["name"] ?? "";
    const phone = raw["phone"] ?? "";
    if (!name) errors.push("Name is required");

    const { values: qualifiedServiceTypes, errors: qualErrors } = parseListField(
      raw["qualifiedservicetypes"] ?? "",
      SERVICE_TYPES,
      "Qualified service types"
    );
    errors.push(...qualErrors);

    let hourlyPayRate: number | null = null;
    const rateRaw = raw["hourlypayrate"] ?? "";
    if (rateRaw) {
      const n = Number(rateRaw);
      if (!Number.isFinite(n) || n < 0) errors.push(`Hourly pay rate: "${rateRaw}" is not a valid non-negative number`);
      else hourlyPayRate = n;
    }

    let status: (typeof EMPLOYEE_STATUSES)[number] = "active";
    const statusRaw = raw["status"] ?? "";
    if (statusRaw) {
      const match = matchEnum(statusRaw, EMPLOYEE_STATUSES);
      if (!match) errors.push(`Status: unrecognized value "${statusRaw}" (expected one of: ${EMPLOYEE_STATUSES.join(", ")})`);
      else status = match;
    }

    const key = dupeKey(name, phone);
    const isDuplicate = !!name && (existingKeys.has(key) || seenInFile.has(key));
    if (name) seenInFile.add(key);
    if (isDuplicate) warnings.push("Matches an existing employee (same name + phone) — will be skipped");

    const data: EmployeeCsvRow | null =
      errors.length === 0 ? { name, phone, qualifiedServiceTypes, hourlyPayRate, status } : null;

    return { rowNumber, raw, data, errors, warnings, isDuplicate };
  });
}
