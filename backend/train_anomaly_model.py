import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import IsolationForest

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR.parent / "data" / "ai4i2020.csv"
MODEL_DIR = BASE_DIR / "app" / "ml"
MODEL_PATH = MODEL_DIR / "anomaly_model.pkl"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(DATA_PATH)
df.columns = df.columns.str.strip()

feature_names = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]

X = df[feature_names].copy()

# Compute baseline reference statistics
baseline_stats = {}
for col in feature_names:
    baseline_stats[col] = {
        "mean": float(X[col].mean()),
        "std": float(X[col].std()),
        "min": float(X[col].min()),
        "max": float(X[col].max()),
        "q25": float(X[col].quantile(0.25)),
        "median": float(X[col].median()),
        "q75": float(X[col].quantile(0.75)),
    }

# Train Isolation Forest on unsupervised sensor measurements
iso_forest = IsolationForest(
    n_estimators=100,
    contamination=0.035,
    random_state=42,
    n_jobs=-1
)
iso_forest.fit(X)

bundle = {
    "model": iso_forest,
    "feature_names": feature_names,
    "baseline_stats": baseline_stats,
}

joblib.dump(bundle, MODEL_PATH)
print(f"Anomaly detection model saved to: {MODEL_PATH}")
print("Baseline sensor reference statistics calculated for 5 features.")
