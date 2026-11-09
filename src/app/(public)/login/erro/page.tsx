import { Suspense } from 'react';
import HubErrorContent, {
	type HubErrorPageProps,
} from './_components/hub-error-content';

// Tela de erro do login pelo HUB (pública; ver src/proxy.ts). Mostra a
// mensagem pelo código e só oferece botões: nada de redirecionar sozinho.
export default function HubErrorPage(props: HubErrorPageProps) {
	return (
		<main className='flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100'>
			<Suspense fallback={null}>
				<HubErrorContent {...props} />
			</Suspense>
		</main>
	);
}
