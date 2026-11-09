/** @format */

import { resolveHubLoginUrl } from '@/lib/auth-url';
import { normalizeRangeTag } from '@/lib/date-range';
import { HUB_ERROR_PATH } from '@/lib/session/hub-error';
import {
	buildInternalRequestPath,
	DASHBOARD_REQUEST_PATH_HEADER,
} from '@/lib/session/request-path';
import { isSessionPath } from '@/lib/session/return-to';
import { NextRequest, NextResponse } from 'next/server';

function nextResponse(request: NextRequest): NextResponse {
	const requestHeaders = new Headers(request.headers);
	requestHeaders.set(
		DASHBOARD_REQUEST_PATH_HEADER,
		buildInternalRequestPath(request.nextUrl.pathname, request.nextUrl.search),
	);

	return NextResponse.next({ request: { headers: requestHeaders } });
}

export function proxy(request: NextRequest): NextResponse {
	const normalizeUrl = request.nextUrl.clone();
	const rawSet = normalizeUrl.searchParams.get('set');
	if (rawSet) {
		const normalizedSet = normalizeRangeTag(rawSet);
		if (normalizedSet !== rawSet) {
			normalizeUrl.searchParams.set('set', normalizedSet);
			return NextResponse.redirect(normalizeUrl);
		}
	}

	const { pathname } = request.nextUrl;
	// /login/erro é pública: a pessoa sem acesso precisa ver a mensagem.
	if (pathname === '/' || pathname === '/login' || pathname === HUB_ERROR_PATH) {
		return nextResponse(request);
	}

	// Só as rotas do dashboard exigem sessão; um caminho inexistente segue
	// para o 404 (app/not-found.tsx) em vez de abrir o login.
	if (!isSessionPath(pathname)) {
		return nextResponse(request);
	}

	const accessToken = request.cookies.get('access_token')?.value;
	const refreshToken = request.cookies.get('refresh_token')?.value;
	if (accessToken || refreshToken) {
		return nextResponse(request);
	}

	const returnTo = buildInternalRequestPath(
		request.nextUrl.pathname,
		request.nextUrl.search,
	);
	const hubLoginUrl = resolveHubLoginUrl(returnTo);
	if (hubLoginUrl) {
		return NextResponse.redirect(hubLoginUrl);
	}

	const loginUrl = request.nextUrl.clone();
	loginUrl.pathname = '/login';
	loginUrl.search = '';
	loginUrl.searchParams.set('returnTo', returnTo);
	return NextResponse.redirect(loginUrl);
}

export const config = {
	// Protect all pages (no public routes), excluding Next internals and static assets.
	matcher: [
		'/((?!api|_next|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|woff|woff2|ttf|otf)$).*)',
	],
};
