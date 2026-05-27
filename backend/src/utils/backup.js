/**
 * MAGED GROUP — Database Backup Utility
 * Export and restore database data as JSON files.
 * 
 * Usage:
 *   node src/utils/backup.js export          → Export all tables to JSON
 *   node src/utils/backup.js restore <dir>   → Restore from a backup directory
 */

const path = require('path');
const fs = require('fs');

// Load config before anything else
require('../config/config');
const prisma = require('../config/prisma');

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Tables in dependency order (for restore)
const TABLES = [
  { name: 'admins', model: 'admin' },
  { name: 'companies', model: 'company' },
  { name: 'customers', model: 'customer' },
  { name: 'products', model: 'product' },
  { name: 'orders', model: 'order' },
  { name: 'orderItems', model: 'orderItem' },
  { name: 'returns', model: 'return' },
  { name: 'returnItems', model: 'returnItem' },
  { name: 'importLogs', model: 'importLog' },
  { name: 'auditLogs', model: 'auditLog' },
];

/**
 * Export all tables to JSON files
 */
async function exportData() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = path.join(BACKUP_DIR, `backup-${timestamp}`);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`\n📦 Starting backup to: ${dir}\n`);

  const summary = {};

  for (const table of TABLES) {
    try {
      const data = await prisma[table.model].findMany();
      const filePath = path.join(dir, `${table.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      summary[table.name] = data.length;
      console.log(`  ✅ ${table.name}: ${data.length} records`);
    } catch (err) {
      // Table might not exist yet (e.g., auditLogs)
      summary[table.name] = `ERROR: ${err.message}`;
      console.log(`  ⚠️  ${table.name}: ${err.message}`);
    }
  }

  // Write summary
  const summaryPath = path.join(dir, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    exportedAt: new Date().toISOString(),
    tables: summary,
  }, null, 2), 'utf-8');

  console.log(`\n✅ Backup complete! Directory: ${dir}`);
  console.log(`📋 Summary: ${summaryPath}\n`);

  return dir;
}

/**
 * Restore data from a backup directory
 */
async function restoreData(backupDir) {
  if (!fs.existsSync(backupDir)) {
    console.error(`❌ Backup directory not found: ${backupDir}`);
    process.exit(1);
  }

  console.log(`\n🔄 Starting restore from: ${backupDir}\n`);
  console.log('⚠️  WARNING: This will INSERT data into existing tables.');
  console.log('   Existing records with same IDs may cause conflicts.\n');

  for (const table of TABLES) {
    const filePath = path.join(backupDir, `${table.name}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⏭️  ${table.name}: No backup file found, skipping`);
      continue;
    }

    try {
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(rawData);

      if (!Array.isArray(data) || data.length === 0) {
        console.log(`  ⏭️  ${table.name}: Empty, skipping`);
        continue;
      }

      // Convert date strings back to Date objects
      const processedData = data.map(record => {
        const processed = { ...record };
        for (const [key, value] of Object.entries(processed)) {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            processed[key] = new Date(value);
          }
        }
        return processed;
      });

      // Use createMany for bulk insert (skip duplicates)
      const result = await prisma[table.model].createMany({
        data: processedData,
        skipDuplicates: true,
      });

      console.log(`  ✅ ${table.name}: ${result.count}/${data.length} records restored`);
    } catch (err) {
      console.error(`  ❌ ${table.name}: ${err.message}`);
    }
  }

  console.log('\n✅ Restore complete!\n');
}

/**
 * List available backups
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('\n📁 No backups directory found.\n');
    return;
  }

  const dirs = fs.readdirSync(BACKUP_DIR)
    .filter(d => d.startsWith('backup-'))
    .sort()
    .reverse();

  if (dirs.length === 0) {
    console.log('\n📁 No backups found.\n');
    return;
  }

  console.log(`\n📁 Available backups (${dirs.length}):\n`);

  for (const dir of dirs) {
    const summaryPath = path.join(BACKUP_DIR, dir, '_summary.json');
    let info = '';
    if (fs.existsSync(summaryPath)) {
      try {
        const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
        const totalRecords = Object.values(summary.tables)
          .filter(v => typeof v === 'number')
          .reduce((a, b) => a + b, 0);
        info = ` — ${totalRecords} total records, exported ${summary.exportedAt}`;
      } catch { /* ignore */ }
    }
    console.log(`  📦 ${dir}${info}`);
  }
  console.log('');
}

// ── CLI ──
if (require.main === module) {
  const action = process.argv[2];

  (async () => {
    try {
      switch (action) {
        case 'export':
          await exportData();
          break;
        case 'restore': {
          const dir = process.argv[3];
          if (!dir) {
            console.error('Usage: node src/utils/backup.js restore <backup-directory>');
            process.exit(1);
          }
          // Resolve relative paths
          const fullDir = path.isAbsolute(dir) ? dir : path.join(BACKUP_DIR, dir);
          await restoreData(fullDir);
          break;
        }
        case 'list':
          listBackups();
          break;
        default:
          console.log(`
MAGED GROUP — Backup Utility

Usage:
  node src/utils/backup.js export              Export all tables
  node src/utils/backup.js restore <dir>       Restore from backup
  node src/utils/backup.js list                List available backups
`);
      }
    } catch (err) {
      console.error('Backup error:', err);
    } finally {
      await prisma.$disconnect();
      process.exit(0);
    }
  })();
}

module.exports = { exportData, restoreData, listBackups };
