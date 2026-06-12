import maxmind, { type CityResponse, type CountryResponse } from 'maxmind';
import { getMaxmindDbPath } from './update';

let lookup: Awaited<ReturnType<typeof maxmind.open>> | null = null;
let lookupFailed = false;

const getDatabasePaths = () => [
	getMaxmindDbPath(),
	'config/maxmind/geolite2-city.mmdb',
	'maxmind/geolite2-city.mmdb'
].filter((path): path is string => Boolean(path));

async function getLocation(ip?: string) {
	if (!lookup && !lookupFailed) {
		for (const path of getDatabasePaths()) {
			try {
				lookup = await maxmind.open(path);
				break;
			} catch {
				// Try the next configured location.
			}
		}
		if (!lookup) lookupFailed = true;
	}
	if (!lookup) return null;
	if (!ip || ip.trim() === '') return null;
	const data = lookup.get(ip);
	if (data === null) return null;
	const city = (data as CityResponse).city?.names.en;
	const region = (data as CityResponse).subdivisions?.map((subdiv) => subdiv.names.en).join(' / ');
	const country = (data as CountryResponse).country?.names.en;
	return { city, country, region };
}

export { getLocation };
