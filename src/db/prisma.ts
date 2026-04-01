import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../../generated/prisma/client.js';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db';
const dbPath = databaseUrl.replace(/^file:/, '');
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);

console.log(`[DIAGNOSTIC] Resolving database at: ${absoluteDbPath}`);

const adapter = new PrismaLibSql({ url: `file:${absoluteDbPath}` });
const prisma = new PrismaClient({ adapter } as any);

export { prisma };
export default prisma;
