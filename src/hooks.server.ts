import 'dotenv/config';
import { sequence } from '@sveltejs/kit/hooks';
import { roles } from '$lib/auth/permissions';
import { getBetterAuth } from '$lib/auth/server';
import { CONSTANTS } from '$lib/server/const';
import { db } from '$lib/server/db';
import dbHandle from '$lib/server/db/db-handle';
import { checkDatabaseConnection } from '$lib/server/db/health';
import { member, organization, organizationRole, user as userTable } from '$lib/server/db/schema';
import betterAuthHandle, { handle2fa } from '$lib/server/handles/better-auth.handle';
import paraglideHandle from '$lib/server/handles/paraglide.handle';
import { ensureMaxmindDatabase } from '$lib/server/maxmind/update';
import { settings } from '$lib/server/settings';
import { slugify } from '$lib/utils';
import { generateId } from 'better-auth';
import { generateRandomString } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

export const _uptime = new Date().toISOString();
export const handle = sequence(paraglideHandle, dbHandle, betterAuthHandle, handle2fa);

export const _checkDB = async (): Promise<boolean> => {
	const database = await checkDatabaseConnection();
	if (database.status === 'down' && CONSTANTS.DEBUG) {
		console.error('[db] health check failed:', database.error);
	}
	return database.status === 'up';
};

export const init = async () => {
	if (!CONSTANTS.DATABASE_URL) {
		console.error('[init] DATABASE_URL is not configured; starting in degraded mode');
		return;
	}

	if (!(await _checkDB())) {
		console.error('[ERROR]: DB Connection required to initialize app');
		console.error('[init] Starting in degraded mode; health check will report database down');
		return;
	}

	console.log('[init] DB: Running migrations...');
	console.time('[init] Migrations...');
	try {
		execFileSync(process.execPath, ['./node_modules/drizzle-kit/bin.cjs', 'migrate'], {
			stdio: 'inherit'
		});
	} catch (error) {
		console.error('[init] Migrations failed; starting in degraded mode');
		if (CONSTANTS.DEBUG) console.error(error);
		console.timeEnd('[init] Migrations...');
		return;
	}
	console.timeEnd('[init] Migrations...');

	if (!fs.existsSync('config/custom.css')) {
		fs.writeFileSync(
			'config/custom.css',
			'/* Add custom styles for this Slugs instance. */'
		);
	}

	try {
		await ensureMaxmindDatabase();
	} catch (error) {
		console.error('[init] MaxMind GeoLite2 City download failed');
		if (CONSTANTS.DEBUG) console.error(error);
	}

	const config = settings.get();
	const host = config.hosts[0]!;
	const auth = await getBetterAuth(host);
	const bootstrapPassword = getBootstrapAdminPassword();
	const shouldResetBootstrapPassword = getEnvBoolean('SLUGS_BOOTSTRAP_ADMIN_RESET');

	for (const { email, username } of config.admin) {
		const password = bootstrapPassword || generateRandomString(12);
		try {
			const exists = await db.query.user.findFirst({
				where: { OR: [{ email }, { username }] }
			});
			if (exists) {
				await db
					.update(userTable)
					.set({
						emailVerified: true,
						role: 'admin',
						updatedAt: new Date(),
						username: exists.username || username
					})
					.where(eq(userTable.id, exists.id));

				if (bootstrapPassword && shouldResetBootstrapPassword) {
					await resetCredentialPassword(auth, exists.id, bootstrapPassword);
					console.log('[auth] reset bootstrap admin password for %s', username);
				}
				continue;
			}

			await auth.api.createUser({
				body: {
					data: { emailVerified: true, username },
					email,
					name: username,
					password,
					role: 'admin'
				}
			});
			if (bootstrapPassword) {
				console.log('[auth] created bootstrap admin %s from environment password', username);
			} else {
				console.log('[auth] generated admin %s \nPassword: %s', username, password);
			}
		} catch (e) {
			if (CONSTANTS.DEBUG) console.error(e);
		}
	}

	const admin = await db.query.user.findMany({ where: { role: 'admin' } });

	await Promise.all(
		config.hosts.map(async (h) => {
			const slug = slugify(h.origin);
			let org = await db.query.organization.findFirst({ where: { id: slug } });

			if (!org) {
				[org] = await db
					.insert(organization)
					.values({
						createdAt: new Date(),
						id: slug,
						metadata: JSON.stringify({ origin: h.origin }),
						name: h.origin,
						slug
					})
					.returning();
				console.log('[init] created organization %s', org?.name);
			}

			if (!org?.id) return;

			for (const a of admin) {
				const m = await db.query.member.findFirst({
					where: { organizationId: org.id, userId: a.id }
				});
				if (!m) {
					await db.insert(member).values({
						createdAt: new Date(),
						id: generateId(24),
						organizationId: org.id,
						role: 'owner',
						userId: a.id
					});
					console.log('[init] added admin %s to organization %s', a.username, org.name);
				}
			}

			for (const [r, statements] of Object.entries(roles)) {
				const exists = await db.query.organizationRole.findFirst({
					where: { organizationId: org.id, role: r }
				});
				if (!exists) {
					await db.insert(organizationRole).values({
						id: generateId(24),
						organizationId: org.id,
						permission: JSON.stringify(statements.statements),
						role: r
					});
				}
			}
		})
	);
};

export const handleError = ({ error }) => {
	console.log(error);
};

type BetterAuthContext = {
	internalAdapter: {
		deleteSessions?: (userId: string) => Promise<unknown>;
		findAccounts: (
			userId: string
		) => Promise<Array<{ id: string; password?: string | null; providerId: string }>>;
		linkAccount: (payload: {
			accountId: string;
			password: string;
			providerId: string;
			userId: string;
		}) => Promise<unknown>;
		updatePassword: (userId: string, password: string) => Promise<unknown>;
	};
	password: {
		hash: (password: string) => Promise<string>;
	};
};

async function resetCredentialPassword(auth: unknown, userId: string, password: string) {
	const context = await (auth as { $context?: Promise<BetterAuthContext> }).$context;
	if (!context?.password?.hash || !context.internalAdapter?.updatePassword) {
		throw new Error('Better Auth password context is unavailable');
	}

	const hashedPassword = await context.password.hash(password);
	const credentialAccount = (await context.internalAdapter.findAccounts(userId)).find(
		(account) => account.providerId === 'credential'
	);

	if (credentialAccount) {
		await context.internalAdapter.updatePassword(userId, hashedPassword);
	} else {
		await context.internalAdapter.linkAccount({
			accountId: userId,
			password: hashedPassword,
			providerId: 'credential',
			userId
		});
	}

	await context.internalAdapter.deleteSessions?.(userId);
}

function getBootstrapAdminPassword() {
	return getEnvString('SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD');
}

function getEnvString(key: string) {
	const value = process.env[key]?.trim();
	return value ? value : undefined;
}

function getEnvBoolean(key: string) {
	const value = getEnvString(key)?.toLowerCase();
	if (value === undefined) return false;
	return ['1', 'true', 'yes', 'on'].includes(value);
}
