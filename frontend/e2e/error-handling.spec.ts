import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Error handling", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Navigating to nonexistent document shows error toast", async ({
    page,
  }) => {
    await page.goto("/documents/nonexistent-id-12345");

    // Should show an error toast
    const toast = page.locator("[data-sonner-toast]");
    await expect(toast).toBeVisible({ timeout: 10000 });
  });

  test("Expired session redirects to login", async ({ page }) => {
    await page.goto("/documents");

    // Clear the auth session to simulate expiry
    await page.evaluate(() => {
      localStorage.clear();
      // Clear supabase auth tokens
      Object.keys(localStorage).forEach((key) => {
        if (key.includes("supabase") || key.includes("auth")) {
          localStorage.removeItem(key);
        }
      });
    });

    // Reload — should redirect to login
    await page.reload();
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});
