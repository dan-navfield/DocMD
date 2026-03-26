import { test, expect } from "@playwright/test";
test.describe("Settings", () => {
  test("Settings page loads with profile section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { name: "Personal Information" })
    ).toBeVisible();
  });

  test("Settings sub-nav has all sections", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Billing" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Fonts" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "API Keys" })
    ).toBeVisible();
  });

  test("API Keys section shows key management", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "API Keys" }).click();
    await expect(page.getByText(/api key/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("Sign out button is visible", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Sign out")).toBeVisible();
  });
});
