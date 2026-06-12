import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		uptimeSeconds: process.uptime()
	});

