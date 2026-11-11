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

## 🤝 How a New Team Member Can Set Up Artisan Connect AI

Follow this step-by-step guide to clone, configure, run, and test the entire project locally.

### 1. Prerequisites
Ensure the following tools are installed on your workstation:
- **Node.js:** v18.x or v20.x LTS (compatible with React 19 and Vite 8)
- **npm:** v9.x or v10.x
- **Python:** v3.10, v3.11, v3.12, or v3.14 (with `pip` and `venv`)
- **Git**

---

### 2. Clone the Repository
```bash
git clone https://github.com/ashwithkumar404-glitch/artisan-connect-ai.git
cd artisan-connect-ai
```

---

### 3. Install Node.js Dependencies
The project is organized into two frontend applications sharing a common root workspace:

```bash
# 1. Install root workspace scripts
npm install

# 2. Install Artisan Assistant dependencies
npm install --prefix artisan-assistant

# 3. Install Customer Marketplace dependencies
npm install --prefix frontend
```

---

### 4. Setup Python Virtual Environment for ML
The machine learning suite (`ml/`) runs in an isolated Python virtual environment:

```bash
# 1. Create a virtual environment in the project root
python -m venv .venv

# 2. Activate the virtual environment:
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On macOS / Linux:
source .venv/bin/activate

# 3. Install verified machine learning dependencies
pip install -r ml/requirements.txt
```

---

### 5. Configure Environment Variables
Environment variable templates are provided at `.env.example` in the root, `artisan-assistant/`, and `frontend/`:

1. **Artisan Assistant (`artisan-assistant/.env.local`):**
   ```bash
   # Copy template
   cp artisan-assistant/.env.example artisan-assistant/.env.local
   # (On Windows PowerShell: copy artisan-assistant\.env.example artisan-assistant\.env.local)
   ```
   Populate with:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
   VITE_MARKETPLACE_URL=http://localhost:5173
   ```

2. **Customer Marketplace (`frontend/.env.local`):**
   ```bash
   # Copy template
   cp frontend/.env.example frontend/.env.local
   # (On Windows PowerShell: copy frontend\.env.example frontend\.env.local)
   ```
   Populate with:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-or-anon-key
   ```

> ⚠️ **Security Warning:** Never commit `.env` or `.env.local` files, service-role keys, or secrets to Git. Only `.env.example` templates should be committed.

---

### 6. Database Schema & Demo Data Setup (Supabase)
All persistent tables, RLS policies, and triggers are located in `supabase/migrations/`:
- If linking to a local Supabase instance or cloud project:
  - Run migrations in chronological order: `20261001000000_initial_baseline.sql` through `20261106000000_order_dispatch_and_demo_support.sql`.
- To seed realistic, isolated demo data flagged with `is_demo = true`:
  ```bash
  node scripts/seed_demo_data.js --sql
  ```
  *(Or execute `supabase/seed_demo_data.sql` directly in your Supabase SQL editor).*

---

### 7. Running the Applications Locally
Both applications run concurrently on dedicated Vite ports:

```bash
# Terminal 1 — Customer Marketplace (Port 5173):
npm run dev:marketplace
# Opens: http://localhost:5173

# Terminal 2 — Artisan Assistant (Port 5174):
npm run dev:artisan
# Opens: http://localhost:5174
```

| Application | Port | Role | Target User |
| :--- | :--- | :--- | :--- |
| **Customer Marketplace** | `5173` | Public craft discovery, bulk enquiries, reviews | Buyers & Collectors |
| **Artisan Assistant** | `5174` | Mobile workshop hub, voice listing, negotiation, order dispatch | Rural & Traditional Artisans |

---

### 8. Running Automated Test Suites & Builds
Ensure all tests pass before making new commits:

```bash
# 1. Artisan Assistant Test Suite (124 tests across 15 test files):
npm test --prefix artisan-assistant

# 2. Machine Learning Test Suite (34 tests across 4 suites):
cd ml
..\.venv\Scripts\python.exe -m pytest tests -v
# (or with venv active: pytest tests -v)

# 3. ML Model Benchmarking (trains baseline and advanced models, exports metrics):
cd ml
..\.venv\Scripts\python.exe benchmark_models.py

# 4. Production Bundle Builds (verifies both apps build without syntax or Vite errors):
npm run build
```

---

## 📊 Project Documentation & Audit Reports

For detailed deep-dives into application workflows, architecture, and evaluations:
- [`ARTISAN_ASSISTANT_AUDIT.md`](./ARTISAN_ASSISTANT_AUDIT.md) — Comprehensive technical audit of the Artisan Assistant, voice engine, and WhatsApp assistant.
- [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) — Complete end-to-end architecture, database schema, and workflow specification.
- [`ML_PERFORMANCE_REPORT.md`](./ML_PERFORMANCE_REPORT.md) — Genuine machine learning benchmarks and model evaluations.
- [`TESTING_AND_VALIDATION.md`](./TESTING_AND_VALIDATION.md) — Test execution results, bundle diagnostics, and known limitations.
- [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) — Current implementation milestones, items needing validation, and roadmap.
