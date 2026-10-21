# Artisan Connect AI – ML Workspace (Phase 1)

This folder contains everything needed to **prepare** a product‑category dataset for a future machine‑learning model.

## Directory layout
- `ml/data/` – place for exported CSVs and the template file.
- `ml/data/labeled_products_template.csv` – header‑only CSV you can fill with your exported rows.
- `ml/data/README.md` – instructions on how to export the required fields from Supabase and map `category_id` → `categories.name`.
- `ml/prepare_data.py` – script that validates a CSV, reports data‑quality issues and produces a clean copy for training.
- `ml/requirements.txt` – Python dependencies required to run the validation script (currently only `pytest` for the test suite).
- `ml/tests/` – pytest suite that checks the validation logic on synthetic fixtures.

## Setup (project‑local virtual environment)
```bash
# From the repository root
python -m venv .venv          # create a virtual environment in .venv
.\.venv\Scripts\activate       # Windows activation
pip install -r ml/requirements.txt
```
If the `requirements.txt` file is missing, install the only required package manually:
```bash
pip install pytest
```

## Validation script
```bash
python -m ml.prepare_data --input PATH/TO/input.csv [--output PATH/TO/clean.csv]
```
- Prints a **validation summary** (total rows, missing fields, duplicate rows, invalid `label_verified`, category counts, variants, and warnings).
- If `--output` is supplied, a cleaned CSV containing only *eligible* rows is written. The original input file is never overwritten.

## Cleaned CSV output
`prepare_data.write_clean_csv(output_path, eligible_only=True)` writes a CSV with the same header as the input and only rows that:
- Have non‑empty `name`, `description`, and `category`.
- Are not exact duplicates.
- Contain a valid `label_verified` value (`true/1/yes/y` → True, `false/0/no/n` → False).
- Do not have the literal category `unknown`.

## `label_verified` handling
The column must contain one of the accepted truthy or falsy strings (case‑insensitive). Anything else is treated as **invalid** and the row is excluded.

## Small or imbalanced dataset limitations
The validator emits warnings when:
- A category has fewer than **5** verified examples (recommended minimum for a usable classifier).
- A single category dominates the eligible rows (> 70 % of eligible data).
These warnings help you decide whether you need to collect more labeled data before proceeding to model training.

## Running the test suite
```bash
python -m pytest -q ml/tests
```
All tests use synthetic CSV fixtures and should pass if the validator logic is unchanged.

---
The ML workspace is **isolated** from the rest of the application: no code touches `frontend/` or the Supabase Edge Functions. All files live under `ml/` and can be added to `.gitignore` if you prefer to keep raw data out of version control.
