import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PW_PORT ? Number(process.env.PW_PORT) : 3100;
const baseURL = `http://localhost:${PORT}`;
const serverCommand =
	process.env.PW_SERVER === 'start'
		? `npm run start -- -p ${PORT}`
		: `npm run dev -- -p ${PORT}`;

export default defineConfig({
	testDir: './e2e',
	reporter: 'list',
	use: {
		baseURL,
		trace: 'on-first-retry',
		timezoneId: 'America/Sao_Paulo',
	},
	webServer: {
		command: serverCommand,
		url: `${baseURL}/favcon.png`,
		reuseExistingServer: false,
		timeout: 120 * 1000,
		env: {
			PLAYWRIGHT_MOCKS: 'true',
			DISABLE_AUTH_COOKIES: 'true',
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
			BACKEND_ENDPOINT_GETAN_INDEPENDENCIA: `${baseURL}/api/mock-backend/unit/getan_independencia`,
			BACKEND_ENDPOINT_GETAN_NOVO_MUNDO: `${baseURL}/api/mock-backend/unit/getan_novo_mundo`,
			BACKEND_ENDPOINT_GETAN_VERA_CRUZ: `${baseURL}/api/mock-backend/unit/getan_vera_cruz`,
			BACKEND_ENDPOINT_GETAN_GRID: `${baseURL}/api/mock-backend/unit/getan_grid`,
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
			testIgnore: [
				/calendar-mobile\.spec\.ts/,
				/refresh-dashboard-flow\.spec\.ts/,
			],
		},
		{
			name: 'webkit-iphone',
			use: { ...devices['iPhone 13'] },
			testMatch: /calendar-mobile\.spec\.ts/,
		},
	],
});
