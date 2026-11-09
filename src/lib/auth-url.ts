import { sanitizeSessionReturnTo } from '@/lib/session/return-to';

export const HUB_PORTAL_URL = 'https://hub.lhgmoteis.com.br/';

export function normalizeAuthApiBaseUrl(
	rawBaseUrl: string | null | undefined,
): string | null {
	const value = rawBaseUrl?.trim();
	if (!value) {
		return null;
	}

	try {
		const url = new URL(value);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			return null;
		}

		const pathname = url.pathname.replace(/\/+$/, '');
		url.pathname = pathname.endsWith('/api') ? pathname : `${pathname}/api`;
		url.search = '';
		url.hash = '';
		return url.toString().replace(/\/$/, '');
	} catch {
		return null;
	}
}

// Chamadas servidor → backend (/me, /refresh): pode ser um endereço interno.
export function resolveAuthApiBaseUrl(): string | null {
	return normalizeAuthApiBaseUrl(
		process.env.BACKEND_AUTH_ENDPOINT?.trim() ||
			process.env.NEXT_PUBLIC_AUTH_URL?.trim(),
	);
}

// Navegações do NAVEGADOR (hub/login e hub/logout): sempre o endereço PÚBLICO,
// o mesmo do botão Sair. O login grava os cookies an_hub_* (host-only) no host
// do backend; o logout precisa ir ao MESMO host para levar o id_token do HUB.
export function resolvePublicAuthApiBaseUrl(): string | null {
	return normalizeAuthApiBaseUrl(
		process.env.NEXT_PUBLIC_AUTH_URL?.trim() ||
			process.env.BACKEND_AUTH_ENDPOINT?.trim(),
	);
}

export function resolveAuthApiUrl(
	endpoint: 'me' | 'refresh' | 'hub/login' | 'hub/logout',
) {
	const baseUrl =
		endpoint === 'hub/login' || endpoint === 'hub/logout'
			? resolvePublicAuthApiBaseUrl()
			: resolveAuthApiBaseUrl();
	return baseUrl ? `${baseUrl}/${endpoint}` : null;
}

export function resolveHubLoginUrl(returnTo: string | null): string | null {
	const hubLoginUrl = resolveAuthApiUrl('hub/login');
	if (!hubLoginUrl) {
		return null;
	}

	const safeReturnTo = sanitizeSessionReturnTo(returnTo);
	return safeReturnTo === '/'
		? hubLoginUrl
		: `${hubLoginUrl}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
