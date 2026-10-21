import csv
import sys
from pathlib import Path
from typing import List

import pytest

# Helper to load the validator module without importing the package (so that the script can be used as a module)
import importlib.util

def load_validator(module_path: Path):
    spec = importlib.util.spec_from_file_location("prepare_data", module_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules["prepare_data"] = module
    spec.loader.exec_module(module)  # type: ignore
    return module.DatasetValidator

@pytest.fixture
def temp_csv(tmp_path):
    def _make(content: str) -> Path:
        p = tmp_path / "test.csv"
        p.write_text(content, encoding="utf-8")
        return p
    return _make

def test_missing_required_columns(temp_csv):
    csv_content = "name,description,source\nproduct1,desc1,web"
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    with pytest.raises(ValueError, match="Missing required column"):
        Validator(csv_path).validate()

def test_empty_csv(temp_csv):
    csv_content = "name,description,category,source,label_verified\n"
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    summary = Validator(csv_path).validate()
    assert summary["total_rows"] == 0
    assert summary["eligible_rows"] == 0

def test_multiple_missing_fields(temp_csv):
    csv_content = (
        "name,description,category,source,label_verified\n"
        ",, ,web,true\n"
    )
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    summary = Validator(csv_path).validate()
    # All three missing fields count as one excluded row
    assert summary["missing_name"] == 1
    assert summary["missing_description"] == 1
    assert summary["missing_category"] == 1
    assert summary["eligible_rows"] == 0
    assert summary["excluded_row_indices"] == [0]

def test_duplicate_rows(temp_csv):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "prod,desc,Cat,web,true\n"
        "prod,desc,Cat,web,true\n"
    )
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    summary = Validator(csv_path).validate()
    # One duplicate (second row) should be counted
    assert summary["duplicate_rows"] == 1
    # Eligible rows should be 1 (first kept)
    assert summary["eligible_rows"] == 1
    assert summary["excluded_row_indices"] == [1]

def test_invalid_label_verified(temp_csv):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "p1,d1,Cat,web,maybe\n"
        "p2,d2,Cat,web,true\n"
    )
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    summary = Validator(csv_path).validate()
    assert summary["invalid_label_verified"] == 1
    # Only the valid row is eligible
    assert summary["eligible_rows"] == 1
    assert summary["excluded_row_indices"] == [0]

def test_blank_and_unknown_category(temp_csv):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "p1,d1,,web,true\n"  # blank category
        "p2,d2,unknown,web,true\n"  # unknown literal
    )
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    summary = Validator(csv_path).validate()
    assert summary["missing_category"] == 1
    # unknown category also excluded
    assert summary["eligible_rows"] == 0
    assert set(summary["excluded_row_indices"]).issuperset({0, 1})

def test_category_variants_and_counts(temp_csv):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "p1,d1,Handicraft,web,true\n"
        "p2,d2,handicraft,app,false\n"
        "p3,d3,HOME,web,true\n"
    )
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    summary = Validator(csv_path).validate()
    # Variant detection for Handicraft/handicraft
    assert "handicraft" in summary["category_variants"]
    # Raw counts include both
    assert summary["raw_category_counts"]["Handicraft"] == 1
    assert summary["raw_category_counts"]["handicraft"] == 1
    # Eligible rows should be 3 (all valid)
    assert summary["eligible_rows"] == 3
    # Verified rows count 2 (p1 and p3 have true)
    assert summary["verified_rows"] == 2

def test_clean_csv_output(temp_csv, tmp_path):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "p1,d1,Cat,web,true\n"
        "p1,d1,Cat,web,true\n"  # duplicate
        "p2,,Cat,web,false\n"  # missing description
    )
    csv_path = temp_csv(csv_content)
    out_path = tmp_path / "clean.csv"
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    validator = Validator(csv_path)
    validator.validate()
    validator.write_clean_csv(out_path)
    # Ensure source file unchanged
    assert csv_path.read_text() == csv_content
    # Clean file should contain only the first row (eligible)
    rows = list(csv.DictReader(out_path.open()))
    assert len(rows) == 1
    assert rows[0]["name"] == "p1"

def test_imbalanced_and_low_verified_warnings(temp_csv):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "p1,d1,CatA,web,true\n"  # only 1 verified for CatA
        "p2,d2,CatA,web,false\n"
        "p3,d3,CatA,web,false\n"
        "p4,d4,CatB,web,true\n"
        "p5,d5,CatB,web,true\n"
        "p6,d6,CatB,web,true\n"
    )
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    summary = Validator(csv_path).validate()
    # Expect warning about CatA low verified examples
    low_verified = any("CatA" in w for w in summary["warnings"])
    assert low_verified
    # No class dominance warning because CatB has 3/5 eligible (<70%)
    assert not any("dominates" in w for w in summary["warnings"])


def test_clean_csv_verified_only(temp_csv, tmp_path):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "p1,d1,CatA,web,true\n"
        "p2,d2,CatA,web,false\n"
    )
    csv_path = temp_csv(csv_content)
    out_path = tmp_path / "verified_clean.csv"
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    validator = Validator(csv_path)
    validator.validate()
    validator.write_clean_csv(out_path, eligible_only=True, verified_only=True)
    rows = list(csv.DictReader(out_path.open()))
    assert len(rows) == 1
    assert rows[0]["name"] == "p1"
    assert rows[0]["label_verified"] == "true"


def test_prepare_allowed_categories_filter(temp_csv):
    csv_content = (
        "name,description,category,source,label_verified\n"
        "p1,d1,CatA,web,true\n"
        "p2,d2,CatC,web,true\n"
    )
    csv_path = temp_csv(csv_content)
    Validator = load_validator(Path(__file__).parents[1] / "prepare_data.py")
    validator = Validator(csv_path, allowed_categories=["CatA", "CatB"])
    summary = validator.validate()
    assert summary["eligible_rows"] == 1
    assert summary["invalid_category"] == 1

