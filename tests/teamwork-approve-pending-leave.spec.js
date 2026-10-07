const { test, expect } = require('@playwright/test');

test.setTimeout(90000);

test('approve the existing Both Sick leave request for 14 October 2026', async ({ page }) => {
  const requestsUrl = 'https://strco.smartappstudio.com/admin/teamzone/approve?view=leave';
  const leaveDate = '14-10-2026';

  await page.goto(requestsUrl, { waitUntil: 'commit' });
  await expect(page.getByRole('button', { name: 'New Request', exact: true })).toBeVisible({
    timeout: 45000,
  });

  await page.getByRole('button', { name: /Date range:/ }).click();
  await page.getByText('This Month', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Date range: This Month/ })).toBeVisible();

  const targetRows = () => page.getByRole('table').nth(1)
    .getByRole('row')
    .filter({ hasText: 'Both' })
    .filter({ hasText: '74152' })
    .filter({ hasText: 'Sick leave' })
    .filter({ hasText: leaveDate });

  await expect(targetRows()).toHaveCount(1, { timeout: 30000 });
  const row = targetRows();
  const cells = row.getByRole('cell');
  await expect(cells.nth(1)).toHaveText('Both');
  await expect(cells.nth(2)).toHaveText('74152');
  await expect(cells.nth(3)).toHaveText('Sick leave');
  await expect(cells.nth(4)).toHaveText(leaveDate);
  await expect(cells.nth(5)).toHaveText(leaveDate);
  await expect(cells.nth(8)).toHaveText('Pending');

  await row.click();
  await expect(page.getByText('Request details and status', { exact: true })).toBeVisible();
  await expect(page.getByText('14 Oct 2026 - 14 Oct 2026', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve Request', exact: true })).toBeEnabled();

  await page.getByRole('button', { name: 'Approve Request', exact: true }).click();

  await expect(row.getByRole('cell').nth(8)).toHaveText('Approved', { timeout: 30000 });
  await expect(page.getByText('Approved', { exact: true }).last()).toBeVisible();
});
