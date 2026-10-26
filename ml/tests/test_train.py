import pytest
import pandas as pd
import os
from pathlib import Path
import joblib

# Import internal functions from the training script
import importlib.util

spec = importlib.util.spec_from_file_location("train", str(Path(__file__).resolve().parents[1] / "train.py"))
train = importlib.util.module_from_spec(spec)
spec.loader.exec_module(train)


def test_parse_label_verified_truthy():
    valid, is_true, err = train._parse_label_verified("Yes")
    assert valid is True
    assert is_true is True
    assert err == ""


def test_parse_label_verified_falsy():
    valid, is_true, err = train._parse_label_verified("no")
    assert valid is True
    assert is_true is False
    assert err == ""


def test_parse_label_verified_invalid():
    valid, is_true, err = train._parse_label_verified("maybe")
    assert valid is False
    assert is_true is False
    assert "Invalid label_verified" in err


def test_insufficient_verified_examples_raises():
    # Create a DataFrame with only one example for category 'A'
    df = pd.DataFrame({
        "name": ["prod1"],
        "description": ["desc"],
        "category": ["A"],
        "label_verified": ["true"],
    })
    # The check requires at least 2 per category
    with pytest.raises(ValueError) as exc:
        train._check_category_counts(df)
    assert "Insufficient verified examples" in str(exc.value)

def test_successful_training_and_model_save(tmp_path):
    # Build a minimal verified CSV with two categories each having **six** rows (12 total)
    rows = [
        {"name": "p1", "description": "d1", "category": "A", "label_verified": "true"},
        {"name": "p2", "description": "d2", "category": "A", "label_verified": "true"},
        {"name": "p3", "description": "d3", "category": "A", "label_verified": "true"},
        {"name": "p4", "description": "d4", "category": "A", "label_verified": "true"},
        {"name": "p5", "description": "d5", "category": "A", "label_verified": "true"},
        {"name": "p6", "description": "d6", "category": "A", "label_verified": "true"},
        {"name": "p7", "description": "d7", "category": "B", "label_verified": "true"},
        {"name": "p8", "description": "d8", "category": "B", "label_verified": "true"},
        {"name": "p9", "description": "d9", "category": "B", "label_verified": "true"},
        {"name": "p10", "description": "d10", "category": "B", "label_verified": "true"},
        {"name": "p11", "description": "d11", "category": "B", "label_verified": "true"},
        {"name": "p12", "description": "d12", "category": "B", "label_verified": "true"},
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "verified.csv"
    df.to_csv(csv_path, index=False)

    model_path = tmp_path / "model.pkl"

    # Run the training script's main function directly
    rc = train.main(["--input", str(csv_path), "--model-output", str(model_path)])
    assert rc == 0
    # Verify that the model file was created
    assert model_path.is_file()

def test_stratified_split_failure_on_small_dataset(tmp_path):
    # Dataset too small for a stratified 20% split (needs at least 2 test samples for 2 classes)
    rows = [
        {"name": "s1", "description": "d1", "category": "A", "label_verified": "true"},
        {"name": "s2", "description": "d2", "category": "B", "label_verified": "true"},
        {"name": "s3", "description": "d3", "category": "A", "label_verified": "true"},
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "small.csv"
    df.to_csv(csv_path, index=False)

    model_path = tmp_path / "model_small.pkl"
    rc = train.main(["--input", str(csv_path), "--model-output", str(model_path)])
    # Expect a non-zero exit code due to the stratified split error
    assert rc != 0
    # Model file should NOT be created
    assert not model_path.is_file()


def test_rejects_all_unverified_dataset(tmp_path):
    rows = [
        {"name": "p1", "description": "d1", "category": "A", "label_verified": "false"},
        {"name": "p2", "description": "d2", "category": "B", "label_verified": "false"},
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "unverified.csv"
    df.to_csv(csv_path, index=False)

    with pytest.raises(ValueError, match="No verified rows eligible for training found"):
        train._load_and_filter(csv_path)


def test_rejects_invalid_category_values(tmp_path):
    rows = [
        {"name": "p1", "description": "d1", "category": "unknown", "label_verified": "true"},
        {"name": "p2", "description": "d2", "category": "null", "label_verified": "true"},
        {"name": "p3", "description": "d3", "category": "cannot_determine", "label_verified": "true"},
        {"name": "p4", "description": "d4", "category": "A", "label_verified": "true"},
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "invalid_cats.csv"
    df.to_csv(csv_path, index=False)

    filtered = train._load_and_filter(csv_path)
    # Only p4 with category "A" should survive
    assert len(filtered) == 1
    assert filtered.iloc[0]["name"] == "p4"


def test_rejects_unallowed_category_when_specified(tmp_path):
    rows = [
        {"name": "p1", "description": "d1", "category": "A", "label_verified": "true"},
        {"name": "p2", "description": "d2", "category": "C", "label_verified": "true"},
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "allowed_cats.csv"
    df.to_csv(csv_path, index=False)

    filtered = train._load_and_filter(csv_path, allowed_categories=["A", "B"])
    assert len(filtered) == 1
    assert filtered.iloc[0]["category"] == "A"


def test_train_resolves_review_columns_overrides(tmp_path):
    rows = [
        {
            "row_number": "1",
            "original_name": "Test Bamboo Basket",
            "reviewed_name": "Natural Bamboo Strip Basket",
            "original_description": "Handmade bamboo basket created by a traditional artisan.",
            "reviewed_description": "Exquisitely handwoven natural bamboo strips.",
            "original_category": "Other Handicrafts",
            "suggested_category": "Bamboo & Natural Craft",
            "reviewed_category": "Bamboo & Natural Craft",
            "verification_status": "True",
            "flag": "AMBIGUOUS_TEST_TITLE",
            "review_notes": "Reviewed and approved"
        },
        {
            "row_number": "2",
            "original_name": "Handmade Bamboo Basket",
            "reviewed_name": "",
            "original_description": "Handmade bamboo basket created by a traditional artisan.",
            "reviewed_description": "",
            "original_category": "Bamboo & Natural Craft",
            "suggested_category": "Bamboo & Natural Craft",
            "reviewed_category": "",
            "verification_status": "True",
            "flag": "VALID_CANDIDATE",
            "review_notes": "Approved original values"
        }
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "reviewed_workflow.csv"
    df.to_csv(csv_path, index=False)

    filtered = train._load_and_filter(csv_path)
    assert len(filtered) == 2
    # Row 1 overrides used
    assert filtered.iloc[0]["name"] == "Natural Bamboo Strip Basket"
    assert filtered.iloc[0]["description"] == "Exquisitely handwoven natural bamboo strips."
    assert filtered.iloc[0]["category"] == "Bamboo & Natural Craft"
    # Row 2 fallback used
    assert filtered.iloc[1]["name"] == "Handmade Bamboo Basket"
    assert filtered.iloc[1]["description"] == "Handmade bamboo basket created by a traditional artisan."
    assert filtered.iloc[1]["category"] == "Bamboo & Natural Craft"


def test_train_rejects_duplicate_verified_rows(tmp_path):
    rows = [
        {"name": "Basket", "description": "Handwoven basket.", "category": "Bamboo", "label_verified": "true"},
        {"name": "Basket", "description": "Handwoven basket.", "category": "Bamboo", "label_verified": "true"},
        {"name": "Pot", "description": "Clay cooking pot.", "category": "Pottery", "label_verified": "true"},
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "duplicates.csv"
    df.to_csv(csv_path, index=False)

    filtered = train._load_and_filter(csv_path)
    assert len(filtered) == 2
    names = filtered["name"].tolist()
    assert names == ["Basket", "Pot"]


def test_train_rejects_placeholder_text(tmp_path):
    rows = [
        {"name": "p1", "description": "placeholder", "category": "A", "label_verified": "true"},
        {"name": "unknown", "description": "Valid description text", "category": "A", "label_verified": "true"},
        {"name": "p3", "description": "Valid description text", "category": "A", "label_verified": "true"},
    ]
    df = pd.DataFrame(rows)
    csv_path = tmp_path / "placeholders.csv"
    df.to_csv(csv_path, index=False)

    filtered = train._load_and_filter(csv_path)
    assert len(filtered) == 1
    assert filtered.iloc[0]["name"] == "p3"


def test_train_blocks_actual_unverified_checklist():
    actual_checklist = Path(__file__).resolve().parents[1] / "data" / "human_review_checklist.csv"
    assert actual_checklist.is_file()
    with pytest.raises(ValueError, match="No verified rows eligible for training found"):
        train._load_and_filter(actual_checklist)


