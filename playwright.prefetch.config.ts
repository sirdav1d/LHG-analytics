import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PW_PORT ? Number(process.env.PW_PORT) : 3211;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './e2e',
	testMatch: /partial-prefetch-boundary\.spec\.ts/,
	reporter: 'list',
	workers: 1,
	use: {
		baseURL,
		trace: 'on-first-retry',
		timezoneId: 'America/Sao_Paulo',
	},
	webServer: {
		command: `npm run start -- -p ${PORT}`,
		url: `${baseURL}/favcon.png`,
		reuseExistingServer: false,
		timeout: 120 * 1000,
		env: {
			PLAYWRIGHT_MOCKS: 'true',
			DISABLE_AUTH_COOKIES: 'false',
			NEXT_PUBLIC_AUTH_URL: baseURL,
			BACKEND_AUTH_ENDPOINT: baseURL,
			BACKEND_CONSOLIDATED_ENDPOINT: `${baseURL}/api/mock-backend/consolidated`,
			BACKEND_ENDPOINT_IPIRANGA: `${baseURL}/api/mock-backend/unit/ipiranga`,
			BACKEND_ENDPOINT_LAPA: `${baseURL}/api/mock-backend/unit/lapa`,
			BACKEND_ENDPOINT_ANDAR_DE_CIMA: `${baseURL}/api/mock-backend/unit/andar_de_cima`,
			BACKEND_ENDPOINT_TOUT: `${baseURL}/api/mock-backend/unit/tout`,
			BACKEND_ENDPOINT_ALTANA: `${baseURL}/api/mock-backend/unit/altana`,
			BACKEND_ENDPOINT_LIV: `${baseURL}/api/mock-backend/unit/liv`,
			BACKEND_ENDPOINT_GETAN_GARAVELO: `${baseURL}/api/mock-backend/unit/getan_garavelo`,
			BACKEND_ENDPOINT_GETAN_PQ_OESTE: `${baseURL}/api/mock-backend/unit/getan_pq_oeste`,
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
