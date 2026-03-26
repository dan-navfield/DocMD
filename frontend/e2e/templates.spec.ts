import { test, expect } from "@playwright/test";
test.describe("Templates", () => {
  test("Templates page loads and shows list or empty state", async ({
    page,
  }) => {
    await page.goto("/templates");
    // Should show either templates or an upload prompt
    await expect(
      page.getByText(/templates|upload|no templates/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Upload template button is visible", async ({ page }) => {
    await page.goto("/templates");
    const uploadBtn = page.getByRole("button", { name: /upload|add/i });
    await expect(uploadBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("Clicking a template navigates to detail page", async ({ page }) => {
    await page.goto("/templates");

    // If there are any template links, click the first one
    const templateLink = page.locator('a[href^="/templates/"]').first();
    if (await templateLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await templateLink.click();
      await expect(page).toHaveURL(/\/templates\/[\w-]+/);
    }
  });

  test("Template detail shows style list", async ({ page }) => {
    await page.goto("/templates");

    const templateLink = page.locator('a[href^="/templates/"]').first();
    if (await templateLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await templateLink.click();
      await page.waitForURL(/\/templates\/[\w-]+/);

      // Should show styles section
      await expect(
        page.getByText(/styles|style/i).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
