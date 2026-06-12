import { env } from '$env/dynamic/private';
import { m } from '$lib/paraglide/messages';
import * as v from 'valibot';
const ConstantsSchema = v.object({
	DATABASE_URL: v.optional(v.pipe(v.string(), v.nonEmpty(m.errors_db_url()))),
	DEBUG: v.optional(
		v.pipe(
			v.union([v.literal('true'), v.literal('false')]),
			v.transform((i) => (i === 'true' ? true : false))
		),
		'false'
	)
});
const CONSTANTS = v.parse(ConstantsSchema, {
	DATABASE_URL: env.DATABASE_URL || undefined,
	DEBUG: env.SLUGS_DEBUG
});
export { CONSTANTS };
