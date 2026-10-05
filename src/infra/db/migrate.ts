import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const client = postgres(process.env.DATABASE_URL ?? '', { max: 1 });
const db = drizzle(client);

console.log('Running sae-api migrations...');
await migrate(db, { migrationsFolder: 'src/infra/db/migrations' });
console.log('Migrations complete.');

await client.end();
