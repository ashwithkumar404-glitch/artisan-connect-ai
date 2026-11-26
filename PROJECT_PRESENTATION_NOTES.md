# ARTISAN CONNECT AI — ACADEMIC PRESENTATION & VIVA PREPARATION NOTES
**Target:** Project Demonstration, Academic Committee Review & Technical Viva  
**Platform:** Artisan Connect AI  
**Key Stakeholders:** Rural Artisans & Craft Buyers across India

---

## 1. Project Explanation in Simple, Clear Language

### What is Artisan Connect AI?
Artisan Connect AI is an end-to-end digital enablement and direct market linkage platform designed specifically for rural, traditional Indian artisans. Most traditional artisans face literacy barriers, regional language barriers, and complex e-commerce interfaces that force them to depend on exploitative middlemen.

### How Does It Work?
1. **Voice & Photo First:** Instead of typing complex forms in English, an artisan takes a photo of their handicraft (e.g., pottery, handloom, wood carving) and speaks naturally in **Kannada or English**.
2. **Instant Bilingual Listing:** The application's on-device and edge NLP engine transcribes their speech, extracts factual specifications (materials, technique, quantity, price), and generates an authentic bilingual listing.
3. **Government Certificate Access:** Artisans log in securely using their government-recognized Handicrafts Application / Certificate Number (e.g., `KA-ART-1001`), instantly restoring their verified profile, craft specialty, and workshop location.
4. **Realtime Marketplace Sync:** When an artisan taps "Publish", the customer marketplace immediately updates via Supabase Realtime with an animated "✨ NEW ARRIVAL" indicator—without requiring a page refresh.
5. **WhatsApp-Style Two-Way Negotiation:** Customers can submit bulk quantity inquiries with proposed budgets. The artisan receives the inquiry in their mobile assistant, reviews the per-unit variance, and submits counteroffers directly.

---

## 2. Technical Architecture Overview

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       CUSTOMER MARKETPLACE       │       │    ARTISAN ASSISTANT PORTAL     │
│       (frontend - Port 5173)     │       │  (artisan-assistant - Port 5174)│
│  • React 18, Vite, Tailwind CSS  │       │  • Mobile-First React App       │
│  • Multi-Filter Search & Cart   │       │  • Web Speech STT / TTS Engine  │
│  • Realtime Product Feed        │       │  • Realtime Order & Inquiry Hub │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 │          HTTPS / WebSocket              │
                 ▼                                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE SHARED BACKEND (BaaS)                        │
│  • PostgreSQL 15 Database (RLS Enforced, auth.uid() scoping)              │
│  • Realtime Publication Engine (postgres_changes streaming)               │
│  • Supabase Auth (Magiclink / Password / Token Hash Session Exchange)    │
│  • Storage Buckets ('product-images', 'artisan-verification', 'reviews')  │
│  • Edge Functions (Deno TypeScript: artisan-otp, whatsapp-webhook)        │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                   OFFLINE MACHINE LEARNING SUBSYSTEM (ml/)                │
│  • Dataset Preparation & Verification (Verified Benchmark Dataset)        │
│  • Scikit-learn Category Classification: Logistic Regression (F1: 0.80)   │
│  • Scikit-learn Pricing Recommendation: Random Forest Regressor           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Exact Machine Learning Models & Algorithms Found in Code

### 1. Speech Recognition (Speech-to-Text)
- **Engine:** W3C Standard Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- **Implementation:** Browser-based on-device speech recognizer with continuous listening mode and Kannada locale (`kn-IN`).
- **Audio Preprocessing:** Handled by client operating system / browser audio pipeline (typically 16 kHz / 48 kHz PCM input).
- **Fallback:** `MediaRecorder` audio capture when speech recognition is unsupported or network-gated.
- **Why Selected:** Zero cloud latency, zero per-minute API costs for low-income artisans, native on-device privacy, and built-in Kannada acoustic modeling.

### 2. Category Classification Model
- **Algorithm:** **Multinomial Logistic Regression** with TF-IDF Vectorization (`ngram_range=(1,2)`, `sublinear_tf=True`, `max_features=500`).
- **Framework:** `scikit-learn` v1.9.0 (serialized to `ml/model/best_classifier.pkl`).
- **Tested Classes (7):** Pottery, Wood Craft, Handloom & Textiles, Bamboo & Natural Craft, Metal Craft, Jewellery, Other Handicrafts.
- **Evaluation on Verified Test Set:**
  - **Accuracy:** **81.25%**
  - **Macro F1-Score:** **0.8000**
  - **Weighted F1-Score:** **0.8125**
  - **Latency per Sample:** 0.411 ms
- **Alternatives Benchmarked:** Decision Tree (Accuracy: 43.75%), Random Forest (62.50%), AdaBoost (37.50%). Logistic Regression outperformed tree ensembles due to sparse TF-IDF text features on small-sample craft descriptions.

### 3. Price Recommendation Model
- **Algorithm:** **Random Forest Regressor** (`n_estimators=100`, `random_state=42`).
- **Framework:** `scikit-learn` v1.9.0 (serialized to `ml/model/best_regressor.pkl`).
- **Evaluation on Verified Test Set:**
  - **Mean Absolute Error (MAE):** **₹402.61**
  - **Root Mean Squared Error (RMSE):** **₹673.33**
  - **R² Score:** **0.2730** (Outperformed Mean Baseline MAE: ₹596.16).
- **Alternatives Benchmarked:** Ridge Linear Regression (MAE: ₹419.01), Decision Tree Regressor (MAE: ₹524.44).

---

## 4. Top 10 Viva Questions with Clear, Direct Technical Answers

### Q1: How do you handle language barriers for rural artisans who cannot speak English?
**Answer:** We implemented a voice-first Kannada interface. The artisan speaks in Kannada (`kn-IN`) via the Web Speech API. Our rule-based linguistic engine (`kannadaProductEngine.js`) normalizes Kannada Unicode conjuncts, extracts specifications (materials, technique, quantity, price), and synthesizes a structured English marketplace title and description alongside the artisan's original native-language text.

### Q2: How does the application prevent unverified users from impersonating artisans?
**Answer:** We maintain an official `artisan_registry` table populated with authorized government handicraft certificate numbers. During login, the artisan supplies their certificate ID (e.g., `KA-ART-1001`), which securely maps to a deterministic authentication account. Supabase Row Level Security (RLS) ensures that all subsequent profile updates, product creations, and order views are strictly constrained by `auth.uid() = profile_id`.

### Q3: How does real-time synchronization work between the two separate web applications?
**Answer:** Both applications communicate through a shared Supabase PostgreSQL backend. The marketplace (`Explore.jsx`) subscribes to Postgres changes on the `products` table using Supabase Realtime channels. When an artisan submits a published product, an `INSERT` postgres event triggers an immediate UI state re-fetch, placing the new item at the top of the catalog with an animated "✨ NEW ARRIVAL" badge without reloading the browser.

### Q4: Why did Logistic Regression achieve a higher F1 score (0.80) than Random Forest (0.64) on craft classification?
**Answer:** Text classification uses TF-IDF representation, which produces high-dimensional, sparse feature matrices. Logistic Regression constructs linear decision hyperplanes that generalize exceptionally well on sparse text spaces with small-to-medium sample sizes (77 verified craft items). Tree-based ensembles like Random Forest split on individual words and suffer from high variance when training on limited text vocabularies.

### Q5: How do you prevent cross-artisan data leaks in order and inquiry management?
**Answer:** Security is enforced at the database level through PostgreSQL Row Level Security (RLS) policies rather than client-side filters. For example, `order_items` queries enforce `.eq('artisan_id', artisan.id)`. Similarly, enquiry messages enforce that `sender_id = auth.uid()` or that the user owns the parent product/enquiry record. Artisans cannot view other artisans' financial or customer data even if they query the API directly.

### Q6: What happens if an artisan takes a product photo while offline or in poor connectivity?
**Answer:** The upload pipeline separates local client state from network operations. The image is captured and previewed immediately using an in-memory Base64 data URL. If the network drops during publication, the application catches the network failure non-silently, preserves the drafted title, price, and image in local state, and offers an explicit "Retry Photo Upload" action without creating duplicate rows.

### Q7: Why do you enforce that "shipped" is distinct from "delivered"?
**Answer:** Middlemen often exploit delivery tracking loopholes. In Artisan Connect AI, when an artisan dispatches goods, the order status transitions to `shipped` and records courier tracking. However, the order is only transitioned to `delivered` when the customer clicks "Confirm Order Received" in their profile, preventing premature payment releases and ensuring customer protection.

### Q8: What database schema supports the two-way price negotiation?
**Answer:** We use an `enquiries` table storing overall contract metadata (product ID, artisan ID, customer ID, proposed budget, counteroffer amount, status) linked to a child `enquiry_messages` table storing every conversational message, sender role (`customer` vs `artisan`), timestamp, and itemized counteroffer. Both parties can exchange counter-proposals with automatic unit-price variance calculations.

### Q9: Why does the mobile phone fail to open the marketplace when using localhost?
**Answer:** `localhost` refers to the loopback interface (`127.0.0.1`) of the device itself. When an artisan opens the mobile web app on a physical phone, `localhost:5173` looks for a server running on the mobile phone, which doesn't exist. We solved this in `LanguageSelector.jsx` by dynamically resolving `window.location.hostname:5173`, allowing the phone to connect to the laptop's LAN IP address when sharing the same Wi-Fi network.

### Q10: What are the primary technical limitations of the current implementation?
**Answer:** 
1. The speech recognition engine relies on browser Web Speech API availability (best supported on Chromium-based mobile browsers like Chrome for Android).
2. The ML training dataset currently consists of 77 verified craft samples; expanding this to 5,000+ state-wide craft items will improve regression $R^2$ scores.
3. Live production WhatsApp delivery requires active Meta Business Cloud API billing credentials, which is simulated internally via the in-app WhatsApp assistant hub.

