import { expect, test, type Page } from '@playwright/test';

const scriptUrl = 'https://helpdesk.lhgmoteis.com.br/widget.js';
const mockScript = `
window.LHGHelpdesk = {
  init(config) {
    sessionStorage.setItem('helpdesk:sistema', config.sistema);
    sessionStorage.setItem('helpdesk:init', String(Number(sessionStorage.getItem('helpdesk:init')) + 1));
    const bubble = document.createElement('button');
    bubble.id = 'helpdesk-bubble';
    bubble.textContent = 'Help Desk';
    document.body.appendChild(bubble);
    config.getToken().then(token => sessionStorage.setItem('helpdesk:token', token));
  },
  destroy() {
    sessionStorage.setItem('helpdesk:destroy', String(Number(sessionStorage.getItem('helpdesk:destroy')) + 1));
    document.querySelectorAll('#helpdesk-bubble').forEach(bubble => bubble.remove());
  }
};`;

async function authenticate(page: Page, baseURL: string) {
	await page.context().addCookies([
		{ name: 'access_token', value: 'playwright', url: baseURL },
		{ name: 'refresh_token', value: 'playwright_refresh', url: baseURL },
	]);
}

test('keeps one widget during private navigation and removes it on logout', async ({ page, baseURL }) => {
	await authenticate(page, baseURL!);
	let scriptRequests = 0;
	let tokenCookie = '';
	await page.route(scriptUrl, async route => {
		scriptRequests++;
		await route.fulfill({ contentType: 'application/javascript', body: mockScript });
	});
	await page.route('**/api/helpdesk/token', async route => {
		tokenCookie = (await route.request().headerValue('cookie')) ?? '';
		await route.fulfill({ json: { token: 'signed-token' } });
	});
	await page.goto('/general?menu=general&set=ultimos_7_dias');
	await expect(page.locator('#helpdesk-bubble')).toHaveCount(1);
	await expect.poll(() => page.evaluate(() => sessionStorage.getItem('helpdesk:token'))).toBe('signed-token');
	expect(await page.evaluate(() => sessionStorage.getItem('helpdesk:sistema'))).toBe('lhg-analytics');
	expect(tokenCookie).toContain('access_token=playwright');
	const initialCalls = await page.evaluate(() => sessionStorage.getItem('helpdesk:init'));
	await page.getByRole('link', { name: 'Restaurantes', exact: true }).click();
	await expect(page).toHaveURL(/\/restaurant\?/);
	await expect(page.locator('#helpdesk-bubble')).toHaveCount(1);
	expect(await page.evaluate(() => sessionStorage.getItem('helpdesk:init'))).toBe(initialCalls);
	expect(scriptRequests).toBe(1);
	const hubLogoutMethods: string[] = [];
	await page.route('**/hub/logout', async route => {
		hubLogoutMethods.push(route.request().method());
		await route.fulfill({ contentType: 'text/html', body: 'hub logout' });
	});
	// Existing chart/filter errors can open the dev overlay over the button.
	// A dispatched click still submits the logout form.
	await page.getByRole('button', { name: 'Sair', exact: true }).dispatchEvent('click');
	await expect(page).toHaveURL(/\/api\/hub\/logout$/);
	expect(hubLogoutMethods).toEqual(['POST']);
	await expect(page.locator('#helpdesk-bubble')).toHaveCount(0);
	// The full-page logout never runs React cleanup, so Sair must destroy first.
	expect(Number(await page.evaluate(() => sessionStorage.getItem('helpdesk:destroy')))).toBe(Number(initialCalls));
});

test('keeps the dashboard usable when the script fails', async ({ page, baseURL }) => {
	await authenticate(page, baseURL!);
	await page.route(scriptUrl, route => route.abort());
	const scriptRequest = page.waitForRequest(scriptUrl);
	await page.goto('/general?menu=general&set=ultimos_7_dias');
	await scriptRequest;
	await expect(page.getByRole('heading', { name: /Visão Geral/i })).toBeVisible();
});
