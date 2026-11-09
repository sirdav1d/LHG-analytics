import { HUB_PORTAL_URL, resolveHubLoginUrl } from '@/lib/auth-url';
import {
	getHubErrorContent,
	normalizeHubErrorCode,
	type HubErrorCode,
} from '@/lib/session/hub-error';
import { sanitizeSessionReturnTo } from '@/lib/session/return-to';

export type HubErrorPageProps = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value;

// "Tentar de novo": sessão indisponível volta para a MESMA página (o servidor
// confere a sessão de novo); falha do login recomeça pelo login do HUB. Os
// dois são cliques da pessoa, nunca um redirecionamento automático.
function retryHref(code: HubErrorCode, returnTo: string | undefined): string {
	const safeReturnTo = sanitizeSessionReturnTo(returnTo ?? null);
	if (code === 'indisponivel') {
		return safeReturnTo;
	}
	return resolveHubLoginUrl(safeReturnTo) ?? HUB_PORTAL_URL;
}

export default async function HubErrorContent({ searchParams }: HubErrorPageProps) {
	const params = await searchParams;
	const code = normalizeHubErrorCode(first(params.codigo));
	const content = getHubErrorContent(code);

	return (
		<section
			className='w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-center'
			role='alert'>
			<h1 className='text-xl font-semibold'>{content.title}</h1>
			<p className='mt-2 text-sm text-zinc-300'>{content.message}</p>
			<div className='mt-5 flex flex-col justify-center gap-3 sm:flex-row'>
				{content.canRetry && (
					<a
						href={retryHref(code, first(params.returnTo))}
						className='inline-flex h-10 items-center justify-center rounded-md bg-violet-400 px-4 text-sm font-medium text-zinc-950 hover:bg-violet-500'>
						Tentar de novo
					</a>
				)}
				<a
					href={HUB_PORTAL_URL}
					className='inline-flex h-10 items-center justify-center rounded-md border border-zinc-600 px-4 text-sm font-medium text-zinc-100 hover:bg-zinc-800'>
					Voltar ao HUB
				</a>
			</div>
		</section>
	);
}
