import { error, redirect } from '@sveltejs/kit';
import { getBetterAuth } from '$lib/auth/server';
import { m } from '$lib/paraglide/messages';
import { findHost, getRequestOrigin } from '$lib/server/env';
import { settings } from '$lib/server/settings/index.js';

export const load = async ({ params: { id }, request, url }) => {
	const config = settings.get();
	const origin = getRequestOrigin(url, request.headers);
	const host = findHost(config, origin);
	if (!host) throw error(400, { message: m.errors_unrecognized_host() });
	const auth = await getBetterAuth(host);
	try {
		await auth.api.acceptInvitation({
			body: {
				invitationId: id
			},
			headers: request.headers
		});
	} catch (err) {
		console.error(err);
		throw error(400, { message: m.errors_generic() });
	}

	redirect(307, '/dashboard');
};
