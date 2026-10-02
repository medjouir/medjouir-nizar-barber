/**
 * Moroccan phone numbers → E.164 (+212XXXXXXXXX).
 * Accepts 0612345678, 06 12 34 56 78, +212612345678, 00212612345678,
 * 212612345678, +212 (0)6 12…, with spaces, dots, dashes or parentheses.
 * Only Moroccan mobile/fixed ranges (5, 6, 7) are accepted.
 */
export function normalizeMoroccanPhone(input: string): string | null {
  let digits = input.trim().replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  let national: string;
  if (digits.startsWith("212")) {
    national = digits.slice(3);
    if (national.startsWith("0")) national = national.slice(1); // +212 (0)6…
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    return null;
  }

  return /^[5-7]\d{8}$/.test(national) ? `+212${national}` : null;
}

/** +212612345678 → "06 12 34 56 78". */
export function formatMoroccanPhone(e164: string): string {
  if (!e164.startsWith("+212") || e164.length !== 13) return e164;
  const n = `0${e164.slice(4)}`;
  return n.replace(/(\d{2})(?=\d)/g, "$1 ");
}

/** wa.me expects the number without "+". */
export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}`;
}
