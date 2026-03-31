import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../../generated/prisma/client';
import path from 'path';

const databaseUrl = process.env.DATABASE_URL || 'file:./db/dev.db';
const dbPath = databaseUrl.replace(/^file:/, '');
const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter } as any);

export { prisma };
export default prisma;
