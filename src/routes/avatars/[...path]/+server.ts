import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('config/avatars');

export const GET = async ({ params: { path: file } }) => {
	const filepath = path.resolve(root, file);

	if (!filepath.startsWith(root + path.sep) || !fs.existsSync(filepath)) {
		return new Response('Not found', { status: 404 });
	}

	const stream = fs.readFileSync(filepath);
	return new Response(stream, {
		headers: {
			'Cache-Control': 'public, max-age=3600',
			'Content-Type': 'image/webp'
		},
		status: 200
	});
};
