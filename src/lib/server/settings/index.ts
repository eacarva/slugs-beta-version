import lodash from 'lodash';
import fs from 'node:fs';
import yaml from 'yaml';

import { CONSTANTS } from '../const';
import { expandEnv, getConfiguredOrigin } from '../env';
import { parseSettings, type TSettings } from './schema';

const SETTINGS_PATH = 'config/settings.yaml';

function defaultSettings(): TSettings {
	return parseSettings({
		admin: [
			{
				email: process.env.SLUGS_ADMIN_EMAIL || 'admin@example.org',
				username: process.env.SLUGS_ADMIN_USERNAME || 'admin'
			}
		],
		appname: process.env.SLUGS_APPNAME || process.env.PROJECT_NAME || 'Slugs',
		hosts: [
			{
				options: {
					customRedirect: '/dashboard',
					disable: {
						homepage: false,
						limits: false,
						lowerCaseFallback: true,
						signup: false,
						twoFactor: true
					},
					limits: {
						maxSlugsPerUser: 1000,
						requestsPerDay: 1000,
						requestsPerMinute: 60
					}
				},
				origin: getConfiguredOrigin()
			}
		],
		smtp: {
			enabled: false
		}
	});
}

class Settings {
	#lastAccess: string | undefined = undefined;
	#settings: TSettings = defaultSettings();

	get() {
		this.sync();
		return this.#settings;
	}

	set(payload: unknown) {
		try {
			this.#settings = parseSettings(lodash.merge({}, this.#settings, payload));
			fs.mkdirSync('config', { recursive: true });
			fs.writeFileSync(SETTINGS_PATH, yaml.stringify(this.#settings));
			this.#lastAccess = new Date().toUTCString();
		} catch (error) {
			console.error('[settings]', 'Error while saving settings');
			if (CONSTANTS.DEBUG) console.error(error);
		}
	}

	sync = () => {
		try {
			if (!fs.existsSync(SETTINGS_PATH)) {
				fs.mkdirSync('config', { recursive: true });
				fs.writeFileSync(SETTINGS_PATH, yaml.stringify(defaultSettings()));
			}

			const stats = fs.statSync(SETTINGS_PATH);
			if (this.#lastAccess && stats.mtime <= new Date(this.#lastAccess)) return;

			const raw = expandEnv(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
			this.#settings = applyEnvironmentOverrides(parseSettings(yaml.parse(raw)));
			this.#lastAccess = new Date().toUTCString();

			if (CONSTANTS.DEBUG) console.info('[settings]', 'Updated from file');
		} catch (error) {
			console.error('[settings]', 'Error while loading settings; using environment fallback');
			this.#settings = defaultSettings();
			if (CONSTANTS.DEBUG) console.error(error);
		}
	};
}

function applyEnvironmentOverrides(settings: TSettings): TSettings {
	const hasOriginOverride = Boolean(
		process.env.SLUGS_ORIGIN ||
		process.env.PUBLIC_ORIGIN ||
		process.env.ORIGIN ||
		process.env.APP_URL ||
		process.env.PRIMARY_DOMAIN
	);

	const adminEmail = getEnvString('SLUGS_ADMIN_EMAIL');
	const adminUsername = getEnvString('SLUGS_ADMIN_USERNAME');
	const smtpEnabled = getEnvBoolean('SLUGS_SMTP_ENABLED');
	const hostLimits = settings.hosts[0]?.options.limits ?? {
		maxSlugsPerUser: 1000,
		requestsPerDay: 1000,
		requestsPerMinute: 60
	};

	return parseSettings({
		...settings,
		admin:
			adminEmail || adminUsername
				? [
						{
							email: adminEmail || settings.admin[0]?.email || 'admin@example.org',
							username: adminUsername || settings.admin[0]?.username || 'admin'
						}
					]
				: settings.admin,
		appname: process.env.SLUGS_APPNAME || process.env.PROJECT_NAME || settings.appname,
		hosts: settings.hosts[0]
			? [
					{
						...settings.hosts[0],
						options: {
							...settings.hosts[0].options,
							customRedirect:
								getEnvString('SLUGS_CUSTOM_REDIRECT') || settings.hosts[0].options.customRedirect,
							disable: {
								...settings.hosts[0].options.disable,
								homepage:
									getEnvBoolean('SLUGS_DISABLE_HOMEPAGE') ??
									settings.hosts[0].options.disable.homepage,
								limits:
									getEnvBoolean('SLUGS_DISABLE_LIMITS') ?? settings.hosts[0].options.disable.limits,
								lowerCaseFallback:
									getEnvBoolean('SLUGS_DISABLE_LOWER_CASE_FALLBACK') ??
									settings.hosts[0].options.disable.lowerCaseFallback,
								signup:
									getEnvBoolean('SLUGS_DISABLE_SIGNUP') ?? settings.hosts[0].options.disable.signup,
								twoFactor:
									getEnvBoolean('SLUGS_DISABLE_2FA') ?? settings.hosts[0].options.disable.twoFactor
							},
							limits: {
								...hostLimits,
								maxSlugsPerUser:
									getEnvNumber('SLUGS_LIMIT_MAX_SLUGS_PER_USER') ?? hostLimits.maxSlugsPerUser,
								requestsPerDay:
									getEnvNumber('SLUGS_LIMIT_REQUESTS_PER_DAY') ?? hostLimits.requestsPerDay,
								requestsPerMinute:
									getEnvNumber('SLUGS_LIMIT_REQUESTS_PER_MINUTE') ?? hostLimits.requestsPerMinute
							}
						},
						origin: hasOriginOverride ? getConfiguredOrigin() : settings.hosts[0].origin
					},
					...settings.hosts.slice(1)
				]
			: settings.hosts,
		smtp: {
			...settings.smtp,
			enabled: smtpEnabled ?? settings.smtp.enabled,
			from: getEnvString('SLUGS_SMTP_FROM') || settings.smtp.from,
			host: getEnvString('SLUGS_SMTP_HOST') || settings.smtp.host,
			pass: getEnvString('SLUGS_SMTP_PASS') || settings.smtp.pass,
			port: getEnvNumber('SLUGS_SMTP_PORT') ?? settings.smtp.port,
			secure: getEnvBoolean('SLUGS_SMTP_SECURE') ?? settings.smtp.secure,
			user: getEnvString('SLUGS_SMTP_USER') || settings.smtp.user
		}
	});
}

export const settings = new Settings();

function getEnvString(key: string) {
	const value = process.env[key]?.trim();
	return value ? value : undefined;
}

function getEnvBoolean(key: string) {
	const value = getEnvString(key)?.toLowerCase();
	if (value === undefined) return undefined;
	if (['1', 'true', 'yes', 'on'].includes(value)) return true;
	if (['0', 'false', 'no', 'off'].includes(value)) return false;
	return undefined;
}

function getEnvNumber(key: string) {
	const value = getEnvString(key);
	if (value === undefined) return undefined;
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
}
