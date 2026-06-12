import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_DB_PATH = 'config/maxmind/geolite2-city.mmdb';
const DOWNLOAD_URL =
	'https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&suffix=tar.gz';

export const getMaxmindDbPath = () => process.env.SLUGS_MAXMIND_DB_PATH || DEFAULT_DB_PATH;

const exists = async (filePath: string) => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};

const findFile = async (dir: string, filename: string): Promise<string | null> => {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name);
		if (entry.isFile() && entry.name === filename) return entryPath;
		if (entry.isDirectory()) {
			const found = await findFile(entryPath, filename);
			if (found) return found;
		}
	}

	return null;
};

export const ensureMaxmindDatabase = async () => {
	const dbPath = getMaxmindDbPath();
	if (await exists(dbPath)) return;

	const licenseKey = process.env.MAXMIND_LICENSE_KEY || process.env.SLUGS_MAXMIND_LICENSE_KEY;
	if (!licenseKey) return;

	const targetDir = path.dirname(dbPath);
	const tempDir = path.join(targetDir, '.tmp');
	const archivePath = path.join(tempDir, 'geolite2-city.tar.gz');

	await fs.mkdir(tempDir, { recursive: true });
	await fs.mkdir(targetDir, { recursive: true });

	const url = new URL(DOWNLOAD_URL);
	url.searchParams.set('license_key', licenseKey);

	const response = await fetch(url);
	if (!response.ok || !response.body) {
		throw new Error(`MaxMind download failed with HTTP ${response.status}`);
	}

	try {
		await pipeline(
			Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
			createWriteStream(archivePath)
		);
		await execFileAsync('tar', ['-xzf', archivePath, '-C', tempDir]);

		const extractedPath = await findFile(tempDir, 'GeoLite2-City.mmdb');
		if (!extractedPath) throw new Error('MaxMind archive did not contain GeoLite2-City.mmdb');
		await fs.rename(extractedPath, dbPath);
	} finally {
		await fs.rm(tempDir, { force: true, recursive: true });
	}
};
