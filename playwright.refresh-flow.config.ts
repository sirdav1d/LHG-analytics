import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PW_PORT ? Number(process.env.PW_PORT) : 3116;
const baseURL = `http://localhost:${PORT}`;
const AUTH_PORT = process.env.PW_AUTH_PORT
	? Number(process.env.PW_AUTH_PORT)
	: PORT + 30_000;
process.env.PW_AUTH_PORT = String(AUTH_PORT);
const AUTH_BASE_PATH = process.env.PW_AUTH_BASE_PATH ?? '';
const authBaseURL = `http://127.0.0.1:${AUTH_PORT}${AUTH_BASE_PATH}`;
const serverCommand =
	process.env.PW_SERVER === 'start'
		? `npm run start -- -p ${PORT}`
		: `npx next dev --webpack -p ${PORT}`;

export default defineConfig({
	testDir: './e2e',
	testMatch: /refresh-dashboard-flow\.spec\.ts/,
	reporter: 'list',
	workers: 1,
	use: {
		baseURL,
		trace: 'on-first-retry',
	},
	webServer: {
		command: serverCommand,
		url: `${baseURL}/favcon.png`,
		reuseExistingServer: false,
		gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
		timeout: 120 * 1000,
		env: {
			PLAYWRIGHT_MOCKS: 'true',
			DISABLE_AUTH_COOKIES: 'false',
			NEXT_PUBLIC_AUTH_URL: authBaseURL,
			BACKEND_AUTH_ENDPOINT: authBaseURL,
			BACKEND_CONSOLIDATED_ENDPOINT: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_IPIRANGA: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_LAPA: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_ANDAR_DE_CIMA: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_TOUT: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_ALTANA: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_LIV: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_GETAN_GARAVELO: `${baseURL}/api/mock-backend`,
			BACKEND_ENDPOINT_GETAN_PQ_OESTE: `${baseURL}/api/mock-backend`,
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
