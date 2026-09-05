# Baba Sultan Restaurant ERP & AI Business Assistant

**Software development & copyright:** Space

**Product:** Baba Sultan Restaurant ERP  
**Release:** 1.0.1

A comprehensive, production-ready Restaurant Enterprise Resource Planning (ERP) platform with integrated AI Certified Public Accountant (CPA), Chief Financial Officer (CFO), and Operations Manager capabilities powered by Google Gemini, Firebase Firestore, Firebase Auth, Express, and React TypeScript.

---

## 1. Project Overview

This platform provides end-to-end management for multi-branch restaurant operations and enterprise financial control:
- **Point of Sale (POS)**: Fast order creation, tables management, held orders, receipt printing, and instant payment processing.
- **Inventory & Recipe Costing**: Automatic raw ingredient deductions based on product recipes upon order completion, purchase receiving, and stock movements.
- **Accounting & Financial Ledger**: Real-time balance sheets, profit & loss statements, accounts payable/receivable, expenses tracking, cash registers, and bank transaction logs.
- **Human Resources & Payroll**: Staff management, attendance tracking, role-based access control (RBAC), shift scheduling, and salary disbursements.
- **AI CPA & Financial Advisor**: Gemini-powered conversational CPA capable of analyzing live Firestore data and automatically executing financial transactions.
- **Operations & Multi-Branch Management**: Kitchen display systems (KDS), delivery driver logistics, branch isolation, customer CRM loyalty wallets, and reservation scheduling.

---

## 2. System Architecture & Data Flow

```text
React UI (Presentation Layer)
       │
   Context / State
       │
Controllers / Application Services
       │
Domain Entities / Services
       │
Repositories (Firestore / API)
       │
Trusted Financial Backend & Firebase SDK
       │
Cloud Firestore (Authoritative Source of Truth)
```

- **Authoritative Database**: Cloud Firestore is the primary single source of truth.
- **Local Storage**: Strictly reserved for temporary setup wizard draft state and client UI preferences.
- **Branch Isolation & RBAC**: Centralized role-based access control and branch verification across server handlers and security rules.

---

## 3. Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Motion, Lucide Icons, Recharts, jsPDF.
- **Backend & Server**: Node.js Express server (`server.ts`, `server/trustedFinancialBackend.ts`) bound to port 3000.
- **Database & Auth**: Firebase Firestore (with multi-tab offline persistence enabled) & Firebase Authentication.
- **AI Intelligence**: `@google/genai` (Gemini 3.6 Flash) via server-side API endpoints (`/api/ai-chat`).
- **Deployment**: Vite SPA + Express standalone server (`dist/server.cjs`).

---

## 4. Installation & Quick Start

Ensure Node.js 22+ is installed on your system.

```bash
# Clone the repository
git clone https://github.com/mukhtar199/BabaSultan-Restaurant.git
cd BabaSultan-Restaurant

# Install dependencies
npm install

# Run test suite
npm test

# Run linter
npm run lint

# Start local dev server
npm run dev
```

---

## 5. Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```env
# Server-Side Gemini API Key (Secret - MUST NOT be prefixed with VITE_)
GEMINI_API_KEY=your_server_side_gemini_api_key

# Client-Side Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Application Localization
VITE_DEFAULT_LANGUAGE=ar
VITE_ENABLE_RTL=true
```

---

## 6. Firebase & Security Rules

Firestore security rules (`firestore.rules`) enforce Role-Based Access Control (RBAC):
- **Unauthenticated / Anonymous Access**: Strictly blocked across all sensitive collections.
- **Financial & Payroll Collections** (`employees`, `salaries`, `expenses`, `purchases`, `bank_transactions`, `accounts`, `revenues`): Restricted to `Owner`, `Admin`, `Manager`, and `Accountant` roles.
- **Server-Authoritative Financial Ledger Operations**: Sensitive financial ledger writes execute via trusted server backend endpoints (`/api/*`).

Deploy Security Rules:
```bash
firebase deploy --only firestore:rules,storage
```

---

## 7. Build and Production Run

To compile client SPA assets and bundle the server:

```bash
# Build production bundle
npm run build

# Start production server
npm start
```

