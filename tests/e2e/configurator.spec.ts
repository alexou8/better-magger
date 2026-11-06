import { expect, test, type Page } from '@playwright/test';

async function demo(page: Page, model?: string) {
  await page.goto('/');
  await expect(
    page.getByText("This browser can't talk to keyboards.", { exact: true }),
  ).toBeVisible();
  if (model) await page.getByLabel('Demo model').selectOption({ label: model });
  await page.getByRole('button', { name: 'Try demo', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Keymap', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.kbd__key').first()).toBeVisible();
}

async function section(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Sections' })
    .getByRole('link', { name, exact: false })
    .click();
  await expect(
    page.getByRole('heading', { level: 2, name, exact: true }),
  ).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    // Demo must work on a browser with no WebHID support, without opening any device.
    Object.defineProperty(navigator, 'hid', {
      value: undefined,
      configurable: true,
    });
  });
  (page as Page & { appErrors?: string[] }).appErrors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { appErrors?: string[] }).appErrors).toEqual([]);
});

test('connect guidance, demo, remap, undo and profile isolation', async ({
  page,
}) => {
  await demo(page);
  const escape = page.locator('.kbd__key').first();
  await escape.click();
  await page.getByRole('searchbox', { name: 'Search keys' }).fill('F5');
  await page.locator('.picker__key').filter({ hasText: /^F5$/ }).click();
  await expect(escape).toContainText('F5');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(escape).not.toContainText('F5');
  await page.getByRole('searchbox', { name: 'Search keys' }).fill('F5');
  await page.locator('.picker__key').filter({ hasText: /^F5$/ }).click();
  await expect(escape).toContainText('F5');
  await page.getByRole('radio', { name: 'Profile 2', exact: true }).click();
  await expect(
    page.getByRole('radio', { name: 'Profile 2', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.kbd__key').first()).not.toContainText('F5');
  await page.getByRole('radio', { name: 'Profile 1', exact: true }).click();
  await expect(page.locator('.kbd__key').first()).toContainText('F5');
});

test('advanced toggle can be created, edited and removed', async ({ page }) => {
  await demo(page);
  await section(page, 'Advanced keys');
  await page.getByRole('button', { name: /Tap to lock a key down/ }).click();
  await page.locator('.kbd__key').first().click();
  await page
    .getByRole('button', { name: 'Assign to key', exact: true })
    .click();
  await expect(page.locator('.binding')).toHaveCount(1);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Edit Toggle/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.binding')).toHaveCount(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.binding')).toHaveCount(0);
  await section(page, 'Keymap');
  await expect(page.locator('.kbd__key').first()).toContainText('Esc');
});

test('press-to-assign captures the first key immediately', async ({ page }) => {
  await demo(page);
  const key = page.locator('.kbd__key').first();
  await key.click();
  await page.getByRole('button', { name: /Press a key to assign/ }).click();
  await page.keyboard.press('z');
  await expect(key).toContainText('Z');
});

test('keyboard skip link preserves the current section', async ({ page }) => {
  await demo(page);
  await section(page, 'Lighting');
  await page
    .getByRole('link', { name: 'Skip to content', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Lighting', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
});

test('recording stops when changing macros and keeps each draft separate', async ({
  page,
}) => {
  await demo(page);
  await section(page, 'Macros');
  await page.getByRole('button', { name: '● Record', exact: true }).click();
  await page.keyboard.press('a');
  await expect(page.locator('.macro-steps > li')).toHaveCount(2);
  await expect(page.getByLabel('Record with a fixed delay')).toBeDisabled();
  await page.locator('.macro-list__item').nth(1).click();
  await expect(
    page.getByRole('button', { name: '● Record', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('b');
  await expect(page.locator('.macro-steps > li')).toHaveCount(0);
  await page.locator('.macro-list__item').first().click();
  await expect(page.locator('.macro-steps > li')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
});

test('lighting and performance edits survive page navigation', async ({
  page,
}) => {
  await demo(page);
  await section(page, 'Lighting');
  await page.getByLabel(/Brightness/).fill('37');
  // Navigation immediately after input must flush the pending slider write.
  await section(page, 'Performance');
  await page.locator('.kbd__key').first().click();
  await page.getByRole('radio', { name: 'Rapid Trigger', exact: true }).click();
  await expect(
    page.getByText('Rapid Trigger: press sensitivity', { exact: true }),
  ).toBeVisible();
  await section(page, 'Lighting');
  await expect(page.getByLabel(/Brightness/)).toHaveValue('37');
  await section(page, 'Performance');
  await page.locator('.kbd__key').first().click();
  await expect(
    page.getByRole('radio', { name: 'Rapid Trigger', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
});

test('macro drafts survive navigation; saved macro is exported and restored', async ({
  page,
}) => {
  await demo(page);
  await section(page, 'Macros');
  await page
    .getByRole('button', { name: '+ Add key press & release', exact: true })
    .click();
  await expect(page.locator('.macro-steps > li')).toHaveCount(2);
  await section(page, 'Keymap');
  await section(page, 'Macros');
  await expect(page.locator('.macro-steps > li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Save macro', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Save macro', exact: true }),
  ).toBeDisabled();
  await section(page, 'Settings');
  const downloadPromise = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export profile 1', exact: true })
    .click();
  const download = await downloadPromise;
  const backupPath = test.info().outputPath('profile.json');
  await download.saveAs(backupPath);
  await page.getByRole('radio', { name: 'Profile 2', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Import into profile 2…', exact: true }),
  ).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('input[type=file]').setInputFiles(backupPath);
  await expect(
    page.getByText('Profile 2 restored', { exact: true }),
  ).toBeVisible();
  await section(page, 'Macros');
  await expect(page.locator('.macro-steps > li')).toHaveCount(2);
});

test('profile switching blocks edits until the new profile is ready', async ({
  page,
}) => {
  await demo(page);
  await page.evaluate(() => {
    const original = window.setTimeout;
    // Delay just the next simulated HID reply, not app rendering or test waits.
    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (timeout !== undefined && timeout >= 2 && timeout <= 5) {
        window.setTimeout = original;
        return original(handler, 500, ...args);
      }
      return original(handler, timeout, ...args);
    }) as typeof window.setTimeout;
  });
  const target = page.getByRole('radio', { name: 'Profile 2', exact: true });
  await target.click();
  await expect(page.locator('#main')).toHaveAttribute('inert', '');
  await expect(target).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.header__status')).toContainText(
    'Switching to profile 2…',
  );
  await expect(target).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#main')).not.toHaveAttribute('inert', '');
  await expect(target).toBeFocused();
});

for (const model of ['Magger68', 'Magger68 Pro', 'Magger68 Ultra JIS']) {
  test(`all sections render for ${model}`, async ({ page }) => {
    await demo(page, model);
    for (const name of [
      'Performance',
      'Advanced keys',
      'Lighting',
      'Macros',
      'Settings',
    ]) {
      await section(page, name);
      await expect(page.locator('.skeleton')).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: /Every key/ }),
    ).toBeVisible();
  });
}

test('narrow screen keeps controls reachable without page overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  for (const name of [
    'Performance',
    'Advanced keys',
    'Lighting',
    'Macros',
    'Settings',
  ]) {
    await section(page, name);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
});

test('enlarged text reflows navigation on a small screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await demo(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  for (const name of [
    'Keymap',
    'Performance',
    'Advanced keys',
    'Lighting',
    'Macros',
    'Settings',
  ]) {
    await section(page, name);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    const item = page
      .getByRole('navigation', { name: 'Sections' })
      .getByRole('link', { name, exact: false });
    await expect(item).toBeInViewport();
  }
});
