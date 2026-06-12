import { error } from '@sveltejs/kit';
import { m } from '$lib/paraglide/messages';
import { db } from '$lib/server/db';
import { findHost, getRequestOrigin } from '$lib/server/env';
import { settings } from '$lib/server/settings';
import { slugify } from '$lib/utils.js';
export const load = async ({ depends, locals: { session, user }, request, url }) => {
	depends('auth:user');
	const isDBError = url.pathname === '/db-offline';
	const config = settings.get();
	const origin = getRequestOrigin(url, request.headers);
	const host = findHost(config, origin) || config.hosts[0];
	if (!host) error(400, { message: m.errors_unrecognized_host() });
	
	
	const invitations = user && !isDBError
		? await db.query.invitation.findMany({
				where: {
					email: user.email,
					status: 'pending'
				},
				with: {
					organization: true,
					user: true
				}
			})
		: [];

	const notifications = {
		invitations: invitations.map((i) => ({ ...i, organization: i.organization!, user: i.user! })),
		lastLogin: session?.updatedAt
	};
	return {
		activeOrganization:!isDBError && await db.query.organization.findFirst({
		where: { id: slugify(host.origin) }
	}) || null,
		appname:config.appname,
		host,
		notifications,
		user
	};
};
