import { resolveLoginRedirect } from '@/lib/session/login-redirect';
import { readSession } from '@/lib/session/session-dal';
import { NextRequest, NextResponse } from 'next/server';

const CACHE_CONTROL =
	'private, no-store, no-cache, max-age=0, must-revalidate';

export async function GET(request: NextRequest) {
	const params = request.nextUrl.searchParams;
	const destination = resolveLoginRedirect({
		hubError: params.get('hub_error'),
		returnTo: params.get('returnTo'),
		set: params.get('set'),
		session: await readSession(),
	});

	const response = NextResponse.redirect(new URL(destination, request.url), 303);
	response.headers.set('cache-control', CACHE_CONTROL);
	return response;
}
