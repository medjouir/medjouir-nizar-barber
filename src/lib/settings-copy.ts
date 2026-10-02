/** Barber settings copy. Items marked "proposed" are pending review. */
export const SETTINGS_COPY = {
  save: "7fed", // approved
  // Proposed copy — pending review.
  saved: "Tsjjel.",
  invalid: "Chi haja machi s7i7a. Chof w 3awed.",
  overlap: "Had l'aw9at kaydakhlo f ba3dhom.",
  remove: "Hayed",
};

export function settingsError(code: string): string {
  return code === "overlap" ? SETTINGS_COPY.overlap : SETTINGS_COPY.invalid;
}
