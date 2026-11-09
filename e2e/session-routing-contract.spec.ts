import { expect, test } from '@playwright/test';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthEnv } from './helpers/auth-env';

type SessionUser = {
	role?: string;
	unit?: string;
};

function getContracts() {
	// These contracts stay independent from the app server and exercise the
	// request-scoped utilities directly.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const cookies = require('../src/lib/auth-cookie') as typeof import('../src/lib/auth-cookie');
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const requestPath = require('../src/lib/session/request-path') as typeof import('../src/lib/session/request-path');
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const returnTo = require('../src/lib/session/return-to') as typeof import('../src/lib/session/return-to');
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const defaultRoute = require('../src/lib/session/default-route') as typeof import('../src/lib/session/default-route');
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const authUrl = require('../src/lib/auth-url') as typeof import('../src/lib/auth-url');
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const loginRedirect = require('../src/lib/session/login-redirect') as typeof import('../src/lib/session/login-redirect');
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const hubError = require('../src/lib/session/hub-error') as typeof import('../src/lib/session/hub-error');

	return {
		...hubError,
		...cookies,
		...requestPath,
		...returnTo,
		...defaultRoute,
		...authUrl,
		...loginRedirect,
	};
}

test.describe('session routing contracts', () => {
	test('merges upstream cookies and removes expired cookies', () => {
		const { appendSetCookies, getSetCookies, mergeCookieHeader } = getContracts();
		const current = 'access_token=stale; refresh_token=refresh; theme=dark';
		const upstream = [
			'access_token=fresh; Path=/; HttpOnly',
			'theme=; Path=/; Max-Age=0',
			'refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		];

		expect(mergeCookieHeader(current, upstream)).toBe('access_token=fresh');

		const response = NextResponse.next();
		appendSetCookies(response, upstream);
		expect(getSetCookies(response.headers)).toEqual(upstream);
	});

	test('expires both auth cookies with secure production attributes and cookie domains', () => {
		const { expireAuthCookies, getSetCookies } = getContracts();
		const originalAuthUrl = process.env.NEXT_PUBLIC_AUTH_URL;
		const originalNodeEnv = process.env.NODE_ENV;
		process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.lhgmoteis.com.br';
		Reflect.set(process.env, 'NODE_ENV', 'production');

		try {
			const response = NextResponse.next();
			expireAuthCookies(
				response,
				new NextRequest('https://analytics-dev.lhgmoteis.com.br/api/logout'),
			);

			const cookies = getSetCookies(response.headers);
			expect(cookies).toEqual(
				expect.arrayContaining([
					expect.stringMatching(/^access_token=; Path=\/; Max-Age=0; Expires=.*; HttpOnly; SameSite=Lax; Secure$/),
					expect.stringMatching(/^refresh_token=; Path=\/; Max-Age=0; Expires=.*; HttpOnly; SameSite=Lax; Secure$/),
					expect.stringMatching(/access_token=.*Domain=lhgmoteis\.com\.br/),
					expect.stringMatching(/refresh_token=.*Domain=lhgmoteis\.com\.br/),
				]),
			);
		} finally {
			if (originalAuthUrl === undefined) {
				delete process.env.NEXT_PUBLIC_AUTH_URL;
			} else {
				process.env.NEXT_PUBLIC_AUTH_URL = originalAuthUrl;
			}
			if (originalNodeEnv === undefined) {
				Reflect.deleteProperty(process.env, 'NODE_ENV');
			} else {
				Reflect.set(process.env, 'NODE_ENV', originalNodeEnv);
			}
		}
	});

	test('expires host-only auth cookies without a request', () => {
		const { expireAuthCookies, getSetCookies } = getContracts();
		const response = NextResponse.next();

		expireAuthCookies(response);

		expect(getSetCookies(response.headers)).toEqual([
			expect.stringMatching(/^access_token=; Path=\/; Max-Age=0;/),
			expect.stringMatching(/^refresh_token=; Path=\/; Max-Age=0;/),
		]);
	});

	test('builds a request path from pathname and search only', () => {
		const { DASHBOARD_REQUEST_PATH_HEADER, buildInternalRequestPath } = getContracts();

		expect(DASHBOARD_REQUEST_PATH_HEADER).toBe('x-lhg-request-path');
		expect(buildInternalRequestPath('/general/liv', '?menu=general&set=este_mes')).toBe(
			'/general/liv?menu=general&set=este_mes',
		);
	});

	test('normalizes auth API bases without losing a real /auth prefix', () => {
		const { normalizeAuthApiBaseUrl, resolveAuthApiBaseUrl } = getContracts();

		expect(normalizeAuthApiBaseUrl('https://auth.test')).toBe(
			'https://auth.test/api',
		);
		expect(normalizeAuthApiBaseUrl('https://auth.test/api/')).toBe(
			'https://auth.test/api',
		);
		expect(normalizeAuthApiBaseUrl('https://auth.test/auth')).toBe(
			'https://auth.test/auth/api',
		);
		expect(normalizeAuthApiBaseUrl('https://auth.test/auth/api/')).toBe(
			'https://auth.test/auth/api',
		);
		expect(normalizeAuthApiBaseUrl('not a url')).toBeNull();

		const originalBackendAuth = process.env.BACKEND_AUTH_ENDPOINT;
		const originalPublicAuth = process.env.NEXT_PUBLIC_AUTH_URL;
		delete process.env.BACKEND_AUTH_ENDPOINT;
		process.env.NEXT_PUBLIC_AUTH_URL = 'https://auth.test/auth';
		try {
			expect(resolveAuthApiBaseUrl()).toBe('https://auth.test/auth/api');
		} finally {
			if (originalBackendAuth === undefined) {
				delete process.env.BACKEND_AUTH_ENDPOINT;
			} else {
				process.env.BACKEND_AUTH_ENDPOINT = originalBackendAuth;
			}
			if (originalPublicAuth === undefined) {
				delete process.env.NEXT_PUBLIC_AUTH_URL;
			} else {
				process.env.NEXT_PUBLIC_AUTH_URL = originalPublicAuth;
			}
		}
	});

	test('keeps only safe internal return paths', () => {
		const { sanitizeSessionReturnTo } = getContracts();

		for (const value of [
			'/general',
			'/general/liv?menu=general&set=este_mes',
			'/operational/getangaravelo',
			'/reservations/getanpqoeste',
			'/restaurant/lushipiranga',
			'/settings',
		]) {
			expect(sanitizeSessionReturnTo(value)).toBe(value);
		}
	});

	test('falls back from unsafe or malformed return paths', () => {
		const { sanitizeSessionReturnTo } = getContracts();

		for (const value of [
			'https://evil.test',
			'//evil.test',
			'/general\\evil',
			'\\\\evil.test',
			'/api/session/refresh',
			'/login',
			'/%2f%2fevil.test',
			'not a path',
			null,
		]) {
			expect(sanitizeSessionReturnTo(value)).toBe('/');
		}
	});

	test('chooses the current default route for every role and unit', () => {
		const { getDefaultSessionHref } = getContracts();
		const units = [
			'LUSH_IPIRANGA',
			'LUSH_LAPA',
			'ANDAR_DE_CIMA',
			'TOUT',
			'LIV',
			'ALTANA',
			'GETAN_GARAVELO',
			'GETAN_PQ_OESTE',
		] as const;
		const slugs: Record<(typeof units)[number], string> = {
			LUSH_IPIRANGA: 'lushipiranga',
			LUSH_LAPA: 'lushlapa',
			ANDAR_DE_CIMA: 'andardecima',
			TOUT: 'tout',
			LIV: 'liv',
			ALTANA: 'altana',
			GETAN_GARAVELO: 'getangaravelo',
			GETAN_PQ_OESTE: 'getanpqoeste',
		};
		const rolePaths = {
			GERENTE_GERAL: 'general',
			GERENTE_FINANCEIRO: 'general',
			GERENTE_OPERACIONAL: 'operational',
			GERENTE_RESERVAS: 'reservations',
			GERENTE_RESTAURANTE: 'restaurant',
		} as const;

		expect(
			getDefaultSessionHref({ role: 'ADMIN', unit: 'LHG' }, 'ultimos_30_dias'),
		).toBe('/general?menu=general&set=ultimo_mes_fechado');

		for (const [role, path] of Object.entries(rolePaths)) {
			for (const unit of units) {
				const expected =
					unit === 'LIV' && role !== 'GERENTE_GERAL'
						? '/login'
						: `/${path}/${slugs[unit]}?menu=${path}&set=este_mes`;
				expect(
					getDefaultSessionHref({ role, unit } satisfies SessionUser, 'este_mes'),
				).toBe(expected);
			}
		}
	});

	test('builds HUB URLs from the configured auth service', async () => {
		const { HUB_PORTAL_URL, resolveAuthApiUrl, resolveHubLoginUrl } = getContracts();
		const hubLogin = 'https://analytics-dev.lhgmoteis.com.br/auth/api/hub/login';
		const hubLogout = 'https://analytics-dev.lhgmoteis.com.br/auth/api/hub/logout';

		expect(HUB_PORTAL_URL).toBe('https://hub.lhgmoteis.com.br/');

		await withAuthEnv(
			{
				BACKEND_AUTH_ENDPOINT: 'https://analytics-dev.lhgmoteis.com.br/auth/api',
				NEXT_PUBLIC_AUTH_URL: undefined,
			},
			() => {
				expect(resolveHubLoginUrl('/general?menu=general&set=hoje')).toBe(
					`${hubLogin}?returnTo=%2Fgeneral%3Fmenu%3Dgeneral%26set%3Dhoje`,
				);
				for (const unsafe of [
					'https://site-externo.com',
					'//site-externo.com',
					'/general\\evil',
					'/login',
					'/api/session/refresh',
					null,
				]) {
					expect(resolveHubLoginUrl(unsafe)).toBe(hubLogin);
				}
				expect(resolveAuthApiUrl('hub/logout')).toBe(hubLogout);
			},
		);

		await withAuthEnv(
			{
				BACKEND_AUTH_ENDPOINT: '',
				NEXT_PUBLIC_AUTH_URL: 'https://analytics-dev.lhgmoteis.com.br/auth',
			},
			() => expect(resolveAuthApiUrl('hub/logout')).toBe(hubLogout),
		);

		await withAuthEnv(
			{ BACKEND_AUTH_ENDPOINT: undefined, NEXT_PUBLIC_AUTH_URL: undefined },
			() => {
				expect(resolveHubLoginUrl('/general')).toBeNull();
				expect(resolveAuthApiUrl('hub/logout')).toBeNull();
			},
		);
	});

	test('decides every /login destination', async () => {
		const { resolveLoginRedirect } = getContracts();
		const portal = 'https://hub.lhgmoteis.com.br/';
		const hubLogin = 'https://analytics-dev.lhgmoteis.com.br/auth/api/hub/login';
		const admin = {
			status: 'authenticated',
			user: { email: 'admin@lhg.test', role: 'ADMIN', unit: 'LHG' },
		} as const;
		const noProfile = {
			status: 'authenticated',
			user: { email: 'sem-perfil@lhg.test' },
		} as const;
		const missing = {
			status: 'unauthenticated',
			canRefresh: false,
			reason: 'missing',
		} as const;
		const base = { hubError: null, returnTo: null, set: null };

		await withAuthEnv(
			{
				BACKEND_AUTH_ENDPOINT: 'https://analytics-dev.lhgmoteis.com.br/auth/api',
				NEXT_PUBLIC_AUTH_URL: undefined,
			},
			() => {
				// 1: any hub_error, even empty, wins over a valid session and goes to
				// the error screen by CODE (unknown → falha); never back to the HUB login
				for (const [hubError, code] of [
					['access_denied', 'access_denied'],
					['inactive', 'inactive'],
					['indisponivel', 'indisponivel'],
					['falha', 'falha'],
					['', 'falha'],
					['<script>alert(1)</script>', 'falha'],
					['toString', 'falha'],
				]) {
					expect(resolveLoginRedirect({ ...base, hubError, session: admin })).toBe(
						`/login/erro?codigo=${code}`,
					);
					expect(resolveLoginRedirect({ ...base, hubError, session: missing })).toBe(
						`/login/erro?codigo=${code}`,
					);
				}
				expect(
					resolveLoginRedirect({
						...base,
						hubError: 'falha',
						returnTo: '/general?menu=general&set=hoje',
						session: missing,
					}),
				).toBe('/login/erro?codigo=falha&returnTo=%2Fgeneral%3Fmenu%3Dgeneral%26set%3Dhoje');
				// 2: /me unavailable shows "indisponível" (no logout); forbidden logs out
				expect(
					resolveLoginRedirect({ ...base, session: { status: 'unavailable' } }),
				).toBe('/login/erro?codigo=indisponivel');
				expect(
					resolveLoginRedirect({
						...base,
						session: { status: 'unauthenticated', canRefresh: false, reason: 'forbidden' },
					}),
				).toBe('/api/session/logout');
				// 3: authenticated with a default route, keeping set
				expect(
					resolveLoginRedirect({ ...base, set: 'ultimos_30_dias', session: admin }),
				).toBe('/general?menu=general&set=ultimo_mes_fechado');
				// 3b: authenticated with a safe returnTo goes there; unsafe → default
				expect(
					resolveLoginRedirect({
						...base,
						returnTo: '/reservations/lushipiranga?menu=reservations&set=hoje',
						session: admin,
					}),
				).toBe('/reservations/lushipiranga?menu=reservations&set=hoje');
				expect(
					resolveLoginRedirect({ ...base, returnTo: '//evil.test', session: admin }),
				).toBe('/general?menu=general&set=ultimos_7_dias');
				// 4: authenticated without profile or unit
				expect(resolveLoginRedirect({ ...base, session: noProfile })).toBe(portal);
				// 5: no session or refused refresh goes to the HUB login
				expect(
					resolveLoginRedirect({
						...base,
						returnTo: '/general?menu=general&set=hoje',
						session: missing,
					}),
				).toBe(`${hubLogin}?returnTo=%2Fgeneral%3Fmenu%3Dgeneral%26set%3Dhoje`);
				expect(
					resolveLoginRedirect({
						...base,
						session: { status: 'unauthenticated', canRefresh: true, reason: 'unauthorized' },
					}),
				).toBe(hubLogin);
			},
		);

		// 6: no auth service configured
		await withAuthEnv(
			{ BACKEND_AUTH_ENDPOINT: undefined, NEXT_PUBLIC_AUTH_URL: undefined },
			() => {
				expect(resolveLoginRedirect({ ...base, session: missing })).toBe(portal);
			},
		);
	});

	test('hub error screen: fixed messages per code, retry only for transient errors', () => {
		const { normalizeHubErrorCode, getHubErrorContent, buildHubErrorPath } =
			getContracts();

		expect(normalizeHubErrorCode('access_denied')).toBe('access_denied');
		expect(normalizeHubErrorCode('__proto__')).toBe('falha');
		expect(normalizeHubErrorCode(null)).toBe('falha');
		expect(getHubErrorContent('access_denied').canRetry).toBe(false);
		expect(getHubErrorContent('inactive').canRetry).toBe(false);
		expect(getHubErrorContent('indisponivel').canRetry).toBe(true);
		expect(getHubErrorContent('falha').canRetry).toBe(true);
		expect(getHubErrorContent('access_denied').message).toContain(
			'não tem acesso ao LHG Analytics',
		);
		expect(buildHubErrorPath('indisponivel', '/settings')).toBe(
			'/login/erro?codigo=indisponivel&returnTo=%2Fsettings',
		);
		// returnTo inseguro não entra na URL da tela de erro
		expect(buildHubErrorPath('falha', 'https://evil.test')).toBe(
			'/login/erro?codigo=falha',
		);
	});

	test('only dashboard roots require a session (unknown paths reach the 404)', () => {
		const { isSessionPath } = getContracts();

		for (const path of [
			'/general',
			'/general/liv',
			'/operational/tout',
			'/reservations/lushlapa',
			'/restaurant/altana',
			'/settings',
		]) {
			expect(isSessionPath(path)).toBe(true);
		}
		for (const path of ['/relatorios', '/generalx', '/login/erro', '/', '/x/general']) {
			expect(isSessionPath(path)).toBe(false);
		}
	});

	test('HUB browser navigations use the PUBLIC auth URL (same host as Sair)', async () => {
		const { resolveAuthApiUrl, resolveHubLoginUrl } = getContracts();

		await withAuthEnv(
			{
				BACKEND_AUTH_ENDPOINT: 'http://interno.svc:3005/auth/api',
				NEXT_PUBLIC_AUTH_URL: 'https://analytics-dev.lhgmoteis.com.br/auth',
			},
			() => {
				// navegações do navegador: o endereço público
				expect(resolveHubLoginUrl(null)).toBe(
					'https://analytics-dev.lhgmoteis.com.br/auth/api/hub/login',
				);
				expect(resolveAuthApiUrl('hub/logout')).toBe(
					'https://analytics-dev.lhgmoteis.com.br/auth/api/hub/logout',
				);
				// chamadas do servidor: podem usar o endereço interno
				expect(resolveAuthApiUrl('me')).toBe('http://interno.svc:3005/auth/api/me');
			},
		);
	});

	test('forces HUB logout from the session logout route', async () => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { GET } = require('../src/app/api/session/logout/route') as typeof import('../src/app/api/session/logout/route');
		const { getSetCookies } = getContracts();
		const url = 'https://analytics-front-dev.lhgmoteis.com.br/api/session/logout';
		const trusted = () =>
			new NextRequest(url, { headers: { 'sec-fetch-site': 'same-origin' } });
		const expectExpiredCookies = (response: Response) => {
			const cookies = getSetCookies(response.headers);
			expect(cookies.some((cookie) => /^access_token=;.*Max-Age=0/.test(cookie))).toBe(
				true,
			);
			expect(cookies.some((cookie) => /^refresh_token=;.*Max-Age=0/.test(cookie))).toBe(
				true,
			);
		};

		await withAuthEnv(
			{
				BACKEND_AUTH_ENDPOINT: 'https://analytics-dev.lhgmoteis.com.br/auth/api',
				NEXT_PUBLIC_AUTH_URL: undefined,
			},
			async () => {
				const response = GET(trusted());
				expect(response.status).toBe(200);
				expect(response.headers.get('content-type')).toContain('text/html');
				expect(response.headers.get('cache-control')).toContain('no-store');
				const html = await response.text();
				expect(html).toContain(
					'<form method="post" action="https://analytics-dev.lhgmoteis.com.br/auth/api/hub/logout">',
				);
				expect(html).toContain(
					'<noscript><button type="submit">Sair</button></noscript>',
				);
				expect(html).toContain('<script>document.forms[0].submit()</script>');
				expectExpiredCookies(response);

				const crossSite = GET(
					new NextRequest(url, { headers: { 'sec-fetch-site': 'cross-site' } }),
				);
				expect(crossSite.status).toBe(403);
			},
		);

		await withAuthEnv(
			{ BACKEND_AUTH_ENDPOINT: undefined, NEXT_PUBLIC_AUTH_URL: undefined },
			() => {
				const response = GET(trusted());
				expect(response.status).toBe(303);
				expect(response.headers.get('location')).toBe('https://hub.lhgmoteis.com.br/');
				expectExpiredCookies(response);
			},
		);
	});
});
