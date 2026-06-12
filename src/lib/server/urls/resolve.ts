import { url } from '$lib/server/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '../db';

type ResolveShortcodeArgs = {
	lowerCaseFallbackDisabled?: boolean;
	organizationId?: string | null;
	shortcode: string;
};

export const resolveShortcode = async ({
	lowerCaseFallbackDisabled,
	organizationId,
	shortcode
}: ResolveShortcodeArgs) => {
	if (organizationId) {
		const orgSpecific = await db
			.select()
			.from(url)
			.where(
				and(
					eq(url.active, true),
					eq(url.shortcode, shortcode),
					eq(url.organizationId, organizationId)
				)
			)
			.limit(1);

		if (orgSpecific[0]) return orgSpecific[0];

		if (!lowerCaseFallbackDisabled) {
			const lowerCaseFallback = await db
				.select()
				.from(url)
				.where(
					and(
						eq(url.active, true),
						eq(url.organizationId, organizationId),
						sql`lower(${url.shortcode}) = lower(${shortcode})`
					)
				)
				.limit(1);

			if (lowerCaseFallback[0]) return lowerCaseFallback[0];
		}
	}

	const fallback = await db
		.select()
		.from(url)
		.where(and(eq(url.active, true), eq(url.shortcode, shortcode)))
		.orderBy(asc(url.createdAt))
		.limit(1);

	return fallback[0] ?? null;
};

export const isExpired = (record: { expiresAt: Date | null }) =>
	record.expiresAt !== null && record.expiresAt <= new Date();

export const markExpiredUrl = async (id: string) => {
	try {
		await db.update(url).set({ active: false, expiresAt: null }).where(eq(url.id, id));
	} catch (err) {
		console.error('[url] failed to mark expired url %s', id, err);
	}
};
