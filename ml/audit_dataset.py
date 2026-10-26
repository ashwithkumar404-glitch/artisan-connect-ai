#!/usr/bin/env python3
"""ml/audit_dataset.py

Audit script for ML product-category datasets.
By default, audits the intended human review checklist (ml/data/human_review_checklist.csv).
Optionally audits any specified CSV via --input.

Usage
-----
    python -m ml.audit_dataset [--input PATH/TO/FILE.csv] [--json] [--all]
"""

import argparse
import json
import sys
from pathlib import Path
import importlib.util
from typing import List, Optional, Dict

ML_DIR = Path(__file__).resolve().parent
prepare_data_path = ML_DIR / "prepare_data.py"

spec = importlib.util.spec_from_file_location("prepare_data", str(prepare_data_path))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

DatasetValidator = prepare.DatasetValidator
STANDARD_MARKETPLACE_CATEGORIES = sorted(prepare.STANDARD_MARKETPLACE_CATEGORIES)


def audit_file(csv_path: Path, allowed_categories: Optional[List[str]] = None) -> Dict:
    """Run DatasetValidator on a specific CSV and compile an audit dictionary."""
    target_allowed = allowed_categories if allowed_categories is not None else STANDARD_MARKETPLACE_CATEGORIES
    validator = DatasetValidator(csv_path, allowed_categories=target_allowed)
    summary = validator.validate()
    
    return {
        "file": str(csv_path),
        "filename": csv_path.name,
        "total_rows": summary["total_rows"],
        "missing_name": summary["missing_name"],
        "missing_description": summary["missing_description"],
        "missing_category": summary["missing_category"],
        "invalid_category": summary["invalid_category"],
        "duplicate_rows": summary["duplicate_rows"],
        "invalid_label_verified": summary["invalid_label_verified"],
        "eligible_rows": summary["eligible_rows"],
        "verified_rows": summary["verified_rows"],
        "unverified_rows": summary["unverified_rows"],
        "raw_category_counts": summary["raw_category_counts"],
        "eligible_category_counts": summary["eligible_category_counts"],
        "verified_category_counts": summary["verified_category_counts"],
        "unverified_category_counts": summary["unverified_category_counts"],
        "non_standard_categories": summary.get("non_standard_categories", {}),
        "warnings": summary.get("warnings", []),
        "status": "BLOCKED_FOR_TRAINING" if summary["verified_rows"] == 0 else "READY_FOR_PREPARATION",
    }


def print_audit_report(report: Dict) -> None:
    """Print human-readable audit results."""
    print("=" * 60)
    print(f"  ARTISAN CONNECT AI - DATASET AUDIT REPORT")
    print(f"  Target file: {report['filename']}")
    print("=" * 60)
    print(f"Total records audited     : {report['total_rows']}")
    print(f"Explicitly verified rows  : {report['verified_rows']}")
    print(f"Unverified rows           : {report['unverified_rows']}")
    print(f"Eligible rows             : {report['eligible_rows']}")
    print(f"Duplicate rows detected   : {report['duplicate_rows']}")
    print(f"Missing / placeholder name: {report['missing_name']}")
    print(f"Missing / placeholder desc: {report['missing_description']}")
    print(f"Invalid category entries  : {report['invalid_category']}")
    print("-" * 60)
    print("Category breakdown (raw):")
    for cat, count in report["raw_category_counts"].items():
        is_std = "(Official)" if cat in prepare.STANDARD_MARKETPLACE_CATEGORIES else "(NON-STANDARD)"
        print(f"  - {cat}: {count} {is_std}")
    
    if report["non_standard_categories"]:
        print("\n[!] Non-standard categories requiring correction:")
        for cat, count in report["non_standard_categories"].items():
            print(f"  * '{cat}' ({count} records) - must be corrected or excluded before training.")

    if report["warnings"]:
        print("\nWarnings:")
        for w in report["warnings"]:
            print(f"  * {w}")

    print("-" * 60)
    if report["verified_rows"] == 0:
        print("[AUDIT STATUS] BLOCKED: 0 verified labels exist.")
        print("  Action required: A human reviewer must inspect the checklist:")
        print(f"  --> {report['file']}")
        print("  Approve or correct records and set 'verification_status' to 'True'.")
        print("  Model training will not run until at least 2 verified examples per category exist.")
    else:
        print(f"[AUDIT STATUS] OK: {report['verified_rows']} verified labels available.")
    print("=" * 60)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Audit an ML product-category CSV dataset for quality, verification, and training readiness."
    )
    default_review_file = ML_DIR / "data" / "human_review_checklist.csv"
    parser.add_argument(
        "--input",
        "-i",
        default=str(default_review_file),
        help=f"Path to CSV file to audit (defaults to {default_review_file.name}).",
    )
    parser.add_argument(
        "--allowed-categories",
        nargs="*",
        default=None,
        help="Optional list of allowed categories. If omitted, checks against standard categories.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output audit result as JSON.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Audit all CSV files in ml/data/ directory.",
    )
    args = parser.parse_args(argv)

    try:
        if args.all:
            data_dir = ML_DIR / "data"
            all_reports = {}
            for csv_path in sorted(data_dir.glob("*.csv")):
                try:
                    all_reports[csv_path.name] = audit_file(csv_path, allowed_categories=args.allowed_categories)
                except Exception as e:
                    all_reports[csv_path.name] = {"error": str(e)}
            if args.json:
                print(json.dumps(all_reports, indent=2))
            else:
                for fname, rep in all_reports.items():
                    if "error" in rep:
                        print(f"[{fname}] ERROR: {rep['error']}")
                    else:
                        print_audit_report(rep)
            return 0

        target_path = Path(args.input)
        if not target_path.is_file():
            print(f"Error: Target file '{target_path}' does not exist.", file=sys.stderr)
            return 1

        rep = audit_file(target_path, allowed_categories=args.allowed_categories)
        if args.json:
            print(json.dumps(rep, indent=2))
        else:
            print_audit_report(rep)
        return 0

    except Exception as e:
        print(f"Fatal audit error: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
