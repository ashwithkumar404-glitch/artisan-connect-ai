# Artisan Connect AI – Ground Truth Data Collection & Review Guide

This guide establishes the protocol for collecting, reviewing, and verifying authentic artisan product data across all seven official product categories. It ensures data integrity, prevents synthetic hallucinations, and maintains compatibility with the existing validation and training pipelines.

---

## 1. Current Situation & Objectives

* **Current Dataset (`ml/data/human_review_checklist.csv`):** 21 records total.
  * `Bamboo & Natural Craft`: 19 records.
  * `Handloom & Textiles`: 1 record.
  * `Metal Craft`: 1 record.
  * `Pottery`, `Wood Craft`, `Jewellery`, `Other Handicrafts`: 0 records.
  * **Verified Records:** 0 (all `verification_status=FALSE`).
* **Objective:** Expand the dataset to an initial **50–100 human-verified, distinct examples per category** (~350–700 total verified records) without inventing fake product details or automatically toggling verification flags.
* **Fallback Operational Status:** The production application currently relies on a deterministic rule-based classifier (`supabase/functions/generate-product/classifier.ts`), ensuring uninterrupted operation while the ML training dataset is collected and verified.

---

## 2. Seven Official Product Categories

Every entry must strictly belong to one of the following seven standard categories:

| Category | Primary Materials & Techniques | Authentic Craft Examples | Boundary / Disambiguation Rules |
| :--- | :--- | :--- | :--- |
| **Bamboo & Natural Craft** | Bamboo, cane, rattan, wicker, coir, sabai grass, jute, palm leaves, river reed (*kauna*). Woven, braided, coiled. | Bamboo baskets, cane stools, sabai grass planters, wicker hampers, river reed mats, jute table runners. | If an item is a wearable textile or garment made of spun jute/cotton yarn, classify as *Handloom & Textiles*. If it is a structural basket/mat, classify here. |
| **Handloom & Textiles** | Hand-spun cotton, silk, tussar, wool, linen, khadi. Handloom weaving, block printing, tie-dye, embroidery, quilting. | Chanderi & Banarasi sarees, Ikat dupattas, Kalamkari fabrics, Kantha embroidered quilts, handspun cotton tote bags, Pashmina shawls. | Hand-embroidered bags and apparel belong here. Do not classify under *Other Handicrafts* if primary craft is handloom or textile embroidery. |
| **Pottery** | Terracotta, red clay, earthenware, stoneware, ceramic, river clay. Wheel-thrown, hand-molded, kiln-fired, glazed. | Terracotta planters, clay water jugs (*matkas*), Blue Pottery plates, hand-thrown ceramic bowls, earthenware *diyas*, glazed vases. | Terracotta beads designed as wearable ornaments belong under *Jewellery*. Tableware and decorative vessels belong here. |
| **Wood Craft** | Sheesham, teak, rosewood, sandalwood, beechwood, mango wood. Hand-carving, lathe turning, lacquer work, inlay. | Channapatna wooden toys, carved wooden spice boxes, Sheesham serving trays, carved animal figurines, wooden printing blocks. | Wooden bangles or wearable pendants belong under *Jewellery*. Utilitarian and decorative wooden artifacts belong here. |
| **Metal Craft** | Brass, bronze, bell metal, copper, wrought iron, zinc alloys. Lost-wax casting (*Dhokra*), repoussé, engraving, etching, Bidriware. | Dhokra brass figurines, Moradabad engraved brass vases, bell metal bowls, copper water carafes, wrought iron candle stands, Bidriware boxes. | Metal earrings, necklaces, and bangles belong under *Jewellery*. Statues, vessels, and hardware belong here. |
| **Jewellery** | Terracotta beads, brass, silver filigree (*Tarakasi*), lac, natural seeds, thread/tassels, semi-precious stones, Dokra pendants. Hand-strung, shaped, soldered. | Terracotta bead necklaces, Lac bangles, silver filigree earrings, Dokra tribal pendants, brass cuffs, glass bead chokers. | Wearable personal ornaments belong here regardless of base material (terracotta, wood, metal, or cloth). |
| **Other Handicrafts** | Papier-mâché, camel leather, marble inlay, soapstone, coconut shell, horn craft, traditional folk scrolls (Madhubani, Pattachitra). | Papier-mâché boxes, Kolhapuri leather footwear, marble inlay coasters, carved coconut shell bowls, traditional folk paintings. | Used strictly for genuine traditional crafts that do not fit into the 6 specific material categories above. |

---

## 3. Authentic Data Sourcing Protocol (Zero Fabrication Policy)

Under **no circumstances** should product titles, descriptions, or specifications be generated synthetically, invented, or hallucinated. All entries must represent genuine artisan goods from legitimate sources:

### Approved Primary Sources
1. **Government & State Artisan Cooperatives:**
   * **Tribes India / TRIFED** public product directories (`tribesindia.com`).
   * **Central Cottage Industries Corporation of India (CCIC)**.
   * **State Handicraft Corporations** (e.g., Lepakshi, Cauvery, Poompuhar, Biswa Bangla, Boyanika).
   * **Export Promotion Council for Handicrafts (EPCH)** & **Handloom Export Promotion Council (HEPC)** public registries.
2. **Geographical Indications (GI) Registry of India:**
   * Official GI registrations detailing authentic product titles, artisan craft communities, raw materials, and traditional techniques.
3. **Fair-Trade Artisan Organizations & Cooperatives:**
   * Dastkar, Craftmark, Sasha, Sadhna, SEWA, and Industree catalogs containing genuine artisan listings.
4. **Artisan Direct Submissions via Artisan Connect AI:**
   * Authentic product drafts created by genuine artisans through the app's voice and image workflow.

### Provenance Tracking
* For every record entered, the `source` column must include verifiable reference information (e.g., `TRIFED Catalog Ref #402`, `Boyanika Odisha Saree Portal`, or `GI Application #183`).

---

## 4. Staging File Schema (`ml/data/category_expansion_staging.csv`)

New candidate records are staged in [`ml/data/category_expansion_staging.csv`](file:///c:/Users/ashvi/OneDrive/Desktop/Artisan%20Connect%20AI/artisan-connect-ai/ml/data/category_expansion_staging.csv).

| Column | Description | Entry Rule |
| :--- | :--- | :--- |
| `row_number` | Sequential row identifier (1, 2, 3...) | Mandatory integer. |
| `original_name` | Raw product title as sourced. | Mandatory. Real title from source. |
| `reviewed_name` | Cleaned title if the original has typos or catalog codes. | Optional. Falls back to `original_name` if blank. |
| `original_description` | Full original product description describing materials and craft technique. | Mandatory. Must not be placeholder text. |
| `reviewed_description` | Cleaned product description if original needs editorial refinement. | Optional. Falls back to `original_description` if blank. |
| `original_category` | Category as labeled at source. | Mandatory. |
| `suggested_category` | Suggested official category during data entry. | Must be one of the 7 official categories. |
| `reviewed_category` | Final confirmed official category. | Required for training eligibility. |
| `source` | Name of portal, artisan coop, or GI registration reference. | Mandatory provenance reference. |
| `verification_status` | Human verification flag (`TRUE` / `FALSE`). | **MUST BE `FALSE` on entry. Never set automatically.** |
| `flag` | Quality flag (`NEEDS HUMAN VERIFICATION`, `VERIFY DETAILS`, etc.). | Contextual note for reviewer. |
| `review_notes` | Specific instructions or checks for the reviewer. | Material, technique, or boundary rationale. |

---

## 5. Quality Standards & Duplicate Prevention

Before any row is approved:
1. **No Placeholders:** Descriptions such as *"it is good"*, *"handmade product"*, or *"test"* are strictly rejected by `ml/prepare_data.py`.
2. **Minimum Descriptive Content:** The description must mention the material (e.g., *terracotta*, *bamboo*, *brass*), the craft process (e.g., *handwoven*, *carved*, *cast*), and the function/form.
3. **Deduplication:**
   * `prepare_data.py` deduplicates based on case-insensitive `(name, description, category)`.
   * Ensure newly staged products are distinct and do not repeat existing catalog entries.

---

## 6. Human Review & Verification Workflow

Every record must undergo manual verification by a human reviewer:
1. **Step 1: Authenticity Audit:** Verify the item is a genuine handcrafted item from the listed source.
2. **Step 2: Category Conformance:** Confirm the product fits squarely into the assigned official category without ambiguity.
3. **Step 3: Text Resolution:** If `original_name` or `original_description` contains extraneous catalog IDs or typos, provide the clean text in `reviewed_name` / `reviewed_description`.
4. **Step 4: Explicit Approval:** The reviewer explicitly changes `verification_status` from `FALSE` to `TRUE`.
5. **Step 5: Integrity Rule:** No script, heuristic, or AI pipeline is allowed to set `verification_status` to `TRUE`.

---

## 7. Dataset Balancing & Evaluation Strategy

### Split Strategy
* **Target Size:** 50–100 verified records per category (minimum 350 total records).
* **Stratified 70/15/15 Split:** `train_test_split(..., test_size=0.30, stratify=y, random_state=42)` partitioned into training, validation, and test sets.
* **Leakage Prevention:** TF-IDF vectorizer must fit **only** on the training split.

### Evaluation Metrics
When evaluated on the held-out test split, report:
1. **Accuracy:** Overall percentage of correct predictions.
2. **Macro Precision:** Unweighted average precision across all 7 categories:
   $$\text{Macro Precision} = \frac{1}{7}\sum_{i=1}^{7}\frac{TP_i}{TP_i + FP_i}$$
3. **Macro Recall:** Unweighted average recall across all 7 categories:
   $$\text{Macro Recall} = \frac{1}{7}\sum_{i=1}^{7}\frac{TP_i}{TP_i + FN_i}$$
4. **Macro F1-Score:** Primary benchmark metric ensuring no single category is overlooked:
   $$\text{Macro F1} = \frac{1}{7}\sum_{i=1}^{7} 2 \cdot \frac{\text{Precision}_i \cdot \text{Recall}_i}{\text{Precision}_i + \text{Recall}_i}$$
5. **Confusion Matrix ($7 \times 7$):** Full classification matrix identifying any inter-category confusion (e.g., *Wood Craft* vs. *Bamboo & Natural Craft*).

---

## 8. CLI Commands for ML Workflow

Run all commands from `artisan-connect-ai/`:

```bash
# 1. Audit the new staging dataset for quality and verification status
python -m ml.audit_dataset --input ml/data/category_expansion_staging.csv

# 2. Prepare verified training data (extracts only rows where verification_status=TRUE)
python -m ml.prepare_data --input ml/data/category_expansion_staging.csv --output ml/data/clean_verified.csv --verified-only

# 3. Train model (Blocked until at least 2 verified records exist per category)
python -m ml.train --input ml/data/clean_verified.csv --model-output ml/model/tfidf_lr.pkl

# 4. Run test suite to verify pipeline integrity
.\.venv\Scripts\python -m pytest ml/tests -v
```
