import { getHost } from '$lib/remotes/config.remote';
import { readOAuthConfig } from '$lib/server/oauth';

export const load = async () => {
	const oauthConfig = await readOAuthConfig();

	const host = await getHost();
	const accountProviders = oauthConfig.map(({ providerId }) => providerId);

	return { accountProviders, host };
};
