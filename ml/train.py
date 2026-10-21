#!/usr/bin/env python3
"""
ml/train.py

Train a product‑category classifier using a cleaned CSV produced by ``ml.prepare_data``.

The script:
* Requires ``--input`` path to a cleaned CSV containing the columns ``name``, ``description``,
  ``category`` and ``label_verified``.
* Accepts **only** rows where ``label_verified`` is a recognised truthy value.
* Parses ``label_verified`` safely – strings like "False" are treated as ``False`` and are **not**
  accepted for training.
* Combines ``name`` and ``description`` into a single text field.
* Checks that every category present in the verified subset has at least two examples so a
  stratified ``train_test_split`` is possible.  If this condition is not met the script aborts
  with a clear error message and a non‑zero exit code.
* Performs a stratified split **before** any TF‑IDF fitting (preventing data leakage).
* Trains a scikit‑learn ``Pipeline`` consisting of ``TfidfVectorizer`` → ``LogisticRegression``.
* Evaluates on the held‑out test set, reporting:
    - Category distribution (training & test)
    - Majority‑class baseline accuracy (computed from the training labels only)
    - Model accuracy, macro‑F1 and a full classification report.
* Saves the fitted pipeline to ``--model-output`` (default ``ml/model/tfidf_lr.pkl``) **only** after
  successful evaluation.

The script exits with ``0`` on success, ``1`` on validation/verification errors and ``2`` on
unexpected exceptions.
"""

import argparse
import sys
import os
from pathlib import Path
from typing import List, Tuple

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    classification_report,
)
import joblib

# Accepted truthy / falsy strings (case-insensitive) - keep in sync with ml.prepare_data
TRUE_VALUES = {"true", "1", "yes", "y"}
FALSE_VALUES = {"false", "0", "no", "n"}

# Invalid category placeholders and sentinel values
INVALID_CATEGORY_VALUES = {
    "", "unknown", "null", "none", "n/a", "na", "undefined",
    "unspecified", "cannot_determine", "placeholder", "nan", "nil"
}

STANDARD_MARKETPLACE_CATEGORIES = {
    "Bamboo & Natural Craft",
    "Handloom & Textiles",
    "Pottery",
    "Wood Craft",
    "Metal Craft",
    "Jewellery",
    "Other Handicrafts"
}


def _norm(s: str) -> str:
    return s.strip().lower()


def _parse_label_verified(value: str) -> Tuple[bool, bool, str]:
    """Parse the label_verified column.

    Returns (valid, is_true, error_msg) where valid is False if the value is not a
    recognised boolean string, is_true indicates the parsed boolean (only meaningful when
    valid is True), and error_msg contains a description when valid is False.
    """
    if value is None:
        return False, False, "Missing label_verified"
    norm = _norm(str(value))
    if norm in TRUE_VALUES:
        return True, True, ""
    if norm in FALSE_VALUES:
        return True, False, ""
    return False, False, f"Invalid label_verified '{value}'"


def _load_and_filter(csv_path: Path, allowed_categories: List[str] | None = None) -> pd.DataFrame:
    df = pd.read_csv(csv_path, dtype=str)
    
    # Handle column aliases gracefully
    col_map = {col.strip().lower(): col for col in df.columns}
    if "category" not in df.columns and "current_category" in col_map:
        df["category"] = df[col_map["current_category"]]
    if "label_verified" not in df.columns and "verification_status" in col_map:
        df["label_verified"] = df[col_map["verification_status"]]
    if "name" not in df.columns and "product_name" in col_map:
        df["name"] = df[col_map["product_name"]]
    if "description" not in df.columns and "product_description" in col_map:
        df["description"] = df[col_map["product_description"]]

    # Ensure required columns exist
    required = {"name", "description", "category", "label_verified"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required column(s): {', '.join(sorted(missing))}")

    total_rows = len(df)

    # 1. Reject missing or empty name / description
    name_clean = df["name"].fillna("").astype(str).str.strip()
    desc_clean = df["description"].fillna("").astype(str).str.strip()
    missing_text_mask = (name_clean == "") | (desc_clean == "")

    # 2. Reject invalid category values (empty, placeholders, sentinels, or outside allowed set)
    cat_clean = df["category"].fillna("").astype(str).str.strip()
    cat_norm = cat_clean.str.lower()
    invalid_cat_mask = cat_norm.isin(INVALID_CATEGORY_VALUES)

    if allowed_categories:
        allowed_norm = {_norm(c) for c in allowed_categories}
        invalid_cat_mask = invalid_cat_mask | (~cat_norm.isin(allowed_norm))

    # 3. Parse label_verified safely and reject unverified rows
    parsed = df["label_verified"].apply(_parse_label_verified)
    parsed_df = pd.DataFrame(parsed.tolist(), index=df.index, columns=["_lv_valid", "_lv_true", "_lv_err"])
    df[["_lv_valid", "_lv_true", "_lv_err"]] = parsed_df

    unverified_mask = (~df["_lv_valid"]) | (~df["_lv_true"])

    # Summary of exclusions
    num_missing_text = int(missing_text_mask.sum())
    num_invalid_cat = int(invalid_cat_mask.sum())
    num_unverified = int(unverified_mask.sum())

    # Keep only rows where text is valid, category is valid, AND label is strictly verified
    valid_mask = (~missing_text_mask) & (~invalid_cat_mask) & (~unverified_mask)
    verified = df[valid_mask].copy()

    print(f"Dataset pre-training validation for '{csv_path.name}':")
    print(f"  Total rows read         : {total_rows}")
    print(f"  Rejected unverified rows: {num_unverified}")
    print(f"  Rejected invalid category: {num_invalid_cat}")
    print(f"  Rejected missing text   : {num_missing_text}")
    print(f"  Eligible verified rows  : {len(verified)}")

    if verified.empty:
        raise ValueError(
            f"No verified rows eligible for training found in '{csv_path.name}'. "
            f"All {total_rows} rows were rejected (unverified={num_unverified}, "
            f"invalid_cat={num_invalid_cat}, missing_text={num_missing_text}). "
            f"Labels must be reviewed and verified by a human before model training."
        )

    return verified


def _check_category_counts(df: pd.DataFrame) -> None:
    # At least two verified examples per category are needed for a stratified split.
    counts = df["category"].value_counts()
    insufficient = counts[counts < 2]
    if not insufficient.empty:
        cats = ", ".join(insufficient.index.tolist())
        raise ValueError(
            f"Insufficient verified examples for categories [{cats}]; each needs at least 2 for stratified split."
        )


def _train_and_evaluate(df: pd.DataFrame, model_output: Path) -> None:
    # Combine name + description
    df["text"] = df["name"].fillna("").astype(str).str.strip() + " " + df["description"].fillna("").astype(str).str.strip()
    X = df["text"].values
    y = df["category"].values

    # Stratified split before any vectoriser fitting (prevent leakage)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Baseline: majority class from training set
    majority = pd.Series(y_train).mode()[0]
    baseline_pred = [majority] * len(y_test)
    baseline_acc = accuracy_score(y_test, baseline_pred)

    # Pipeline
    pipeline = (
        ("tfidf", TfidfVectorizer()),
        ("clf", LogisticRegression(max_iter=1000)),
    )
    from sklearn.pipeline import Pipeline

    model = Pipeline(pipeline)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    acc = accuracy_score(y_test, pred)
    macro_f1 = f1_score(y_test, pred, average="macro")
    report = classification_report(y_test, pred, zero_division=0)

    # Reporting
    print("--- Training Summary ---")
    print(f"Total verified rows   : {len(df)}")
    print("Category distribution (verified rows):")
    print(df["category"].value_counts().to_string())
    print(f"\nBaseline accuracy    : {baseline_acc:.4f}")
    print(f"Model accuracy        : {acc:.4f}")
    print(f"Macro-F1 score        : {macro_f1:.4f}")
    print("\nClassification report:")
    print(report)
    print("--- End of Summary ---")

    # Save model after successful evaluation
    model_output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_output)
    print(f"Model pipeline saved to {model_output}")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train a product-category classifier.")
    parser.add_argument("--input", "-i", required=True, help="Path to cleaned CSV containing verified rows.")
    parser.add_argument(
        "--model-output",
        "-o",
        default="ml/model/tfidf_lr.pkl",
        help="Path where the fitted pipeline will be saved.",
    )
    parser.add_argument(
        "--allowed-categories",
        nargs="*",
        default=None,
        help="List of allowed categories (optional).",
    )
    args = parser.parse_args(argv)

    try:
        csv_path = Path(args.input)
        model_path = Path(args.model_output)

        verified_df = _load_and_filter(csv_path, allowed_categories=args.allowed_categories)
        _check_category_counts(verified_df)
        _train_and_evaluate(verified_df, model_path)
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
