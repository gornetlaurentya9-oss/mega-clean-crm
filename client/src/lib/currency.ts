/** Mega Clean bills in euros — format every money amount through this helper
 *  rather than hand-rolling `$${n}` in individual screens. */
export function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}
