if (!process.env.ORIGIN && process.env.SLUGS_ORIGIN) {
	process.env.ORIGIN = process.env.SLUGS_ORIGIN;
}

await import('dotenv/config');
await import('../build/index.js');
