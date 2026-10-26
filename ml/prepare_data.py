#!/usr/bin/env python3
"""ml/prepare_data.py

Validate and prepare a CSV dataset for product‑category classification.

Expected columns (case‑sensitive):
    name, description, category, source, label_verified

The script reports detailed statistics and can write a cleaned CSV to a
separate file (never overwriting the original).  It performs **no model
training** – it is only a preprocessing step.

Usage
-----
    python -m ml.prepare_data --input INPUT.csv [--output CLEANED.csv]

The return code is 0 for a successful validation (even if rows are
excluded) and >0 for fatal errors such as missing columns or an empty
input file.
"""

import argparse
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import List, Dict, Tuple, Set, Optional

# Helper utilities
TRUE_VALUES = {"true", "1", "yes", "y"}
FALSE_VALUES = {"false", "0", "no", "n"}
_REQUIRED_COLUMNS = ["name", "description", "category", "source", "label_verified"]

# Invalid category placeholders and sentinel values
INVALID_CATEGORY_VALUES = {
    "", "unknown", "null", "none", "n/a", "na", "undefined",
    "unspecified", "cannot_determine", "placeholder", "nan", "nil",
    "exclude", "excluded", "reject", "rejected", "discard", "discarded",
    "invalid", "unverified"
}

# Invalid text placeholders and sentinels for name and description
INVALID_TEXT_VALUES = {
    "", "unknown", "null", "none", "n/a", "na", "undefined", "placeholder", "nan", "nil"
}

# Standard marketplace categories for Artisan Connect AI
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
    if value is None:
        return False, False, "Missing label_verified"
    norm = _norm(value)
    if norm in TRUE_VALUES:
        return True, True, ""
    if norm in FALSE_VALUES:
        return True, False, ""
    return False, False, f"Invalid label_verified '{value}'"

class DatasetValidator:
    """Validate a CSV file according to the dataset quality policy."""
    def __init__(self, input_path: Path, allowed_categories: Optional[List[str]] = None):
        self.input_path = input_path
        self.allowed_categories = allowed_categories
        self.allowed_categories_norm = (
            {_norm(c) for c in allowed_categories} if allowed_categories else None
        )
        self.header: List[str] = []
        self.rows: List[Dict[str, str]] = []

    def _load(self) -> None:
        if not self.input_path.is_file():
            raise FileNotFoundError(f"Input file '{self.input_path}' does not exist")
        with self.input_path.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            raw_header = reader.fieldnames or []
            if not raw_header:
                raise ValueError("CSV file has no header row")
            
            # Support separate review/original columns and standard aliases
            col_map = {}
            for col in raw_header:
                col_lower = col.strip().lower()
                if col_lower == "reviewed_category":
                    col_map["reviewed_category"] = col
                elif col_lower in {"original_category", "current_category"}:
                    col_map["original_category"] = col
                elif col_lower == "category":
                    col_map["category"] = col

                if col_lower == "reviewed_name":
                    col_map["reviewed_name"] = col
                elif col_lower in {"original_name", "product_name"}:
                    col_map["original_name"] = col
                elif col_lower == "name":
                    col_map["name"] = col

                if col_lower == "reviewed_description":
                    col_map["reviewed_description"] = col
                elif col_lower in {"original_description", "product_description"}:
                    col_map["original_description"] = col
                elif col_lower == "description":
                    col_map["description"] = col

                if col_lower in {"label_verified", "verification_status"}:
                    col_map["label_verified"] = col
                elif col_lower in {"source"}:
                    col_map["source"] = col

            self.header = list(raw_header)
            for row in reader:
                cleaned_row = {k: (v or "").strip() for k, v in row.items()}
                
                # Resolve name: reviewed_name > original_name > name
                name = ""
                if "reviewed_name" in col_map and row.get(col_map["reviewed_name"], "").strip():
                    name = row[col_map["reviewed_name"]].strip()
                elif "original_name" in col_map and row.get(col_map["original_name"], "").strip():
                    name = row[col_map["original_name"]].strip()
                elif "name" in col_map and row.get(col_map["name"], "").strip():
                    name = row[col_map["name"]].strip()

                # Resolve description: reviewed_description > original_description > description
                description = ""
                if "reviewed_description" in col_map and row.get(col_map["reviewed_description"], "").strip():
                    description = row[col_map["reviewed_description"]].strip()
                elif "original_description" in col_map and row.get(col_map["original_description"], "").strip():
                    description = row[col_map["original_description"]].strip()
                elif "description" in col_map and row.get(col_map["description"], "").strip():
                    description = row[col_map["description"]].strip()

                # Resolve category: reviewed_category > original_category > category
                category = ""
                if "reviewed_category" in col_map and row.get(col_map["reviewed_category"], "").strip():
                    category = row[col_map["reviewed_category"]].strip()
                elif "original_category" in col_map and row.get(col_map["original_category"], "").strip():
                    category = row[col_map["original_category"]].strip()
                elif "category" in col_map and row.get(col_map["category"], "").strip():
                    category = row[col_map["category"]].strip()

                # Resolve label_verified
                label_verified = ""
                if "label_verified" in col_map:
                    label_verified = row.get(col_map["label_verified"], "").strip()

                # Resolve source
                source = "dataset_export"
                if "source" in col_map and row.get(col_map["source"], "").strip():
                    source = row[col_map["source"]].strip()

                cleaned_row["name"] = name
                cleaned_row["description"] = description
                cleaned_row["category"] = category
                cleaned_row["label_verified"] = label_verified
                cleaned_row["source"] = source
                self.rows.append(cleaned_row)

        # Check required columns
        has_name = any(k in col_map for k in ("reviewed_name", "original_name", "name"))
        has_desc = any(k in col_map for k in ("reviewed_description", "original_description", "description"))
        has_cat = any(k in col_map for k in ("reviewed_category", "original_category", "category"))
        has_lv = "label_verified" in col_map

        missing = []
        if not has_name:
            missing.append("name")
        if not has_desc:
            missing.append("description")
        if not has_cat:
            missing.append("category")
        if not has_lv:
            missing.append("label_verified")

        if missing:
            raise ValueError(f"Missing required column(s): {', '.join(missing)}")

    def _detect_duplicates(self) -> Set[int]:
        seen: Set[Tuple[str, str, str]] = set()
        dup: Set[int] = set()
        for i, row in enumerate(self.rows):
            # Key based on core content: name, description, category (case-insensitive)
            key = (
                row.get("name", "").strip().lower(),
                row.get("description", "").strip().lower(),
                row.get("category", "").strip().lower()
            )
            if key in seen:
                dup.add(i)
            else:
                seen.add(key)
        return dup

    def _analyse(self) -> Dict:
        total = len(self.rows)
        excluded: Set[int] = set()
        missing_name = {
            i for i, r in enumerate(self.rows)
            if not r.get("name") or _norm(r.get("name", "")) in INVALID_TEXT_VALUES
        }
        missing_desc = {
            i for i, r in enumerate(self.rows)
            if not r.get("description") or _norm(r.get("description", "")) in INVALID_TEXT_VALUES
        }
        missing_cat = {i for i, r in enumerate(self.rows) if not r.get("category")}
        excluded.update(missing_name | missing_desc | missing_cat)

        duplicate = self._detect_duplicates()
        excluded.update(duplicate)

        invalid_verified: Set[int] = set()
        verified_true: Set[int] = set()
        verified_false: Set[int] = set()
        for i, r in enumerate(self.rows):
            valid, is_true, _ = _parse_label_verified(r.get("label_verified"))
            if not valid:
                invalid_verified.add(i)
                excluded.add(i)
            else:
                if is_true:
                    verified_true.add(i)
                else:
                    verified_false.add(i)

        # Reject invalid categories (empty, placeholders, or outside allowed set if specified)
        invalid_cat: Set[int] = set()
        for i, r in enumerate(self.rows):
            cat_norm = _norm(r.get("category", ""))
            if cat_norm in INVALID_CATEGORY_VALUES:
                invalid_cat.add(i)
            elif self.allowed_categories_norm and cat_norm not in self.allowed_categories_norm:
                invalid_cat.add(i)
        excluded.update(invalid_cat)

        eligible = set(range(total)) - excluded

        def cat_counts(indices: Set[int]) -> Counter:
            c = Counter()
            for i in indices:
                cat = self.rows[i]["category"].strip()
                if cat:
                    c[cat] += 1
            return c

        raw_counts = cat_counts(set(range(total)))
        eligible_counts = cat_counts(eligible)
        verified_counts = cat_counts(verified_true & eligible)
        unverified_counts = cat_counts(verified_false & eligible)

        # Non-standard marketplace category check
        non_standard_cats = {
            cat: cnt for cat, cnt in raw_counts.items()
            if cat not in STANDARD_MARKETPLACE_CATEGORIES
        }

        # Variant detection (case-insensitive)
        norm_map: defaultdict = defaultdict(set)
        for cat in raw_counts:
            norm_map[_norm(cat)].add(cat)
        variants = {norm: list(names) for norm, names in norm_map.items() if len(names) > 1}

        # Warnings for low verified examples & imbalance
        warnings: List[str] = []
        min_verified = 5
        for cat, cnt in verified_counts.items():
            if cnt < min_verified:
                warnings.append(f"Category '{cat}' has only {cnt} verified examples (minimum recommended {min_verified}).")
        if eligible:
            total_eligible = len(eligible)
            for cat, cnt in eligible_counts.items():
                if cnt / total_eligible > 0.7:
                    warnings.append(f"Category '{cat}' dominates eligible rows ({cnt}/{total_eligible} ~ {cnt/total_eligible:.0%}).")
        if non_standard_cats:
            for nsc, cnt in non_standard_cats.items():
                warnings.append(f"Non-standard marketplace category '{nsc}' detected ({cnt} rows). Review recommended.")

        return {
            "total_rows": total,
            "missing_name": len(missing_name),
            "missing_description": len(missing_desc),
            "missing_category": len(missing_cat),
            "invalid_category": len(invalid_cat),
            "duplicate_rows": len(duplicate),
            "invalid_label_verified": len(invalid_verified),
            "eligible_rows": len(eligible),
            "verified_rows": len(verified_true & eligible),
            "unverified_rows": len(verified_false & eligible),
            "raw_category_counts": dict(raw_counts),
            "eligible_category_counts": dict(eligible_counts),
            "verified_category_counts": dict(verified_counts),
            "unverified_category_counts": dict(unverified_counts),
            "category_variants": variants,
            "non_standard_categories": non_standard_cats,
            "warnings": warnings,
            "excluded_row_indices": sorted(excluded),
            "eligible_row_indices": sorted(eligible),
            "verified_row_indices": sorted(verified_true & eligible),
        }

    def validate(self) -> Dict:
        self._load()
        return self._analyse()

    def write_clean_csv(self, output_path: Path, eligible_only: bool = True, verified_only: bool = False) -> None:
        summary = self._analyse()
        if verified_only:
            indices = summary["verified_row_indices"]
        elif eligible_only:
            indices = summary["eligible_row_indices"]
        else:
            indices = list(range(len(self.rows)))

        # Output standard columns
        out_columns = ["name", "description", "category", "source", "label_verified"]
        with output_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=out_columns)
            writer.writeheader()
            for i in indices:
                row = self.rows[i]
                writer.writerow({
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "category": row.get("category", ""),
                    "source": row.get("source", "dataset_clean"),
                    "label_verified": row.get("label_verified", "false"),
                })

def _print_summary(s: Dict) -> None:
    print("--- Validation Summary ---")
    print(f"Total rows                : {s['total_rows']}")
    print(f"Missing name              : {s['missing_name']}")
    print(f"Missing description       : {s['missing_description']}")
    print(f"Missing category          : {s['missing_category']}")
    print(f"Invalid category          : {s['invalid_category']}")
    print(f"Duplicate rows            : {s['duplicate_rows']}")
    print(f"Invalid label_verified    : {s['invalid_label_verified']}")
    print(f"Eligible rows             : {s['eligible_rows']} (verified {s['verified_rows']}, unverified {s['unverified_rows']})")
    print("\nRaw category counts:")
    for cat, cnt in s['raw_category_counts'].items():
        print(f"  {cat}: {cnt}")
    print("\nEligible category counts:")
    for cat, cnt in s['eligible_category_counts'].items():
        print(f"  {cat}: {cnt}")
    print("\nVerified category counts:")
    for cat, cnt in s['verified_category_counts'].items():
        print(f"  {cat}: {cnt}")
    if s['category_variants']:
        print("\nPotential spelling/capitalisation variants detected:")
        for norm, vars in s['category_variants'].items():
            print(f"  {norm} => {', '.join(vars)}")
    if s.get('non_standard_categories'):
        print("\nNon-standard categories detected (outside 7 official marketplace categories):")
        for nsc, cnt in s['non_standard_categories'].items():
            print(f"  {nsc}: {cnt} rows")
    if s['warnings']:
        print("\nWarnings:")
        for w in s['warnings']:
            print(f"  - {w}")
    print("--- End of Summary ---")

def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate and optionally clean a product-category CSV dataset.")
    parser.add_argument("--input", "-i", required=True, help="Path to input CSV.")
    parser.add_argument("--output", "-o", help="Path to write cleaned CSV (optional).")
    parser.add_argument(
        "--verified-only",
        action="store_true",
        help="Write only rows with verified labels (label_verified=True) to the cleaned CSV."
    )
    parser.add_argument(
        "--allowed-categories",
        nargs="*",
        default=None,
        help="List of allowed categories (optional). If omitted, standard non-empty check is used."
    )
    args = parser.parse_args(argv)
    try:
        validator = DatasetValidator(Path(args.input), allowed_categories=args.allowed_categories)
        summary = validator.validate()
        _print_summary(summary)
        if args.output:
            out_path = Path(args.output)
            if out_path.resolve() == Path(args.input).resolve():
                print("Error: output file must differ from input file.", file=sys.stderr)
                return 1
            validator.write_clean_csv(out_path, eligible_only=True, verified_only=args.verified_only)
            print(f"Cleaned CSV written to {out_path} (verified_only={args.verified_only})")
        return 0
    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    sys.exit(main())
