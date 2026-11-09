const LOCAL_ORIGIN = 'http://lhg.internal';
const ALLOWED_ROOTS = [
	'/general',
	'/operational',
	'/reservations',
	'/restaurant',
	'/settings',
];

// Rotas que exigem sessão (as raízes do dashboard). Fora delas o proxy não
// manda ao login: um caminho inexistente cai no 404 (app/not-found.tsx).
export function isSessionPath(pathname: string): boolean {
	return ALLOWED_ROOTS.some(
		(root) => pathname === root || pathname.startsWith(`${root}/`),
	);
}

export function sanitizeSessionReturnTo(value: string | null): string {
	if (!value || value.includes('\\') || /%5c/i.test(value)) {
		return '/';
	}

	try {
		const parsed = new URL(value, LOCAL_ORIGIN);
		if (parsed.origin !== LOCAL_ORIGIN || !value.startsWith('/')) {
			return '/';
		}
		if (
			!ALLOWED_ROOTS.some(
				(root) => parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
			)
		) {
			return '/';
		}

		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return '/';
	}
}
