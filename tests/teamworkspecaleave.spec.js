const { test, expect } = require('@playwright/test');

test.setTimeout(90000);

test('create and approve a Team Workspace single-day leave request', async ({ page }) => {
  const requestsUrl = 'https://strco.smartappstudio.com/admin/teamzone/approve?view=leave';
  const reasonText = 'Playwright Team Workspace Leave Test';
  const leaveTypeText = 'Sick leave';
  const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const selectThisMonth = async (year, month) => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    await page.getByRole('button', { name: /Date range:/ }).click();

    let responseTimer;
    let onLeaveRequestsResponse;
    const leaveRequestsResponse = new Promise((resolve, reject) => {
      onLeaveRequestsResponse = (response) => {
        const url = new URL(response.url());
        if (
          url.pathname !== '/api/leave-request/'
          || url.searchParams.get('start_date') !== startDate
          || url.searchParams.get('end_date') !== endDate
        ) {
          return;
        }

        clearTimeout(responseTimer);
        if (!response.ok()) {
          reject(new Error(`Leave Requests API returned HTTP ${response.status()} for This Month.`));
          return;
        }
        response.json().then(resolve, reject);
      };
      page.on('response', onLeaveRequestsResponse);
      responseTimer = setTimeout(
        () => reject(new Error(`Timed out waiting for Leave Requests data for ${startDate}–${endDate}.`)),
        30000,
      );
    });

    try {
    await page.getByText('This Month', { exact: true }).click();
      await expect(page.getByRole('button', { name: /Date range: This Month/ })).toBeVisible();
      const leaveRequests = await leaveRequestsResponse;
      if (!Array.isArray(leaveRequests)) {
        throw new Error('The This Month Leave Requests response was not a list.');
      }

      return leaveRequests;
    } finally {
      clearTimeout(responseTimer);
      page.off('response', onLeaveRequestsResponse);
    }
  };

  const matchingRows = () =>
    page.getByRole('table').first()
      .getByRole('row')
      .filter({ hasText: 'Both' });

  const verifyApprovedRequest = async (dateText) => {
    await expect(matchingRows()).toHaveCount(1, { timeout: 30000 });
    const cells = matchingRows().getByRole('cell');
    await expect(cells.nth(1)).toHaveText('74152');
    await expect(cells.nth(2)).toHaveText(leaveTypeText);
    await expect(cells.nth(3)).toHaveText(dateText);
    await expect(cells.nth(4)).toHaveText(dateText);
    await expect(cells.nth(7)).toHaveText('Approved');
  };

  await page.goto(requestsUrl, { waitUntil: 'commit' });
  await expect(page.getByRole('button', { name: 'New Request', exact: true })).toBeVisible({
    timeout: 45000,
  });

  const todayLabel = await page.getByRole('button', { name: /Date range: Today/ }).innerText();
  const todayMatch = todayLabel.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!todayMatch) {
    throw new Error(`Could not read today’s date from the Leave Requests date-range control: ${todayLabel}`);
  }

  const today = new Date(Date.UTC(
    Number(todayMatch[3]),
    Number(todayMatch[2]) - 1,
    Number(todayMatch[1]),
  ));
  const leaveDate = new Date(today.getTime() + 86400000);
  const leaveDateText = [
    String(leaveDate.getUTCDate()).padStart(2, '0'),
    String(leaveDate.getUTCMonth() + 1).padStart(2, '0'),
    leaveDate.getUTCFullYear(),
  ].join('-');

  const thisMonthRequests = await selectThisMonth(today.getUTCFullYear(), today.getUTCMonth());

  const requestsForSelectedDate = thisMonthRequests.filter((request) =>
    String(request.employee_id) === '74152'
    && request.leave_type === leaveTypeText
    && request.from_date === leaveDateText
    && request.to_date === leaveDateText);

  if (requestsForSelectedDate.length > 0) {
    const existingRequest = requestsForSelectedDate.find(
      (request) => request.applied_reason === reasonText,
    );
    if (existingRequest) {
      expect(
        existingRequest.status,
        'The existing request for this employee, leave type, and date must be Approved.',
      ).toBe('Approved');
      return;
    }

    throw new Error(
      `Refusing to create a duplicate leave request for employee 74152 on ${leaveDateText}; `
      + `a ${leaveTypeText} request already exists for that date.`,
    );
  }

  const search = page.getByPlaceholder('Search...', { exact: true });
  await search.fill(reasonText);
  await expect(search).toHaveValue(reasonText);

  const noMatchingRequest = page.getByText('No Matching Results', { exact: true });
  await expect.poll(async () => (
    await noMatchingRequest.isVisible() || await matchingRows().count() > 0
  ), { timeout: 15000 }).toBe(true);

  if (!(await noMatchingRequest.isVisible())) {
    await verifyApprovedRequest(leaveDateText);
    return;
  }

  expect(leaveDate.getTime(), 'The selected leave date must be in the future.').toBeGreaterThan(today.getTime());

  await page.getByRole('button', { name: 'New Request', exact: true }).click();

  const employee = page.getByPlaceholder('Select the name', { exact: true });
  await employee.click();
  await page.getByRole('option').filter({ hasText: 'Both' }).click();
  await expect(employee).toHaveValue('Both');

  const leaveType = page.getByPlaceholder('Select leave type', { exact: true });
  await leaveType.click();
  await page.getByRole('option', { name: leaveTypeText, exact: true }).click();
  await expect(leaveType).toHaveValue(leaveTypeText);

  await page.getByRole('button', { name: 'Default', exact: true }).click();
  await page.getByText('Single Day', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Single Day', exact: true })).toBeChecked();

  await page.getByRole('button', { name: /Choose date,/ }).click();
  const monthLabel = `${fullMonthNames[leaveDate.getUTCMonth()]} ${leaveDate.getUTCFullYear()}`;
  const datePicker = page.getByRole('dialog');
  await expect(datePicker.getByText(monthLabel, { exact: true })).toBeVisible();
  const dateCell = datePicker.getByRole('gridcell', {
    name: String(leaveDate.getUTCDate()),
    exact: true,
  });
  await expect(dateCell).toBeEnabled();
  await dateCell.click();
  await expect(page.getByPlaceholder('Select start date', { exact: true }))
    .toHaveValue(leaveDateText);

  const reason = page.getByPlaceholder('Enter the reason for leave', { exact: true });
  await reason.fill(reasonText);
  await expect(reason).toHaveValue(reasonText);

  const approveButton = page.getByRole('button', { name: 'Approve', exact: true });
  await expect(approveButton).toBeEnabled();
  await approveButton.click();

  await page.goto(requestsUrl, { waitUntil: 'commit' });
  await expect(page.getByRole('button', { name: 'New Request', exact: true })).toBeVisible({
    timeout: 45000,
  });
  await selectThisMonth(today.getUTCFullYear(), today.getUTCMonth());
  await page.getByPlaceholder('Search...', { exact: true }).fill(reasonText);
  await expect(matchingRows()).toHaveCount(1, { timeout: 30000 });
  await verifyApprovedRequest(leaveDateText);
});
