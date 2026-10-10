import tempfile
import unittest
from pathlib import Path

from backend.synthetic_future_demo import (
    FEATURES,
    evaluate_synthetic_dataset,
    generate_synthetic_dataset,
    run,
)


class SyntheticFutureDemoTests(unittest.TestCase):
    def test_generator_is_reproducible_and_uses_simulated_ids(self):
        first = generate_synthetic_dataset(cohort_count=4, students_per_cohort=80, seed=17)
        second = generate_synthetic_dataset(cohort_count=4, students_per_cohort=80, seed=17)

        self.assertTrue(first.equals(second))
        self.assertTrue(first["student_id"].str.startswith("SIM-").all())
        self.assertEqual(len(first), 320)

    def test_test_cohorts_are_strictly_later_than_training_cohorts(self):
        frame = generate_synthetic_dataset(cohort_count=4, students_per_cohort=80, seed=18)
        report, models = evaluate_synthetic_dataset(frame)

        self.assertEqual(report["train_cohorts"], "1-2")
        self.assertEqual(report["test_cohorts"], "3-4")
        self.assertEqual(report["train_rows"], 160)
        self.assertEqual(report["test_rows"], 160)
        self.assertEqual(set(models), {"academic_failure_next_term", "placement_not_ready_next_cycle"})
        self.assertTrue(all(set(model.feature_names_in_) == set(FEATURES) for model in models.values()))

    def test_run_writes_dataset_trained_models_and_caveated_report(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            report = run(root)

            self.assertEqual(report["dataset_rows"], 3600)
            self.assertTrue((root / "data" / "synthetic-future-outcomes-demo.csv").exists())
            self.assertTrue((root / "models" / "synthetic-future-demo.joblib").exists())
            text = (root / "docs" / "synthetic-future-model-report.md").read_text(encoding="utf-8")
            self.assertIn("Demonstration only", text)
            self.assertIn("not evidence of real-world predictive performance", text)


if __name__ == "__main__":
    unittest.main()
