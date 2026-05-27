# MAGED GROUP — Complete Deployment Guide

## Overview

This guide covers deploying the MAGED GROUP ERP system with:
- **Frontend**: Vercel (free tier)
- **Backend**: Railway ($5/month)
- **Database**: Railway MySQL or Aiven MySQL (free tier)
- **Images**: Cloudinary (free tier — 25GB bandwidth/month)

---

## Step 1: Database Setup

### Option A: Railway MySQL (Recommended — Easiest)

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project** → **Provision MySQL**
3. Click on the MySQL service → **Variables** tab
4. Copy `DATABASE_URL` — it will look like:
   ```
   mysql://root:PASSWORD@HOST:PORT/railway
   ```
5. You'll use this URL in Step 3

### Option B: Aiven MySQL (Free Tier — 1GB)

1. Go to [aiven.io](https://aiven.io) and create account
2. Create a **MySQL** service (free tier)
3. From the service overview, copy the connection details
4. Format as: `mysql://USER:PASS@HOST:PORT/DATABASE?ssl-mode=REQUIRED`

### Option C: PlanetScale (Paid — $39/month)

1. Go to [planetscale.com](https://planetscale.com) and create account
2. Create a new database
3. Go to **Connect** → select **Prisma** → copy the URL
4. Format includes `?sslaccept=strict`

---

## Step 2: Cloudinary Setup

1. Go to [cloudinary.com](https://cloudinary.com) and create free account
2. From Dashboard, note down:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
3. Create a folder called `MAGED-group` (optional, auto-created on first upload)

---

## Step 3: Deploy Backend to Railway

### 3.1 Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Select **Deploy from GitHub repo** → connect your GitHub
3. Select the repository and set **Root Directory** to `backend`

### 3.2 Set Environment Variables

In Railway dashboard → your service → **Variables** tab, add ALL of these:

```env
NODE_ENV=production
PORT=5000

# Database (from Step 1)
DATABASE_URL=mysql://root:PASSWORD@HOST:PORT/railway

# Auth — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=YOUR_GENERATED_64_CHAR_SECRET
JWT_EXPIRES_IN=7d

# Frontend URL (update after Vercel deployment)
FRONTEND_URL=https://your-app.vercel.app

# Cloudinary (from Step 2)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_FOLDER=MAGED-group

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
RATE_LIMIT_LOGIN_MAX=10

# Puppeteer (for PDF generation)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
```

### 3.3 Deploy Settings

In Railway → **Settings**:
- **Build Command**: `npm install && npx prisma generate`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

### 3.4 Push Database Schema

After the first deployment, open Railway CLI or use the shell:

```bash
# In Railway shell (or locally with DATABASE_URL set):
npx prisma db push
```

### 3.5 Seed Admin User

```bash
node src/utils/seed.js
```

### 3.6 Note Your Backend URL

Railway will give you a URL like:
```
https://MAGED-group-backend-production.up.railway.app
```

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Create Vercel Project

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Framework: **Vite**

### 4.2 Set Environment Variables

In Vercel → **Settings** → **Environment Variables**:

```env
VITE_API_URL=https://your-railway-backend.up.railway.app/api
VITE_APP_NAME=MAGED GROUP
```

### 4.3 Build Settings

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4.4 Deploy

Click **Deploy**. Vercel will build and deploy automatically.

### 4.5 Note Your Frontend URL

Vercel will give you a URL like:
```
https://MAGED-group.vercel.app
```

---

## Step 5: Update CORS

Go back to Railway → your backend service → **Variables**:

Update `FRONTEND_URL` with your actual Vercel URL:
```
FRONTEND_URL=https://MAGED-group.vercel.app
```

Railway will auto-redeploy.

---

## Step 6: Post-Deployment Checklist

### Health Check
```bash
curl https://your-backend.up.railway.app/api/health
```
Expected: `{"success":true,"status":"healthy",...}`

### Admin Login
1. Open `https://MAGED-group.vercel.app/login`
2. Login with: `admin@MAGED.com` / `admin123`
3. **IMPORTANT**: Change the admin password immediately!

### Test Order Flow
1. Create a test order from the public page
2. Accept it from admin dashboard
3. Verify stock deduction
4. Generate PDF invoice

### Test Image Upload
1. Create a company with a logo
2. Verify logo appears from Cloudinary URL

---

## Step 7: Custom Domain (Optional)

### Vercel (Frontend)
1. Go to Vercel → **Settings** → **Domains**
2. Add your domain (e.g., `MAGED-group.com`)
3. Update DNS records as instructed by Vercel

### Railway (Backend)
1. Go to Railway → your service → **Settings** → **Networking**
2. Add custom domain (e.g., `api.MAGED-group.com`)
3. Update DNS records
4. Update `FRONTEND_URL` and `VITE_API_URL` accordingly

---

## Environment Variables Reference

### Backend (Railway)

| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | Yes | `5000` |
| `DATABASE_URL` | Yes | `mysql://...` |
| `JWT_SECRET` | Yes | 64-char random string |
| `JWT_EXPIRES_IN` | No | `7d` |
| `FRONTEND_URL` | Yes | `https://app.vercel.app` |
| `CLOUDINARY_CLOUD_NAME` | Yes | `your-cloud-name` |
| `CLOUDINARY_API_KEY` | Yes | `123456789` |
| `CLOUDINARY_API_SECRET` | Yes | `abc123...` |
| `CLOUDINARY_FOLDER` | No | `MAGED-group` |
| `RATE_LIMIT_MAX` | No | `100` |
| `RATE_LIMIT_LOGIN_MAX` | No | `10` |
| `LOG_LEVEL` | No | `info` |

### Frontend (Vercel)

| Variable | Required | Example |
|----------|----------|---------|
| `VITE_API_URL` | Yes | `https://backend.railway.app/api` |
| `VITE_APP_NAME` | No | `MAGED GROUP` |

---

## Prisma Commands Reference

```bash
# Generate Prisma client (run after schema changes)
npx prisma generate

# Push schema to database (PlanetScale/Railway - no migrations)
npx prisma db push

# Create migration (traditional MySQL only)
npx prisma migrate dev --name description

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (DANGER: deletes all data)
npx prisma db push --force-reset
```

---

## Backup Commands

```bash
# Export all data to JSON
npm run backup:export

# List available backups
npm run backup:list

# Restore from a specific backup
npm run backup:restore -- backup-2024-01-15T10-30-00
```

---

## Troubleshooting

### "Cannot connect to database"
- Check `DATABASE_URL` format
- Ensure SSL is enabled for cloud databases
- Check if database service is running

### "CORS error"
- Verify `FRONTEND_URL` matches exactly (no trailing slash)
- Check browser console for the exact origin being blocked

### "PDF generation fails on Railway"
- Use the Dockerfile deployment (includes Chromium)
- Or set `PUPPETEER_EXECUTABLE_PATH` correctly

### "Rate limit hit"
- Wait 15 minutes
- Or increase `RATE_LIMIT_MAX` in Railway variables

### "Cloudinary upload fails"
- Verify all 3 Cloudinary credentials are set
- Check Cloudinary free tier limits
- System falls back to local storage if Cloudinary is down
