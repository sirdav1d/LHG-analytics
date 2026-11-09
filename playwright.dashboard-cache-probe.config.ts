import { defineConfig, devices } from '@playwright/test';

const PORT = 3123;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	testMatch: /dashboard-cache-probe\.spec\.ts/,
	reporter: 'list',
	timeout: 45 * 1000,
	use: {
		baseURL,
		trace: 'on-first-retry',
		timezoneId: 'America/Sao_Paulo',
	},
	webServer: {
		command: `npm run dev -- -p ${PORT}`,
		url: `${baseURL}/favcon.png`,
		reuseExistingServer: false,
		timeout: 120 * 1000,
		env: {
			PLAYWRIGHT_MOCKS: 'true',
			DISABLE_AUTH_COOKIES: 'true',
			KPI_REQUEST_TIMEOUT_MS: '30000',
			NEXT_PUBLIC_AUTH_URL: baseURL,
			BACKEND_AUTH_ENDPOINT: `${baseURL}/api/mock-backend`,
			BACKEND_CONSOLIDATED_ENDPOINT: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_IPIRANGA: `${baseURL}/ipiranga/api`,
			BACKEND_ENDPOINT_LAPA: `${baseURL}/lapa/api`,
			BACKEND_ENDPOINT_ANDAR_DE_CIMA: `${baseURL}/andar_de_cima/api`,
			BACKEND_ENDPOINT_TOUT: `${baseURL}/tout/api`,
			BACKEND_ENDPOINT_ALTANA: `${baseURL}/altana/api`,
			BACKEND_ENDPOINT_LIV: `${baseURL}/liv/liv/api`,
			BACKEND_ENDPOINT_GETAN_GARAVELO: `${baseURL}/getan_garavelo/api`,
			BACKEND_ENDPOINT_GETAN_PQ_OESTE: `${baseURL}/getan_pq_oeste/api`,
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			workers: 1,
		},
	],
});
