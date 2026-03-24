import { Page } from "@playwright/test";

/**
 * Create a test document via the UI "New Document" button.
 * Returns the document ID from the URL.
 */
export async function createDocument(page: Page): Promise<string> {
  // Click the sidebar "New Document" button
  await page.goto("/documents");
  await page
    .getByRole("button", { name: /new document/i })
    .first()
    .click();

  // Wait for navigation to /documents/<id>
  await page.waitForURL(/\/documents\/[\w-]+/, { timeout: 10000 });

  const url = page.url();
  const id = url.split("/documents/")[1]?.split("?")[0];
  if (!id) throw new Error(`Could not extract doc ID from URL: ${url}`);
  return id;
}
