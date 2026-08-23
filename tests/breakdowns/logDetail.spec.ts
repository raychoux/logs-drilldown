import { expect, test } from '@grafana/plugin-e2e';

import { testIds } from '../../src/services/testIds';
import { ExplorePage } from '../fixtures/explore';

import { setupServiceBreakdownTest, teardownServiceBreakdownTest } from './shared';

test.describe('Log detail — quick checks', () => {
  let explorePage: ExplorePage;

  test.beforeEach(async ({ page, grafanaVersion }, testInfo) => {
    explorePage = await setupServiceBreakdownTest(page, grafanaVersion, testInfo);
  });

  test.afterEach(async () => {
    await teardownServiceBreakdownTest(explorePage);
  });

  test('the native logs row action opens the plugin-owned dialog', async ({ page }) => {
    await explorePage.goToLogsTab();

    const row = page.locator('.unwrapped-log-line').nth(1);
    await expect(row).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText(/Rendering \d+ rows.../)).toHaveCount(0);
    await row.hover();
    await page.getByLabel('Log menu').first().click();
    await page.getByText('Open log details', { exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Log details' })).toBeVisible();
    await expect(page.getByTestId(testIds.logDetails.logLine)).toBeVisible();
  });

  test('the native table inspect action opens the plugin-owned dialog', async ({ page }) => {
    await explorePage.goToLogsTab();
    await explorePage.clickTableToggle();

    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId(testIds.table.inspectLine).first().click();

    const dialog = page.getByRole('dialog', { name: 'Log details' });
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId(testIds.logDetails.logLine)).toBeVisible();
    await expect(page.getByTestId(testIds.logDetails.fields)).toBeVisible();
    await expect(page.getByTestId(testIds.logDetails.copyLogLine)).toBeVisible();

    const bodyText = (await page.getByTestId(testIds.logDetails.logLine).textContent()) ?? '';
    expect(bodyText.replace(/\s+/g, '').trim().length).toBeGreaterThan(0);
  });

  test('switching native table rows resets dialog state', async ({ page }) => {
    await explorePage.goToLogsTab();
    await explorePage.clickTableToggle();
    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible({ timeout: 45_000 });

    const inspectButtons = page.getByTestId(testIds.table.inspectLine);
    await expect(inspectButtons.first()).toBeVisible({ timeout: 15_000 });

    await inspectButtons.nth(0).click();
    await expect(page.getByRole('dialog', { name: 'Log details' })).toBeVisible();
    await page.getByTestId(testIds.logDetails.search).fill('no-match-for-next-row');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Log details' })).toBeHidden();

    if ((await inspectButtons.count()) < 2) {
      test.skip(true, 'only one inspect button present');
      return;
    }
    await inspectButtons.nth(1).click();
    await expect(page.getByRole('dialog', { name: 'Log details' })).toBeVisible();
    await expect(page.getByTestId(testIds.logDetails.search)).toHaveValue('');
  });

  test('dialog keeps a row snapshot while the native table refreshes', async ({ page }) => {
    await explorePage.goToLogsTab();
    await explorePage.clickTableToggle();
    await expect(page.getByTestId(testIds.table.wrapper)).toBeVisible({ timeout: 45_000 });

    const inspectButtons = page.getByTestId(testIds.table.inspectLine);
    await expect(inspectButtons.first()).toBeVisible({ timeout: 15_000 });

    await inspectButtons.first().click();
    await expect(page.getByRole('dialog', { name: 'Log details' })).toBeVisible();
    const bodyBefore = (await page.getByTestId(testIds.logDetails.logLine).textContent()) ?? '';

    const refresh = page.getByRole('button', { name: /refresh/i }).first();
    if ((await refresh.count()) > 0) {
      await refresh.click({ timeout: 2_000 }).catch(() => {});
    }

    await expect(page.getByRole('dialog', { name: 'Log details' })).toBeVisible();
    const bodyAfter = (await page.getByTestId(testIds.logDetails.logLine).textContent()) ?? '';
    expect(bodyAfter).toBe(bodyBefore);
  });
});
