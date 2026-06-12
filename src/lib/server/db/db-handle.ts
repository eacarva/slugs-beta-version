import { type Handle, redirect } from '@sveltejs/kit';

import { _checkDB } from '../../../hooks.server';

let lastCheck = 0;
let lastState = false;

function canBypassDatabase(pathname: string) {
	return (
		pathname === '/api' ||
		pathname === '/api/live' ||
		pathname === '/custom.css' ||
		pathname.startsWith('/logos/') ||
		pathname.startsWith('/avatars/')
	);
}

async function isDatabaseAvailable() {
	const now = Date.now();
	if (now - lastCheck < 5_000) return lastState;

	lastState = await _checkDB();
	lastCheck = now;
	return lastState;
}

const dbHandle: Handle = async ({ event, resolve }) => {
	try {
		if (canBypassDatabase(event.url.pathname)) return resolve(event);

		if (await isDatabaseAvailable()) {
			if (event.url.pathname !== '/db-offline') return resolve(event);
			redirect(307, '/dashboard');
		}

		if (event.url.pathname === '/db-offline') return resolve(event);
	} catch (err) {
		console.error(err);
	}
	redirect(307, '/db-offline');
};
export default dbHandle;
