import { expect, test, type Page } from '@playwright/test';

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', e => messages.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Try demo', exact: true }).click();
  await expect(page.locator('.kbd__key').first()).toBeVisible();
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

async function section(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: false }).click();
  await expect(page.locator('.skeleton')).toHaveCount(0);
}

test('LED readback follows actual output brightness once, pauses, and changes with profiles', async ({ page }) => {
  await section(page, 'Lighting');
  const preview = page.getByRole('region', { name: 'Lighting preview', exact: true });
  await expect(preview.getByRole('status')).toHaveText('Demo LED stream');
  await expect(page.getByLabel('Preview source', { exact: true })).toHaveValue('keyboard');
  await page.getByRole('radio', { name: /Static/ }).click();
  await page.getByText('Rainbow colours', { exact: true }).click();
  await page.getByLabel('Colour', { exact: true }).fill('#c86432');
  await page.getByLabel(/Brightness/).fill('50');
  const key = preview.locator('rect').first();
  await expect(key).toHaveAttribute('fill', '#643219'); // Actual RGB halved once, not twice.
  await preview.getByRole('button', { name: 'Pause preview', exact: true }).click();
  await page.getByLabel(/Brightness/).fill('100');
  await page.waitForTimeout(400);
  await expect(key).toHaveAttribute('fill', '#643219');
  await preview.getByRole('button', { name: 'Refresh snapshot', exact: true }).click();
  await expect(key).toHaveAttribute('fill', '#c86432');
  await preview.getByRole('button', { name: 'Play preview', exact: true }).click();
  await page.getByRole('radio', { name: 'Profile 2', exact: true }).click();
  await expect(key).not.toHaveAttribute('fill', '#c86432');
  await page.getByRole('radio', { name: 'Profile 1', exact: true }).click();
  await expect(key).toHaveAttribute('fill', '#c86432');
});

test('reduced motion takes a real LED snapshot and refreshes only on request', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await section(page, 'Lighting');
  const preview = page.getByRole('region', { name: 'Lighting preview', exact: true });
  await expect(preview.getByRole('status')).toHaveText('Snapshot paused');
  const key = preview.locator('rect').first();
  const initial = await key.getAttribute('fill');
  await page.getByLabel(/Brightness/).fill('0');
  await page.waitForTimeout(450);
  await expect(key).toHaveAttribute('fill', initial!);
  await preview.getByRole('button', { name: 'Refresh snapshot', exact: true }).click();
  await expect(key).toHaveAttribute('fill', '#000000');
  await expect(preview.getByRole('button', { name: 'Pause preview', exact: true })).toBeDisabled();
});

test('WASD and arrow shortcuts select physical keys even after remapping', async ({ page }) => {
  await page.getByRole('button', { name: 'WASD', exact: true }).click();
  await expect(page.locator('.kbd__key[aria-pressed=true]')).toHaveCount(4);
  await page.getByRole('searchbox', { name: 'Search keys' }).fill('F5');
  await page.locator('.picker__key').filter({ hasText: /^F5$/ }).click();
  await page.getByRole('button', { name: 'None', exact: true }).click();
  await page.getByRole('button', { name: 'WASD', exact: true }).click();
  await expect(page.locator('.kbd__key[aria-pressed=true]')).toHaveCount(4);
  await section(page, 'Performance');
  await page.getByRole('button', { name: 'WASD', exact: true }).click();
  await expect(page.locator('.kbd__key[aria-pressed=true]')).toHaveCount(4);
  await page.getByRole('button', { name: 'Arrows', exact: true }).click();
  await expect(page.locator('.kbd__key[aria-pressed=true]')).toHaveCount(4);
});

test('match sensitivity keeps selected keys independent and survives navigation', async ({ page }) => {
  // Includes connection, multi-key writes and round-trip navigation on constrained runners.
  test.setTimeout(60_000);
  await section(page, 'Performance');
  await page.getByRole('button', { name: 'WASD', exact: true }).click();
  await page.getByRole('radio', { name: 'Rapid Trigger', exact: true }).click();
  const press = page.getByRole('spinbutton', { name: 'Rapid Trigger: press sensitivity mm', exact: true });
  const release = page.getByRole('spinbutton', { name: 'Rapid Trigger: release sensitivity mm', exact: true });
  await press.fill('0.17');
  await press.press('Enter');
  await expect(release).not.toHaveValue('0.17');
  await page.getByRole('button', { name: 'Match release to press', exact: true }).click();
  await expect(release).toHaveValue('0.17');
  await section(page, 'Lighting');
  await section(page, 'Performance');
  await page.getByRole('button', { name: 'WASD', exact: true }).click();
  await expect(release).toHaveValue('0.17');
  await page.getByRole('button', { name: 'Arrows', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Normal', exact: true })).toHaveAttribute('aria-checked', 'true');
});

test('recent colours can be reused and persist after reloading', async ({ page }) => {
  await section(page, 'Lighting');
  await page.getByRole('radio', { name: /Static/ }).click();
  await page.getByText('Rainbow colours', { exact: true }).click();
  await page.getByLabel('Colour', { exact: true }).fill('#aabbcc');
  await expect(page.getByRole('button', { name: 'Recent colour #aabbcc', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Colour #ff2828', exact: true }).click();
  await page.getByRole('button', { name: 'Recent colour #aabbcc', exact: true }).click();
  await expect(page.getByLabel('Colour', { exact: true })).toHaveValue('#aabbcc');
  await page.reload();
  await page.getByRole('button', { name: 'Try demo', exact: true }).click();
  await section(page, 'Lighting');
  await page.getByRole('radio', { name: /Custom/ }).click();
  await expect(page.getByRole('button', { name: 'Recent colour #aabbcc', exact: true })).toBeVisible();
});
