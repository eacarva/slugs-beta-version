import { Client } from 'pg';

import { CONSTANTS } from '../const';

export type DatabaseHealth = {
	error: string;
	responseTimeMs: number;
	status: 'down' | 'up';
};

export const checkDatabaseConnection = async (): Promise<DatabaseHealth> => {
	const started = Date.now();

	if (!CONSTANTS.DATABASE_URL) {
		return {
			error: 'DATABASE_URL is not configured',
			responseTimeMs: Date.now() - started,
			status: 'down'
		};
	}

	const client = new Client({
		connectionString: CONSTANTS.DATABASE_URL,
		connectionTimeoutMillis: 1_000
	});

	try {
		await client.connect();
		await client.query('SELECT 1');

		return {
			error: '',
			responseTimeMs: Date.now() - started,
			status: 'up'
		};
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : 'Unknown database error',
			responseTimeMs: Date.now() - started,
			status: 'down'
		};
	} finally {
		await client.end().catch(() => {});
	}
};
