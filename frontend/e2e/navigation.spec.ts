import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Top bar tabs navigate to correct pages", async ({ page }) => {
    await page.goto("/documents");

    // Documents tab
    await page.getByRole("link", { name: /documents/i }).first().click();
    await expect(page).toHaveURL(/\/documents/);

    // Templates tab
    await page.getByRole("link", { name: /templates/i }).first().click();
    await expect(page).toHaveURL(/\/templates/);

    // Mappings tab
    await page.getByRole("link", { name: /mappings/i }).first().click();
    await expect(page).toHaveURL(/\/mappings/);

    // Projects tab
    await page.getByRole("link", { name: /projects/i }).first().click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test("Icon nav navigates to main sections", async ({ page }) => {
    await page.goto("/documents");

    // Settings icon (gear)
    const settingsLink = page.locator('a[href="/settings"]');
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/);
    }
  });

  test("Sidebar shows on documents page", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByText("Smart Views")).toBeVisible();
    await expect(page.getByText("Projects")).toBeVisible();
    await expect(page.getByText("Tags")).toBeVisible();
  });

  test("Sidebar smart views filter documents", async ({ page }) => {
    await page.goto("/documents");

    // Click "Needs review" filter
    await page.getByRole("link", { name: /needs review/i }).click();
    await expect(page).toHaveURL(/status=received/);
  });

  test("Sidebar hidden on non-document pages", async ({ page }) => {
    await page.goto("/templates");
    await expect(page.getByText("Smart Views")).not.toBeVisible();
  });
});
