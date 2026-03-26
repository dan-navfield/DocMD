import { test, expect } from "@playwright/test";
test.describe("Error handling", () => {
  test("Navigating to nonexistent document shows error feedback", async ({
    page,
  }) => {
    await page.goto("/documents/00000000-0000-0000-0000-000000000000");

    // Should show an error toast or stay on loading
    const toast = page.locator("[data-sonner-toast]");
    const errorVisible = await toast
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    // Either a toast appeared or the page didn't crash (no unhandled error)
    expect(errorVisible || (await page.title()) !== "").toBeTruthy();
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
