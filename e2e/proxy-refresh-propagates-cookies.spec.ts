import { expect, test } from '@playwright/test';
import { NextRequest } from 'next/server';
import { withAuthEnv } from './helpers/auth-env';

type Proxy = typeof import('../src/proxy').proxy;

function getProxy(): Proxy {
	// Playwright transpiles TypeScript modules for require(), keeping this
	// contract test independent from the app web server.
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	return (require('../src/proxy') as typeof import('../src/proxy')).proxy;
}

function request(path: string, headers?: HeadersInit): NextRequest {
	return new NextRequest(`http://app.local${path}`, { headers });
}

test.describe('proxy session routing contract', () => {
	// Without a configured auth service the proxy keeps the /login fallback.
	test('routes with cookie presence only and never calls fetch', () => withAuthEnv({ BACKEND_AUTH_ENDPOINT: undefined, NEXT_PUBLIC_AUTH_URL: undefined }, async () => {
		const originalFetch = global.fetch;
		global.fetch = (() => {
			throw new Error('Proxy must not call fetch');
		}) as typeof global.fetch;

		try {
			const proxy = getProxy();

			const login = await proxy(request('/login?returnTo=%2Fgeneral%3Fset%3Dhoje'));
			expect(login.headers.get('location')).toBeNull();

			const root = await proxy(request('/'));
			expect(root.headers.get('location')).toBeNull();

			const accessDashboard = await proxy(
				request('/general/liv?menu=general&set=este_mes', {
					cookie: 'access_token=present',
					'x-lhg-request-path': '/forged',
				}),
			);
			expect(accessDashboard.headers.get('location')).toBeNull();
			expect(
				accessDashboard.headers.get('x-middleware-override-headers'),
			).toContain('x-lhg-request-path');
			expect(
				accessDashboard.headers.get('x-middleware-request-x-lhg-request-path'),
			).toBe('/general/liv?menu=general&set=este_mes');

			const refreshDashboard = await proxy(
				request('/operational/lapa?set=este_mes', {
					cookie: 'refresh_token=present',
				}),
			);
			expect(refreshDashboard.headers.get('location')).toBeNull();
			expect(
				refreshDashboard.headers.get('x-middleware-request-x-lhg-request-path'),
			).toBe('/operational/lapa?set=este_mes');

			const unauthenticatedDashboard = await proxy(
				request('/general/liv?menu=general&set=este_mes'),
			);
			expect(unauthenticatedDashboard.headers.get('location')).toBe(
				'http://app.local/login?returnTo=%2Fgeneral%2Fliv%3Fmenu%3Dgeneral%26set%3Deste_mes',
			);

			const normalizedRange = await proxy(
				request('/general/liv?set=ultimos_30_dias'),
			);
			expect(normalizedRange.headers.get('location')).toBe(
				'http://app.local/general/liv?set=ultimo_mes_fechado',
			);
		} finally {
			global.fetch = originalFetch;
		}
	}));

	test('sends unauthenticated requests straight to the HUB', async () => {
		const originalFetch = global.fetch;
		global.fetch = (() => {
			throw new Error('Proxy must not call fetch');
		}) as typeof global.fetch;

		try {
			await withAuthEnv(
				{
					BACKEND_AUTH_ENDPOINT: 'https://analytics-dev.lhgmoteis.com.br/auth/api',
					NEXT_PUBLIC_AUTH_URL: undefined,
				},
				async () => {
					const proxy = getProxy();

					const dashboard = await proxy(
						request('/general/liv?menu=general&set=este_mes'),
					);
					expect(dashboard.headers.get('location')).toBe(
						'https://analytics-dev.lhgmoteis.com.br/auth/api/hub/login?returnTo=%2Fgeneral%2Fliv%3Fmenu%3Dgeneral%26set%3Deste_mes',
					);

					const login = await proxy(request('/login'));
					expect(login.headers.get('location')).toBeNull();

					const withSession = await proxy(
						request('/general', { cookie: 'access_token=present' }),
					);
					expect(withSession.headers.get('location')).toBeNull();
				},
			);
		} finally {
			global.fetch = originalFetch;
		}
	});
});
