# Artisan Connect AI — Testing & Validation Report

---

## 1. Verified Test Execution Summary

The following test suites and production build commands were executed and independently verified in the repository:

| Test Suite / Build Target | Result | Duration | Scope & Details |
| :--- | :---: | :---: | :--- |
| **Python ML Tests (`ml/tests`)** | **34 passed** | 47.3s | Dataset structure, human review validation, training rules, stratification |
| **Artisan Assistant Tests (`artisan-assistant/tests`)** | **124 passed** | 8.8s | 15 test suites: auth, voice, storage, orders, delivery, negotiation, analytics |
| **Artisan Application Production Build** | **Passed** | 4.08s | Vite production bundle compilation (`dist/`) |
| **Marketplace Application Production Build** | **Passed** | 4.38s | Vite production bundle compilation (`dist/`) |
| **Marketplace Automated Tests** | **Not configured** | N/A | No automated test script currently configured in `frontend/package.json` |

---

## 2. What the Tests Actually Validate

### A. Artisan Assistant Test Suite (124 Passing Tests)
1. **Authentication & Session Hardening (`auth_and_storage_policy.test.js`, `step1_welcome_and_login.test.js`):**
   - Validates OTP challenge generation, expired token rejection, replay prevention, and rate-limiting safeguards.
   - Verifies that artisan profile queries are bound to `auth.uid()`, preventing artisan ID spoofing.
   - Verifies that development OTP mechanisms do not compromise production configurations.
2. **Local Kannada Voice Engine (`kannada_pipeline.test.js`, `voice_recognition.test.js`, `voice_to_english_listing.test.js`):**
   - Validates Kannada numeral conversion (`೦-೯` $\rightarrow$ `0-9`).
   - Verifies material and technique keyword extraction across all 7 craft categories.
   - Confirms that speech recognition failures transition to honest error states rather than fabricating silent outputs.
   - Asserts that listing generation creates clean English titles and descriptions without corrupting fields with Kannada text leakage.
   - Asserts that provisional prices must be confirmed before an artisan can publish a product live.
3. **Order Lifecycle & Workshop Guidance (`orders_and_earnings.test.js`, `phase2_delivery_negotiation_insights.test.js`):**
   - Verifies lifecycle state progression (`placed` $\rightarrow$ `confirmed` $\rightarrow$ `preparing` $\rightarrow$ `ready_for_dispatch` $\rightarrow$ `shipped` $\rightarrow$ `delivered`).
   - Validates that `shipped` status is strictly distinct from `delivered`.
   - Validates the 5-step production preparation checklist.
4. **Enquiry & Two-Way Price Negotiation (`enquiry_negotiation_rls_lifecycle.test.js`):**
   - Verifies bulk negotiation math: base cost, proposed budget, discount percentage, and unit price equivalent.
   - Validates status transitions: `pending` $\rightarrow$ `negotiation_ongoing` $\rightarrow$ `accepted` $\rightarrow$ `confirmed`.
   - Validates mutual confirmation modal creating confirmed order rows in `public.orders`.
5. **Customer Feedback & SVG Analytics (`performance_and_reviews.test.js`):**
   - Verifies review categorization into delivery, product quality, and compliments.
   - Verifies period calculation (7d, 30d, all-time) in `ProductPerformancePage.jsx`.
   - Verifies pure SVG charts and KPI cards rendering without external charting libraries.

### B. Machine Learning Test Suite (34 Passing Tests)
1. **Dataset Integrity (`test_audit_dataset.py`, `test_prepare_data.py`):**
   - Rejects missing required columns (`name`, `description`, `category`, `source`, `label_verified`).
   - Detects and excludes duplicate rows, case-insensitive variants, and invalid category placeholders.
   - Verifies that unverified checklist records (`verification_status: False`) are strictly blocked from training.
2. **Training Pipeline Safeguards (`test_train.py`):**
   - Verifies that stratified train/test split occurs **before** any TF-IDF vectorizer fitting (preventing data leakage).
   - Enforces that every category must have at least 2 verified examples to enable stratification.

---

## 3. What the Tests Do NOT Validate (Limitations)

To maintain academic and professional honesty, the following constraints must be noted:

1. **No Live External WhatsApp API Testing:**
   - The in-app assistant mimics a WhatsApp-style conversational interface.
   - Tests do **not** validate live Meta WhatsApp Cloud API webhooks or real WhatsApp message delivery, as production Meta business credentials and external webhooks are not deployed.
2. **No Live Cloud Speech-to-Text Verification:**
   - Voice tests mock speech audio inputs and validate browser Web Speech APIs. They do not benchmark cloud speech APIs (e.g. Google Cloud STT or Whisper).
3. **No End-to-End Payment Gateway Integration:**
   - Orders are confirmed through negotiation and marketplace checkout flows, but live UPI or payment gateway APIs (e.g., Razorpay, Stripe) are simulated and not wired to live banking rails.
4. **No Automated Unit Tests in `frontend/`:**
   - While `artisan-assistant/` has 124 automated tests, the `frontend/` application does not currently have a dedicated `npm test` script configured. Its verification relies on successful Vite production builds and manual end-to-end browser walkthroughs.

---

## 4. Production Build Diagnostics & Optimization Warnings

Both applications build successfully for production deployment:

```bash
# Artisan Assistant Build
vite v8.3.4 building client environment for production...
✓ 88 modules transformed.
dist/index.html                   1.14 kB │ gzip:   0.61 kB
dist/assets/index-toOH86-d.css   28.36 kB │ gzip:   5.53 kB
dist/assets/index-BmW2UAmd.js   798.66 kB │ gzip: 210.95 kB
✓ built in 4.08s

# Customer Marketplace Build
vite v8.2.2 building client environment for production...
✓ 100 modules transformed.
dist/index.html                   0.45 kB │ gzip:   0.29 kB
dist/assets/index-yJwXZOfZ.css   66.51 kB │ gzip:  11.97 kB
dist/assets/index-CR-mILv_.js   853.75 kB │ gzip: 211.76 kB
✓ built in 4.38s
```

### Minified Bundle Size Diagnostic
Both builds emit Vite chunk-size notices:
- `artisan-assistant`: ~798.66 kB minified (~210.95 kB gzipped).
- `frontend`: ~853.75 kB minified (~211.76 kB gzipped).

> **Important Assessment:** These bundle sizes trigger standard Vite informational warnings (`chunkSizeWarningLimit: 500 kB`). They are **performance optimization notices, not build or runtime errors**. The larger chunk size is driven by bundling the Supabase client library, React DOM, and localized linguistic dictionaries into single bundles. For future production releases, route-based dynamic `import()` code-splitting can be configured to optimize initial mobile loading times.

