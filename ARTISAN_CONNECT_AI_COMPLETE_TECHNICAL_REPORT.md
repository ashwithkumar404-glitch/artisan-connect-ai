# ARTISAN CONNECT AI — COMPLETE TECHNICAL ARCHITECTURE & STABILIZATION REPORT
**Academic & Engineering Master Documentation**  
**Repository Branch:** `feat/master-artisan-platform`  
**Current Date:** November 2026  
**Demonstration Status:** **STABILIZED & VERIFIED (158 Tests Passed, Zero Regressions)**

---

## 1. Project Introduction & Executive Summary
Artisan Connect AI is an accessible, bilingual, voice-enabled commerce platform created to eliminate the socioeconomic digital divide separating rural Indian artisans from urban e-commerce consumers. Traditional craftspeople frequently face steep barriers to entry when dealing with conventional e-commerce interfaces due to regional language limitations, typing literacy challenges, and complex product configuration forms.

The platform provides a dual-interface architecture:
1. **Customer Marketplace (`frontend/`):** A modern, responsive web application offering verified craft discovery, multi-filter catalog exploration, verified buyer reviews, customer order tracking, and volume price negotiations.
2. **Artisan Assistant (`artisan-assistant/`):** A mobile-first, voice-driven progressive web application offering government certificate authentication, on-device Kannada/English speech recognition, automated product listing formulation, WhatsApp-style order/inquiry management, and business intelligence.

Both frontend clients interact with a shared **Supabase PostgreSQL** backend leveraging Row Level Security (RLS) policies, atomic stored procedures, Storage buckets, and Realtime WebSocket event streaming.

---

## 2. Problem Statement & System Objectives

### Existing System Limitations
- **Linguistic Exclusion:** Existing e-commerce seller portals require typing product titles, descriptions, and metadata exclusively in English.
- **Predatory Middlemen:** Rural craftspeople rely on intermediaries who capture up to 60–80% of consumer market value while paying artisans minimal piecework rates.
- **Lack of Provenance & Trust:** Consumers cannot verify whether a handicraft is genuine artisan-made or factory-replicated mass production.
- **Disconnected Negotiation:** Traditional craft purchases in India thrive on bulk price negotiation, which static "Add to Cart" platforms fail to accommodate.

### Proposed System Objectives
- Enable artisans to speak naturally in **Kannada or English** to create professional marketplace listings with zero manual typing.
- Provide government-recognized certificate login mapping authorized state artisans to secure digital identities.
- Enable direct, real-time bulk price negotiations between buyer and artisan with live per-unit discount analytics.
- Provide seamless, cross-device real-time event updates connecting laptop marketplace buyers with mobile phone artisans.

---

## 3. Complete System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │            PHYSICAL CLIENT DEVICES           │
                               ├──────────────────────┬───────────────────────┤
                               │   Laptop / Desktop   │  Mobile Phone (Touch) │
                               │  (Buyer Marketplace) │  (Artisan Assistant)  │
                               └──────────┬───────────┴───────────┬───────────┘
                                          │                       │
                                          ▼                       ▼
┌──────────────────────────────────────────────────┐ ┌──────────────────────────────────────────────────┐
│          CUSTOMER MARKETPLACE (frontend/)        │ │       ARTISAN ASSISTANT (artisan-assistant/)     │
│  • React 18, Vite 8, Tailwind CSS v4             │ │  • React 18, Vite 8, Semantic Token Theme        │
│  • Routes: /, /explore, /product/:id, /cart,     │ │  • Routes: /, /login, /my-orders, /my-products,  │
│    /checkout, /profile (BuyerProfile)            │ │    /customer-feedback, /product-performance      │
│  • Realtime Catalog & Notification Listeners     │ │  • Web Speech STT Engine & Audio Capture         │
│  • Verified Customer Reviews & Star Ratings      │ │  • DashboardNavTabs & CustomerInquiriesHub       │
└─────────────────────────┬────────────────────────┘ └─────────────────────────┬────────────────────────┘
                          │                                                     │
                          │            HTTPS REST / Realtime WebSocket          │
                          └──────────────────────────┬──────────────────────────┘
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SHARED SUPABASE BACKEND (PostgreSQL 15)                              │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Tables:                                                                                               │
│  • profiles (id, full_name, email, phone, role)                                                        │
│  • artisan_registry (artisan_id_code, full_name, craft_category, phone_number, location_state)         │
│  • artisans (id, profile_id, business_name, location, specialization, verification_status)             │
│  • categories (id, name, description)                                                                  │
│  • products (id, artisan_id, category_id, name, description, price, stock_quantity, status)             │
│  • product_images (id, product_id, image_url, display_order)                                           │
│  • orders (id, customer_id, total_amount, status, shipping_name, shipping_city, created_at)            │
│  • order_items (id, order_id, product_id, artisan_id, quantity, unit_price, subtotal)                  │
│  • enquiries (id, product_id, customer_id, artisan_id, quantity, budget, counteroffer_amount, status)  │
│  • enquiry_messages (id, enquiry_id, sender_id, sender_role, message, proposed_amount, created_at)     │
│  • product_reviews (id, product_id, customer_id, rating, review_text, photo_url, created_at)           │
│  • notifications (id, user_id, title, message, reference_id, reference_type, is_read)                  │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  Security & Storage:                                                                                   │
│  • Row Level Security (RLS) policies enforcing auth.uid() scoping across all mutations                 │
│  • Storage Buckets: 'product-images', 'artisan-verification', 'review-photos'                           │
│  • Edge Functions: 'artisan-otp' (Session generation), 'whatsapp-webhook' (Meta Graph API verification)│
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Real-Time Integration & Cross-Device Workflow

### A. Artisan Product Publication ➔ Immediate Marketplace Refresh
1. The artisan captures an image via the device camera (`capture="environment"`) or picks from the gallery.
2. The image is uploaded to Supabase Storage (`product-images/${artisan.id}/${productId}/${fileName}`).
3. The artisan dictates details in Kannada. The local NLP engine extracts attributes and presents a bilingual draft.
4. Upon clicking "Publish", the record is committed to `products` with `status: 'published'`.
5. The customer marketplace (`frontend/src/pages/Explore.jsx`) maintains an active Supabase Realtime channel (`postgres_changes` on `table: products`). When an `INSERT` event fires, the catalog re-queries instantly without reloading the page, applying an animated `✨ NEW ARRIVAL` badge.

### B. Customer Checkout ➔ Instant Artisan Order Dispatch
1. The customer adds handicrafts to their cart and submits the checkout form (`Checkout.jsx`).
2. An order is inserted into `orders`, and itemized rows are created in `order_items` tagged with each respective `artisan_id`.
3. Checkout identifies every unique artisan involved and creates notifications targeted to each artisan's `profile_id`.
4. The artisan's `MyOrdersPage.jsx` listens via Realtime on `table: order_items` filtered by `artisan_id = eq.${artisan.id}`. The order list updates dynamically on the mobile phone without manual refreshing.

### C. Two-Way Bulk Price Negotiation
1. The customer submits a custom quantity and budget on `ProductDetails.jsx`.
2. An inquiry record is created in `enquiries` (`status: 'pending'`), and the initial message is recorded in `enquiry_messages`.
3. The artisan opens the **Inquiries Hub** (`CustomerInquiriesHub.jsx`), which subscribes to incoming messages via Supabase Realtime.
4. The artisan evaluates the suggested midpoint counteroffer, types or speaks a note, and sends the counteroffer.
5. The customer's `BuyerProfile.jsx` negotiation thread receives the counteroffer and allows one-click acceptance (`status: 'offer_accepted'`).

---

## 5. Machine Learning & Speech-to-Text Architecture

### A. Speech Recognition (Web Speech API)
- **Engine:** W3C Standard Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- **Language Locales:** Kannada (`kn-IN`) and English (`en-IN`).
- **Processing Mode:** Continuous listening with real-time interim results assembly.
- **Deduplication:** Event-level boundary protection preventing duplicate word appends during interim-to-final transcript transitions.
- **Failure Tolerance:** Graceful degradation to `MediaRecorder` or typed manual input if microphone permissions are denied.

### B. Natural Language Information Extraction Pipeline
Implemented in `artisan-assistant/src/lib/kannadaProductEngine.js`:
1. **Unicode Conjunct Normalization:** Strips zero-width joiners and validates Kannada character ranges.
2. **Material Recognition:** Recognizes clay (`ಜೇಡಿಮಣ್ಣು`, `ಟೆರಾಕೋಟಾ`), wood (`ತೇಗ`, `ಶ್ರೀಗಂಧ`), textiles (`ರೇಷ್ಮೆ`, `ಹತ್ತಿ`, `ಇಳಕಲ್`), metals (`ಹಿತ್ತಾಳೆ`, `ಬಿದರಿ`).
3. **Technique Extraction:** Distinguishes handloom weaving, wheel throwing, hand carving, and silver inlay.
4. **Numeric Parsing:** Extracts numeric quantities (e.g., "60 units") and currency amounts for unit price assignment.

### C. Supervised Machine Learning Benchmark (ml/train.py)

#### 1. Craft Category Classifier
- **Model:** Multinomial Logistic Regression Pipeline with TF-IDF Vectorization (`ngram_range=(1,2)`).
- **Benchmark Results on Verified Craft Dataset:**
  - **Accuracy:** **81.25%**
  - **Macro Precision:** **88.10%**
  - **Macro Recall:** **80.95%**
  - **Macro F1-Score:** **0.8000**
  - **Weighted F1-Score:** **0.8125**
  - **Inference Latency:** **0.411 ms / sample**
- **Comparison:** Outperformed Random Forest (62.50%), Decision Trees (43.75%), and AdaBoost (37.50%).

#### 2. Price Recommender
- **Model:** Random Forest Regressor (`n_estimators=100`, `random_state=42`).
- **Benchmark Results on Verified Craft Dataset:**
  - **Mean Absolute Error (MAE):** **₹402.61**
  - **Root Mean Squared Error (RMSE):** **₹673.33**
  - **$R^2$ Score:** **0.2730**
- **Comparison:** Outperformed Mean Baseline (MAE: ₹596.16) and Decision Tree Regressor (MAE: ₹524.44).

---

## 6. Mobile Responsiveness & Cross-Device LAN Configuration

### Mobile Viewport Compatibility
Both web applications were audited across mobile viewport breakpoints (360px, 375px, 390px, 430px) as well as tablet and desktop layouts:
- **Touch Target Sizing:** Minimum 44px button heights across all mobile actions (`login-submit-btn`, `drawer-link`, `theme-toggle-btn`).
- **Layout Overflow Protection:** Replaced fixed-pixel tables with horizontally scrolling cards and flex-wrap containers.
- **Mobile Drawer Navigation:** Responsive collapsible menus and touch-friendly header pills.

### Cross-Device LAN Resolution
To enable seamless testing where a laptop runs the Vite dev server and a mobile phone connects over the local Wi-Fi network:
- `LanguageSelector.jsx` detects `window.location.hostname` dynamically. Instead of hardcoding `localhost:5173`, it opens `${protocol}//${hostname}:5173`, allowing mobile phones to jump between the assistant and marketplace directly.

---

## 7. Security & Row Level Security (RLS) Audit

1. **Authentication Scoping:** Supabase sessions are verified via `auth.uid()`. Artisans cannot create or modify products on behalf of another artisan.
2. **Order Access Control:** `orders` queries in `MyOrdersPage.jsx` join through `order_items` matching `artisan_id = artisan.id`. Customer personal contact phone numbers and residential addresses are omitted from artisan order lists to protect buyer privacy.
3. **Storage Bucket Policies:** Storage upload policies strictly isolate uploads under `${auth.uid()}/...`, preventing cross-account media overwrites.
4. **Secret Handling:** Zero Supabase service-role keys or passwords exist in frontend source code. Edge Functions use server-side environment variables (`SUPABASE_SERVICE_ROLE_KEY`).

---

## 8. Installation, Execution & Demonstration Guide

### Prerequisites
- Node.js v20+ / v22+
- Python 3.10+ / 3.14+ with virtual environment (`.venv`)
- Active Internet connection (for Supabase BaaS connection)

### Running Locally
```bash
# 1. Customer Marketplace (Port 5173)
cd frontend
npm install
npm run dev -- --host

# 2. Artisan Assistant (Port 5174)
cd artisan-assistant
npm install
npm run dev -- --host

# 3. Running Test Suites
cd artisan-assistant
npm test

cd ../ml
..\.venv\Scripts\python.exe -m pytest tests -v
```

### Demonstration Accounts (Dev Mode)
- **`KA-ART-1001`**: Rameshappa Kumbar — Pottery & Terracotta (Ramanagara, Karnataka)
- **`KA-ART-1002`**: Sharadamma Nekara — Handloom & Textiles (Bagalkote, Karnataka)
- **`KA-ART-1003`**: Mallikarjun Badagi — Wood Craft & Toy Making (Channapatna, Karnataka)
- **`KA-ART-1004`**: Abdul Hameed Bidri — Bidriware & Metal Craft (Bidar, Karnataka)
