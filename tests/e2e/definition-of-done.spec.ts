import { expect, test, type Page } from "@playwright/test";

/*
 * V0.1 definition of done: a client books from the shared link on mobile, the
 * slot is no longer bookable, and Nizar sees, contacts, plans, completes,
 * reschedules and cancels appointments.
 */

const availableDays = (page: Page) => page.locator("main button[aria-pressed]:not([disabled])").filter({ hasText: /\d/ });
const timeSlots = (page: Page) => page.locator("main div.grid-cols-3 > button").filter({ hasText: /^\d{2}:\d{2}$/ });

async function bookAsClient(page: Page, opts: { service: RegExp; dayIndex: number; name: string; phone: string }) {
  await page.goto("/nizar");
  await expect(page.getByRole("heading", { name: "7jez rendez-vous dyalk 3end Nizar." })).toBeVisible();
  await page.getByRole("link", { name: "7jez daba" }).click();

  await expect(page.getByRole("heading", { name: "Chno bghiti dir?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kmel" })).toBeDisabled();
  await page.getByRole("button", { name: opts.service }).click();
  await page.getByRole("button", { name: "Kmel" }).click();

  await expect(page.getByRole("heading", { name: "Imta bghiti tji?" })).toBeVisible();
  await availableDays(page).nth(opts.dayIndex).click();

  await expect(page.getByRole("heading", { name: "Khtar lwe9t li ynasbek" })).toBeVisible();
  const time = (await timeSlots(page).first().innerText()).trim();
  await timeSlots(page).first().click();
  await page.getByRole("button", { name: "Kmel" }).click();

  await expect(page.getByRole("heading", { name: "B9a ghir n3rfo chkoun nta." })).toBeVisible();
  await page.getByLabel("Smitk").fill(opts.name);
  await page.getByLabel("Numero telephone").fill(opts.phone);
  await page.getByRole("button", { name: "Chof reservation" }).click();

  await expect(page.getByRole("heading", { name: "Kolchi mzyan?" })).toBeVisible();
  await expect(page.getByText("M3a Nizar")).toBeVisible();
  await page.getByRole("button", { name: "T2ked reservation" }).click();

  await expect(page.getByRole("heading", { name: "Rendez-vous dyalk tconfirmat." })).toBeVisible();
  await expect(page).toHaveURL(/\/manage\/[0-9a-f]{64}\?c=1$/);
  return { time, manageUrl: page.url().replace("?c=1", "") };
}

test("client books on mobile and Nizar manages the appointment", async ({ page }) => {
  const booking = await bookAsClient(page, { service: /^Coupe 1h/, dayIndex: 1, name: "Test Client", phone: "06 11 22 33 44" });

  // The confirmed slot can never be offered again.
  await page.goto("/nizar/7jez");
  await page.getByRole("button", { name: /^Coupe 1h/ }).click();
  await page.getByRole("button", { name: "Kmel" }).click();
  await availableDays(page).nth(1).click();
  await expect(timeSlots(page).first()).toBeVisible();
  await expect(timeSlots(page).filter({ hasText: booking.time })).toHaveCount(0);

  // Nizar sees the client and can contact them.
  await page.goto("/dashboard/clients");
  await page.getByRole("searchbox").fill("0611223344");
  await page.getByRole("link", { name: /Test Client/ }).click();
  await expect(page.getByRole("heading", { name: "Test Client" })).toBeVisible();
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", "https://wa.me/212611223344");
  await expect(page.getByRole("link", { name: "3ayet" })).toHaveAttribute("href", "tel:+212611223344");
  await expect(page.getByText("Rendez-vous jay")).toBeVisible();

  // Planning → day of the booking → mark completed.
  await page.goto("/dashboard/planning");
  await page.getByRole("link", { name: "Gddam" }).click();
  const block = page.locator("main button.absolute").filter({ hasText: "Test Client" });
  await block.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText(`${booking.time} →`)).toBeVisible();
  await sheet.getByRole("button", { name: "Tsalat" }).click();
  await expect(sheet).toBeHidden();
  await expect(block).toContainText("Tsalat");

  // The client's link reflects it and no longer allows changes.
  await page.goto(booking.manageUrl);
  await expect(page.getByRole("button", { name: "Bdel lwe9t" })).toHaveCount(0);
});

test("client cancels from the secure link and the slot reopens", async ({ page }) => {
  const booking = await bookAsClient(page, { service: /^Coupe \+ barbe/, dayIndex: 2, name: "Second Client", phone: "0722334455" });

  await page.goto("/dashboard/clients");
  await page.getByRole("searchbox").fill("second");
  await page.getByRole("link", { name: /Second Client/ }).click();
  await expect(page.getByText(booking.time)).toBeVisible();

  // Cancel from the client's side, then check the slot is offered again.
  await page.goto(booking.manageUrl);
  await page.getByRole("button", { name: "Annuler rendez-vous" }).click();
  await page.getByRole("button", { name: "Ah, annuler" }).click();
  await expect(page.getByText("Had rendez-vous tannula.")).toBeVisible();

  await page.goto("/nizar/7jez");
  await page.getByRole("button", { name: /^Coupe \+ barbe/ }).click();
  await page.getByRole("button", { name: "Kmel" }).click();
  await availableDays(page).nth(2).click();
  await expect(timeSlots(page).filter({ hasText: booking.time })).toHaveCount(1);
});

test("public pages expose no private data; bad tokens are 404; sign-out is POST-only", async ({ page, request }) => {
  const landing = await request.get("/nizar");
  const html = await landing.text();
  for (const secret of ["Rendez-vous chkhsi", "+212600000001", "Youssef El Amrani"]) expect(html).not.toContain(secret);

  const unknown = await request.get(`/manage/${"0".repeat(64)}`);
  expect(unknown.status()).toBe(404);
  const notHex = await request.get("/manage/1");
  expect(notHex.status()).toBe(404);

  const signout = await request.get("/auth/signout");
  expect(signout.status()).toBe(405);
  await page.goto("/nope");
  await expect(page.getByRole("heading", { name: "Had saf7a ma kaynach." })).toBeVisible();
});
