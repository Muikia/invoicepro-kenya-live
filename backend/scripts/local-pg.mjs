import path from 'path';
import { fileURLToPath } from 'url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '.pglite');

const db = await PGlite.create({ dataDir });
console.log(await db.query('SELECT version()'));

const server = new PGLiteSocketServer({
  db,
  port: 5432,
  host: '127.0.0.1',
});

await server.start();
console.log('Local PGlite (Postgres-compatible) ready on 127.0.0.1:5432');

process.on('SIGINT', async () => {
  await server.stop();
  await db.close();
  process.exit(0);
});
