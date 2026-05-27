<div align="center">

# 🏍️ MAGEED GROUP

### Motorcycle Spare Parts ERP System

**Full-stack inventory management, order processing, returns, analytics, and customer tracking.**

[![CI](https://github.com/YOUR_USERNAME/mageed-group/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/mageed-group/actions)
![Node](https://img.shields.io/badge/Node.js-≥18-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red)

</div>

---

## 📋 Overview

MAGEED GROUP is a production-ready ERP system designed for motorcycle spare parts businesses. Built with a modern Arabic-first RTL interface, it provides complete business management from inventory tracking to customer analytics.

## ✨ Features

### 🏪 Inventory Management
- Full product CRUD with category/company organization
- Real-time stock tracking with low-stock alerts
- Excel import with 4 modes: Create Only, Update Only, Create+Update, Validate Only
- 3 stock behaviors: Replace, Add, Subtract
- Import history with detailed validation logs

### 📦 Order System
- Customer-facing order form (no login required)
- Auto-generated sequential order numbers (`ORD-20260527-0001`)
- Admin review workflow: Pending → Accept / Reject
- Atomic stock deduction with idempotency guards
- PDF invoice generation with Arabic support

### ↩️ Returns System
- Multi-step return wizard (search → select order → pick items → confirm)
- Quantity validation against already-returned amounts
- Atomic stock restoration
- Return number tracking (`RET-20260527-0001`)

### 👥 Customer Management
- Auto-generated unique customer codes (`CUS-0001`)
- Race condition-safe code generation (3-retry loop)
- Order history per customer
- Phone/code search

### 🏢 Company Management
- Company profiles with logo upload (Cloudinary)
- Company name deduplication (normalized matching)
- Soft-delete with product reassignment

### 📊 Analytics Dashboard
- Revenue, orders, products, customers KPIs
- Monthly revenue trend charts
- Top-selling products
- Sales by category breakdown
- Low stock and out-of-stock alerts

### 🔐 Security
- JWT authentication with token expiry handling
- Helmet security headers
- Rate limiting (global + login-specific)
- CORS with strict origin allowlist
- Audit logging for all critical operations
- Input validation and sanitization

### 🌐 Deployment Ready
- Railway backend (Docker or Nixpacks)
- Vercel frontend (auto-deploy from Git)
- Cloudinary image hosting
- MySQL cloud databases (Railway, Aiven, PlanetScale)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TailwindCSS, Recharts, Axios |
| **Backend** | Express.js, Prisma ORM, Winston Logger |
| **Database** | MySQL 8 (PlanetScale-compatible) |
| **Auth** | JWT (jsonwebtoken + bcryptjs) |
| **Storage** | Cloudinary (images), Multer (uploads) |
| **PDF** | PDFKit + Puppeteer (Arabic support) |
| **Import** | xlsx library (Excel parsing) |
| **CI/CD** | GitHub Actions, Railway, Vercel |

---

## 📂 Project Structure

```
mageed-group/
├── .github/workflows/     # CI/CD pipelines
│   └── ci.yml             # Build + security checks
├── backend/
│   ├── prisma/
│   │   └── schema.prisma  # Database schema (9 models)
│   ├── src/
│   │   ├── config/        # Config, Prisma singleton, Logger
│   │   ├── controllers/   # Auth, Products, Orders, Companies, Customers, Returns, Health
│   │   ├── middleware/     # Auth, Security, Upload, Error handler, Request logger
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # Cloudinary service
│   │   ├── utils/         # Import, Inventory, Returns, Customer, Audit, Backup, PDF
│   │   ├── fonts/         # Arabic font (Cairo.ttf)
│   │   └── index.js       # Server entry point
│   ├── Dockerfile         # Multi-stage Docker build
│   ├── nixpacks.toml      # Railway Nixpacks config
│   ├── railway.json       # Railway deployment config
│   └── .env.example       # Environment template
├── frontend/
│   ├── src/
│   │   ├── api/           # Axios client with interceptors
│   │   ├── components/    # Layout, Modal, Sidebar, Navbar, LoadingSpinner
│   │   ├── context/       # Auth context
│   │   ├── pages/         # 13 pages (Dashboard, Products, Orders, Returns, etc.)
│   │   └── utils/         # Formatting helpers
│   ├── vercel.json        # Vercel config with SPA rewrites
│   └── .env.example       # Environment template
├── docs/
│   ├── DEPLOYMENT.md      # Step-by-step deployment guide
│   └── backup-guide.md    # Backup & restore guide
├── .gitignore             # Comprehensive ignore rules
└── README.md              # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **MySQL** 8.x (local or cloud)
- **Git**

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/mageed-group.git
cd mageed-group

# Install all dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 2. Database Setup

```bash
cd backend

# Copy environment template
cp .env.example .env
# Edit .env with your MySQL connection string and JWT secret

# Push schema to database
npx prisma db push

# Seed admin user + sample products
npm run seed
```

### 3. Start Development

```bash
# Terminal 1 — Backend (port 5000)
cd backend && npm run dev

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

### 4. Access the App

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Frontend (admin dashboard) |
| `http://localhost:5173/login` | Admin login |
| `http://localhost:5173/order/:customerId` | Customer order form |
| `http://localhost:5000/api/health` | Backend health check |

**Default Admin:** `admin@mageed.com` / `admin123`

> ⚠️ **Change the default password immediately after first login.**

---

## 🌐 Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the complete step-by-step guide.

### Quick Deploy Summary

| Component | Platform | Docs |
|-----------|----------|------|
| Backend | Railway | [Step 3](docs/DEPLOYMENT.md#step-3-deploy-backend-to-railway) |
| Frontend | Vercel | [Step 4](docs/DEPLOYMENT.md#step-4-deploy-frontend-to-vercel) |
| Database | Railway MySQL | [Step 1](docs/DEPLOYMENT.md#step-1-database-setup) |
| Images | Cloudinary | [Step 2](docs/DEPLOYMENT.md#step-2-cloudinary-setup) |

---

## ⚙️ Environment Variables

### Backend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | — | MySQL connection string |
| `JWT_SECRET` | ✅ | — | Auth token signing key |
| `PORT` | No | `5000` | Server port |
| `FRONTEND_URL` | Prod | `localhost:5173` | CORS origin |
| `CLOUDINARY_CLOUD_NAME` | No | — | Image hosting |
| `CLOUDINARY_API_KEY` | No | — | Image hosting |
| `CLOUDINARY_API_SECRET` | No | — | Image hosting |

### Frontend

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Prod | `/api` | Backend API URL |
| `VITE_APP_NAME` | No | `MAGEED GROUP` | App display name |

---

## 📦 NPM Scripts

### Backend (`cd backend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with hot-reload (nodemon) |
| `npm start` | Start in production mode |
| `npm run seed` | Create admin user + sample data |
| `npm run backup:export` | Export database to JSON |
| `npm run backup:restore` | Restore from backup |
| `npm run backup:list` | List available backups |
| `npm run prisma:push` | Push schema to database |
| `npm run prisma:studio` | Open Prisma Studio GUI |
| `npm run prisma:generate` | Regenerate Prisma client |

### Frontend (`cd frontend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (port 5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |

---

## 🗄️ Database Schema

9 models with 23 indexes:

```
Admin        → Authentication
Product      → Inventory items (code, name, price, stock, category)
Company      → Product manufacturers (with logo)
Customer     → Buyers (auto-generated codes)
Order        → Purchase orders (status workflow)
OrderItem    → Order line items
Return       → Return transactions
ReturnItem   → Return line items
ImportLog    → Excel import audit trail
AuditLog     → Administrative action tracking
```

---

## 🔧 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| `POST` | `/api/auth/login` | No | Admin login |
| `GET` | `/api/auth/me` | Yes | Get current admin |
| `GET` | `/api/products` | Yes | List products |
| `POST` | `/api/products` | Yes | Create product |
| `PUT` | `/api/products/:id` | Yes | Update product |
| `DELETE` | `/api/products/:id` | Yes | Delete product |
| `POST` | `/api/products/import` | Yes | Excel import |
| `GET` | `/api/orders` | Yes | List orders |
| `POST` | `/api/orders` | No | Create order (public) |
| `PUT` | `/api/orders/:id/status` | Yes | Accept/reject |
| `GET` | `/api/orders/:id/invoice` | Yes | Generate PDF |
| `GET` | `/api/customers` | Yes | List customers |
| `GET` | `/api/companies` | Yes | List companies |
| `POST` | `/api/returns` | Yes | Create return |
| `GET` | `/api/health` | No | Health check |
| `GET` | `/api/health/detailed` | Yes | System status |
| `GET` | `/api/alerts/summary` | Yes | Dashboard alerts |
| `GET` | `/api/alerts/low-stock` | Yes | Low stock products |

---

## 🛡️ Security Features

- **Authentication:** JWT tokens with configurable expiry
- **Rate Limiting:** 100 req/15min (global), 10 req/15min (login)
- **Security Headers:** Helmet.js (CSP, XSS, HSTS, etc.)
- **CORS:** Strict origin allowlist with production enforcement
- **Input Validation:** Server-side validation on all endpoints
- **Audit Trail:** All admin actions logged to `AuditLog` table
- **Environment Safety:** Fail-fast on missing critical variables
- **Password Security:** bcrypt hashing with salt rounds

---

## 📄 License

Private — All rights reserved. MAGEED GROUP © 2024-2026.
