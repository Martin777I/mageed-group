# MAGEED GROUP — Backup Strategy Guide

## Backup Layers

### Layer 1: Cloud Database Auto-Backups

#### Railway MySQL
- **Automatic**: Railway takes daily snapshots
- **Retention**: 7 days on paid plans
- **Restore**: Contact Railway support or use their dashboard

#### Aiven MySQL
- **Automatic**: Continuous backups with PITR (Point-in-Time Recovery)
- **Retention**: Depends on plan
- **Restore**: From Aiven dashboard → Backups

#### PlanetScale
- **Automatic**: Continuous backups
- **Restore**: Branch-based restore from dashboard

### Layer 2: Application-Level Backups

Use the built-in backup utility for JSON exports:

```bash
# Export all data
npm run backup:export

# This creates: backups/backup-YYYY-MM-DDTHH-MM-SS/
# Contains one JSON file per table + summary
```

### Layer 3: Manual Database Dumps

```bash
# Using mysqldump (if you have MySQL client installed)
mysqldump -h HOST -P PORT -u USER -p DATABASE > backup.sql

# Restore
mysql -h HOST -P PORT -u USER -p DATABASE < backup.sql
```

---

## Recommended Backup Schedule

| Frequency | Method | Tool |
|-----------|--------|------|
| Continuous | Auto-backup | Cloud provider (Railway/Aiven) |
| Daily | JSON export | `npm run backup:export` |
| Weekly | Download backups | Copy `backups/` folder to external storage |
| Monthly | Full mysqldump | Manual SQL dump to Google Drive / OneDrive |

---

## Restore Procedures

### From JSON Backup

```bash
# List available backups
npm run backup:list

# Restore (inserts data, skips duplicates)
npm run backup:restore -- backups/backup-2024-01-15T10-30-00
```

> **Warning**: Restore inserts data alongside existing records. For a clean restore, reset the database first with `npx prisma db push --force-reset`, then restore.

### From SQL Dump

```bash
# Reset database schema
npx prisma db push --force-reset

# Import SQL dump
mysql -h HOST -P PORT -u USER -p DATABASE < backup.sql

# Regenerate Prisma client
npx prisma generate
```

---

## Important Notes

1. **Always test restores** — A backup is only useful if you can restore from it
2. **Store backups externally** — Don't keep backups only on the same server
3. **Encrypt sensitive backups** — Customer data should be encrypted at rest
4. **Include Cloudinary** — Images are stored in Cloudinary, not in database backups
5. **Seed data** — After a full restore, you may need to re-seed the admin user
