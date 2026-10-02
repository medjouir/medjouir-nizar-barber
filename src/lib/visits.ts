/** "1 ziyara" / "3 ziyarat". Proposed copy — pending review. */
export function visitsLabel(n: number): string {
  return `${n} ${n === 1 ? "ziyara" : "ziyarat"}`;
}
