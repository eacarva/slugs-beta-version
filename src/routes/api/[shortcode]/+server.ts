import { error, redirect } from '@sveltejs/kit';
import { defineEndpoint } from '@uraniadev/sveltekit-valibot-openapi';
import { m } from '$lib/paraglide/messages.js';
import { authenticateAPI } from '$lib/server/api/authenticate';
import { db } from '$lib/server/db/index.js';
import { checkRateLimit } from '$lib/server/rate-limit.js';
import { logNotFound, logVisit } from '$lib/server/umami';
import { isExpired, markExpiredUrl, resolveShortcode } from '$lib/server/urls/resolve.js';
import { domainFromUrl } from '$lib/utils.js';
import { verifyPassword } from 'better-auth/crypto';
import * as v from 'valibot';

const SecretSchema = v.object({ _secret: v.optional(v.string()) });
export const POST = async (event) => {
	const rateLimit = checkRateLimit(event, {
		limit: 120,
		namespace: `api-redirect:${event.params.shortcode}`,
		windowMs: 60_000
	});
	if (rateLimit.limited) throw error(429, { message: 'Too many requests' });

	const { host, key, organizationId } = await authenticateAPI();

	const body = await event.request.json();
	const secret = v.safeParse(SecretSchema, body);
	const user = await db.query.user.findFirst({
		columns: { id: true, role: true },
		where: { id: key.userId }
	});
	if (!user) throw error(401, { message: m.errors_unauthorized() });

	const shortened = await resolveShortcode({
		lowerCaseFallbackDisabled: host.options.disable.lowerCaseFallback === true,
		organizationId,
		shortcode: event.params.shortcode
	});

	if (!shortened || shortened.active === false || isExpired(shortened)) {
		if (shortened && isExpired(shortened)) void markExpiredUrl(shortened.id);
		await logNotFound(event);
		throw error(404, { message: m.disabled_urls() });
	}

	const redirection = new URL(shortened.originalUrl);

	for (const params of Object.values(shortened.utm || {}))
		redirection.searchParams.set(params.key, params.value);

	const domain = domainFromUrl(redirection.href);
	const blacklisted = await db.query.watchlist.findFirst({
		where: {
			allowed: false,
			domain,
			username: { isNull: true }
		}
	});
	if (blacklisted) throw error(403, { message: m.errors_blacklisted_url() });

	if (shortened.secret === null) {
		if (shortened.userId !== user?.id) void logVisit(event, shortened);
	} else {
		if (!secret.success) throw error(401, { message: m.api_url_protected() });
		const valid =
			(secret.output._secret &&
				(await verifyPassword({ hash: shortened.secret, password: secret.output._secret }))) ||
			false;
		if (!valid) throw error(403, { message: m.api_url_protected() });
	}
	redirect(307, encodeURI(decodeURI(redirection.href)));
};

export const _openapi = {
	POST: defineEndpoint({
		body: {
			content: {
				'application/json': SecretSchema
			},
			description: m.api_url_resolve_body_description(),
			required: false
		},
		description: m.api_url_resolve_description(),
		method: 'POST',
		responses: {
			307: {
				description: m.api_url_resolve_redirect()
			},
			401: {
				description: m.errors_unauthorized()
			},
			403: {
				description: m.api_url_protected()
			},
			404: {
				description: m.disabled_urls()
			},
			500: {
				description: m.errors_generic()
			}
		},
		summary: m.api_url_resolve_summary(),
		tags: ['URLs']
	})
} as const;
