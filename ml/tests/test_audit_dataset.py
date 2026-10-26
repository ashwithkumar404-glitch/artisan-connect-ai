import json
import subprocess
import sys
from pathlib import Path
import pytest

import importlib.util

audit_path = Path(__file__).resolve().parents[1] / "audit_dataset.py"
spec = importlib.util.spec_from_file_location("audit_dataset", str(audit_path))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def test_audit_dataset_default_checklist():
    """Verify that auditing the cleaned checklist reports BLOCKED_FOR_TRAINING with 0 duplicates and 0 verified rows."""
    checklist_path = Path(__file__).resolve().parents[1] / "data" / "human_review_checklist.csv"
    assert checklist_path.is_file()

    rep = audit.audit_file(checklist_path)
    assert rep["filename"] == "human_review_checklist.csv"
    assert rep["total_rows"] == 21
    assert rep["verified_rows"] == 0
    assert rep["unverified_rows"] == 21
    assert rep["eligible_rows"] == 21
    assert rep["duplicate_rows"] == 0
    assert rep["invalid_category"] == 0
    assert rep["status"] == "BLOCKED_FOR_TRAINING"


def test_audit_dataset_detects_duplicates_and_invalid_categories(tmp_path):
    """Verify that audit_file correctly detects duplicates and non-standard categories on a fixture."""
    test_csv = tmp_path / "test_audit.csv"
    test_csv.write_text(
        "name,description,category,source,label_verified\n"
        "Basket,Handwoven bamboo storage.,Bamboo & Natural Craft,web,false\n"
        "Basket,Handwoven bamboo storage.,Bamboo & Natural Craft,web,false\n"
        "Wall Art,Painting for decor.,Home Decor,web,false\n",
        encoding="utf-8"
    )

    rep = audit.audit_file(test_csv)
    assert rep["total_rows"] == 3
    assert rep["duplicate_rows"] == 1
    assert rep["invalid_category"] == 1  # 'Home Decor' is not official
    assert "Home Decor" in rep["non_standard_categories"]
    assert rep["eligible_rows"] == 1
    assert rep["status"] == "BLOCKED_FOR_TRAINING"


def test_audit_dataset_cli_json_output(capsys):
    """Verify CLI argument parsing and JSON reporting."""
    checklist_path = Path(__file__).resolve().parents[1] / "data" / "human_review_checklist.csv"
    rc = audit.main(["--input", str(checklist_path), "--json"])
    assert rc == 0

    captured = capsys.readouterr()
    data = json.loads(captured.out)
    assert data["filename"] == "human_review_checklist.csv"
    assert data["verified_rows"] == 0
    assert data["status"] == "BLOCKED_FOR_TRAINING"


def test_audit_dataset_nonexistent_file():
    """Verify that auditing a non-existent file returns error code 1."""
    rc = audit.main(["--input", "non_existent_file.csv"])
    assert rc == 1
