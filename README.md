# 🧵 Artisan Connect AI

### AI-Assisted Digital Commerce and Workshop Management for Indian Artisans

**Artisan Connect AI** is a dual-application web platform built to bridge the digital divide for traditional and rural Indian artisans. It combines a customer-facing marketplace with an artisan-facing business management assistant featuring bilingual voice-assisted product listing, customer enquiry negotiation, production tracking, and craft analytics.

---

## 📌 Problem Statement

Traditional Indian artisans possess generational craft skills but face steep systemic barriers when attempting to sell online:
- **Digital Literacy & Language Barriers:** Most e-commerce portals require English-only text input, complex product cataloguing forms, and intricate merchant dashboards.
- **Listing & Pricing Friction:** Artisans struggle to write structured English descriptions or gauge suitable market pricing from unstandardized handmade items.
- **Communication & Negotiation Gaps:** Handcrafted products frequently involve bulk orders, custom dimensions, or ceremonial timelines that require two-way price negotiation, which rigid cart-and-checkout systems do not accommodate.
- **Logistics & Order Tracking:** Lack of structured workshop production stages and simple dispatch recording leads to delivery misunderstandings.

---

## 🎯 Objectives & Proposed Solution

Artisan Connect AI addresses these challenges with two complementary applications sharing a unified, secure database:

1. **Customer Marketplace (`frontend/`):** A responsive e-commerce storefront where buyers discover authentic crafts, inspect verified artisan credentials, submit bulk enquiries with proposed budgets, negotiate prices directly, and track orders.
2. **Artisan Assistant (`artisan-assistant/`):** A mobile-first workshop assistant offering local-language (Kannada & English) voice input, rule-based product fact extraction, order production stage checklists, carrier dispatch logging, and performance analytics.
3. **Machine Learning Pipeline (`ml/`):** An audited classification and price estimation benchmark for categorizing Indian crafts and suggesting baseline pricing.

---

## 🏗️ Technical Architecture

```
                    ┌───────────────────────────────────────────┐
                    │            Artisan Connect AI             │
                    └─────────────────────┬─────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
       ┌─────────────────────┐                         ┌─────────────────────┐
       │ Customer Marketplace│                         │  Artisan Assistant  │
       │     (frontend/)     │                         │ (artisan-assistant/)│
       │    Port 5173        │                         │    Port 5174        │
       └──────────┬──────────┘                         └──────────┬──────────┘
                  │                                               │
                  │   Enquiries, Orders, Reviews, Profiles        │
                  └───────────────────────┬───────────────────────┘
                                          ▼
                         ┌─────────────────────────────────┐
                         │       Supabase Backend          │
                         │  - PostgreSQL + Row Level Sec.  │
                         │  - GoTrue Auth (Session tokens) │
                         │  - Storage (Images, Documents)  │
                         │  - Deno Edge Functions (NLP)    │
                         └─────────────────────────────────┘
                                          │
                                          ▼
                         ┌─────────────────────────────────┐
                         │       ML Benchmark (ml/)        │
                         │  - TF-IDF + Logistic Regression │
                         │  - Price Regression (RF / Ridge)│
                         └─────────────────────────────────┘
```

---

## 💻 Technologies Actually Used

- **Frontend & UI Frameworks:**
  - React 18 / 19
  - Vite (Rolldown / ESBuild)
  - TailwindCSS (Marketplace)
  - Pure Semantic CSS + CSS Variables (Artisan Assistant, Light/Dark theme support)
  - Native SVG Data Visualizations (No bloated charting dependencies)
- **Backend & Database:**
  - Supabase PostgreSQL (Postgres 15+)
  - Supabase Row Level Security (RLS) policies for customer/artisan data separation
  - Supabase Storage Buckets (`product-images`, `artisan-verification`, `review-photos`)
  - Supabase GoTrue Authentication (Email/Password, Session Tokens, Artisan Application IDs)
- **Local Voice & Natural Language Processing:**
  - Browser Web Speech Recognition API (`webkitSpeechRecognition` / `SpeechRecognition`)
  - Local deterministic Kannada NLP engine (`kannadaProductEngine.js`) for keyword, material, price, and numeral extraction
  - Browser Speech Synthesis API (`window.speechSynthesis`) for bilingual review playback
- **Machine Learning & Data Science:**
  - Python 3.14 (Virtual Environment in `.venv/`)
  - Scikit-Learn (TF-IDF Vectorizer, Logistic Regression, Decision Trees, Random Forest, AdaBoost, Ridge)
  - Pandas & NumPy for dataset preparation and verification
  - Pytest for dataset validation and training rule enforcement

---

## 📦 Main Application Modules

| Module | Directory | Purpose | Key Routes / Entrypoints |
| :--- | :--- | :--- | :--- |
| **Customer Marketplace** | `frontend/` | Public browsing, product details, bulk enquiry submission, buyer profile, order history | `/`, `/explore`, `/product/:id`, `/profile`, `/checkout` |
| **Artisan Assistant** | `artisan-assistant/` | Artisan workshop hub, voice listing creation, enquiry negotiation, order stages, reviews, analytics | `/`, `/whatsapp`, `/my-products`, `/my-orders`, `/customer-feedback`, `/product-performance` |
| **Machine Learning** | `ml/` | Product classification and price regression benchmarks, dataset audit tools | `ml/benchmark_models.py`, `ml/train.py`, `ml/audit_dataset.py` |
| **Database Migrations** | `supabase/migrations/` | Versioned SQL schemas, constraints, RLS policies | `20261001000000_*.sql` to `20261106000000_*.sql` |

---

## ⚙️ Installation & Setup

### Prerequisites
- **Node.js:** v18.x or v20.x recommended
- **npm:** v9.x or v10.x
- **Python:** v3.10+ (for ML scripts in `ml/`)
- **Git**

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/ashwithkumar404-glitch/artisan-connect-ai.git
cd artisan-connect-ai

# Install root dependencies
npm install

# Install Artisan Assistant dependencies
npm install --prefix artisan-assistant

# Install Customer Marketplace dependencies
npm install --prefix frontend
```

### 2. Environment Configuration
Copy `.env.example` in both applications and populate your Supabase URL and Anon Key:

```bash
# In artisan-assistant/.env.local:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MARKETPLACE_URL=http://localhost:5173

# In frontend/.env.local:
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> **Security Note:** Never commit `.env` or `.env.local` files, service-role keys, or private tokens to Git.

---

## 🚀 Running the Applications

You can start both applications independently or run both in separate terminals:

```bash
# Terminal 1: Run Customer Marketplace (Port 5173)
npm run dev:marketplace
# URL: http://localhost:5173

# Terminal 2: Run Artisan Assistant (Port 5174)
npm run dev:artisan
# URL: http://localhost:5174
```

---

## 🧪 Running Automated Tests & Production Builds

### 1. Artisan Assistant Tests (Node Test Runner)
```bash
npm test --prefix artisan-assistant
```
*Current result: 124 passed across 15 test suites.*

### 2. Machine Learning Tests (Pytest)
```bash
cd ml
..\.venv\Scripts\python.exe -m pytest tests -v
```
*Current result: 34 passed across 4 test suites.*

### 3. Production Builds
```bash
# Build Artisan Assistant
npm run build:artisan

# Build Customer Marketplace
npm run build:marketplace
```

### 4. Running ML Model Benchmarking
```bash
cd ml
..\.venv\Scripts\python.exe benchmark_models.py
```
*Evaluates 5 classification models and 4 regression models, outputs `ml/evaluation_report.json`, and serializes the best models to `ml/model/`.*

---

## 📊 Current Implementation Status

For a full breakdown of completed features, limitations, and future work, see:
- [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) — Comprehensive functional and technical workflow documentation.
- [`ML_PERFORMANCE_REPORT.md`](./ML_PERFORMANCE_REPORT.md) — Genuine machine learning benchmark metrics and experimental disclaimers.
- [`TESTING_AND_VALIDATION.md`](./TESTING_AND_VALIDATION.md) — Verified test results, bundle diagnostics, and known limitations.
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — Current implementation milestones, items needing validation, and roadmap.
