#!/usr/bin/env python3
"""Audit script for the ML CSV files.
It loads each CSV in ml/data using the DatasetValidator from ml.prepare_data
and prints a concise JSON report for each file.
"""
import json
import sys
from pathlib import Path
import importlib.util

ML_DIR = Path(__file__).resolve().parent
prepare_data_path = ML_DIR / "prepare_data.py"

spec = importlib.util.spec_from_file_location("prepare_data", str(prepare_data_path))
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

DATA_DIR = ML_DIR / "data"
report = {}
for csv_file in sorted(DATA_DIR.glob("*.csv")):
    try:
        validator = prepare.DatasetValidator(csv_file)
        summary = validator.validate()
        report[csv_file.name] = {
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
            "non_standard_categories": summary.get("non_standard_categories", {}),
            "warnings": summary.get("warnings", []),
        }
    except Exception as e:
        report[csv_file.name] = {"error": str(e)}

print(json.dumps(report, indent=2))

