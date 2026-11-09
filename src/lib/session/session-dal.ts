import 'server-only';

import { buildCookieHeader } from '@/lib/auth-cookie';
import { resolveAuthApiBaseUrl } from '@/lib/auth-url';
import { buildHubErrorPath } from '@/lib/session/hub-error';
import {
	DASHBOARD_REQUEST_PATH_HEADER,
	buildInternalRequestPath,
} from '@/lib/session/request-path';
import { extractSessionUser, type SessionUser } from '@/lib/session-user';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

export type SessionReadResult =
	| { status: 'authenticated'; user: SessionUser }
	| {
			status: 'unauthenticated';
			canRefresh: boolean;
			reason: 'missing' | 'unauthorized' | 'forbidden';
	  }
	| { status: 'unavailable' };

export const readSession = cache(async (): Promise<SessionReadResult> => {
	const cookieStore = await cookies();
	const accessToken = cookieStore.get('access_token')?.value;
	const refreshToken = cookieStore.get('refresh_token')?.value;

	if (!accessToken) {
		return {
			status: 'unauthenticated',
			canRefresh: Boolean(refreshToken),
			reason: 'missing',
		};
	}

	const authApiBaseUrl = resolveAuthApiBaseUrl();
	const cookieHeader = buildCookieHeader(accessToken, refreshToken);
	if (!authApiBaseUrl || !cookieHeader) {
		return { status: 'unavailable' };
	}

	const abortController = new AbortController();
	// 15 s: cobre a partida a frio do backend (Render) sem derrubar a sessão.
	const timeout = setTimeout(() => abortController.abort(), 15_000);

	try {
		const response = await fetch(`${authApiBaseUrl}/me`, {
			headers: {
				accept: 'application/json',
				cookie: cookieHeader,
			},
			cache: 'no-store',
			signal: abortController.signal,
		});

		if (response.ok) {
			const user = extractSessionUser(await response.json());
			return user
				? { status: 'authenticated', user }
				: { status: 'unavailable' };
		}

		if (response.status === 401) {
			return {
				status: 'unauthenticated',
				canRefresh: Boolean(refreshToken),
				reason: 'unauthorized',
			};
		}

		if (response.status === 403) {
			return {
				status: 'unauthenticated',
				canRefresh: false,
				reason: 'forbidden',
			};
		}

		return { status: 'unavailable' };
	} catch {
		return { status: 'unavailable' };
	} finally {
		clearTimeout(timeout);
	}
});

export async function getOptionalSessionUser(): Promise<SessionUser | null> {
	const session = await readSession();
	return session.status === 'authenticated' ? session.user : null;
}

async function getRequestPath(): Promise<string> {
	const requestHeaders = await headers();
	return (
		requestHeaders.get(DASHBOARD_REQUEST_PATH_HEADER) ??
		buildInternalRequestPath('/', '')
	);
}

export async function requireDashboardSession(): Promise<SessionUser> {
	const session = await readSession();

	if (session.status === 'authenticated') {
		return session.user;
	}

	const requestPath = await getRequestPath();

	// Backend indisponível NÃO é sessão inválida: mostra o erro com "Tentar de
	// novo" (volta à mesma página), em vez de deslogar do Analytics e do HUB.
	if (session.status === 'unavailable') {
		redirect(buildHubErrorPath('indisponivel', requestPath));
	}
	if (session.canRefresh) {
		redirect(
			`/api/session/refresh?returnTo=${encodeURIComponent(requestPath)}`,
		);
	}

	redirect(`/login?returnTo=${encodeURIComponent(requestPath)}`);
}
