import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';
import { relations } from './schema';

const realDb = drizzle({
	client: postgres(env.DATABASE_URL || 'postgres://slugs:slugs@127.0.0.1:1/slugs', {
		connect_timeout: 3,
		idle_timeout: 20,
		max: 5,
		max_lifetime: 60 * 30
	}),
	relations,
	schema
});

const unavailableDb = new Proxy(
	{},
	{
		get() {
			throw new Error('DATABASE_URL is not configured');
		}
	}
) as typeof realDb;

const db = env.DATABASE_URL ? realDb : unavailableDb;

export { db };
