const { test, expect } = require('@playwright/test');

test.setTimeout(90000);

test('apply for a single day of leave and verify the request', async ({ page }) => {
  const requestsUrl = 'https://strco.smartappstudio.com/admin/myzone/apply?view=leave';
  const leaveDateLabel = '07 Oct 2026, Shift Planned';
  const leaveDateText = /07[-/ ](?:10|Oct)[-/ ]2026/i;
  const reasonText = 'Playwright Automation Leave 2026-10-07';
  const requestRow = () => page.getByRole('row').filter({ hasText: reasonText });

  await page.goto(requestsUrl, {
    waitUntil: 'commit',
  });

  await expect(page.getByText('My Workspace', { exact: true }).first()).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText('My Requests', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Leave Request', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('table').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'New Request', exact: true })).toBeVisible({
    timeout: 20000,
  });

  if (await requestRow().count() === 0) {
    await page.getByRole('button', { name: 'New Request', exact: true }).click();

    await expect(page.getByText('Leave Request', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Apply for Leave', { exact: true })).toBeVisible();

    const leaveType = page.getByRole('combobox', { name: 'Select leave type' });
    await expect(leaveType).toBeVisible();
    await leaveType.click();
    await page.getByRole('option', { name: 'Sick leave', exact: true }).click();

    const dateButton = page.getByRole('button', { name: leaveDateLabel, exact: true });
    await expect(dateButton).toBeVisible();
    await expect(dateButton).toBeEnabled();
    await dateButton.click();
    await expect(dateButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Selected Dates (1)', { exact: true })).toBeVisible();

    const singleDay = page.getByLabel('Single Day', { exact: true });
    await singleDay.check();
    await expect(singleDay).toBeChecked();

    const reason = page.getByPlaceholder('Enter the reason for leave');
    await reason.fill(reasonText);
    await expect(reason).toHaveValue(reasonText);

    const applyButton = page.getByRole('button', { name: 'Apply', exact: true });
    await expect(applyButton).toBeEnabled();
    await applyButton.click();
  }

  await page.goto(requestsUrl, { waitUntil: 'commit' });

  await expect(page.getByRole('table').first()).toBeVisible({ timeout: 20000 });

  const createdRequest = requestRow();
  await expect(createdRequest).toBeVisible({ timeout: 20000 });

  const cells = createdRequest.getByRole('cell');
  await expect(cells.nth(0)).toHaveText('Sick leave');
  await expect(cells.nth(1)).toContainText(leaveDateText);
  await expect(cells.nth(2)).toContainText(leaveDateText);
  await expect(cells.nth(4)).toHaveText(reasonText);
  await expect(cells.nth(5)).not.toBeEmpty();

  console.log('Verified Leave request:', JSON.stringify({
    leaveType: await cells.nth(0).innerText(),
    from: await cells.nth(1).innerText(),
    to: await cells.nth(2).innerText(),
    reason: await cells.nth(4).innerText(),
    status: await cells.nth(5).innerText(),
  }));
});

test('apply for three days of Casual Leave and verify the request', async ({ page }) => {
  const requestsUrl = 'https://strco.smartappstudio.com/admin/myzone/apply?view=leave';
  const applyUrl = 'https://strco.smartappstudio.com/admin/myzone/apply?view=leave&apply=true';
  const reasonText = 'velilala pora';
  const requestRows = () => page.getByRole('row')
    .filter({ hasText: reasonText })
    .filter({ hasNotText: 'Cancelled' });
  const leaveDates = ['15-10-2026', '16-10-2026', '17-10-2026'];

  const verifyRequests = async () => {
    await expect(requestRows()).toHaveCount(3, { timeout: 30000 });

    const verifiedRequests = [];
    for (const date of leaveDates) {
      const row = requestRows().filter({ hasText: date });
      await expect(row).toHaveCount(1);

      const cells = row.getByRole('cell');
      await expect(cells.nth(0)).toHaveText('Casual Leave');
      await expect(cells.nth(1)).toHaveText(date);
      await expect(cells.nth(2)).toHaveText(date);
      await expect(cells.nth(3)).toHaveText('1');
      await expect(cells.nth(4)).toHaveText(reasonText);
      await expect(cells.nth(5)).toHaveText('Pending');

      verifiedRequests.push({
        date: await cells.nth(1).innerText(),
        leaveType: await cells.nth(0).innerText(),
        reason: await cells.nth(4).innerText(),
        status: await cells.nth(5).innerText(),
      });
    }
    console.log('Verified Casual Leave requests:', JSON.stringify(verifiedRequests));
  };

  await page.goto(requestsUrl, { waitUntil: 'commit' });
  await expect(page.getByRole('table').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Showing \d+[–-]\d+ of \d+ records/)).toBeVisible({
    timeout: 30000,
  });

  if (await requestRows().count() > 0) {
    await verifyRequests();
    return;
  }

  await page.goto(applyUrl, { waitUntil: 'commit' });
  await expect(page.getByText('Apply for Leave', { exact: true })).toBeVisible({
    timeout: 30000,
  });

  const leaveType = page.getByRole('combobox', { name: 'Select leave type' });
  await expect(leaveType).toBeVisible();
  await leaveType.click();
  await page.getByRole('option', { name: 'Casual Leave', exact: true }).click();
  await expect(leaveType).toHaveValue(/^Casual Leave\s*$/);

  const multipleDays = page.getByLabel('Multiple Days', { exact: true });
  // This labeled radio is present in the form but hidden by the app's layout.
  await multipleDays.evaluate(input => input.click());
  await expect(multipleDays).toBeChecked();
  await expect(page.getByLabel('Single Day', { exact: true })).not.toBeChecked();

  const dates = [
    '15 Oct 2026, Shift Planned',
    '16 Oct 2026, Shift Planned',
    '17 Oct 2026, Shift Planned',
  ];

  for (const date of dates) {
    const dateButton = page.getByRole('button', { name: date, exact: true });
    await expect(dateButton).toBeVisible();
    await expect(dateButton).toBeEnabled();
    await dateButton.click();
    await expect(dateButton).toHaveAttribute('aria-pressed', 'true');
  }

  await expect(page.getByText('Selected Dates (3)', { exact: true })).toBeVisible();

  const reason = page.getByPlaceholder('Enter the reason for leave');
  await reason.fill(reasonText);
  await expect(reason).toHaveValue(reasonText);

  const applyButton = page.getByRole('button', { name: 'Apply', exact: true });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();
  await expect(page.getByText('Leave request received!', { exact: false })).toBeVisible({
    timeout: 30000,
  });

  await page.goto(requestsUrl, { waitUntil: 'commit' });
  await expect(page.getByRole('button', { name: 'New Request', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await verifyRequests();
});
