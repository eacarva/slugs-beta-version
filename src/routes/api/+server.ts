import { json } from '@sveltejs/kit';
import { defineEndpoint } from '$lib/server/openapi';
import { m } from '$lib/paraglide/messages';
import { checkDatabaseConnection } from '$lib/server/db/health';
import { literal, number, object, string, union } from 'valibot';

import type { RequestHandler } from './$types';

const dependencyStatusSchema = object({
	error: string(),
	responseTimeMs: number(),
	status: union([literal('up'), literal('down'), literal('degraded')])
});

const healthCheckSchema = object({
	checks: object({
		database: dependencyStatusSchema
	}),
	environment: string(),
	status: union([literal('ok'), literal('degraded'), literal('error')]),
	timestamp: string(),
	uptimeSeconds: number(),
	version: string()
});
export const _openapi = {
	GET: defineEndpoint({
		description: m.api_health_check(),
		method: 'GET',
		responses: {
			200: {
				description: m.api_health_check_healthy(),
				schema: healthCheckSchema
			},
			503: {
				description: m.api_health_check_unhealthy(),
				schema: healthCheckSchema
			}
		},
		summary: m.api_health_check_helper(),
		tags: ['Health']
	})
} as const;

type DependencyStatus = {
	error: string;
	responseTimeMs: number;
	status: DependencyStatusName;
};

type DependencyStatusName = 'degraded' | 'down' | 'up';

export const GET: RequestHandler = async () => {
	const database = await checkDatabaseConnection();

	let overallStatus: 'degraded' | 'error' | 'ok' = 'ok';

	if (database.status === 'down') {
		overallStatus = 'error';
	}

	const httpStatus = overallStatus === 'error' ? 503 : 200;

	const body = {
		checks: { database },
		environment: process.env.NODE_ENV ?? m.api_health_env_unknown(),
		status: overallStatus,
		timestamp: new Date().toISOString(),
		uptimeSeconds: process.uptime(),
		version: process.env.npm_package_version ?? m.api_health_version_unknown()
	};

	return json(body, { status: httpStatus });
};
