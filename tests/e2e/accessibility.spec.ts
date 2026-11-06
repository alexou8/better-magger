import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function openDemo(page: Page) {
  await page.goto('/');
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
  await expect(page.locator('.skeleton')).toHaveCount(0);
}

async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  if (results.violations.length) {
    await test
      .info()
      .attach(`${name}-axe.json`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: 'application/json',
      });
  }
  expect
    .soft(
      results.violations.map(({ id, help, nodes }) => ({
        id,
        help,
        nodes: nodes.map(({ target, failureSummary }) => ({
          target,
          failureSummary,
        })),
      })),
      name,
    )
    .toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hid', {
      value: undefined,
      configurable: true,
    });
  });
});

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} theme passes accessibility checks across connect, six pages, editors and modal`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.addInitScript(
      (theme) => localStorage.setItem('better-magger.theme', theme),
      theme,
    );
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await audit(page, `${theme}-connect`);
    await openDemo(page);
    await audit(page, `${theme}-keymap`);
    await page.locator('.kbd__key').first().click();
    await expect(
      page.getByRole('searchbox', { name: 'Search keys' }),
    ).toBeVisible();
    await audit(page, `${theme}-keymap-editor`);

    await section(page, 'Performance');
    await page.locator('.kbd__key').first().click();
    await page
      .getByRole('radio', { name: 'Rapid Trigger', exact: true })
      .click();
    await expect(
      page.getByText('Rapid Trigger: press sensitivity', { exact: true }),
    ).toBeVisible();
    await audit(page, `${theme}-performance-editor`);

    await section(page, 'Advanced keys');
    await audit(page, `${theme}-advanced`);
    await page.getByRole('button', { name: /Tap to lock a key down/ }).click();
    await audit(page, `${theme}-advanced-wizard`);
    const changeAction = page.getByRole('button', {
      name: /Tap to lock \/ unlock:.*Change/,
    });
    await changeAction.click();
    await expect(
      page.getByRole('dialog', { name: 'Tap to lock / unlock' }),
    ).toBeVisible();
    await audit(page, `${theme}-action-modal`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
      .soft(changeAction, 'Closing the modal restores focus to its trigger')
      .toBeFocused();

    await section(page, 'Lighting');
    await audit(page, `${theme}-lighting`);
    await section(page, 'Macros');
    await page
      .getByRole('button', { name: '+ Add key press & release', exact: true })
      .click();
    await audit(page, `${theme}-macro-editor`);
    await section(page, 'Settings');
    await audit(page, `${theme}-settings`);
  });
}

test('keyboard layout has one Tab stop, spatial arrows and multi-selection', async ({
  page,
}) => {
  await openDemo(page);
  const keyboard = page.getByRole('group', {
    name: 'Main layer keys',
    exact: true,
  });
  const keys = keyboard.locator('.kbd__key');
  await expect(keyboard.locator('.kbd__key[tabindex="0"]')).toHaveCount(1);
  await keys.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(keys.nth(1)).toBeFocused();
  await expect(keyboard.locator('.kbd__key[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Space');
  await expect(keys.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(keys.nth(2)).toBeFocused();
  await expect(keyboard.locator('[aria-pressed="true"]')).toHaveCount(2);
  await page.keyboard.press('Control+a');
  await expect(keyboard.locator('[aria-pressed="true"]')).toHaveCount(
    await keys.count(),
  );
  await page.keyboard.press('End');
  await expect(keys.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(keys.first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'All', exact: true }),
  ).toBeFocused();
});

test('layer and profile radios support arrows and Home/End with one Tab stop each', async ({
  page,
}) => {
  await openDemo(page);
  const layers = page.getByRole('radiogroup', { name: 'Layer', exact: true });
  await layers.getByRole('radio', { name: 'Main', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    layers.getByRole('radio', { name: 'FN1', exact: true }),
  ).toBeFocused();
  await expect(
    layers.getByRole('radio', { name: 'FN1', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('End');
  await expect(
    layers.getByRole('radio', { name: 'FN3', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Home');
  await expect(
    layers.getByRole('radio', { name: 'Main', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(layers.locator('[tabindex="0"]')).toHaveCount(1);

  const profiles = page.getByRole('radiogroup', {
    name: 'Profile',
    exact: true,
  });
  await profiles.getByRole('radio', { name: 'Profile 1', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(
    profiles.getByRole('radio', { name: 'Profile 2', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    profiles.getByRole('radio', { name: 'Profile 2', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Home');
  await expect(
    profiles.getByRole('radio', { name: 'Profile 1', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(profiles.locator('[tabindex="0"]')).toHaveCount(1);
});

test('key category tabs support keyboard navigation and identify their tabpanel', async ({
  page,
}) => {
  await openDemo(page);
  await page.locator('.kbd__key').first().click();
  const categories = page.getByRole('tablist', {
    name: 'Key categories',
    exact: true,
  });
  await categories.getByRole('tab').first().focus();
  await page.keyboard.press('End');
  const shortcut = categories.getByRole('tab', {
    name: 'Shortcut',
    exact: true,
  });
  await expect(shortcut).toBeFocused();
  await expect(shortcut).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('tabpanel', { name: 'Shortcut', exact: true }),
  ).toBeVisible();
  await expect(categories.locator('[tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('Home');
  await expect(categories.getByRole('tab').first()).toBeFocused();
  await expect(categories.getByRole('tab').first()).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('ArrowLeft');
  await expect(shortcut).toBeFocused();
});

test('keyboard remains operable with full-size targets on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  const keyboard = page.getByRole('group', {
    name: 'Main layer keys',
    exact: true,
  });
  const keys = keyboard.locator('.kbd__key');
  const firstBox = await keys.first().boundingBox();
  expect(firstBox?.width).toBeGreaterThanOrEqual(24);
  expect(firstBox?.height).toBeGreaterThanOrEqual(24);
  await keys.first().focus();
  await page.keyboard.press('End');
  await expect(keys.last()).toBeFocused();
  await expect
    .poll(() => keyboard.evaluate((el) => el.parentElement!.scrollLeft))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
});

test('travel slider and millimetre input share a visible label and helper description', async ({
  page,
}) => {
  await openDemo(page);
  await section(page, 'Performance');
  await page.locator('.kbd__key').first().click();
  const slider = page.getByRole('slider', {
    name: 'Actuation point',
    exact: true,
  });
  const number = page.getByRole('spinbutton', {
    name: 'Actuation point mm',
    exact: true,
  });
  await expect(slider).toBeVisible();
  await expect(number).toBeVisible();
  await expect(slider).toHaveAccessibleDescription(
    /How far you press before the key registers/,
  );
  await expect(number).toHaveAccessibleDescription(
    /How far you press before the key registers/,
  );
  await number.fill('1.50');
  await number.press('Enter');
  await expect(slider).toHaveAttribute('aria-valuetext', '1.50 millimetres');
});
