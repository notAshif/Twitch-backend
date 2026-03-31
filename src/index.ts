import { createApp } from './app.ts';
import { config } from './config/env.ts';
import {prisma} from './db/prisma.ts';

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected');

    const app = createApp();

    app.listen(config.port, () => {
      console.log(`Server running on http://localhost:${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

main();
