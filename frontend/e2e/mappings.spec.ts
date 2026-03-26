import { test, expect } from "@playwright/test";
test.describe("Mappings", () => {
  test("Mappings page loads", async ({ page }) => {
    await page.goto("/mappings");
    await expect(
      page.getByText(/mappings|mapping|no mappings/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Create mapping button is visible", async ({ page }) => {
    await page.goto("/mappings");
    const createBtn = page.getByRole("button", { name: /create|new|add/i });
    await expect(createBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("Clicking a mapping navigates to editor", async ({ page }) => {
    await page.goto("/mappings");

    const mappingLink = page.locator('a[href^="/mappings/"]').first();
    if (await mappingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mappingLink.click();
      await expect(page).toHaveURL(/\/mappings\/[\w-]+/);
    }
  });

  test("Mapping editor shows style fields", async ({ page }) => {
    await page.goto("/mappings");

    const mappingLink = page.locator('a[href^="/mappings/"]').first();
    if (await mappingLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await mappingLink.click();
      await page.waitForURL(/\/mappings\/[\w-]+/);

      // Should show mapping field labels
      await expect(
        page.getByText(/heading|paragraph|list/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
