/**
 * MAGEED GROUP — Seed Script (Root-level wrapper)
 *
 * This file delegates to the proper seed script that uses the
 * singleton PrismaClient. DO NOT create new PrismaClient() here.
 *
 * Usage: node seed.js
 * Preferred: node src/utils/seed.js
 */

require('./src/utils/seed');
