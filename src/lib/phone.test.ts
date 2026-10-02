import { describe, expect, it } from "vitest";
import { formatMoroccanPhone, normalizeMoroccanPhone, whatsappUrl } from "./phone";

describe("normalizeMoroccanPhone", () => {
  it.each([
    ["0612345678", "+212612345678"],
    ["0712345678", "+212712345678"],
    ["+212612345678", "+212612345678"],
    ["+212712345678", "+212712345678"],
    ["06 12 34 56 78", "+212612345678"],
    ["06.12.34.56.78", "+212612345678"],
    ["06-12-34-56-78", "+212612345678"],
    ["00212612345678", "+212612345678"],
    ["212612345678", "+212612345678"],
    ["+212 (0)6 12 34 56 78", "+212612345678"],
    ["0522123456", "+212522123456"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeMoroccanPhone(input)).toBe(expected);
  });

  it.each(["", "061234567", "06123456789", "0812345678", "+33612345678", "612345678", "06abc45678", "+2126123"])(
    "rejects %s",
    (input) => {
      expect(normalizeMoroccanPhone(input)).toBeNull();
    },
  );

  it("formats for display and WhatsApp", () => {
    expect(formatMoroccanPhone("+212612345678")).toBe("06 12 34 56 78");
    expect(whatsappUrl("+212612345678")).toBe("https://wa.me/212612345678");
  });
});
