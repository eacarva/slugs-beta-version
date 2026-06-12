import { readOAuthConfig } from '$lib/server/oauth';

export const load = async ({ parent }) => {
	const oauthConfig = await readOAuthConfig();

	const data = await parent();
	const accountProviders = oauthConfig.map(({ providerId }) => providerId);

	return { ...data, accountProviders };
};
