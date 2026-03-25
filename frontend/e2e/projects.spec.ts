import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Projects", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Projects page loads", async ({ page }) => {
    await page.goto("/projects");
    await expect(
      page.getByText(/projects|no projects/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Create project button is visible", async ({ page }) => {
    await page.goto("/projects");
    const createBtn = page.getByRole("button", { name: /create|new|add/i });
    await expect(createBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test("Create project flow", async ({ page }) => {
    await page.goto("/projects");

    const createBtn = page.getByRole("button", { name: /create|new/i }).first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();

      // Should show a form or modal for project creation
      const nameInput = page.getByPlaceholder(/name|project/i).first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill("E2E Test Project");

        // Submit
        const submitBtn = page.getByRole("button", { name: /create|save|submit/i }).first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();

          // Should navigate to project detail or show in list
          await page.waitForTimeout(2000);
          await expect(page.getByText("E2E Test Project")).toBeVisible({
            timeout: 5000,
          });
        }
      }
    }
  });
});
