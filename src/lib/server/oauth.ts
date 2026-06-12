import type { GenericOAuthConfig } from 'better-auth/plugins';

import fs from 'node:fs/promises';

const OAUTH_CONFIG_PATH = 'config/oauth.json';
const EMPTY_OAUTH_CONFIG = '[]\n';

export async function readOAuthConfig(): Promise<GenericOAuthConfig[]> {
	try {
		return JSON.parse(await fs.readFile(OAUTH_CONFIG_PATH, 'utf8')) as GenericOAuthConfig[];
	} catch (error) {
		if (!isNotFoundError(error)) throw error;

		await fs.mkdir('config', { recursive: true });
		await fs
			.writeFile(OAUTH_CONFIG_PATH, EMPTY_OAUTH_CONFIG, { flag: 'wx' })
			.catch((writeError) => {
				if (!isAlreadyExistsError(writeError)) throw writeError;
			});

		return [];
	}
}

function isNotFoundError(error: unknown) {
	return hasErrorCode(error, 'ENOENT');
}

function isAlreadyExistsError(error: unknown) {
	return hasErrorCode(error, 'EEXIST');
}

function hasErrorCode(error: unknown, code: string) {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === code
	);
}
