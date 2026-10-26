# Artisan Connect AI – ML Workspace

This folder contains the dataset auditing, human review, validation, and training pipeline for product-category classification.

---

## Current Status
- **Gemini & external AI**: Completely removed from all pipelines.
- **Dataset verification**: The dataset currently contains **zero verified labels**.
- **Model deployment**: No model is trained or deployed yet. Training is blocked until verified labels exist.
- **Artisan creation workflow**: Upload photo -> voice description -> draft listing -> human review/save (completely preserved).

---

## Directory Layout
- `ml/data/human_review_checklist.csv` – **Target file for human review and editing**. Preserves original values separately from human-approved corrections.
- `ml/data/labeled_products_template.csv` – Template header for product imports.
- `ml/audit_dataset.py` – Audits CSV datasets against quality rules, standard categories, and verification readiness.
- `ml/prepare_data.py` – Validates, deduplicates, and prepares cleaned subsets for training.
- `ml/train.py` – Trains a TF-IDF + Logistic Regression classifier on strictly verified, non-duplicate rows (blocked if zero verified rows or insufficient class counts exist).
- `ml/tests/` – Comprehensive pytest suite covering validation, review workflow, duplicate handling, and training constraints.

---

## Human Review Workflow & Instructions

The target file to review and edit is:
`ml/data/human_review_checklist.csv`

### Preserving Original Data
The review CSV has separate columns for original metadata and human corrections:
- `original_name`, `original_description`, `original_category`: **Never edit these columns**. They preserve raw data lineage.
- `reviewed_name`, `reviewed_description`, `reviewed_category`: Reviewer fields for corrected values.
- `verification_status`: Set to `True` only when a row is explicitly human-verified and ready for training. Default is `False`.
- `flag` & `review_notes`: Contextual warnings and rationale for the reviewer.

### Review Guidelines
1. **Approving an already valid candidate** (e.g., Row 4, 6, 7, 8, 9, 10, 12, 13, 19, 20, 21, 22):
   - Leave `reviewed_name`, `reviewed_description`, `reviewed_category` blank (the system will safely fall back to the original values).
   - Set `verification_status` to `True`.
2. **Correcting a record** (e.g., removing test prefix or reclassifying category):
   - Row 5: Title has `'Test Bamboo Basket'`. Set `reviewed_name` to `Natural Bamboo Strip Basket`, and set `verification_status` to `True`.
   - Row 23: Cotton bag currently under `'Other Handicrafts'`. Set `reviewed_category` to `Handloom & Textiles`, and set `verification_status` to `True`.
   - Row 24: Bamboo basket under `'Other Handicrafts'`. Set `reviewed_category` to `Bamboo & Natural Craft`, and set `verification_status` to `True`.
3. **Excluding an uninformative, duplicate, or uncertain record**:
   - Rows 2, 3: Placeholder descriptions (`'it is good'`, `'it is very good'`). Keep `verification_status` as `False` (or set `reviewed_category` to `EXCLUDE`).
   - Row 11: Non-standard category (`Home Decor`) with vague description. Keep `verification_status` as `False`.
   - Rows 17, 18, 25: Exact duplicates. Keep `verification_status` as `False` (or set `reviewed_category` to `EXCLUDE`).
   - Row 16: Uncertain category (wall art painting without clear material craft). Keep `verification_status` as `False`.

---

## Standard Marketplace Categories
1. `Bamboo & Natural Craft`
2. `Handloom & Textiles`
3. `Pottery`
4. `Wood Craft`
5. `Metal Craft`
6. `Jewellery`
7. `Other Handicrafts`

---

## CLI Commands

All commands are run from the project root (`artisan-connect-ai/`):

### 1. Audit Dataset
Audits the human review checklist against quality checks, standard categories, and verification status:
```bash
# Default: audits ml/data/human_review_checklist.csv against standard categories
python -m ml.audit_dataset

# Audit a specific CSV
python -m ml.audit_dataset --input ml/data/human_review_checklist.csv

# Output report in JSON format
python -m ml.audit_dataset --json

# Audit all CSVs in ml/data/
python -m ml.audit_dataset --all
```

### 2. Prepare & Clean Dataset
Validates the input CSV and writes a clean CSV with eligible records:
```bash
# Export all eligible rows (both verified and unverified)
python -m ml.prepare_data --input ml/data/human_review_checklist.csv --output ml/data/clean_working.csv

# Export strictly human-verified rows only (recommended for training preparation)
python -m ml.prepare_data --input ml/data/human_review_checklist.csv --output ml/data/clean_verified.csv --verified-only
```

### 3. Train Model (Blocked until verified data exists)
Attempts training on verified data; automatically enforces stratification requirements (at least 2 verified examples per category) and rejects duplicates:
```bash
python -m ml.train --input ml/data/clean_verified.csv --model-output ml/model/tfidf_lr.pkl
```

### 4. Run Test Suite
```bash
.\.venv\Scripts\python -m pytest ml/tests -v
```
