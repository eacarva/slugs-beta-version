import { error, redirect } from '@sveltejs/kit';
import { CONSTANTS } from '$lib/server/const.js';
import { db } from '$lib/server/db/index.js';
import { checkRateLimit } from '$lib/server/rate-limit.js';
import { logNotFound, logVisit } from '$lib/server/umami';
import { isExpired, markExpiredUrl, resolveShortcode } from '$lib/server/urls/resolve.js';
import { domainFromUrl } from '$lib/utils.js';

export const load = async (event) => {
	const {
		locals: { user },
		params: { shortcode }
	} = event;

	const rateLimit = checkRateLimit(event, {
		limit: 120,
		namespace: `redirect:${shortcode}`,
		windowMs: 60_000
	});
	if (rateLimit.limited) throw error(429, 'Too many requests');

	const data = await event.parent();

	const shortened = await resolveShortcode({
		lowerCaseFallbackDisabled: data.host.options.disable.lowerCaseFallback === true,
		organizationId: data.activeOrganization?.id,
		shortcode
	});

	if (!shortened || shortened.active === false || isExpired(shortened)) {
		if (shortened && isExpired(shortened)) void markExpiredUrl(shortened.id);
		await logNotFound(event);
		return { disabled: true, slugsHasSecret: false };
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
	try {
		if (blacklisted) return { disabled: true, slugsHasSecret: false };

		if (shortened.secret === null) {
			if (shortened.userId !== user?.id) void logVisit(event, shortened);
		} else return { disabled: false, slugsHasSecret: true, urlId: shortened.id };
	} catch (err) {
		if (CONSTANTS.DEBUG) console.error(err);
	}
	redirect(307, encodeURI(decodeURI(redirection.href)));
};
