import { expect, test, type Page } from '@playwright/test';

function trackLogoWarnings(page: Page) {
	const warnings: string[] = [];

	page.on('console', (message) => {
		const text = message.text();
		if (text.includes('logo-analytics')) {
			warnings.push(text);
		}
	});

	return warnings;
}

test.describe('Task 04 - Logo image optimization', () => {
	test.beforeEach(async ({ page }, testInfo) => {
		const baseURL = testInfo.project.use.baseURL;
		if (!baseURL) {
			throw new Error('Missing baseURL in Playwright config');
		}

		const cookieUrl = `${new URL(baseURL).origin}/`;
		await page.context().addCookies([
			{
				name: 'access_token',
				value: 'playwright',
				url: cookieUrl,
			},
			{
				name: 'refresh_token',
				value: 'playwright_refresh',
				url: cookieUrl,
			},
		]);
	});

	test('dashboard does not emit logo-analytics image warnings', async ({
		page,
	}) => {
		const warnings = trackLogoWarnings(page);

		await page.goto('/general?menu=general&set=ultimos_7_dias');
		await page.waitForTimeout(1000);

		expect(warnings).toEqual([]);
	});
});
