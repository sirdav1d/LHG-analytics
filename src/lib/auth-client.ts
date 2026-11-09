/** @format */

'use client';

export type AuthApiResult<T> = {
	ok: boolean;
	status: number;
	data: T | null;
	error: unknown | null;
};

type JsonValue =
	| null
	| boolean
	| number
	| string
	| JsonValue[]
	| { [key: string]: JsonValue };

const baseUrl = process.env.NEXT_PUBLIC_AUTH_URL;

async function readBody(resp: Response): Promise<JsonValue | string | null> {
	const contentType = resp.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		return (await resp.json()) as JsonValue;
	}
	const text = await resp.text();
	return text || null;
}

export async function refreshWithCookies(): Promise<
	AuthApiResult<JsonValue | string>
> {
	const resp = await fetch(`${baseUrl}/api/refresh`, {
		method: 'POST',
		credentials: 'include',
		headers: {
			accept: 'application/json',
		},
		cache: 'no-store',
	});

	const payload = await readBody(resp);

	return {
		ok: resp.ok,
		status: resp.status,
		data: resp.ok ? payload : null,
		error: resp.ok ? null : payload,
	};
}

export async function getMeWithCookies(): Promise<
	AuthApiResult<JsonValue | string>
> {
	const resp = await fetch(`${baseUrl}/api/me`, {
		method: 'GET',
		credentials: 'include',
		cache: 'no-store',
	});

	const payload = await readBody(resp);

	return {
		ok: resp.ok,
		status: resp.status,
		data: resp.ok ? payload : null,
		error: resp.ok ? null : payload,
	};
}

export async function getUserByEmailWithCookies(
	email: string,
): Promise<AuthApiResult<JsonValue | string>> {
	const resp = await fetch(
		`${baseUrl}/api/users/email/${encodeURIComponent(email)}`,
		{
			method: 'GET',
			credentials: 'include',
		},
	);

	const payload = await readBody(resp);

	return {
		ok: resp.ok,
		status: resp.status,
		data: resp.ok ? payload : null,
		error: resp.ok ? null : payload,
	};
}
