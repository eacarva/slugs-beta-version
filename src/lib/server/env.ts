import type { TSettings } from './settings/schema';

const ENV_PATTERN = /\$\(([A-Z0-9_]+)\)|\$\{([A-Z0-9_]+)\}|\$([A-Z0-9_]+)/gi;

const LOCAL_HOSTS = new Set(['[::1]', '127.0.0.1', 'localhost']);

export function expandEnv(value: string): string {
	return value.replace(ENV_PATTERN, (match, parenKey, braceKey, plainKey) => {
		const key = parenKey || braceKey || plainKey;
		return process.env[key] ?? match;
	});
}

export function findHost(config: TSettings, origin: string) {
	const index = findHostIndex(config, origin);
	return index === -1 ? undefined : config.hosts[index];
}

export function findHostIndex(config: TSettings, origin: string) {
	const normalized = normalizeOrigin(origin);
	const exact = config.hosts.findIndex((host) => normalizeOrigin(host.origin) === normalized);
	if (exact !== -1) return exact;

	const requestedHost = new URL(normalized).host;
	return config.hosts.findIndex((host) => new URL(normalizeOrigin(host.origin)).host === requestedHost);
}

export function getConfiguredOrigin() {
	return normalizeOrigin(
		process.env.SLUGS_ORIGIN ||
			process.env.PUBLIC_ORIGIN ||
			process.env.ORIGIN ||
			process.env.APP_URL ||
			process.env.PRIMARY_DOMAIN ||
			'http://localhost:3000'
	);
}

export function getRequestOrigin(url: URL, headers?: Headers): string {
	const forwardedHost = headers?.get('x-forwarded-host')?.split(',')[0]?.trim();
	const forwardedProto = headers?.get('x-forwarded-proto')?.split(',')[0]?.trim();
	const host = forwardedHost || headers?.get('host') || url.host;
	const protocol = forwardedProto || url.protocol.replace(':', '');

	return normalizeOrigin(`${protocol}://${host}`);
}

export function normalizeOrigin(value: string): string {
	const expanded = expandEnv(value).trim().replace(/\/+$/, '');
	if (!expanded) return expanded;

	const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(expanded)
		? expanded
		: `${isLocalHost(expanded) ? 'http' : 'https'}://${expanded}`;

	const url = new URL(withProtocol);
	return url.origin;
}

function isLocalHost(value: string): boolean {
	try {
		return LOCAL_HOSTS.has(new URL(/:\/\//.test(value) ? value : `http://${value}`).hostname);
	} catch {
		return false;
	}
}
