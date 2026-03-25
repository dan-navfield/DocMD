import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";

test.describe("Settings", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Settings page loads with sections", async ({ page }) => {
    await page.goto("/settings");
    // Should show at least profile or LLM settings section
    await expect(
      page.getByText(/profile|settings|api|llm/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("LLM provider section is visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByText(/llm|ai provider|language model/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("API keys section is visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(
      page.getByText(/api key/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("Generate API key button exists", async ({ page }) => {
    await page.goto("/settings");
    const genBtn = page.getByRole("button", { name: /generate|create|new.*key/i });
    await expect(genBtn.first()).toBeVisible({ timeout: 10000 });
  });
});
