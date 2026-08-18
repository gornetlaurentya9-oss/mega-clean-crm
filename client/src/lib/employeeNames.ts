/**
 * Formats a job/pattern's assigned employee names for compact display — used everywhere a job
 * card or list row used to show the old singular `employeeName ?? "Unassigned"`. A job can now
 * carry more than one assigned employee (e.g. two cleaners on one visit), so every consumer of
 * the flattened job shape needs this instead of reading a single name.
 *
 * "Alice" for one, "Alice & Bob" for two, "Alice, Bob & Carol" for three or more.
 */
export function formatEmployeeNames(names: string[] | null | undefined): string {
  const list = names ?? [];
  if (list.length === 0) return "Unassigned";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} & ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} & ${list[list.length - 1]}`;
}

/**
 * Same idea, but for message-template prose ("with Alice and Bob") — uses "and" instead of "&"
 * to read naturally in a sentence, and falls back to a caller-supplied phrase (e.g. "our team")
 * when nobody's assigned yet, since "with Unassigned" would read oddly in a client-facing text.
 */
export function joinEmployeeFirstNamesForMessage(names: string[] | null | undefined, fallback: string): string {
  const firstNames = (names ?? []).map((n) => n.split(" ")[0]);
  if (firstNames.length === 0) return fallback;
  if (firstNames.length === 1) return firstNames[0];
  if (firstNames.length === 2) return `${firstNames[0]} and ${firstNames[1]}`;
  return `${firstNames.slice(0, -1).join(", ")} and ${firstNames[firstNames.length - 1]}`;
}
