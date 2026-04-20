import json
from pathlib import Path

import pytest

from app.eval.datasets import (
    list_datasets,
    load_dataset,
    DATASETS_DIR,
)


def test_load_json_dataset(tmp_path):
    data = [{"question": "Q1", "expected_answer": "A1", "weight": 2.0}]
    f = tmp_path / "test.json"
    f.write_text(json.dumps(data))
    result = load_dataset(str(f))
    assert result[0]["question"] == "Q1"
    assert result[0]["weight"] == 2.0


def test_load_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        load_dataset("/nonexistent/path/file.json")


def test_load_unsupported_ext_raises(tmp_path):
    f = tmp_path / "bad.csv"
    f.write_text("a,b")
    with pytest.raises(ValueError, match="Unsupported"):
        load_dataset(str(f))


def test_list_datasets_returns_json_and_pdf(tmp_path, monkeypatch):
    (tmp_path / "golden.json").write_text("[]")
    (tmp_path / "doc.pdf").write_bytes(b"%PDF")
    (tmp_path / "ignore.txt").write_text("nope")
    monkeypatch.setattr("app.eval.datasets.DATASETS_DIR", tmp_path)
    result = list_datasets()
    assert "golden.json" in result
    assert "doc.pdf" in result
    assert "ignore.txt" not in result
