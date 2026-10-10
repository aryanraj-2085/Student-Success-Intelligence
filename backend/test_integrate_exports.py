import tempfile
import unittest
from pathlib import Path

import pandas as pd

from backend.analytics import CohortService
from backend.integrate_exports import integrate_exports


class IntegrateExportsTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.base = self.root / "base.csv"
        self.source = self.root / "attendance.csv"
        self.output = self.root / "merged.csv"
        pd.DataFrame([
            {"Student_ID": "STU0001", "Department": "CSE", "Overall_Attendance_%": 70},
            {"Student_ID": "STU0002", "Department": "ECE", "Overall_Attendance_%": 80},
        ]).to_csv(self.base, index=False)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_merges_by_student_id_and_later_values_take_precedence(self):
        pd.DataFrame([
            {"student id": " stu0001 ", "Overall_Attendance_%": 62, "Subject_Attendance_Critical_%": 51},
            {"student id": "STU0002", "Overall_Attendance_%": None, "Subject_Attendance_Critical_%": 71},
        ]).to_csv(self.source, index=False)

        report = integrate_exports(self.base, [self.source], self.output)
        merged = pd.read_csv(self.output).set_index("Student_ID")

        self.assertEqual(merged.loc["STU0001", "Overall_Attendance_%"], 62)
        self.assertEqual(merged.loc["STU0001", "Subject_Attendance_Critical_%"], 51)
        self.assertEqual(merged.loc["STU0002", "Overall_Attendance_%"], 80)
        self.assertEqual(report["matched_rows"], 2)
        self.assertEqual(report["conflicts_overridden"], 1)

    def test_rejects_unmatched_student_ids_without_overwriting_output(self):
        self.output.write_text("preserve", encoding="utf-8")
        pd.DataFrame([{"Student_ID": "STU9999", "Overall_Attendance_%": 50}]).to_csv(self.source, index=False)

        with self.assertRaisesRegex(ValueError, "absent from the base cohort"):
            integrate_exports(self.base, [self.source], self.root / "new.csv")
        self.assertEqual(self.output.read_text(encoding="utf-8"), "preserve")

    def test_rejects_duplicate_student_ids_in_source(self):
        pd.DataFrame([
            {"Student_ID": "STU0001", "Overall_Attendance_%": 62},
            {"Student_ID": "stu0001", "Overall_Attendance_%": 60},
        ]).to_csv(self.source, index=False)

        with self.assertRaisesRegex(ValueError, "duplicate student identifiers"):
            integrate_exports(self.base, [self.source], self.output)
        self.assertFalse(self.output.exists())

    def test_accepts_explicit_vendor_column_mapping(self):
        pd.DataFrame([{"SIS Primary Key": "STU0001", "Roll Call Percent": 77}]).to_csv(self.source, index=False)

        integrate_exports(
            self.base,
            [self.source],
            self.output,
            {"SIS Primary Key": "Student_ID", "Roll Call Percent": "Overall_Attendance_%"},
        )

        merged = pd.read_csv(self.output).set_index("Student_ID")
        self.assertEqual(merged.loc["STU0001", "Overall_Attendance_%"], 77)

    def test_integrated_file_loads_as_the_configured_analytics_cohort(self):
        pd.DataFrame([{"Student_ID": "STU0001", "Subject_Attendance_Critical_%": 51}]).to_csv(self.source, index=False)
        integrate_exports(self.base, [self.source], self.output)

        cohort = CohortService(self.output)

        self.assertEqual(len(cohort.students), 2)
        self.assertEqual(cohort.by_id["STU0001"]["critical_attendance"], 51)
        self.assertEqual(cohort.dashboard()["data_quality"]["duplicate_ids_removed"], 0)


if __name__ == "__main__":
    unittest.main()
