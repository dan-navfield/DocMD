import { test as setup } from "@playwright/test";

/**
 * Global setup: log in once and save the session to a file.
 * All other tests reuse this session via storageState.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for E2E tests"
    );
  }

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("you@company.com").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30000,
  });

  // Save the authenticated session
  await page.context().storageState({ path: "e2e/.auth/session.json" });
});
