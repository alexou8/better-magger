import { expect, test, type Page } from '@playwright/test';

const appErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  appErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
});
test.afterEach(async ({ page }) => { expect(appErrors.get(page)).toEqual([]); });

async function demo(page: Page, model?: string) {
  await page.goto('/');
  if (model) await page.getByLabel('Demo model').selectOption({ label: model });
  await page.getByRole('button', { name: 'Try demo', exact: true }).click();
  await expect(page.locator('.kbd__key').first()).toBeVisible();
}
async function section(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name, exact: false }).click();
  await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
  await expect(page.locator('.skeleton')).toHaveCount(0);
}

test('profile names persist, stay separate and can be cleared', async ({ page }) => {
  await demo(page);
  await section(page, 'Settings');
  await page.getByLabel('Profile 1 name', { exact: true }).fill('Everyday');
  await page.getByRole('button', { name: 'Save profile name', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Profile 1: Everyday', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'Profile 2', exact: true }).click();
  await expect(page.getByLabel('Profile 2 name', { exact: true })).toHaveValue('');
  await page.getByRole('radio', { name: 'Profile 1: Everyday', exact: true }).click();
  await expect(page.getByLabel('Profile 1 name', { exact: true })).toHaveValue('Everyday');
  await page.reload();
  await demo(page);
  await expect(page.getByRole('radio', { name: 'Profile 1: Everyday', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await demo(page, 'Magger68 Pro');
  await expect(page.getByRole('radio', { name: 'Profile 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await demo(page, 'Magger68 Plus');
  await section(page, 'Settings');
  await page.getByLabel('Profile 1 name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Save profile name', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Profile 1', exact: true })).toBeVisible();
});

test('blocked storage keeps profile naming usable for the session', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('Blocked'); }; });
  await demo(page);
  await section(page, 'Settings');
  await page.getByLabel('Profile 1 name', { exact: true }).fill('Gaming');
  await page.getByRole('button', { name: 'Save profile name', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Profile 1: Gaming', exact: true })).toBeVisible();
  await expect(page.getByText('Name updated for this session. Browser storage is unavailable.')).toBeVisible();
});

test('lighting animates, pauses, responds to brightness and restores per profile', async ({ page }) => {
  await demo(page);
  await section(page, 'Lighting');
  await page.getByLabel('Preview source', { exact: true }).selectOption('illustration');
  const preview = page.getByRole('region', { name: 'Lighting preview', exact: true });
  const key = preview.locator('rect').first();
  await page.getByRole('radio', { name: /Breathe/ }).click();
  await preview.getByRole('button', { name: 'Pause preview', exact: true }).click();
  const paused = await key.getAttribute('fill');
  await page.waitForTimeout(250);
  await expect(key).toHaveAttribute('fill', paused!);
  await preview.getByRole('button', { name: 'Play preview', exact: true }).click();
  await expect.poll(() => key.getAttribute('fill')).not.toBe(paused);
  await page.getByLabel(/Brightness/).fill('0');
  await expect(key).toHaveAttribute('fill', '#000000');
  await page.getByRole('radio', { name: 'Profile 2', exact: true }).click();
  await expect(page.getByLabel(/Brightness/)).not.toHaveValue('0');
  await page.getByRole('radio', { name: 'Profile 1', exact: true }).click();
  await expect(page.getByLabel(/Brightness/)).toHaveValue('0');
});

test('reduced motion shows a still preview and custom colours match the painter', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await demo(page);
  await section(page, 'Lighting');
  await page.getByLabel('Preview source', { exact: true }).selectOption('illustration');
  const preview = page.getByRole('region', { name: 'Lighting preview', exact: true });
  await expect(preview.getByRole('button', { name: 'Pause preview', exact: true })).toBeDisabled();
  const key = preview.locator('rect').first();
  const initial = await key.getAttribute('fill');
  await page.waitForTimeout(250);
  await expect(key).toHaveAttribute('fill', initial!);
  await page.getByRole('radio', { name: /Custom/ }).click();
  await page.getByLabel(/Brightness/).fill('100');
  await page.getByRole('button', { name: 'Fill all keys', exact: true }).click();
  await expect(key).toHaveAttribute('fill', '#00c8ff');
});

test('switch travel preview is independent and switch selection clamps actuation', async ({ page }) => {
  await demo(page, 'Magger68 Pro');
  await section(page, 'Performance');
  await page.locator('.kbd__key').first().click();
  const actuation = page.getByRole('spinbutton', { name: 'Actuation point mm', exact: true });
  await actuation.fill('3.5');
  await actuation.press('Enter');
  await page.getByLabel('Switch type', { exact: true }).selectOption({ label: 'Gateron Jade Switch' });
  await expect(actuation).toHaveValue('3.30');
  await expect(page.getByLabel('Actuation measurements')).toContainText('3.30 mm · Fully pressed');
  const preview = page.getByRole('region', { name: 'Switch preview', exact: true });
  await preview.getByLabel('Preview press depth', { exact: true }).fill('165');
  await expect(preview.getByText('Past actuation point', { exact: true })).toBeVisible();
  await expect(actuation).toHaveValue('3.30');
  await section(page, 'Lighting');
  await section(page, 'Performance');
  await page.locator('.kbd__key').first().click();
  await expect(page.getByLabel('Switch type', { exact: true })).toHaveValue('2');
  await expect(actuation).toHaveValue('3.30');
});

test('named profiles and preview controls reflow on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  await section(page, 'Settings');
  for (let profile = 1; profile <= 4; profile++) {
    await page.getByRole('radio', { name: `Profile ${profile}`, exact: true }).click();
    await page.getByLabel(`Profile ${profile} name`, { exact: true }).fill(`Long profile name ${profile}!!!!!`);
    await page.getByRole('button', { name: 'Save profile name', exact: true }).click();
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  for (const name of ['Lighting', 'Performance']) {
    await section(page, name);
    if (name === 'Performance') await page.locator('.kbd__key').first().click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
