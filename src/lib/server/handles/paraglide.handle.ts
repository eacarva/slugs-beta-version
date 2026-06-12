import type { Handle } from '@sveltejs/kit';

import { paraglideMiddleware } from '$lib/paraglide/server';

const normalizeLegacyLocaleCookie = (request: Request) => {
	const cookie = request.headers.get('cookie');
	if (!cookie?.match(/(^|;\s*)PARAGLIDE_LOCALE=pt(?=;|$)/)) return request;

	const headers = new Headers(request.headers);
	headers.set('cookie', cookie.replace(/(^|;\s*)PARAGLIDE_LOCALE=pt(?=;|$)/, '$1PARAGLIDE_LOCALE=pt-BR'));

	return new Request(request, { headers });
};

const handleParaglide: Handle = ({ event, resolve }) => {
	if (event.cookies.get('PARAGLIDE_LOCALE') === 'pt') {
		event.cookies.set('PARAGLIDE_LOCALE', 'pt-BR', {
			maxAge: 34_560_000,
			path: '/',
			sameSite: 'lax'
		});
	}

	return paraglideMiddleware(normalizeLegacyLocaleCookie(event.request), ({ locale, request }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
		});
	});
};
export default handleParaglide;
