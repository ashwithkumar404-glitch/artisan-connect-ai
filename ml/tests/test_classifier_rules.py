import subprocess
import sys
from pathlib import Path
import pytest

def test_classifier_node_suite():
    """Execute the classifier regression test suite in supabase/functions/generate-product/test_classifier.cjs."""
    repo_root = Path(__file__).resolve().parents[2]
    test_script = repo_root / "supabase" / "functions" / "generate-product" / "test_classifier.cjs"
    assert test_script.is_file(), f"Test script {test_script} does not exist"

    res = subprocess.run(
        ["node", str(test_script)],
        cwd=str(repo_root),
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"Classifier tests failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    assert "CLASSIFIER TESTS PASSED!" in res.stdout
