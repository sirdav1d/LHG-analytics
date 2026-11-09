import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PW_PORT ? Number(process.env.PW_PORT) : 3118;
const baseURL = `http://localhost:${PORT}`;
const delayedBackendBaseUrl = 'http://127.0.0.1:35557';

export default defineConfig({
	testDir: './e2e',
	reporter: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		timezoneId: 'America/Sao_Paulo',
	},
	webServer: {
		command: `npx next dev --webpack -p ${PORT}`,
		url: `${baseURL}/favcon.png`,
		reuseExistingServer: false,
		timeout: 120 * 1000,
		env: {
			PLAYWRIGHT_MOCKS: 'true',
			DISABLE_AUTH_COOKIES: 'true',
			NEXT_PUBLIC_AUTH_URL: baseURL,
			BACKEND_AUTH_ENDPOINT: delayedBackendBaseUrl,
			BACKEND_ENDPOINT_IPIRANGA: delayedBackendBaseUrl,
			BACKEND_ENDPOINT_LAPA: delayedBackendBaseUrl,
			BACKEND_ENDPOINT_ANDAR_DE_CIMA: delayedBackendBaseUrl,
			BACKEND_ENDPOINT_TOUT: delayedBackendBaseUrl,
			BACKEND_ENDPOINT_ALTANA: delayedBackendBaseUrl,
			BACKEND_ENDPOINT_LIV: delayedBackendBaseUrl,
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			testMatch: /dashboard-kpi-streaming\.spec\.ts/,
		},
	],
});
