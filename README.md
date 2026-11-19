# Doctor Tracker

## Description

Doctor Tracker is a secure clinical administrative web application designed for hospital coordinators and medical directors to manage physicians, monitor their corresponding patient caseloads, and visualize operational intake trends in real time. The platform enforces route-level authentication, provides high-speed indexed search, multi-facet filtering, and server-side pagination across both doctor and patient directories, and surfaces pre-aggregated clinical analytics on an executive dashboard.

---

## Setup Guide

### Prerequisites

- Node.js 20+ (tested on Node 22)
- npm 10+

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

Key variables in `.env.example`:

- `PORT` — HTTP server port (defaults to `3000`)
- `AUTH_SECRET` — Secret key used for signing HMAC-SHA256 session tokens
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — Seeded administrator account credentials
- `DB_FILE_PATH` — Local persistent datastore path (defaults to `./data/doctor-tracker.json`)

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Unit Tests

```bash
npm test
```

### 4. Start the Application

Development mode (Express API + Vite middleware on port 3000):

```bash
npm run dev
```

Production build & start:

```bash
npm run build
npm start
```

Open `http://localhost:3000` in your browser and sign in using the seeded administrator credentials (`admin@doctortracker.org` / `Admin@1234`) or register a new coordinator account.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        React Client (src/)                           │
│  AuthContext ──► Layout Shell ──► Dashboard / Doctors / Patients     │
│       │                                      │                       │
│       └────────────── Bearer JWT + HttpOnly Cookie ──────────────────┤
└──────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼ RESTful JSON API (/api/*)
┌──────────────────────────────────────────────────────────────────────┐
│                   Express Backend (server.ts)                        │
│  requireAuth Middleware ──► /api/auth, /api/doctors, /api/patients,  │
│                             /api/analytics                           │
│                                      │                               │
│                                      ▼                               │
│               Indexed ClinicalDataStore (server/db/store.ts)         │
│  Secondary Indexes: email, specialization, hospital, doctorId,       │
│                     condition, status + Atomic Disk Persistence      │
└──────────────────────────────────────────────────────────────────────┘
```

1. **Client Layer (`src/`)**: Modular React + TypeScript components communicate exclusively through a typed REST client (`src/services/api.ts`). Searches are debounced (`220ms`) before issuing parameterized requests (`search`, `specialization`, `hospital`, `condition`, `status`, `dateFrom`, `dateTo`, `sortBy`, `sortOrder`, `page`, `limit`).
2. **Authentication & Authorization (`server/auth/`)**: Passwords are salted and hashed using `crypto.scryptSync` and verified via `crypto.timingSafeEqual`. Sessions issue HMAC-SHA256 signed JWT tokens stored both in an `HttpOnly` cookie and returned for `Authorization: Bearer` headers. Every `/api/doctors`, `/api/patients`, and `/api/analytics` endpoint passes through `requireAuth`.
3. **Indexed Repository & Analytics (`server/db/store.ts`)**: Maintains secondary lookup maps (`doctorEmailIdx`, `doctorSpecIdx`, `doctorHospitalIdx`, `patientDoctorIdx`, `patientConditionIdx`, `patientStatusIdx`) for sub-millisecond set intersection filtering, paginated slicing, referential cleanup on deletion, and server-side aggregation for dashboard charts.

---

## Technical Decisions

### 1. Secondary-Indexed Repository & Server-Side Aggregation vs. Client-Side Full-Scan Filtering

Instead of fetching full doctor and patient collections to the browser and filtering in React state, all searching, multi-facet filtering (`specialization`, `hospital`, `condition`, `status`, `dateFrom`/`dateTo`), sorting, and pagination run on the Express backend against explicit secondary indexes (`Map<string, Set<string>>`). When filtering by specialization or condition, the store intersects candidate ID sets before applying substring/date checks and slicing the requested page. Similarly, `GET /api/analytics` computes KPIs, `patientsPerDoctor`, `dateSeries`, and condition breakdowns server-side so the dashboard receives compact summary payloads rather than raw records.

### 2. Stateless HMAC-SHA256 Token Auth with Scrypt Hashing vs. Heavy External Auth Dependencies

To keep authentication self-contained, auditable, and zero-dependency, `server/auth/crypto.ts` implements `crypto.scryptSync` (64-byte derived key with 16-byte random salt) paired with `crypto.timingSafeEqual` and HMAC-SHA256 signed JWT tokens verified by `requireAuth` middleware. Supporting both `HttpOnly` cookies and `Authorization: Bearer` headers prevents unauthenticated access across every protected portal route while eliminating external session-store latency or third-party auth lock-in.

---

## Visual Evidence

The portal includes responsive **Desktop (1440×900)** and **Mobile (390×844)** layouts across:
- Administrator Sign-In & Registration portal
- Executive Dashboard (4 KPI cards, Date-Based Intake & Onboarding line chart, Patients per Doctor bar chart, Condition & Status breakdowns)
- Doctors Directory with Search, Date/Specialty/Hospital Filters, Pagination, and Slide-Over Doctor Caseload Drawer
- Dedicated Patients Page with Multi-Facet Filters, Inline Edit Modal, Delete Confirmation, and CSV Export
