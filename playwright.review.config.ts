import { defineConfig } from '@playwright/test';
import type { PluginOptions } from '@grafana/plugin-e2e';

import { authProject, baseConfig, chromiumProjectWithPermissions } from './playwright.base.config';
import { E2ESubPath } from './tests/fixtures/explore';

export default defineConfig<PluginOptions>({
  ...baseConfig,
  fullyParallel: false,
  outputDir: 'artifacts/ui-review/test-results',
  projects: [authProject, chromiumProjectWithPermissions],
  reporter: [['line'], ['html', { open: 'never', outputFolder: 'artifacts/ui-review/report' }]],
  testDir: './tests/review',
  use: {
    ...baseConfig.use,
    baseURL: process.env.GRAFANA_URL ?? `http://localhost:3001${E2ESubPath}`,
  },
  workers: 1,
});
