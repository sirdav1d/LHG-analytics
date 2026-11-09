import { expireAuthCookies } from '@/lib/auth-cookie';
import { HUB_PORTAL_URL, resolveAuthApiUrl } from '@/lib/auth-url';
import { NextRequest, NextResponse } from 'next/server';

const CACHE_CONTROL =
	'private, no-store, no-cache, max-age=0, must-revalidate';

// The HUB logout must be a POST sent by the browser: the backend needs its own
// host-only id_token cookie, which the Next server never receives.
function buildHubLogoutPage(logoutUrl: string): string {
	return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Saindo…</title></head><body><form method="post" action="${logoutUrl}"><noscript><button type="submit">Sair</button></noscript></form><script>document.forms[0].submit()</script></body></html>`;
}

function isTrustedLogoutNavigation(request: NextRequest): boolean {
	const fetchSite = request.headers.get('sec-fetch-site');
	if (!fetchSite || !['same-origin', 'same-site', 'none'].includes(fetchSite)) {
		return false;
	}

	const origin = request.headers.get('origin');
	if (!origin) {
		return true;
	}

	try {
		return new URL(origin).origin === request.nextUrl.origin;
	} catch {
		return false;
	}
}

export function GET(request: NextRequest) {
	if (!isTrustedLogoutNavigation(request)) {
		const response = new NextResponse(null, { status: 403 });
		response.headers.set('cache-control', CACHE_CONTROL);
		return response;
	}

	const logoutUrl = resolveAuthApiUrl('hub/logout');
	const response = logoutUrl
		? new NextResponse(buildHubLogoutPage(logoutUrl), {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			})
		: NextResponse.redirect(HUB_PORTAL_URL, 303);
	response.headers.set('cache-control', CACHE_CONTROL);
	expireAuthCookies(response, request);
	return response;
}
