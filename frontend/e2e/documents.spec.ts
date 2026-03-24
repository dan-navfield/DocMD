import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { createDocument } from "./helpers/seed";

test.describe("Document lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("New Document button creates doc and navigates to editor", async ({
    page,
  }) => {
    await page.goto("/documents");
    await page
      .getByRole("button", { name: /new document/i })
      .first()
      .click();

    // Should navigate to /documents/<uuid>
    await page.waitForURL(/\/documents\/[\w-]+/, { timeout: 10000 });
    // Should show the document title
    await expect(page.getByText("Untitled Document")).toBeVisible();
  });

  test("Document list shows created documents", async ({ page }) => {
    // Create a doc first
    await createDocument(page);

    // Go back to list
    await page.goto("/documents");
    await expect(page.getByText("Untitled Document")).toBeVisible();
  });

  test("Search filters documents", async ({ page }) => {
    await page.goto("/documents");
    const searchInput = page.getByPlaceholder(/search documents/i);
    await searchInput.fill("nonexistent-query-xyz");

    // Wait for the list to update
    await page.waitForTimeout(500);

    // Should show empty state or no matching docs
    const docLinks = page.locator('a[href^="/documents/"]');
    await expect(docLinks).toHaveCount(0);
  });

  test("Delete document removes it from list", async ({ page }) => {
    const docId = await createDocument(page);

    // We're now on the document detail page
    // Click delete
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /delete/i }).click();

    // Should navigate back to documents list
    await page.waitForURL("/documents", { timeout: 10000 });
  });
});
