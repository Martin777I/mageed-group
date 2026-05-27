/**
 * MAGED GROUP — Singleton PrismaClient
 * 
 * CRITICAL: This file must be the ONLY place PrismaClient is instantiated.
 * All other files must import from here: const prisma = require('../config/prisma');
 * 
 * Previously, the codebase had 7+ separate PrismaClient instances which
 * caused connection pool exhaustion and contributed to MySQL crashes.
 */

const { PrismaClient } = require('@prisma/client');
const config = require('./config');

let prisma;

if (config.isProd) {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
    errorFormat: 'minimal',
  });
} else {
  // In development, reuse client across hot reloads (nodemon)
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
      errorFormat: 'pretty',
    });

    // Log slow queries in development
    global.__prisma.$on('query', (e) => {
      if (e.duration > 500) {
        console.warn(`⚠️  Slow query (${e.duration}ms): ${e.query}`);
      }
    });
  }
  prisma = global.__prisma;
}

// ── Graceful shutdown ──
async function disconnectPrisma() {
  try {
    await prisma.$disconnect();
    console.log('📦 Prisma disconnected gracefully');
  } catch (err) {
    console.error('Failed to disconnect Prisma:', err);
  }
}

process.on('beforeExit', disconnectPrisma);

// ── Connection test utility ──
async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true, latency: null };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// Export the singleton
module.exports = prisma;
module.exports.disconnectPrisma = disconnectPrisma;
module.exports.testConnection = testConnection;
