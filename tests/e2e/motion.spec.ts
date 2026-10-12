import { expect, test } from "@playwright/test";

test("hero forms can be selected with the keyboard and motion can be paused", async ({ page }) => {
  await page.goto("/");
  const gallery = page.getByRole("button", { name: "Preview Gallery form", exact: true });
  await gallery.focus();
  await page.keyboard.press("Enter");
  await expect(gallery).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("img", { name: "Fire Sword as a Gallery artwork", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play animation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play animation", exact: true }).click();
  await page.getByRole("button", { name: "Pause animation", exact: true }).click();
  const selected = await page.locator("[data-form][aria-pressed=true]").getAttribute("data-form");
  await page.waitForTimeout(3500);
  await expect(page.locator("[data-form][aria-pressed=true]")).toHaveAttribute("data-form", selected!);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Preview Arena form", exact: true }).click();
  await page.screenshot({ path: ".local/ui-preview-desktop.png", fullPage: true, animations: "disabled" });
});

test("reduced motion keeps the hero static and every form remains accessible on mobile", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Play animation", exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Preview Social form", exact: true }).click();
  await expect(page.getByRole("img", { name: "Fire Sword as a Social badge", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  await page.screenshot({ path: ".local/ui-preview-mobile.png", fullPage: true, animations: "disabled" });
  await page.getByRole("link", { name: "Rupa home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "One asset. Every form.", exact: true })).toBeVisible();
});
