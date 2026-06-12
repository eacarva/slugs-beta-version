import maxmind, { type CityResponse, type CountryResponse } from 'maxmind';

let lookup: Awaited<ReturnType<typeof maxmind.open>> | null = null;

async function getLocation(ip?: string) {
	if (!lookup) {
		try {
			lookup = await maxmind.open('maxmind/geolite2-city.mmdb');
		} catch {
			return null;
		}
	}
	if (!ip || ip.trim() === '') return null;
	const data = lookup.get(ip);
	if (data === null) return null;
	const city = (data as CityResponse).city?.names.en;
	const region = (data as CityResponse).subdivisions?.map((subdiv) => subdiv.names.en).join(' / ');
	const country = (data as CountryResponse).country?.names.en;
	return { city, country, region };
}

export { getLocation };
