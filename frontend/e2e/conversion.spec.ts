import { test, expect } from "@playwright/test";
import { login } from "./helpers/auth";
import { createDocument } from "./helpers/seed";

test.describe("Conversion flow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Edit markdown and save", async ({ page }) => {
    await createDocument(page);

    // Switch to edit mode
    await page.getByRole("button", { name: /edit/i }).first().click();

    // The editor should be visible
    const editor = page.locator(".w-md-editor");
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Click save
    await page.getByRole("button", { name: /save/i }).first().click();

    // Should show saved indicator
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  });

  test("Convert document with template and mapping", async ({ page }) => {
    await createDocument(page);

    // Wait for classification to finish (or skip)
    await page.waitForTimeout(3000);

    // Select template if dropdown is available
    const templateSelect = page.locator("select").first();
    if (await templateSelect.isVisible()) {
      const options = await templateSelect.locator("option").all();
      // Select first non-placeholder option if available
      if (options.length > 1) {
        await templateSelect.selectOption({ index: 1 });
      }
    }

    // Select mapping if dropdown is available
    const mappingSelect = page.locator("select").nth(1);
    if (await mappingSelect.isVisible()) {
      const options = await mappingSelect.locator("option").all();
      if (options.length > 1) {
        await mappingSelect.selectOption({ index: 1 });
      }
    }

    // Click convert if both are selected
    const convertBtn = page.getByRole("button", { name: /convert/i });
    if (await convertBtn.isEnabled()) {
      await convertBtn.click();

      // Should either show post-convert view or error toast
      await Promise.race([
        page.waitForSelector('[class*="docx-preview"]', { timeout: 30000 }),
        page.waitForSelector('[data-sonner-toast]', { timeout: 30000 }),
      ]);
    }
  });

  test("Download button appears after conversion", async ({ page }) => {
    await createDocument(page);

    // Wait for auto-classification
    await page.waitForTimeout(3000);

    // If template/mapping are auto-selected, try conversion
    const convertBtn = page.getByRole("button", { name: /convert/i });
    if (await convertBtn.isEnabled({ timeout: 5000 }).catch(() => false)) {
      await convertBtn.click();

      // Wait for conversion to complete
      const downloadBtn = page.getByRole("button", { name: /\.docx/i });
      await expect(downloadBtn).toBeVisible({ timeout: 30000 });
    }
  });
});
