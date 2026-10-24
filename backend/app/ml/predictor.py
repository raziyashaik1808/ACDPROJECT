import joblib
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, List, Dict, Any

MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"

bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
metrics = bundle["metrics"]
feature_names = bundle["feature_names"]

# Baseline distribution statistics calculated from training set
BASELINE_MEANS = {
    "Air temperature [K]": 300.0,
    "Process temperature [K]": 310.0,
    "Rotational speed [rpm]": 1538.8,
    "Torque [Nm]": 40.0,
    "Tool wear [min]": 108.0,
}
BASELINE_STDS = {
    "Air temperature [K]": 2.0,
    "Process temperature [K]": 1.5,
    "Rotational speed [rpm]": 179.3,
    "Torque [Nm]": 9.97,
    "Tool wear [min]": 63.7,
}

# Initialize SHAP TreeExplainer on the trained Random Forest model
shap_explainer = None
try:
    import shap
    shap_explainer = shap.TreeExplainer(model)
except Exception as e:
    print(f"[SHAP] TreeExplainer initialization warning: {e}. Fallback explanation method active.")


def calculate_risk_score(probability: float) -> float:
    return round(probability * 100, 2)


def get_health_status(risk_score: float) -> str:
    if risk_score <= 30:
        return "Healthy"
    if risk_score <= 70:
        return "Warning"
    return "Critical"


def get_recommendation(data: dict) -> str:
    air_temp = data.get("Air temperature [K]", 0)
    process_temp = data.get("Process temperature [K]", 0)
    rotational_speed = data.get("Rotational speed [rpm]", 0)
    torque = data.get("Torque [Nm]", 0)
    tool_wear = data.get("Tool wear [min]", 0)

    if process_temp > 310 and tool_wear > 200:
        return "Inspect cooling system and consider tool replacement."
    if torque > 50 and rotational_speed < 1400:
        return "Check motor load and shaft alignment."
    if air_temp > 305 and torque > 55:
        return "Inspect overheating and vibration-related components."
    if tool_wear > 180:
        return "Tool wear exceeds recommended continuous limit. Inspect cutting insert."
    return "No immediate action required. Continue monitoring."


def compute_feature_contributions(input_data: dict, df_row: Optional[pd.DataFrame] = None) -> List[Dict[str, Any]]:
    """
    Calculate genuine prediction explanations.
    Uses shap.TreeExplainer when available to compute exact Shapley values for the positive class (failure).
    Falls back gracefully to documented feature-importance weighted z-scores if SHAP is unavailable.
    Note: Feature contributions and SHAP values reflect model decision influence relative to baselines,
    not physical causation.
    """
    if df_row is None:
        df_row = pd.DataFrame([input_data])[feature_names]

    contributions = []
    shap_computed = False

    if shap_explainer is not None:
        try:
            raw_shap = shap_explainer.shap_values(df_row)
            # Binary classification in SHAP: 3D array (n_samples, n_features, 2) or list of length 2
            if hasattr(raw_shap, "shape") and len(raw_shap.shape) == 3:
                shap_vector = raw_shap[0, :, 1]
            elif isinstance(raw_shap, list) and len(raw_shap) >= 2:
                shap_vector = raw_shap[1][0]
            elif hasattr(raw_shap, "shape") and len(raw_shap.shape) == 2:
                shap_vector = raw_shap[0]
            else:
                shap_vector = np.array(raw_shap).flatten()

            total_impact = float(sum(abs(v) for v in shap_vector)) or 1.0

            for feat, v in zip(feature_names, shap_vector):
                val = float(input_data.get(feat, BASELINE_MEANS[feat]))
                mean = BASELINE_MEANS[feat]
                std = BASELINE_STDS[feat]
                z = round((val - mean) / std, 2)
                rel_pct = round((float(abs(v)) / total_impact) * 100, 1)
                shap_val = round(float(v), 4)
                direction = "Increases risk" if shap_val > 0 else "Reduces risk"

                contributions.append({
                    "feature": feat,
                    "value": round(val, 2),
                    "z_score": z,
                    "relative_contribution": rel_pct,
                    "shap_value": shap_val,
                    "direction": direction,
                    "method": "TreeExplainer (SHAP)",
                })
            shap_computed = True
        except Exception as e:
            shap_computed = False
            contributions = []

    if not shap_computed:
        # Fallback explanation: Feature importance weighted z-score
        feat_importances = metrics.get("feature_importance", {})
        raw_scores = {}
        for feat in feature_names:
            val = float(input_data.get(feat, BASELINE_MEANS[feat]))
            mean = BASELINE_MEANS[feat]
            std = BASELINE_STDS[feat]
            z = abs(val - mean) / std
            imp = float(feat_importances.get(feat, 0.2))
            raw_scores[feat] = max(0.01, z * imp)

        total = sum(raw_scores.values()) or 1.0
        for feat in feature_names:
            val = float(input_data.get(feat, BASELINE_MEANS[feat]))
            mean = BASELINE_MEANS[feat]
            std = BASELINE_STDS[feat]
            z = round((val - mean) / std, 2)
            rel_pct = round((raw_scores[feat] / total) * 100, 1)
            direction = "Elevated parameter" if z > 0 else "Nominal parameter"

            contributions.append({
                "feature": feat,
                "value": round(val, 2),
                "z_score": z,
                "relative_contribution": rel_pct,
                "shap_value": 0.0,
                "direction": direction,
                "method": "Importance Weighted Deviation (Fallback)",
            })

    # Sort descending by relative contribution
    contributions.sort(key=lambda x: x["relative_contribution"], reverse=True)
    return contributions


def predict_single(input_data: dict) -> dict:
    df = pd.DataFrame([input_data])

    missing_cols = [col for col in feature_names if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing model input columns: {missing_cols}")

    df = df[feature_names]

    prediction = int(model.predict(df)[0])
    probability = float(model.predict_proba(df)[0][1])

    risk_score = calculate_risk_score(probability)
    status = get_health_status(risk_score)
    recommendation = get_recommendation(input_data)
    contributions = compute_feature_contributions(input_data, df)

    return {
        "failure_prediction": prediction,
        "failure_probability": round(probability, 4),
        "risk_score": risk_score,
        "health_status": status,
        "recommendation": recommendation,
        "feature_contributions": contributions,
    }


def predict_batch(df: pd.DataFrame) -> list:
    missing_cols = [col for col in feature_names if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing model input columns: {missing_cols}")

    df_clean = df[feature_names].copy()

    preds = model.predict(df_clean)
    probs = model.predict_proba(df_clean)[:, 1]

    results = []
    for i in range(len(df_clean)):
        row = df_clean.iloc[i].to_dict()
        row_df = df_clean.iloc[[i]]
        risk_score = calculate_risk_score(float(probs[i]))
        results.append({
            "row_id": i,
            "failure_prediction": int(preds[i]),
            "failure_probability": round(float(probs[i]), 4),
            "risk_score": risk_score,
            "health_status": get_health_status(risk_score),
            "recommendation": get_recommendation(row),
            "feature_contributions": compute_feature_contributions(row, row_df),
        })

    return results