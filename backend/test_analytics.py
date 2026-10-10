import unittest

from backend.analytics import service, score_record, train_proxy_models


class ScoreTests(unittest.TestCase):
    def test_weighted_score_uses_normalized_components(self):
        result = score_record({
            "CGPA": 8,
            "Subject_Performance_Avg": 70,
            "Internal_Marks": 32,
            "External_Marks": 48,
            "Overall_Attendance_%": 80,
            "Assignment_Completion_%": 80,
            "Quiz_Avg_Score": 70,
            "LMS_Login_Frequency_per_week": 7,
            "Placement_Readiness_Score": 70,
            "Technical_Skill_Score": 80,
            "Soft_Skill_Score": 60,
            "Extracurricular_Score": 60,
            "Aptitude_Score": 60,
            "Coding_Score": 60,
            "Mock_Interview_Score": 60,
            "Backlogs": 0,
        })

        self.assertEqual(result["coverage"], 100)
        self.assertAlmostEqual(result["success_score"], 74.2)
        self.assertEqual(result["overall_risk"], "On track")

    def test_missing_components_are_renormalized_not_zeroed(self):
        result = score_record({"CGPA": 8})

        self.assertEqual(result["coverage"], 17)
        self.assertEqual(result["success_score"], 80)
        self.assertEqual(result["components"]["attendance"], None)

    def test_risk_explanations_name_triggered_indicators(self):
        result = score_record({"CGPA": 4, "Overall_Attendance_%": 50, "Backlogs": 2})

        self.assertEqual(result["academic_risk"], "High priority")
        self.assertIn("Attendance below 65%", result["academic_reasons"])
        self.assertIn("2 current backlogs", result["academic_reasons"])

    def test_real_cohort_has_leakage_aware_holdout_models(self):
        self.assertEqual(len(service.students), 1000)
        self.assertEqual(set(service.models), {"academic", "placement"})
        for model in service.models.values():
            self.assertEqual(model.metrics["test_rows"], 250)
            self.assertEqual(len(model.out_of_fold_probabilities), 1000)

    def test_new_imported_columns_are_not_automatically_used_as_model_features(self):
        frame = service.frame.assign(Sensitive_Imported_Field="do-not-train")
        models = train_proxy_models(frame)

        self.assertTrue(models)
        self.assertTrue(all("Sensitive_Imported_Field" not in model.features for model in models.values()))
        self.assertTrue(all("Gender" not in model.features and "Age" not in model.features for model in models.values()))


if __name__ == "__main__":
    unittest.main()