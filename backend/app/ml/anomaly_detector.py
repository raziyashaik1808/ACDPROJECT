import joblib
import pandas as pd
import numpy as np
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parent / "anomaly_model.pkl"

bundle = joblib.load(MODEL_PATH)
iso_model = bundle["model"]
feature_names = bundle["feature_names"]
baseline_stats = bundle["baseline_stats"]


def compute_deviations(data: dict) -> list:
    """Analyze sensor readings against nominal training distribution to explain anomalies."""
    deviations = []
    for feat in feature_names:
        val = data.get(feat)
        if val is None:
            continue
        stats = baseline_stats.get(feat, {})
        mean = stats.get("mean", 0)
        std = stats.get("std", 1) or 1
        z_score = round((val - mean) / std, 2)

        # Flag features with notable statistical deviations (|z| >= 1.5)
        if abs(z_score) >= 1.5:
            severity = "High" if abs(z_score) >= 2.5 else "Moderate"
            direction = "Elevated" if z_score > 0 else "Sub-nominal"
            deviations.append({
                "feature": feat,
                "observed": round(float(val), 2),
                "baseline_mean": round(float(mean), 2),
                "z_score": z_score,
                "severity": severity,
                "note": f"{direction} ({z_score:+}σ from nominal mean)"
            })
    return sorted(deviations, key=lambda x: abs(x["z_score"]), reverse=True)


def detect_anomaly_single(input_data: dict) -> dict:
    """Run Isolation Forest anomaly inference on a single operational measurement vector."""
    df = pd.DataFrame([input_data])
    missing = [c for c in feature_names if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required anomaly feature columns: {missing}")

    df = df[feature_names]

    # Raw decision function: positive = inlier, negative = outlier
    decision_score = float(iso_model.decision_function(df)[0])
    raw_pred = int(iso_model.predict(df)[0])  # 1 for inlier, -1 for outlier

    is_anomaly = bool(raw_pred == -1)

    # Normalize anomaly score to 0 - 100 scale:
    # Lower decision_score means more anomalous.
    # Typically decision_function is around -0.3 to +0.25.
    norm_score = round(float(np.clip((0.18 - decision_score) / 0.35 * 100, 0, 100)), 2)

    if norm_score >= 65 or is_anomaly:
        anomaly_level = "Critical Anomaly"
    elif norm_score >= 40:
        anomaly_level = "Moderate Anomaly"
    else:
        anomaly_level = "Normal"

    deviations = compute_deviations(input_data)

    if deviations:
        top_dev = deviations[0]
        explanation = f"Sensor anomaly triggered primarily by {top_dev['feature']} ({top_dev['note']})."
    elif is_anomaly:
        explanation = "Multivariate sensor relationship deviates from nominal operational boundaries."
    else:
        explanation = "All sensor parameters within nominal multivariate distribution."

    return {
        "is_anomaly": is_anomaly,
        "anomaly_score": norm_score,
        "anomaly_level": anomaly_level,
        "raw_score": round(decision_score, 4),
        "deviating_features": deviations,
        "explanation": explanation,
    }


def detect_anomaly_batch(df: pd.DataFrame) -> list:
    """Run Isolation Forest on batch sensor records."""
    missing = [c for c in feature_names if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required anomaly feature columns: {missing}")

    X = df[feature_names].copy()
    decision_scores = iso_model.decision_function(X)
    raw_preds = iso_model.predict(X)

    results = []
    for i in range(len(df)):
        row = df.iloc[i].to_dict()
        dec = float(decision_scores[i])
        is_anom = bool(raw_preds[i] == -1)
        norm_score = round(float(np.clip((0.18 - dec) / 0.35 * 100, 0, 100)), 2)

        if norm_score >= 65 or is_anom:
            level = "Critical Anomaly"
        elif norm_score >= 40:
            level = "Moderate Anomaly"
        else:
            level = "Normal"

        deviations = compute_deviations(row)

        results.append({
            "row_id": i,
            "is_anomaly": is_anom,
            "anomaly_score": norm_score,
            "anomaly_level": level,
            "raw_score": round(dec, 4),
            "deviating_features": deviations,
        })
    return results
