import { Page, expect } from "@playwright/test";

/**
 * Log in via the Supabase email/password form.
 * Expects E2E_TEST_EMAIL and E2E_TEST_PASSWORD env vars to be set.
 */
export async function login(page: Page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for E2E tests"
    );
  }

  await page.goto("/login");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();

  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
}

/**
 * Assert the user is on an authenticated page (not login/signup).
 */
export async function assertAuthenticated(page: Page) {
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page).not.toHaveURL(/\/signup/);
}
