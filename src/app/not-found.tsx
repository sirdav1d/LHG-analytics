import Link from 'next/link';

// Caminho inexistente: 404 de verdade, em vez de mandar ao login do HUB.
export default function NotFound() {
	return (
		<main className='flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100'>
			<section className='w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 text-center'>
				<h1 className='text-xl font-semibold'>Página não encontrada</h1>
				<p className='mt-2 text-sm text-zinc-300'>
					O endereço acessado não existe no LHG Analytics.
				</p>
				<Link
					href='/'
					className='mt-5 inline-flex h-10 items-center justify-center rounded-md bg-violet-400 px-4 text-sm font-medium text-zinc-950 hover:bg-violet-500'>
					Ir para o início
				</Link>
			</section>
		</main>
	);
}
