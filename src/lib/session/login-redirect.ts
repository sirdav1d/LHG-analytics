import { HUB_PORTAL_URL, resolveHubLoginUrl } from '@/lib/auth-url';
import { getDefaultSessionHref } from '@/lib/session/default-route';
import { buildHubErrorPath, normalizeHubErrorCode } from '@/lib/session/hub-error';
import { sanitizeSessionReturnTo } from '@/lib/session/return-to';
import type { SessionReadResult } from '@/lib/session/session-dal';

export type LoginRedirectInput = {
	hubError: string | null;
	returnTo: string | null;
	set: string | null;
	session: SessionReadResult;
};

// /login has no screen: every request is sent to the HUB, the HUB portal, the
// error screen (/login/erro) or the forced logout. Error outcomes never send
// back to the HUB login automatically, because its single sign-on session
// would return the person immediately (a loop): the error screen shows the
// message and only offers buttons.
export function resolveLoginRedirect({
	hubError,
	returnTo,
	set,
	session,
}: LoginRedirectInput): string {
	if (hubError !== null) {
		// Mensagem pelo código (nunca o valor bruto), sem redirecionar sozinho.
		return buildHubErrorPath(normalizeHubErrorCode(hubError), returnTo);
	}

	// Backend fora do ar ou lento: não desloga (seria sair do HUB também).
	if (session.status === 'unavailable') {
		return buildHubErrorPath('indisponivel', returnTo);
	}

	if (session.status === 'unauthenticated' && session.reason === 'forbidden') {
		return '/api/session/logout';
	}

	if (session.status === 'authenticated') {
		// Já logado: respeita o destino pedido (só caminhos internos seguros).
		const safeReturnTo = sanitizeSessionReturnTo(returnTo);
		if (safeReturnTo !== '/') {
			return safeReturnTo;
		}
		const defaultHref = getDefaultSessionHref(session.user, set);
		return defaultHref === '/login' ? HUB_PORTAL_URL : defaultHref;
	}

	return resolveHubLoginUrl(returnTo) ?? HUB_PORTAL_URL;
}
