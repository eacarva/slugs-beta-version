import type { RequestEvent } from '@sveltejs/kit';

type RateLimitOptions = {
	limit: number;
	namespace: string;
	windowMs: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastCleanup = 0;

const getClientKey = (event: RequestEvent) => {
	const forwardedFor = event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
	return forwardedFor || event.getClientAddress();
};

export const checkRateLimit = (
	event: RequestEvent,
	{ limit, namespace, windowMs }: RateLimitOptions
) => {
	const now = Date.now();

	if (now - lastCleanup > windowMs) {
		lastCleanup = now;
		for (const [key, bucket] of buckets) {
			if (bucket.resetAt <= now) buckets.delete(key);
		}
	}

	const key = `${namespace}:${getClientKey(event)}`;
	const bucket = buckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + windowMs });
		return { limited: false, remaining: limit - 1, resetAt: now + windowMs };
	}

	bucket.count += 1;

	return {
		limited: bucket.count > limit,
		remaining: Math.max(limit - bucket.count, 0),
		resetAt: bucket.resetAt
	};
};
