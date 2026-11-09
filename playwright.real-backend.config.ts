import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PW_PORT ? Number(process.env.PW_PORT) : 3114;
const baseURL = `http://localhost:${PORT}`;
const authUrl = process.env.REAL_AUTH_URL ?? 'http://localhost:3005';

export default defineConfig({
	testDir: './e2e',
	reporter: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
	},
	webServer: {
		command: `npm run dev -- -p ${PORT}`,
		url: `${baseURL}/favcon.png`,
		reuseExistingServer: false,
		timeout: 120 * 1000,
		env: {
			PLAYWRIGHT_MOCKS: 'false',
			DISABLE_AUTH_COOKIES: 'false',
			NEXT_PUBLIC_AUTH_URL: authUrl,
			BACKEND_ENDPOINT_IPIRANGA: `${baseURL}/ipiranga/api`,
			BACKEND_ENDPOINT_LAPA: `${baseURL}/lapa/api`,
			BACKEND_ENDPOINT_ANDAR_DE_CIMA: `${baseURL}/andar_de_cima/api`,
			BACKEND_ENDPOINT_TOUT: `${baseURL}/tout/api`,
			BACKEND_ENDPOINT_LIV: `${baseURL}/liv/liv/api`,
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
