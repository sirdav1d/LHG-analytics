import { expect, test, type APIResponse, type Page } from '@playwright/test';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const AUTH_PORT = Number(process.env.PW_AUTH_PORT);
if (!Number.isInteger(AUTH_PORT) || AUTH_PORT <= 0 || AUTH_PORT > 65_535) {
	throw new Error(
		'PW_AUTH_PORT must be provided by playwright.refresh-flow.config.ts',
	);
}
const AUTH_BASE_PATH = (process.env.PW_AUTH_BASE_PATH ?? '').replace(/\/+$/, '');
const AUTH_API_PATH = AUTH_BASE_PATH.endsWith('/api')
	? AUTH_BASE_PATH
	: `${AUTH_BASE_PATH}/api`;
const AUTH_REFRESH_PATH = `${AUTH_API_PATH}/refresh`;
const AUTH_ME_PATH = `${AUTH_API_PATH}/me`;

const ORIGINAL_DASHBOARD = '/general?menu=general&set=ultimos_7_dias';
const KPI_UNAUTHORIZED_URL =
	'/restaurant?menu=restaurant&set=custom&startDate=2091-01-01&endDate=2091-01-07';
const SAFE_RETURN_TO = '/general?menu=general&set=ultimos_7_dias';
const FAILURE_REASON = 'session_refresh_failed';
const SENSITIVE_UPSTREAM_VALUE = 'upstream-secret-token-value';
const TRUSTED_NAVIGATION_HEADERS = {
	'Sec-Fetch-Site': 'same-origin',
} as const;

type Scenario =
	| 'success'
	| 'invalid-refresh'
	| 'refresh-rejected'
	| 'verification-rejected'
	| 'verification-invalid-dto'
	| 'refresh-5xx'
	| 'verification-5xx'
	| 'refresh-network'
	| 'refresh-timeout'
	| 'verification-network'
	| 'verification-timeout-body'
	| 'session-unavailable'
	| 'kpi-unauthorized';

type RecordedAuthRequest = {
	method: string;
	url: string;
	cookie: string;
	accept: string;
};

let scenario: Scenario = 'success';
let authRequests: RecordedAuthRequest[] = [];
const pendingAuthTimers = new Set<NodeJS.Timeout>();

function scheduleAuthResponse(callback: () => void, delay: number) {
	const timer = setTimeout(() => {
		pendingAuthTimers.delete(timer);
		callback();
	}, delay);
	pendingAuthTimers.add(timer);
}

function clearPendingAuthTimers() {
	for (const timer of pendingAuthTimers) {
		clearTimeout(timer);
	}
	pendingAuthTimers.clear();
}

async function stopAuthServer(
	server: ReturnType<typeof createServer>,
): Promise<void> {
	if (!server.listening) {
		server.closeAllConnections();
		return;
	}

	await new Promise<void>((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}
			resolve();
		});
		server.closeAllConnections();
	});
}

function json(res: ServerResponse, status: number, body: unknown) {
	res.statusCode = status;
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify(body));
}

function recordAuthRequest(req: IncomingMessage) {
	authRequests.push({
		method: req.method ?? '',
		url: req.url ?? '',
		cookie: req.headers.cookie ?? '',
		accept: req.headers.accept ?? '',
	});
}

function sendRefreshedCookies(res: ServerResponse) {
	res.statusCode = 200;
	res.setHeader('content-type', 'application/json');
	res.setHeader('set-cookie', [
		'access_token=fresh-token; Path=/; HttpOnly; SameSite=Lax',
		'refresh_token=fresh-refresh; Path=/; HttpOnly; SameSite=Lax',
	]);
	res.end(JSON.stringify({ ignored: SENSITIVE_UPSTREAM_VALUE }));
}

function handleAuthRequest(req: IncomingMessage, res: ServerResponse) {
	recordAuthRequest(req);
	const cookie = req.headers.cookie ?? '';

	if (req.url === AUTH_REFRESH_PATH && req.method === 'POST') {
		if (scenario === 'refresh-network') {
			req.socket.destroy();
			return;
		}

		if (scenario === 'refresh-timeout') {
			scheduleAuthResponse(() => {
				if (!res.destroyed) {
					json(res, 200, { ignored: SENSITIVE_UPSTREAM_VALUE });
				}
			}, 6_000);
			return;
		}

		if (scenario === 'refresh-5xx') {
			json(res, 503, { detail: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		if (scenario === 'refresh-rejected') {
			json(res, 401, { detail: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		if (!cookie.includes('refresh_token=stale-refresh')) {
			json(res, 401, { detail: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		if (scenario === 'invalid-refresh') {
			json(res, 200, { accessToken: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		sendRefreshedCookies(res);
		return;
	}

	if (req.url === AUTH_ME_PATH && req.method === 'GET') {
		if (scenario === 'session-unavailable') {
			json(res, 503, { detail: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		if (scenario === 'kpi-unauthorized') {
			if (!cookie.includes('access_token=kpi-token')) {
				json(res, 401, { detail: SENSITIVE_UPSTREAM_VALUE });
				return;
			}

			json(res, 200, {
				user: {
					email: 'admin@local.test',
					role: 'ADMIN',
					unit: 'LHG',
					name: 'Admin Local',
					cpf: '359.267.460-94',
				},
			});
			return;
		}

		if (!cookie.includes('access_token=fresh-token')) {
			json(res, 401, { detail: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		if (scenario === 'verification-rejected') {
			json(res, 401, { detail: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		if (scenario === 'verification-5xx') {
			json(res, 503, { detail: SENSITIVE_UPSTREAM_VALUE });
			return;
		}

		if (scenario === 'verification-invalid-dto') {
			json(res, 200, {
				user: { role: 'ADMIN', accessToken: SENSITIVE_UPSTREAM_VALUE },
			});
			return;
		}

		if (scenario === 'verification-network') {
			req.socket.destroy();
			return;
		}

		if (scenario === 'verification-timeout-body') {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.write('{"user":{"email":"admin@local.test"');
			scheduleAuthResponse(() => {
				if (!res.destroyed) {
					res.end('}}');
				}
			}, 6_000);
			return;
		}

		json(res, 200, {
			user: {
				email: 'admin@local.test',
				role: 'ADMIN',
				unit: 'LHG',
				name: 'Admin Local',
				cpf: '359.267.460-94',
				accessToken: SENSITIVE_UPSTREAM_VALUE,
			},
		});
		return;
	}

	json(res, 404, { detail: SENSITIVE_UPSTREAM_VALUE });
}

function setCookieHeaders(response: APIResponse): string[] {
	return response
		.headersArray()
		.filter((header) => header.name.toLowerCase() === 'set-cookie')
		.map((header) => header.value);
}

function expectPrivateBodylessRedirect(response: APIResponse) {
	expect(response.status()).toBe(303);
	const cacheControl = response.headers()['cache-control'] ?? '';
	expect(cacheControl).toMatch(/(?:^|,)\s*private(?:,|$)/i);
	expect(cacheControl).toMatch(/(?:^|,)\s*no-store(?:,|$)/i);
	expect(cacheControl).toMatch(/(?:^|,)\s*max-age=0(?:,|$)/i);
}

async function interceptHubLogout(page: Page): Promise<string[]> {
	const methods: string[] = [];
	await page.route('**/hub/logout', async (route) => {
		methods.push(route.request().method());
		await route.fulfill({ contentType: 'text/html', body: 'hub logout' });
	});
	return methods;
}

async function expectRejectedBeforeTransaction(response: APIResponse) {
	expect(response.status()).toBe(403);
	const cacheControl = response.headers()['cache-control'] ?? '';
	expect(cacheControl).toMatch(/(?:^|,)\s*private(?:,|$)/i);
	expect(cacheControl).toMatch(/(?:^|,)\s*no-store(?:,|$)/i);
	expect(cacheControl).toMatch(/(?:^|,)\s*max-age=0(?:,|$)/i);
	expect(await response.text()).toBe('');
	expect(response.headers().location).toBeUndefined();
	expect(setCookieHeaders(response)).toEqual([]);
}

async function expectFailedTransaction(response: APIResponse) {
	expectPrivateBodylessRedirect(response);
	expect(await response.text()).toBe('');

	const location = new URL(response.headers().location);
	expect(location.pathname).toBe('/login');
	expect(Array.from(location.searchParams.keys())).toEqual(['reason']);
	expect(location.searchParams.get('reason')).toBe(FAILURE_REASON);

	const cookies = setCookieHeaders(response);
	expect(
		cookies.some(
			(value) => /^access_token=;/.test(value) && /Max-Age=0/i.test(value),
		),
	).toBe(true);
	expect(
		cookies.some(
			(value) => /^refresh_token=;/.test(value) && /Max-Age=0/i.test(value),
		),
	).toBe(true);

	const exposed = [
		response.headers().location,
		response.headers()['set-cookie'],
		await response.text(),
	].join('\n');
	expect(exposed).not.toContain(SENSITIVE_UPSTREAM_VALUE);
	expect(exposed).not.toContain('stale-token');
	expect(exposed).not.toContain('stale-refresh');
	expect(exposed).not.toContain('fresh-token');
	expect(exposed).not.toContain('fresh-refresh');
}

test.describe('transparent refresh route handler', () => {
	test.describe.configure({ mode: 'serial' });

	let authServer: ReturnType<typeof createServer> | null = null;

	test.beforeAll(async () => {
		authServer = createServer(handleAuthRequest);
		const server = authServer;
		try {
			await new Promise<void>((resolve, reject) => {
				server.once('error', reject);
				server.listen(AUTH_PORT, '127.0.0.1', () => {
					server.off('error', reject);
					resolve();
				});
			});
		} catch (error) {
			server.closeAllConnections();
			authServer = null;
			throw error;
		}
	});

	test.afterAll(async () => {
		clearPendingAuthTimers();
		const server = authServer;
		authServer = null;
		if (server) {
			await stopAuthServer(server);
		}
	});

	test.beforeEach(() => {
		scenario = 'success';
		authRequests = [];
	});

	// /me indisponível (5xx/timeout) NÃO é sessão inválida: mostra o erro com
	// "Tentar de novo" para a mesma página e NÃO desloga (o logout derrubaria
	// também a sessão do HUB LHG). Sessão inválida de verdade (401/403) segue
	// pelo refresh ou pelo logout, como nos outros testes.
	test('shows the unavailable screen (no HUB logout) when /me cannot validate the session', async ({
		page,
	}, testInfo) => {
		scenario = 'session-unavailable';
		const baseURL = testInfo.project.use.baseURL;
		if (!baseURL) throw new Error('Missing baseURL in Playwright config');

		const cookieUrl = `${new URL(baseURL).origin}/`;
		await page.context().addCookies([
			{ name: 'access_token', value: 'unavailable-token', url: cookieUrl },
			{ name: 'refresh_token', value: 'unavailable-refresh', url: cookieUrl },
		]);
		const hubLogoutMethods = await interceptHubLogout(page);

		await page.goto(ORIGINAL_DASHBOARD);
		await expect(page).toHaveURL(/\/login\/erro\?codigo=indisponivel&returnTo=/);
		await expect(
			page.getByText('Serviço temporariamente indisponível'),
		).toBeVisible();
		await expect(
			page.getByRole('link', { name: 'Tentar de novo' }),
		).toHaveAttribute('href', ORIGINAL_DASHBOARD);
		await expect(page.getByText(SENSITIVE_UPSTREAM_VALUE)).toHaveCount(0);
		expect(hubLogoutMethods).toEqual([]);

		const cookies = await page.context().cookies();
		expect(
			cookies.find((cookie) => cookie.name === 'access_token')?.value,
		).toBe('unavailable-token');
		expect(
			cookies.find((cookie) => cookie.name === 'refresh_token')?.value,
		).toBe('unavailable-refresh');
	});

	test('forces HUB logout when the authenticated dashboard receives a KPI 401', async ({
		page,
	}, testInfo) => {
		scenario = 'kpi-unauthorized';
		const baseURL = testInfo.project.use.baseURL;
		if (!baseURL) throw new Error('Missing baseURL in Playwright config');

		const cookieUrl = `${new URL(baseURL).origin}/`;
		await page.context().addCookies([
			{ name: 'access_token', value: 'kpi-token', url: cookieUrl },
			{ name: 'refresh_token', value: 'kpi-refresh', url: cookieUrl },
		]);
		const hubLogoutMethods = await interceptHubLogout(page);

		await page.goto(KPI_UNAUTHORIZED_URL);
		await expect(page).toHaveURL(/\/hub\/logout$/);
		expect(hubLogoutMethods).toEqual(['POST']);

		const cookies = await page.context().cookies();
		expect(cookies.find((cookie) => cookie.name === 'access_token')).toBeUndefined();
		expect(cookies.find((cookie) => cookie.name === 'refresh_token')).toBeUndefined();
	});

	test('returns a bodyless private 303 after refresh and one verified /api/me', async ({
		request,
	}, testInfo) => {
		const baseURL = testInfo.project.use.baseURL;
		if (!baseURL) {
			throw new Error('Missing baseURL in Playwright config');
		}

		const response = await request.get(
			`/api/session/refresh?returnTo=${encodeURIComponent(SAFE_RETURN_TO)}`,
			{
				headers: {
					...TRUSTED_NAVIGATION_HEADERS,
					Origin: new URL(baseURL).origin,
					Cookie: 'access_token=stale-token; refresh_token=stale-refresh',
				},
				maxRedirects: 0,
			},
		);

		expectPrivateBodylessRedirect(response);
		expect(await response.text()).toBe('');
		const location = new URL(response.headers().location);
		expect(`${location.pathname}${location.search}`).toBe(SAFE_RETURN_TO);
		expect(setCookieHeaders(response)).toEqual([
			'access_token=fresh-token; Path=/; HttpOnly; SameSite=Lax',
			'refresh_token=fresh-refresh; Path=/; HttpOnly; SameSite=Lax',
		]);

		expect(authRequests).toEqual([
			{
				method: 'POST',
				url: AUTH_REFRESH_PATH,
				cookie: 'access_token=stale-token; refresh_token=stale-refresh',
				accept: 'application/json',
			},
			{
				method: 'GET',
				url: AUTH_ME_PATH,
				cookie: 'access_token=fresh-token; refresh_token=fresh-refresh',
				accept: 'application/json',
			},
		]);
	});

	test('navigates dashboard -> refresh handler -> the same dashboard without committing a refresh screen', async ({
		page,
	}, testInfo) => {
		const baseURL = testInfo.project.use.baseURL;
		if (!baseURL) {
			throw new Error('Missing baseURL in Playwright config');
		}

		const flowUrls: string[] = [];
		const committedUrls: string[] = [];
		page.on('request', (request) => {
			const url = new URL(request.url());
			if (
				url.pathname === '/general' ||
				url.pathname === '/api/session/refresh'
			) {
				url.searchParams.delete('_rsc');
				flowUrls.push(`${url.pathname}${url.search}`);
			}
		});
		page.on('framenavigated', (frame) => {
			if (frame === page.mainFrame()) {
				const url = new URL(frame.url());
				committedUrls.push(`${url.pathname}${url.search}`);
			}
		});

		const cookieUrl = `${new URL(baseURL).origin}/`;
		await page.context().addCookies([
			{ name: 'access_token', value: 'stale-token', url: cookieUrl },
			{ name: 'refresh_token', value: 'stale-refresh', url: cookieUrl },
		]);

		await page.goto(ORIGINAL_DASHBOARD);
		await page.waitForURL(
			(url) => `${url.pathname}${url.search}` === ORIGINAL_DASHBOARD,
		);
		await expect
			.poll(
				() =>
					authRequests.some(
						(entry) =>
							entry.method === 'POST' && entry.url === AUTH_REFRESH_PATH,
					),
				{ timeout: 10_000 },
			)
			.toBe(true);
		await expect(page.getByText('Painel Admin')).toBeVisible();

		const refreshNavigationIndex = flowUrls.findIndex((url) =>
			url.startsWith('/api/session/refresh?'),
		);
		expect(refreshNavigationIndex).toBeGreaterThan(0);
		expect(flowUrls[0]).toBe(ORIGINAL_DASHBOARD);
		expect(
			flowUrls.slice(refreshNavigationIndex + 1),
		).toContain(
			ORIGINAL_DASHBOARD,
		);
		expect(
			flowUrls.filter((url) => url.startsWith('/api/session/refresh?')),
		).toHaveLength(1);
		expect(
			committedUrls.some((url) => url.startsWith('/api/session/refresh')),
		).toBe(false);

		const refreshIndex = authRequests.findIndex(
			(entry) => entry.method === 'POST' && entry.url === AUTH_REFRESH_PATH,
		);
		expect(refreshIndex).toBeGreaterThan(0);
		expect(authRequests[refreshIndex].cookie).toContain(
			'access_token=stale-token',
		);
		expect(authRequests[refreshIndex].cookie).toContain(
			'refresh_token=stale-refresh',
		);
		expect(authRequests[refreshIndex + 1]).toMatchObject({
			method: 'GET',
			url: AUTH_ME_PATH,
			accept: 'application/json',
		});
		expect(authRequests[refreshIndex + 1].cookie).toContain(
			'access_token=fresh-token',
		);
		expect(authRequests[refreshIndex + 1].cookie).toContain(
			'refresh_token=fresh-refresh',
		);

		const cookies = await page.context().cookies();
		expect(cookies.find((cookie) => cookie.name === 'access_token')?.value).toBe(
			'fresh-token',
		);
		expect(
			cookies.find((cookie) => cookie.name === 'refresh_token')?.value,
		).toBe('fresh-refresh');
		expect(authRequests.at(-1)).toMatchObject({
			method: 'GET',
			url: AUTH_ME_PATH,
			accept: 'application/json',
		});
		expect(authRequests.at(-1)?.cookie).toContain('access_token=fresh-token');
		expect(authRequests.at(-1)?.cookie).toContain(
			'refresh_token=fresh-refresh',
		);
	});

	for (const failureScenario of [
		'invalid-refresh',
		'refresh-rejected',
		'verification-rejected',
		'verification-invalid-dto',
		'refresh-5xx',
		'verification-5xx',
		'refresh-network',
		'refresh-timeout',
		'verification-network',
		'verification-timeout-body',
	] as const) {
		test(`fails closed without leaking upstream data: ${failureScenario}`, async ({
			request,
		}) => {
			scenario = failureScenario;
			const startedAt = Date.now();
			const response = await request.get(
				`/api/session/refresh?returnTo=${encodeURIComponent(SAFE_RETURN_TO)}`,
				{
					headers: {
						...TRUSTED_NAVIGATION_HEADERS,
						Host: 'analytics-dev.lhgmoteis.com.br',
						Cookie: 'access_token=stale-token; refresh_token=stale-refresh',
					},
					maxRedirects: 0,
					timeout: 10_000,
				},
			);

			await expectFailedTransaction(response);
			const expectedRequestCount = failureScenario.startsWith('verification-')
				? 2
				: 1;
			expect(authRequests).toHaveLength(expectedRequestCount);
			expect(authRequests[0]).toMatchObject({
				method: 'POST',
				url: AUTH_REFRESH_PATH,
			});
			if (expectedRequestCount === 2) {
				expect(authRequests[1]).toMatchObject({
					method: 'GET',
					url: AUTH_ME_PATH,
				});
			}
			if (
				failureScenario === 'refresh-timeout' ||
				failureScenario === 'verification-timeout-body'
			) {
				const elapsed = Date.now() - startedAt;
				expect(elapsed).toBeGreaterThanOrEqual(4_500);
				expect(elapsed).toBeLessThan(9_000);
			}
		});
	}

	test('sanitizes unsafe returnTo values to the application root', async ({
		request,
	}) => {
		for (const unsafeReturnTo of [
			'https://evil.test/steal',
			'//evil.test/steal',
			'/login',
			'/api/session/refresh',
			'/general\\evil',
			'/%2f%2fevil.test',
		]) {
			authRequests = [];
			const response = await request.get(
				`/api/session/refresh?returnTo=${encodeURIComponent(unsafeReturnTo)}`,
				{
					headers: {
						...TRUSTED_NAVIGATION_HEADERS,
						Cookie: 'access_token=stale-token; refresh_token=stale-refresh',
					},
					maxRedirects: 0,
				},
			);

			expectPrivateBodylessRedirect(response);
			expect(await response.text()).toBe('');
			const location = new URL(response.headers().location);
			expect(`${location.pathname}${location.search}`).toBe('/');
			expect(location.origin).not.toBe('https://evil.test');
			expect(authRequests.map(({ method, url }) => ({ method, url }))).toEqual([
				{ method: 'POST', url: AUTH_REFRESH_PATH },
				{ method: 'GET', url: AUTH_ME_PATH },
			]);
		}
	});

	test('rejects untrusted refresh requests without contacting auth or mutating cookies', async ({
		request,
	}) => {
		const untrustedHeaderCases: Array<Record<string, string>> = [
			{ 'Sec-Fetch-Site': 'cross-site' },
			{},
			{
				'Sec-Fetch-Site': 'same-origin',
				Origin: 'https://evil.test',
			},
		];

		for (const headers of untrustedHeaderCases) {
			authRequests = [];
			const response = await request.get(
				`/api/session/refresh?returnTo=${encodeURIComponent(SAFE_RETURN_TO)}`,
				{
					headers: {
						...headers,
						Cookie: 'access_token=stale-token; refresh_token=stale-refresh',
					},
					maxRedirects: 0,
				},
			);

			await expectRejectedBeforeTransaction(response);
			expect(authRequests).toEqual([]);
		}
	});
});
