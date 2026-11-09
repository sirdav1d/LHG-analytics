/** @format */

'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut } from 'lucide-react';
import { normalizeAuthApiBaseUrl } from '@/lib/auth-url';

// Only NEXT_PUBLIC_AUTH_URL exists on both server and client, so the form action
// renders identically on both sides (BACKEND_AUTH_ENDPOINT is server-only).
const authApiBaseUrl = normalizeAuthApiBaseUrl(process.env.NEXT_PUBLIC_AUTH_URL);
const logoutUrl = authApiBaseUrl ? `${authApiBaseUrl}/hub/logout` : null;

export default function BtnSignOut({
	isOpened,
	fit,
}: {
	isOpened?: boolean;
	fit?: boolean;
}) {
	const [loading, setLoading] = useState(false);

	return (
		<form
			method='post'
			action={logoutUrl ?? undefined}
			onSubmit={() => {
				// Leaving the page skips React cleanup, so close the Help Desk session now.
				window.LHGHelpdesk?.destroy();
				setLoading(true);
			}}
			className={fit ? 'w-fit' : 'w-full'}>
			<Button
				type='submit'
				disabled={loading || !logoutUrl}
				variant={'destructive'}
				className={`flex ${
					fit ? 'w-fit' : 'w-full'
				}  gap-3 text-red-600 hover:bg-transparent md:hover:bg-destructive hover:text-red-600 p-2.5 disabled:grayscale disabled:border-zinc-100/40 disabled:hover:grayscale bg-transparent md:hover:text-zinc-100 `}
				onClick={(e) => e.stopPropagation()}>
				{loading ? (
					<Loader2 className='size-5 animate-spin' />
				) : isOpened ? (
					<>
						<p className=''>Sair</p>
						<LogOut size={16} />
					</>
				) : (
					<LogOut size={16} />
				)}
			</Button>
		</form>
	);
}
