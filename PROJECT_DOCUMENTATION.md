# Artisan Connect AI — Comprehensive Project Documentation

---

## 1. System Overview

Artisan Connect AI is an integrated platform connecting Indian handicraft artisans with domestic and global buyers. The project resolves key friction points in digital adoption through local-language voice cataloguing, conversational price negotiation, workshop production stage tracking, and transparent carrier dispatch recording.

The repository is organized into three primary subsystems:
1. **`frontend/`** — The Customer Marketplace for product discovery, checkout, bulk enquiries, and order tracking.
2. **`artisan-assistant/`** — The Artisan Assistant application providing a WhatsApp-style in-app workshop hub, voice listing generator, enquiry inbox, order manager, customer feedback analyzer, and analytics dashboard.
3. **`ml/`** — An offline Python machine learning suite providing text-based product category classification and baseline price recommendation.

All persistent records are managed in a shared **Supabase PostgreSQL** instance with strict Row Level Security (RLS).

---

## 2. Module Workflows

### Module A: Customer Marketplace (`frontend/`)

- **Product Browsing & Discovery (`/`, `/explore`):**
  - Displays published products created by approved artisans.
  - Category filtering across seven verified craft categories: *Bamboo & Natural Craft, Handloom & Textiles, Pottery, Wood Craft, Metal Craft, Jewellery, Other Handicrafts*.
  - Search by product name, materials, or artisan business name.
- **Product Details (`/product/:id`):**
  - Displays product photography, verified artisan badge, stock status, and English descriptions.
  - Interactive local language toggle: Allows switching between primary English title/description and original Kannada title/description (`local_title`, `local_description`).
  - Standard Buy Now / Add to Cart flow for immediate single-unit purchases.
- **Bulk & Custom Enquiry Submission:**
  - Integrated bulk enquiry form on each product page.
  - Live math calculation card: Computes base cost ($Quantity \times Unit\ Price$), user's proposed budget, absolute price difference ($₹$), and percentage discount in real time.
  - Submits enquiry with initial status `'pending'` to `public.enquiries` and inserts the opening message into `public.enquiry_messages`.
- **Customer Communication & Negotiation (`/profile?tab=enquiries`):**
  - Dedicated negotiation thread inside the buyer profile.
  - Displays chronological message history with sender badges (`Customer` vs `Artisan`).
  - Action buttons: "Accept Offer", "Send Counteroffer", or "Send Note".
  - Confirmed Order Banner: Once an enquiry is accepted and confirmed by the artisan, displays the assigned Order ID, expected completion date, and a direct link to the buyer's order history.
- **Notifications & Deep-Linking (`NotificationBell.jsx`):**
  - Real-time notification badge alerting the buyer to artisan counteroffers, message updates, and dispatch changes.
  - Clicking an enquiry notification navigates directly to `/profile?tab=enquiries&enquiryId=<id>`.
- **Order Tracking (`/profile?tab=orders`):**
  - Displays lifecycle progression: `placed` $\rightarrow$ `confirmed` $\rightarrow$ `preparing` $\rightarrow$ `ready_for_dispatch` $\rightarrow$ `shipped` $\rightarrow$ `delivered`.
  - Shows carrier name, tracking number, dispatch date, and delivery confirmation timestamps.
- **Customer Reviews (`ProductDetails.jsx`):**
  - Star rating (1★ to 5★) and text feedback submitted against delivered orders.
  - Stored in `public.product_reviews` with customer reference.

---

### Module B: Artisan Assistant (`artisan-assistant/`)

- **Business Management Centre (`SideMenu.jsx`):**
  - Unified 8-section navigation drawer available across all artisan screens:
    1. 🤖 AI Voice Assistant (`/`)
    2. 📱 WhatsApp Assistant (`/whatsapp`)
    3. 📦 My Products (`/my-products`)
    4. 💬 Customer Enquiries (`/whatsapp?action=check_enquiries`)
    5. 📋 My Orders (`/my-orders`)
    6. 🔨 Production & Preparation (`/my-orders?tab=preparing`)
    7. 🚚 Delivery & Dispatch (`/my-orders?tab=delivery`)
    8. ⭐ Customer Reviews (`/customer-feedback`)
    9. 📈 Performance Insights (`/product-performance`)
    10. Quick Actions: ➕ Add Product (`/add-product`) & 💰 My Earnings (`/my-earnings`).
- **Artisan Onboarding & Authentication:**
  - Artisan Application / Certificate Number login with temporary verification password.
  - Profile retrieval strictly linked to `auth.uid()`, preventing artisan ID spoofing.
  - Displays verified artisan badge, business name, craft specialization, and avatar.
- **Product Management (`/my-products`):**
  - Lists all artisan products with stock count, unit price, published status, and edit controls.
- **Voice-Based Product Creation (`/whatsapp` and `/add-product`):**
  - Step-by-step conversational flow: Photo capture $\rightarrow$ Audio recording $\rightarrow$ Local Kannada fact extraction $\rightarrow$ Bilingual draft review $\rightarrow$ Publish / Save draft.
- **Enquiry Management & In-App WhatsApp Negotiation (`/whatsapp?action=check_enquiries`):**
  - Native card view of incoming customer enquiries.
  - Side-by-side Kannada translation of customer messages.
  - Counteroffer submission via text input or voice recognition.
  - Mutual Production Confirmation modal creating persistent order rows upon agreement.
- **Order Management & Production Checklist (`/my-orders`):**
  - Tabbed filtering: All, Active, Preparing, Delivery, Delivered, Cancelled.
  - Step-by-step workshop checklist for orders in preparation.
- **Delivery Management (`/my-orders?tab=delivery`):**
  - Dispatch modal capturing carrier name and tracking consignment number.
  - Marks order as `shipped` and records `dispatch_date`.
  - Manual delivery confirmation fallback.
- **Customer Feedback & Review Management (`/customer-feedback`):**
  - Review categorization into delivery issues, product quality, or general compliments.
  - Audio speech synthesis playback of customer reviews in Kannada and English.
  - AI-assisted draft response generation.
- **Performance Analytics (`/product-performance`):**
  - SVG charts for sales revenue, order volumes, lifecycle stages, and star ratings.
  - Enquiry-to-order conversion rate metric.
  - Summary cards linking to pending production and active customer complaints.

---

### Module C: AI and Voice Processing Workflow

#### 1. Implemented & Verified Capabilities
- **Local Voice Capture & Transcription:**
  - Uses browser Web Speech Recognition API (`webkitSpeechRecognition`) supporting Kannada (`kn-IN`) and Indian English (`en-IN`).
  - Graceful fallback: If Web Speech is unavailable, records audio via `MediaRecorder` API.
  - Real-time live audio timer with start, stop, cancel, and permission error handling.
- **Deterministic Kannada NLP Engine (`kannadaProductEngine.js`):**
  - Runs entirely client-side without paid or external cloud dependencies.
  - **Numeral Normalization:** Maps Kannada Unicode digits (`೦`, `೧`, `೨`, `೩`, `೪`, `೫`, `೬`, `೭`, `೮`, `೯`) to standard digits (`0-9`).
  - **Fact Extraction:** Extracts product price, stock quantity, primary craft material, and technique keywords from multi-sentence conversational speech.
  - **Bilingual Listing Synthesis:** Generates a structured English marketplace title and description alongside the original local Kannada text.
- **Voice-Based Listing Corrections:**
  - Allows the artisan to update specific draft fields using voice commands (e.g., *"ಬೆಲೆ 450 ರೂಪಾಯಿ ಮಾಡಿ"* updates only the price to ₹450 without altering title or description).
- **Stage-Level Latency Instrumentation:**
  - Traces execution time for NLP extraction (`nlpExtractionMs`), listing generation (`listingGenerationMs`), and total processing time (`totalProcessingMs`).
  - Renders a latency badge directly on the product draft review card.

#### 2. Planned / Experimental / Unimplemented Capabilities
- **Cloud Speech-to-Text (`transcribe-voice` Edge Function):** The codebase includes a fallback invoke call to a Supabase Edge Function, but cloud API keys (e.g., Google Cloud STT or Whisper) are not configured in local development.
- **End-to-End LLM Translation:** Current bilingual translation relies on dictionary-based template generation rather than generative LLM translation models.

---

### Module D: Customer Enquiry and Two-Way Negotiation Workflow

```
[Customer on Marketplace]                [Artisan on Assistant Hub]
           │                                          │
    Submits Bulk Enquiry                              │
 (Qty, Proposed Budget, Note)                         │
           │                                          │
           ├────────────► public.enquiries ───────────┤
           │            public.enquiry_messages       │
           │            (Status: 'pending')           │
           │                                          │
           │                                   Reviews Enquiry
           │                                 (Reads KN translation)
           │                                          │
           │                                   Sends Counteroffer
           │                                (Text or Voice ₹ Amount)
           │                                          │
           ├◄─────────── Status Updated ──────────────┤
           │         ('negotiation_ongoing')          │
           │                                          │
     Customer Reviews                                 │
   Accepts Final Offer                                │
           │                                          │
           ├────────────► Status: 'accepted' ─────────┤
           │                                          │
           │                                   Artisan Confirms
           │                                (Ready Date + Workshop Notes)
           │                                          │
           ├◄─────────── Order Created ───────────────┤
           │          (Status: 'confirmed')           │
           │           Rows in public.orders          │
           │         Rows in public.order_items       │
```

1. **Enquiry Initiation:** Customer submits proposed budget and quantity on `ProductDetails.jsx`. Row inserted with `status = 'pending'`.
2. **Inbox Notification:** Artisan Assistant displays the enquiry in the conversational WhatsApp-style inbox.
3. **Offer Exchange:** Both parties exchange messages and counteroffers. The enquiry status updates to `'negotiation_ongoing'`.
4. **Offer Acceptance:** Either party can accept the latest offer, setting status to `'accepted'`.
5. **Mutual Production Confirmation:** The artisan specifies the estimated ready date and production notes in a modal dialog. This atomically transitions the enquiry to `'confirmed'` and inserts a confirmed order record into `public.orders` and `public.order_items`.

---

### Module E: Production and Delivery Management

1. **Order Acceptance:** New orders appear under `MyOrdersPage.jsx`.
2. **Production Preparation Checklist:** For orders in `preparing` status, a 5-step checklist guides the artisan:
   - Step 1: Raw materials selection & quality inspection
   - Step 2: Primary shaping & hand-crafting
   - Step 3: Finishing, polishing & drying
   - Step 4: Final quality inspection & measurement
   - Step 5: Protective packaging
   - Checkbox state is saved to `orders.preparation_checklist` JSONB column.
3. **Packaging & Ready for Dispatch:** When all steps are checked, the order transitions to `ready_for_dispatch`.
4. **Carrier Dispatch Modal:** The artisan records:
   - Logistics Carrier: India Post (Speed Post), Delhivery, Blue Dart, DTDC, or Local Courier.
   - Consignment Tracking Number: E.g., `EK783921045IN`.
   - Dispatch Date: Automatically stamped with current timestamp.
   - Status transitions to `shipped`.
5. **Delivery Confirmation:**
   - Buyer or artisan marks the parcel as delivered upon physical receipt.
   - Status transitions to `delivered` with recorded `delivered_at` timestamp.

---

### Module F: Customer Reviews and Workshop Analytics

1. **Review Ingestion:** Reviews written by buyers are stored in `public.product_reviews` with ratings 1★ to 5★.
2. **Review Categorization:**
   - `delivery_issue`: Detected via keywords (delay, late, tracking, courier, packaging).
   - `product_quality`: Detected via ratings $\le 2$ or keywords (broken, damage, scratch, defect, poor).
   - `general_feedback`: Positive feedback and compliments.
3. **Artisan Response Drafting:**
   - One-click AI response generator drafts a polite bilingual reply.
   - Web Speech Synthesis provides audio playback so artisans with limited reading literacy can listen to feedback.
4. **Pure SVG Analytics Dashboards (`ProductPerformancePage.jsx`):**
   - **Monthly Sales Bar Chart:** Visualizes monthly revenue in ₹.
   - **Monthly Orders Trend Line Chart:** Tracks monthly order volumes.
   - **Orders by Lifecycle Stage:** Horizontal bar chart showing counts across all 7 statuses.
   - **Customer Rating Distribution:** 1★ to 5★ breakdown.
   - **Enquiry-to-Order Conversion Rate:** Displays conversion percentage from enquiries to confirmed sales.

---

### Module G: Backend Architecture, Database & Security

#### Database Tables
- `public.profiles`: User identity, role (`artisan`, `customer`, `admin`), phone, full name.
- `public.artisans`: Workshop name, craft specialization, certificate number, verification status (`pending`, `approved`, `rejected`), language preference.
- `public.categories`: Standard craft categories with English and Kannada names.
- `public.products`: Product listings, price, stock quantity, category ID, status (`draft`, `published`, `archived`), `local_title`, `local_description`, `is_demo`.
- `public.product_images`: Image URLs linked to products.
- `public.enquiries`: Customer bulk enquiries, quantities, proposed prices, counter prices, status, `is_demo`.
- `public.enquiry_messages`: Multi-turn dialogue thread between customer and artisan.
- `public.orders`: Order records, status, total amount, preparation stage, checklist, carrier name, tracking number, dispatch date, delivered date, `is_demo`.
- `public.order_items`: Line items linking orders to products, quantities, and unit prices.
- `public.product_reviews`: Ratings and customer comments.

#### Row Level Security (RLS) Policies
- Strict RLS is enabled on all tables:
  - Customers can read published products, create orders, submit enquiries, and view their own negotiation messages.
  - Artisans can read/update only their own products, view enquiries directed to them, manage their own orders, and view product reviews.
  - `enquiry_messages` access is restricted strictly to the participating customer (`auth.uid() = customer_id`) and participating artisan (`auth.uid() = artisan_user_id`).
  - No service-role keys are exposed in client-side bundles.

