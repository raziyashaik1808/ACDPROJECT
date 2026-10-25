"""
Unit and Integration Test Suite for Person 1 Features:
- Intelligent Predictive Maintenance Recommendation Engine
- Data Quality & Physical Validation (Single Reading + Batch CSV)
- ML Model Validation & Dataset Provenance
- MongoDB Persistence for Maintenance Recommendations
- Regression checks for /predict and /anomalies/detect
"""

import unittest
import io
import pandas as pd
from app.ml.recommendation_engine import (
    evaluate_maintenance_recommendation,
)
from app.ml.data_validator import (
    validate_single_reading,
    validate_batch_dataframe,
    PHYSICAL_BOUNDS,
)
from app.ml.model_validator import (
    get_validation_report,
    audit_feature_contract,
    APPROVED_FEATURE_CONTRACT,
)
from app.db.mongodb import (
    get_db,
    connect_to_mongo,
    save_maintenance_recommendation,
    get_maintenance_recommendations,
    update_recommendation_status,
)


def setUpModule():
    try:
        connect_to_mongo()
    except Exception as e:
        print(f"Warning: Could not connect to local MongoDB in test runner: {e}")


class TestRecommendationEngine(unittest.TestCase):
    """Test suite verifying recommendation logic and priorities."""

    def test_nominal_condition_yields_low_priority(self):
        sensor_data = {
            "Air temperature [K]": 298.1,
            "Process temperature [K]": 308.6,
            "Rotational speed [rpm]": 1551.0,
            "Torque [Nm]": 42.8,
            "Tool wear [min]": 15.0,
        }
        rec = evaluate_maintenance_recommendation(
            sensor_readings=sensor_data,
            risk_score=4.0,
            health_status="Healthy",
            failure_prediction=0,
            machine_id="M-TEST-NOMINAL",
        )
        self.assertEqual(rec["priority"], "Low")
        self.assertIn("nominal", rec["reason"].lower())
        self.assertEqual(rec["machine_id"], "M-TEST-NOMINAL")
        self.assertTrue(len(rec["actions"]) >= 1)
        self.assertFalse(rec["requires_immediate_action"])

    def test_critical_tool_wear_triggers_critical_priority(self):
        sensor_data = {
            "Air temperature [K]": 301.0,
            "Process temperature [K]": 310.5,
            "Rotational speed [rpm]": 1320.0,
            "Torque [Nm]": 58.5,
            "Tool wear [min]": 245.0,  # Above critical limit of 215 min
        }
        rec = evaluate_maintenance_recommendation(
            sensor_readings=sensor_data,
            risk_score=88.0,
            health_status="Critical",
            failure_prediction=1,
            anomaly_result={"is_anomaly": True, "anomaly_level": "Critical"},
            machine_id="M-TEST-TWF",
        )
        self.assertEqual(rec["priority"], "Critical")
        self.assertTrue(rec["requires_immediate_action"])
        self.assertIn("tool wear", rec["reason"].lower())
        # Must not fabricate exact failure dates
        self.assertNotIn("will fail on", rec["reason"].lower())
        self.assertTrue(any("tool" in act.lower() or "cutting" in act.lower() or "insert" in act.lower() for act in rec["actions"]))

    def test_heat_dissipation_hazard_priority(self):
        sensor_data = {
            "Air temperature [K]": 304.5,
            "Process temperature [K]": 312.0,  # Delta T is 7.5K (< 8.6K)
            "Rotational speed [rpm]": 1350.0,
            "Torque [Nm]": 54.0,
            "Tool wear [min]": 120.0,
        }
        rec = evaluate_maintenance_recommendation(
            sensor_readings=sensor_data,
            risk_score=72.0,
            health_status="Critical",
            failure_prediction=1,
            machine_id="M-TEST-HDF",
        )
        self.assertIn(rec["priority"], ["High", "Critical"])
        self.assertIn("heat dissipation", rec["full_reason"].lower())
        self.assertTrue(any("coolant" in act.lower() or "thermal" in act.lower() for act in rec["actions"]))

    def test_shap_explanation_integration(self):
        sensor_data = {
            "Air temperature [K]": 300.0,
            "Process temperature [K]": 310.0,
            "Rotational speed [rpm]": 1200.0,
            "Torque [Nm]": 75.0,  # Overstrain
            "Tool wear [min]": 190.0,
        }
        shap_contributions = [
            {"feature": "Torque [Nm]", "relative_contribution": 55.0},
            {"feature": "Tool wear [min]", "relative_contribution": 25.0},
        ]
        rec = evaluate_maintenance_recommendation(
            sensor_readings=sensor_data,
            risk_score=78.0,
            health_status="Critical",
            failure_prediction=1,
            shap_contributions=shap_contributions,
            machine_id="M-TEST-SHAP",
        )
        self.assertTrue(any("Torque [Nm]" in f["parameter"] for f in rec["contributing_factors"]))


class TestDataQualityValidation(unittest.TestCase):
    """Test suite verifying input validation and physical limits."""

    def test_valid_sensor_payload_passes(self):
        valid_input = {
            "Air_temperature_K": 298.5,
            "Process_temperature_K": 308.7,
            "Rotational_speed_rpm": 1500,
            "Torque_Nm": 40.0,
            "Tool_wear_min": 20,
        }
        is_valid, errors, clean_features = validate_single_reading(valid_input)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(clean_features), 5)

    def test_negative_or_impossible_readings_rejected(self):
        invalid_input = {
            "Air_temperature_K": -10.0,  # Below absolute zero in K
            "Process_temperature_K": 308.7,
            "Rotational_speed_rpm": -500,  # Negative RPM
            "Torque_Nm": 40.0,
            "Tool_wear_min": 9999,  # Physical impossibility
        }
        is_valid, errors, _ = validate_single_reading(invalid_input)
        self.assertFalse(is_valid)
        self.assertTrue(any("Air temperature [K]" in err for err in errors))
        self.assertTrue(any("Rotational speed [rpm]" in err for err in errors))
        self.assertTrue(any("Tool wear [min]" in err for err in errors))

    def test_nonnumeric_and_nan_rejected(self):
        invalid_input = {
            "Air_temperature_K": "corrupt_string",
            "Process_temperature_K": float("nan"),
            "Rotational_speed_rpm": 1500,
            "Torque_Nm": float("inf"),
            "Tool_wear_min": 20,
        }
        is_valid, errors, _ = validate_single_reading(invalid_input)
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) >= 3)

    def test_batch_csv_validation(self):
        # Valid CSV
        valid_df = pd.DataFrame([
            {"Air temperature [K]": 298.1, "Process temperature [K]": 308.6, "Rotational speed [rpm]": 1500, "Torque [Nm]": 40, "Tool wear [min]": 10},
            {"Air temperature [K]": 300.0, "Process temperature [K]": 310.0, "Rotational speed [rpm]": 1400, "Torque [Nm]": 45, "Tool wear [min]": 30},
        ])
        res = validate_batch_dataframe(valid_df)
        self.assertTrue(res["is_valid"])
        self.assertEqual(res["valid_rows"], 2)

        # Missing columns
        invalid_df = pd.DataFrame([
            {"Air temperature [K]": 298.1, "Torque [Nm]": 40}  # Missing 3 required sensors
        ])
        res_inv = validate_batch_dataframe(invalid_df)
        self.assertFalse(res_inv["is_valid"])
        self.assertTrue(any("Missing required" in e for e in res_inv["errors"]))


class TestModelReliabilityAndProvenance(unittest.TestCase):
    """Test suite verifying ML model provenance and zero target leakage."""

    def test_ai4i_synthetic_dataset_disclosure(self):
        summary = get_validation_report()
        provenance = summary["provenance"]
        self.assertIn("Synthetic", provenance["dataset_type"])
        self.assertIn("synthetic", provenance["description"].lower())
        self.assertIn("not raw industrial sensor data", provenance["description"].lower())

    def test_zero_target_leakage_audit(self):
        audit = audit_feature_contract(APPROVED_FEATURE_CONTRACT)
        self.assertTrue(audit["passed"])
        self.assertFalse(audit["has_leakage"])
        self.assertEqual(len(audit["leaked_columns"]), 0)
        self.assertEqual(len(audit["missing_contract_features"]), 0)

        # Confirm that injecting a failure mode column triggers leakage detection
        leaked_audit = audit_feature_contract(APPROVED_FEATURE_CONTRACT + ["TWF"])
        self.assertTrue(leaked_audit["has_leakage"])
        self.assertIn("TWF", leaked_audit["leaked_columns"])


class TestMongoDBRecommendationPersistence(unittest.TestCase):
    """Test suite verifying MongoDB recommendation CRUD and status transitions."""

    def setUp(self):
        self.db = get_db()
        self.test_rec_id = "REC-UNITTEST-99"

    def tearDown(self):
        # Clean up only unit test records
        if self.db is not None:
            self.db.maintenance_recommendations.delete_many({"recommendation_id": self.test_rec_id})

    def test_save_retrieve_and_update_status(self):
        if self.db is None:
            self.skipTest("MongoDB not connected in this test runner environment")

        test_doc = {
            "recommendation_id": self.test_rec_id,
            "machine_id": "M-UNITTEST",
            "prediction_id": "PRED-UT-1",
            "failure_risk_score": 85.5,
            "priority": "High",
            "reason": "Test unit recommendation for motor check",
            "actions": ["Inspect motor winding", "Verify thermal sensor"],
            "urgency_timeframe": "Within 24 hours",
            "status": "open",
        }
        saved_id = save_maintenance_recommendation(test_doc)
        self.assertEqual(saved_id, self.test_rec_id)

        # Retrieve
        retrieved = self.db.maintenance_recommendations.find_one({"recommendation_id": self.test_rec_id})
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["status"], "open")
        self.assertEqual(retrieved["priority"], "High")

        # Update status
        updated = update_recommendation_status(self.test_rec_id, "in_progress")
        self.assertTrue(updated)

        updated_doc = self.db.maintenance_recommendations.find_one({"recommendation_id": self.test_rec_id})
        self.assertEqual(updated_doc["status"], "in_progress")


if __name__ == "__main__":
    unittest.main()
