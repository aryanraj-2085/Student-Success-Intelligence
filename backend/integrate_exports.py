"""Merge normalized campus CSV exports into the student cohort snapshot."""

from __future__ import annotations

import argparse
import json
import re
import tempfile
from pathlib import Path
from typing import Any

import pandas as pd


STUDENT_ID_ALIASES = {"student_id", "studentid", "roll_no", "roll_number", "registration_number"}


def _header_key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def _normalize_export(
    path: Path,
    known_columns: dict[str, str],
    column_map: dict[str, str],
) -> pd.DataFrame:
    frame = pd.read_csv(path, dtype=object)
    headers = [str(column).strip() for column in frame.columns]
    if len(headers) != len(set(headers)):
        raise ValueError(f"{path.name} has duplicate column names; rename them before importing.")
    frame.columns = headers

    rename: dict[str, str] = {}
    for column in headers:
        target = column_map.get(column)
        key = _header_key(column)
        if target is None and key in STUDENT_ID_ALIASES:
            target = "Student_ID"
        if target is None:
            target = known_columns.get(key, column)
        rename[column] = target
    frame = frame.rename(columns=rename)
    if len(set(frame.columns)) != len(frame.columns):
        raise ValueError(f"{path.name} maps multiple columns to the same canonical field.")
    if "Student_ID" not in frame.columns:
        raise ValueError(f"{path.name} needs a Student_ID column or a column-map entry for its student key.")
    identifiers = frame["Student_ID"].astype("string").str.strip().str.upper()
    if identifiers.isna().any() or identifiers.eq("").any():
        raise ValueError(f"{path.name} contains rows without a student identifier.")
    if identifiers.duplicated().any():
        raise ValueError(f"{path.name} contains duplicate student identifiers.")
    frame["Student_ID"] = identifiers
    return frame


def integrate_exports(
    base_path: Path,
    source_paths: list[Path],
    output_path: Path,
    column_map: dict[str, str] | None = None,
) -> dict[str, int]:
    """Apply source exports in order; later non-empty values override earlier values."""
    if not source_paths:
        raise ValueError("Provide at least one source CSV export.")
    output_resolved = output_path.resolve()
    inputs = [base_path, *source_paths]
    if any(path.resolve() == output_resolved for path in inputs):
        raise ValueError("Output must be a separate file; source files are never overwritten.")

    cohort = _normalize_export(base_path, {}, {})
    if "Department" not in cohort.columns:
        raise ValueError("Base cohort must include Department; map roster fields before importing.")

    known_columns = {_header_key(column): column for column in cohort.columns}
    mappings = column_map or {}
    base = cohort.set_index("Student_ID", drop=False)
    report = {"source_files": len(source_paths), "source_rows": 0, "matched_rows": 0, "updated_cells": 0, "conflicts_overridden": 0}

    for source_path in source_paths:
        source = _normalize_export(source_path, known_columns, mappings).set_index("Student_ID")
        unmatched = ~source.index.isin(base.index)
        if unmatched.any():
            raise ValueError(f"{source_path.name} has {int(unmatched.sum())} IDs absent from the base cohort.")
        report["source_rows"] += len(source)
        report["matched_rows"] += len(source)
        for column in source.columns:
            values = source[column].reindex(base.index)
            has_value = values.notna()
            if not has_value.any():
                continue
            if column not in base.columns:
                base[column] = pd.NA
            existing = base[column]
            conflicts = has_value & existing.notna() & values.astype("string").ne(existing.astype("string"))
            report["conflicts_overridden"] += int(conflicts.sum())
            report["updated_cells"] += int(has_value.sum())
            base[column] = values.combine_first(existing)

    result = base.reset_index(drop=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            suffix=".csv",
            prefix=f".{output_path.stem}-",
            dir=output_path.parent,
            delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            result.to_csv(temporary, index=False)
        temporary_path.replace(output_path)
    except OSError:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)
        raise
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge canonical SIS/LMS/etc. CSV exports into one cohort file.")
    parser.add_argument("--base", required=True, type=Path, help="Authoritative base cohort/roster CSV")
    parser.add_argument("--source", required=True, action="append", type=Path, help="Source CSV; repeat in precedence order")
    parser.add_argument("--output", required=True, type=Path, help="Separate merged CSV output path")
    parser.add_argument("--column-map", type=Path, help="Optional JSON object mapping source headers to canonical headers")
    arguments = parser.parse_args()
    mapping = json.loads(arguments.column_map.read_text(encoding="utf-8")) if arguments.column_map else {}
    if not isinstance(mapping, dict) or not all(isinstance(key, str) and isinstance(value, str) for key, value in mapping.items()):
        parser.error("--column-map must contain a JSON object of string header mappings.")
    report = integrate_exports(arguments.base, arguments.source, arguments.output, mapping)
    print(json.dumps({"output": str(arguments.output.resolve()), **report}, indent=2))


if __name__ == "__main__":
    main()
