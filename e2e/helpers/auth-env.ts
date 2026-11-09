type AuthEnv = {
	BACKEND_AUTH_ENDPOINT?: string;
	NEXT_PUBLIC_AUTH_URL?: string;
};

const AUTH_ENV_KEYS = ['BACKEND_AUTH_ENDPOINT', 'NEXT_PUBLIC_AUTH_URL'] as const;

function applyAuthEnv(env: AuthEnv) {
	for (const key of AUTH_ENV_KEYS) {
		const value = env[key];
		if (value === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = value;
		}
	}
}

export async function withAuthEnv<T>(
	env: AuthEnv,
	run: () => T | Promise<T>,
): Promise<T> {
	const original: AuthEnv = {
		BACKEND_AUTH_ENDPOINT: process.env.BACKEND_AUTH_ENDPOINT,
		NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
	};
	applyAuthEnv(env);

	try {
		return await run();
	} finally {
		applyAuthEnv(original);
	}
}
