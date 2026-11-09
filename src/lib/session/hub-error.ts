import { sanitizeSessionReturnTo } from '@/lib/session/return-to';

// Tela de erro do login pelo HUB. O backend devolve /login?hub_error=<código>;
// o /login manda para cá, que MOSTRA a mensagem e NÃO redireciona sozinho
// (redirecionar de volta ao HUB faria laço com a sessão SSO dele).
export const HUB_ERROR_PATH = '/login/erro';

export type HubErrorCode = 'access_denied' | 'inactive' | 'indisponivel' | 'falha';

type HubErrorContent = {
	title: string;
	message: string;
	// "Tentar de novo" só faz sentido para erro temporário.
	canRetry: boolean;
};

// O texto vem SEMPRE daqui, nunca do parâmetro da URL.
const CONTENT: Record<HubErrorCode, HubErrorContent> = {
	access_denied: {
		title: 'Sem acesso ao LHG Analytics',
		message: 'Você não tem acesso ao LHG Analytics. Fale com o administrador.',
		canRetry: false,
	},
	inactive: {
		title: 'Acesso desativado',
		message: 'Seu acesso está desativado. Fale com o administrador.',
		canRetry: false,
	},
	indisponivel: {
		title: 'Serviço temporariamente indisponível',
		message: 'Não foi possível confirmar a sua sessão agora. Tente de novo em instantes.',
		canRetry: true,
	},
	falha: {
		title: 'Não foi possível entrar',
		message: 'Não foi possível entrar agora. Tente de novo.',
		canRetry: true,
	},
};

export function normalizeHubErrorCode(value: string | null | undefined): HubErrorCode {
	return value && Object.prototype.hasOwnProperty.call(CONTENT, value)
		? (value as HubErrorCode)
		: 'falha';
}

export function getHubErrorContent(code: HubErrorCode): HubErrorContent {
	return CONTENT[code];
}

// /login/erro?codigo=<código>[&returnTo=<caminho interno seguro>]
export function buildHubErrorPath(
	code: HubErrorCode,
	returnTo?: string | null,
): string {
	const params = new URLSearchParams({ codigo: code });
	const safeReturnTo = sanitizeSessionReturnTo(returnTo ?? null);
	if (safeReturnTo !== '/') {
		params.set('returnTo', safeReturnTo);
	}
	return `${HUB_ERROR_PATH}?${params.toString()}`;
}
