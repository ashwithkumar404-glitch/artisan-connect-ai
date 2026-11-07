# Artisan Connect AI — Current Project Status

---

## 1. Completed and Verified Functionality

The following modules, components, and workflows have been fully implemented, tested, and verified with passing test suites and successful production builds:

- **Dual-Application Architecture:**
  - Independent Vite applications: Customer Marketplace on port 5173 and Artisan Assistant on port 5174.
  - Shared Supabase backend schema and real-time state synchronization.
- **Artisan Workshop Hub & Navigation:**
  - Unified 8-section Business Management Centre navigation drawer (`SideMenu.jsx`).
  - Mobile-responsive layout, CSS variable-based light/dark theme persistence, and reduced-motion accessibility.
  - Artisan Application/Certificate login linked strictly to `auth.uid()`, preventing ID spoofing.
- **Local Voice-Assisted Product Listing:**
  - In-app audio recording with live timer, waveform preview, and permission handling.
  - Deterministic Kannada NLP engine (`kannadaProductEngine.js`): Kannada numeral conversion (`೦-೯` $\rightarrow$ `0-9`), keyword detection, and extraction of price, stock, and materials.
  - Bilingual listing generation (English title/description alongside local Kannada text).
  - Voice-driven draft corrections (e.g., updating only price or stock via spoken command).
  - Latency instrumentation badge displaying processing breakdown in milliseconds.
- **Two-Way Customer-Artisan Price Negotiation:**
  - Marketplace bulk enquiry form calculating base cost, proposed budget, discount percentage, and unit equivalent price in real time.
  - Conversational negotiation thread in both applications (`BuyerProfile.jsx` and `WhatsAppPlaceholderPage.jsx`) backed by `public.enquiry_messages`.
  - Multi-message exchanges with counteroffers and offer acceptance.
  - Notification deep-linking (`NotificationBell.jsx` $\rightarrow$ `/profile?tab=enquiries&enquiryId=...`).
  - Mutual Production Confirmation modal creating persistent confirmed order rows in `public.orders`.
- **Workshop Production & Order Management:**
  - Order status lifecycle: `placed` $\rightarrow$ `confirmed` $\rightarrow$ `preparing` $\rightarrow$ `ready_for_dispatch` $\rightarrow$ `shipped` $\rightarrow$ `delivered`.
  - 5-step preparation checklist for orders in production with persistent state.
  - Carrier dispatch modal capturing courier name, tracking number, and dispatch date.
  - Manual delivery confirmation fallback.
- **Customer Reviews & Performance Analytics:**
  - Review categorization into delivery issues, product quality concerns, or general appreciation.
  - Web Speech synthesis audio playback of customer reviews in Kannada and English.
  - Pure SVG charts: Monthly sales bar chart, monthly order trends line chart, lifecycle stage breakdown, and rating distribution.
  - KPI conversion card tracking enquiry-to-order conversion rate.
- **Database Security & Migrations:**
  - Versioned PostgreSQL migrations in `supabase/migrations/`.
  - Strict Row Level Security policies on `products`, `orders`, `order_items`, `enquiries`, `enquiry_messages`, and `product_reviews`.
- **Isolated Demo Dataset:**
  - Seed dataset (`data/demo_data.json` and `scripts/seed_demo_data.js`) with 16 products, 25 orders, 12 enquiries, and 18 reviews.
  - 100% of demo rows tagged with `is_demo: true` to prevent pollution of real user records.
- **Machine Learning Benchmarking:**
  - Automated benchmark script (`ml/benchmark_models.py`) evaluating 5 classifiers and 4 regressors.
  - Serialized model artifacts (`ml/model/best_classifier.pkl` and `ml/model/best_regressor.pkl`).
  - Comprehensive evaluation metrics exported to `ml/evaluation_report.json`.

---

## 2. Partially Completed / Needs Further Validation

The following features exist in the codebase but require live external credentials, physical hardware, or broader integration testing:

- **External WhatsApp Cloud API Integration:**
  - The in-app conversational assistant interface is functional and verified.
  - Webhook verification functions and HMAC signature checkers exist in Edge Functions (`supabase/functions/whatsapp-webhook/`), but live end-to-end messaging requires an active Meta Business account, registered phone number, and verified webhook domain.
- **Cloud Speech-to-Text Fallback:**
  - The client-side browser Web Speech API works cleanly on supported browsers (Chrome, Edge).
  - Backend speech fallback (`transcribe-voice` Edge Function) exists in code, but live cloud credentials (e.g. Google Cloud Speech API keys) are not configured in local environment variables.
- **Marketplace Automated Testing:**
  - The Customer Marketplace has been tested manually and compiles cleanly in production builds.
  - However, unlike the Artisan Assistant (which has 124 automated tests), `frontend/` lacks automated unit/component test scripts in `package.json`.

---

## 3. Pending / Future Improvements

The following roadmap items represent planned future enhancements:

- **Larger Labelled ML Dataset:**
  - Expand the verified handicraft dataset from 77 curated samples to 500+ field-collected artisan records across all Indian states.
- **Stronger ML Validation & Feature Engineering:**
  - Train advanced neural or sub-word embedding models (e.g., IndicBERT, multilingual RoBERTa) to capture nuanced dialectal variations in craft descriptions.
- **Empirical Voice & Translation Benchmarking:**
  - Conduct formal Word Error Rate (WER) and BLEU score evaluations on spoken Kannada audio collected from rural artisan workshops.
- **Mobile Bundle Optimization & Code-Splitting:**
  - Address the ~800 kB minified chunk warnings by configuring Vite dynamic `import()` route splitting, reducing initial load times on 3G/4G rural mobile networks.
- **Automated Frontend Test Suite:**
  - Configure Vitest or Jest in `frontend/` to provide automated component testing parity with `artisan-assistant/`.
- **Live Payment Gateway Integration:**
  - Integrate production UPI/payment gateway rails (e.g. Razorpay or Bharat Interface for Money) for real-time payment settlement upon order confirmation.
