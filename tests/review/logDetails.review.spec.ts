import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@grafana/plugin-e2e';
import type { Page, TestInfo } from '@playwright/test';

import { testIds } from '../../src/services/testIds';
import { ExplorePage } from '../fixtures/explore';

const artifactDir = path.resolve('artifacts/ui-review');
const reviewFrom = process.env.UI_REVIEW_FROM ?? 'now-15m';
const reviewTo = process.env.UI_REVIEW_TO ?? 'now';

async function capture(page: Page, testInfo: TestInfo, name: string) {
  const screenshotPath = path.join(artifactDir, `${name}.png`);
  await page.screenshot({ animations: 'disabled', caret: 'hide', path: screenshotPath });
  await testInfo.attach(name, { contentType: 'image/png', path: screenshotPath });
}

test('captures the custom dialog from native Logs and Table renderers', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await mkdir(artifactDir, { recursive: true });

  const explorePage = new ExplorePage(page, testInfo);
  await page.setViewportSize({ height: 1000, width: 1440 });
  await explorePage.clearLocalStorage();
  await explorePage.gotoServicesBreakdownOldUrl('tempo-distributor', reviewFrom, reviewTo);
  await explorePage.assertNotLoading();

  const nativeLogRows = page.locator('.unwrapped-log-line');
  const nativeLogRow = nativeLogRows.nth(1);
  await expect(nativeLogRow).toBeVisible({ timeout: 45_000 });
  await nativeLogRow.click();
  const nativeDetailsSearch = page.getByPlaceholder('Search field names and values').first();
  await expect(nativeDetailsSearch).toBeVisible();
  await expect(page.getByLabel('Anchor to the right')).toHaveCount(0);

  const nativeDetailsPane = page
    .locator('section > div[class$="panel-content"] div:has(> div > div > [data-testid="input-wrapper"]):has(button)')
    .first();
  const nativeDetailsBox = await nativeDetailsPane.boundingBox();
  const viewport = page.viewportSize();
  expect(nativeDetailsBox?.x).toBeGreaterThan((viewport?.width ?? 0) * 0.6);
  expect(nativeDetailsBox?.width).toBeLessThan((viewport?.width ?? 0) * 0.4);
  expect(nativeDetailsBox?.y).toBeGreaterThanOrEqual(68);
  expect(nativeDetailsBox?.y).toBeLessThanOrEqual(76);
  expect((viewport?.height ?? 0) - (nativeDetailsBox?.y ?? 0) - (nativeDetailsBox?.height ?? 0)).toBeLessThanOrEqual(
    12
  );

  const nextLogRow = nativeLogRows.nth(2);
  await expect(nextLogRow).toBeVisible();
  await nextLogRow.click();
  await expect(nativeDetailsSearch).toBeVisible();
  await capture(page, testInfo, 'log-details-native-anchored');

  await page.getByLabel('Display inline').click();
  const visibleAnchorButton = page.locator('button[aria-label="Anchor to the right"]:visible').first();
  await expect(visibleAnchorButton).toBeVisible();
  const inlineDetailsBox = await nativeDetailsPane.boundingBox();
  const logsPanelBox = await nativeDetailsPane.locator('xpath=ancestor::section[1]').boundingBox();
  expect(inlineDetailsBox).not.toBeNull();
  expect(logsPanelBox).not.toBeNull();
  const inlineWidthRatio = (inlineDetailsBox?.width ?? 0) / (logsPanelBox?.width ?? 1);
  expect(inlineWidthRatio).toBeGreaterThanOrEqual(0.45);
  expect(inlineWidthRatio).toBeLessThanOrEqual(0.55);

  const inlineNextLogRow = nativeLogRows.nth(3);
  await expect(inlineNextLogRow).toBeVisible();
  await inlineNextLogRow.click();
  await expect(nativeDetailsSearch).toBeVisible();
  await capture(page, testInfo, 'log-details-native-inline-half');
  for (let openDetailCount = 0; openDetailCount < 5; openDetailCount++) {
    const closeButton = page.locator('button[aria-label="Close log details"]:visible').first();
    if ((await closeButton.count()) === 0) {
      break;
    }
    await closeButton.click();
  }
  await expect(page.locator('button[aria-label="Close log details"]:visible')).toHaveCount(0);

  await nativeLogRow.hover();
  await page.getByLabel('Log menu').first().click();
  await page.getByText('Open log details', { exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Log details' })).toBeVisible();
  await capture(page, testInfo, 'log-details-native-logs');

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Log details' })).toBeHidden();
  await explorePage.clickTableToggle();
  await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible({ timeout: 45_000 });
  await page.getByTestId(testIds.table.inspectLine).first().click();
  await expect(page.getByRole('dialog', { name: 'Log details' })).toBeVisible();
  await capture(page, testInfo, 'log-details-native-table');
});

test('captures Show Context with wrapping disabled by default', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await mkdir(artifactDir, { recursive: true });

  const explorePage = new ExplorePage(page, testInfo);
  await page.setViewportSize({ height: 1000, width: 1440 });
  await explorePage.clearLocalStorage();
  await explorePage.gotoServicesBreakdownOldUrl('tempo-distributor', reviewFrom, reviewTo);
  await explorePage.assertNotLoading();

  const logMenus = page.getByLabel('Log menu');
  await expect(logMenus.first()).toBeAttached({ timeout: 45_000 });
  await explorePage.setLogsLineWrapMenu(true);

  await logMenus.first().click({ force: true });
  await page.getByText('Show context', { exact: true }).click();
  let contextDialog = page.getByRole('dialog', { name: 'Log context' });
  let contextWrap = contextDialog.getByRole('switch', { name: 'Wrap lines' });
  await expect(contextWrap).not.toBeChecked();

  await contextWrap.check();
  await expect(contextWrap).toBeChecked();
  await contextDialog.getByRole('button', { name: 'Close' }).click();
  await expect(contextDialog).toBeHidden();

  await logMenus.nth(1).click({ force: true });
  await page.getByText('Show context', { exact: true }).click();
  contextDialog = page.getByRole('dialog', { name: 'Log context' });
  contextWrap = contextDialog.getByRole('switch', { name: 'Wrap lines' });
  await expect(contextWrap).not.toBeChecked();
  await capture(page, testInfo, 'log-context-wrap-default-off');
});
