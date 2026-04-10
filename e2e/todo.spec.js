'use strict';

const {test, expect} = require('@playwright/test');

/** Пауза после теста, чтобы снять гонки с БД/сервером между сценариями. */
const PAUSE_BETWEEN_TESTS_MS = 400;

test.describe('Todo UI', () => {
  test.beforeEach(async ({page}) => {
    await Promise.all([
      page.waitForResponse(
          (r) =>
            r.url().includes('/api/todos') && r.request().method() === 'GET',
      ),
      page.goto('/'),
    ]);

    for (;;) {
      const n = await page.locator('#list li').count();
      if (n === 0) {
        break;
      }
      await page.locator('#list li').first().getByRole('button', {
        name: 'Удалить',
      }).click({force: true});
      const confirmBtn = page.locator('#confirmDialog').getByRole('button', {
        name: 'Удалить',
      });
      await Promise.all([
        page.waitForResponse(
            (r) =>
              r.url().includes('/api/todos/') &&
              r.request().method() === 'DELETE' &&
              r.status() === 204,
        ),
        confirmBtn.click(),
      ]);
    }
  });

  test.afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_TESTS_MS));
  });

  test('пустой список и подсказка', async ({page}) => {
    await expect(page.getByRole('heading', {name: 'Задачи'})).toBeVisible();
    await expect(page.getByText('Пока пусто')).toBeVisible();
    await expect(page.locator('#list li')).toHaveCount(0);
  });

  test('добавление задачи и отображение в списке', async ({page}) => {
    await page.getByPlaceholder('Добавить задачу…').fill('E2E: купить молоко');
    await page.getByRole('button', {name: 'Добавить'}).click();
    await expect(page.locator('#list li')).toHaveCount(1);
    await expect(page.locator('.item-text')).toHaveText('E2E: купить молоко');
    await expect(page.getByText('Пока пусто')).toBeHidden();
  });

  test('отметка выполненной', async ({page}) => {
    await expect(page.locator('#list li')).toHaveCount(0);
    await expect(page.getByText('Пока пусто')).toBeVisible();

    await page.getByPlaceholder('Добавить задачу…').fill('Сделать e2e');
    await Promise.all([
      page.waitForResponse(
          (r) =>
            r.url().includes('/api/todos') &&
            r.request().method() === 'POST' &&
            r.status() === 201,
      ),
      page.getByRole('button', {name: 'Добавить'}).click(),
    ]);
    await expect(page.locator('#list li')).toHaveCount(1);

    const item = page.locator('#list li').first();
    await Promise.all([
      page.waitForResponse(
          (r) =>
            r.url().includes('/api/todos/') &&
            r.request().method() === 'PATCH' &&
            r.ok(),
      ),
      item.getByRole('checkbox').check(),
    ]);
    await expect(item).toHaveClass(/done/);
    await expect(item.getByRole('checkbox')).toBeChecked();
  });

  test('удаление', async ({page}) => {
    await expect(page.locator('#list li')).toHaveCount(0);
    await expect(page.getByText('Пока пусто')).toBeVisible();

    await page.getByPlaceholder('Добавить задачу…').fill('Удалить меня');
    await Promise.all([
      page.waitForResponse(
          (r) =>
            r.url().includes('/api/todos') &&
            r.request().method() === 'POST' &&
            r.status() === 201,
      ),
      page.getByRole('button', {name: 'Добавить'}).click(),
    ]);
    await expect(page.locator('#list li')).toHaveCount(1);
    await expect(page.locator('.item-text')).toHaveText('Удалить меня');

    const item = page.locator('#list li').first();
    await item.getByRole('button', {name: 'Удалить'}).click({force: true});
    const confirmDel = page.locator('#confirmDialog').getByRole('button', {
      name: 'Удалить',
    });
    await Promise.all([
      page.waitForResponse(
          (r) =>
            r.url().includes('/api/todos/') &&
            r.request().method() === 'DELETE' &&
            r.status() === 204,
      ),
      confirmDel.click(),
    ]);
    await expect(page.locator('#list li')).toHaveCount(0);
    await expect(page.getByText('Пока пусто')).toBeVisible();
  });
});
