import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
const client = postgres(process.env['DATABASE_URL'] ?? '', { max: 1 });
const db = drizzle(client);
console.log('Running sae-api migrations...');
await migrate(db, { migrationsFolder: 'src/db/migrations' });
console.log('Migrations complete.');
await client.end();
//# sourceMappingURL=migrate.js.map