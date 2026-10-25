"""
Data Quality Validation Service for Industrial Telemetry.

Validates single sensor readings and batch CSV files against schema constraints,
data types, numerical sanity, and physical plausibility boundaries.
Distinguishes physically impossible/corrupt data from genuine operational anomalies.
"""

from typing import Dict, Any, List, Optional, Tuple
import math
import pandas as pd
import numpy as np


# Standardized sensor feature names in bracket notation (AI4I dataset convention)
CANONICAL_FEATURES = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]

# Field mapping from common snake_case or identifier variants to canonical names
FEATURE_ALIASES = {
    "air_temperature_k": "Air temperature [K]",
    "air_temp_k": "Air temperature [K]",
    "air_temperature": "Air temperature [K]",
    "air temp [k]": "Air temperature [K]",
    "air_temp": "Air temperature [K]",
    "process_temperature_k": "Process temperature [K]",
    "process_temp_k": "Process temperature [K]",
    "process_temperature": "Process temperature [K]",
    "process temp [k]": "Process temperature [K]",
    "process_temp": "Process temperature [K]",
    "rotational_speed_rpm": "Rotational speed [rpm]",
    "rotational_speed": "Rotational speed [rpm]",
    "speed_rpm": "Rotational speed [rpm]",
    "speed": "Rotational speed [rpm]",
    "torque_nm": "Torque [Nm]",
    "torque": "Torque [Nm]",
    "tool_wear_min": "Tool wear [min]",
    "tool_wear": "Tool wear [min]",
    "tool wear [min]": "Tool wear [min]",
}

# Physical Plausibility Ranges for CNC Milling / Machine Tool Operations
# Values outside these bounds represent sensor faults, wiring errors, or corrupt logs.
# Notice: Normal operational variations and anomalies lie WITHIN these physical limits.
PHYSICAL_BOUNDS = {
    "Air temperature [K]": {
        "min": 260.0,       # -13.15 °C (extreme cold plant floor)
        "max": 350.0,       # 76.85 °C (severe plant fire/sensor burn)
        "typical_min": 295.0,
        "typical_max": 305.0,
        "unit": "K",
        "description": "Ambient factory environment temperature",
    },
    "Process temperature [K]": {
        "min": 270.0,       # -3.15 °C
        "max": 380.0,       # 106.85 °C
        "typical_min": 305.0,
        "typical_max": 315.0,
        "unit": "K",
        "description": "Tool-workpiece interface temperature",
    },
    "Rotational speed [rpm]": {
        "min": 200.0,       # Minimum powered spindle idle
        "max": 4500.0,      # Mechanical overspeed burst safety limit
        "typical_min": 1150.0,
        "typical_max": 2900.0,
        "unit": "rpm",
        "description": "Machining spindle rotational velocity",
    },
    "Torque [Nm]": {
        "min": 0.0,         # Zero torque (free-spinning / no load)
        "max": 180.0,       # Maximum stall torque before physical shaft failure
        "typical_min": 3.5,
        "typical_max": 80.0,
        "unit": "Nm",
        "description": "Spindle motor output torque",
    },
    "Tool wear [min]": {
        "min": 0.0,         # Fresh new cutting insert
        "max": 500.0,       # Hard mechanical life cutoff
        "typical_min": 0.0,
        "typical_max": 260.0,
        "unit": "min",
        "description": "Accumulated active tool contact cut time",
    },
}


def normalize_feature_name(name: str) -> str:
    """Map any supported alias or whitespace variation to canonical name."""
    cleaned = name.strip()
    if cleaned in CANONICAL_FEATURES:
        return cleaned
    lower_norm = cleaned.lower().replace("-", "_").replace(" ", "_")
    if lower_norm in FEATURE_ALIASES:
        return FEATURE_ALIASES[lower_norm]
    return cleaned


def validate_single_reading(data: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, float]]:
    """
    Validate a single machine operational reading.
    Returns:
        is_valid (bool): True if data meets schema, type, and physical bounds.
        errors (List[str]): List of human-readable validation error messages.
        clean_features (Dict[str, float]): Canonical feature mapping if valid.
    """
    errors: List[str] = []
    clean_features: Dict[str, float] = {}

    # Map input keys to canonical names
    mapped_input: Dict[str, Any] = {}
    for k, v in data.items():
        canonical_key = normalize_feature_name(k)
        mapped_input[canonical_key] = v

    # Check for missing required features
    for feat in CANONICAL_FEATURES:
        if feat not in mapped_input:
            errors.append(f"Missing required parameter '{feat}'.")
            continue

        raw_val = mapped_input[feat]

        # Check for None / Null
        if raw_val is None:
            errors.append(f"Parameter '{feat}' cannot be null or empty.")
            continue

        # Check numerical type conversion
        try:
            num_val = float(raw_val)
        except (ValueError, TypeError):
            errors.append(f"Parameter '{feat}' must be numeric, got '{raw_val}'.")
            continue

        # Check for NaN / Inf
        if math.isnan(num_val) or math.isinf(num_val):
            errors.append(f"Parameter '{feat}' contains invalid numerical value (NaN or Infinity).")
            continue

        # Check physical bounds
        bounds = PHYSICAL_BOUNDS[feat]
        if num_val < bounds["min"]:
            errors.append(
                f"Parameter '{feat}' value {num_val} {bounds['unit']} is physically impossible "
                f"(below absolute physical minimum of {bounds['min']} {bounds['unit']})."
            )
            continue
        if num_val > bounds["max"]:
            errors.append(
                f"Parameter '{feat}' value {num_val} {bounds['unit']} is physically impossible "
                f"(above absolute physical maximum of {bounds['max']} {bounds['unit']})."
            )
            continue

        clean_features[feat] = num_val

    # Relational physical validation: Process temperature cannot be drastically below Air temperature
    if "Air temperature [K]" in clean_features and "Process temperature [K]" in clean_features:
        air_t = clean_features["Air temperature [K]"]
        proc_t = clean_features["Process temperature [K]"]
        if proc_t < (air_t - 5.0):
            errors.append(
                f"Physical thermal violation: Process temperature ({proc_t} K) cannot be more than "
                f"5 K colder than ambient Air temperature ({air_t} K) during powered operation."
            )

    return (len(errors) == 0, errors, clean_features)


def validate_batch_dataframe(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Comprehensive data-quality validation for CSV batch uploads.
    Checks column presence, missing values, datatypes, duplicates, and physical limits.
    """
    errors: List[str] = []
    warnings: List[str] = []

    if df is None or len(df) == 0:
        return {
            "is_valid": False,
            "errors": ["Uploaded dataset contains no data rows."],
            "warnings": [],
            "row_count": 0,
            "valid_rows": 0,
            "duplicate_count": 0,
            "clean_dataframe": None,
        }

    # Normalize column headers
    rename_dict = {}
    for col in df.columns:
        norm = normalize_feature_name(str(col))
        if norm in CANONICAL_FEATURES:
            rename_dict[col] = norm

    df_norm = df.rename(columns=rename_dict)

    # Check for missing canonical columns
    missing_cols = [c for c in CANONICAL_FEATURES if c not in df_norm.columns]
    if missing_cols:
        errors.append(
            f"Missing required columns in CSV: {missing_cols}. "
            f"Expected either bracket notation (e.g., 'Air temperature [K]') "
            f"or underscore notation (e.g., 'Air_temperature_K')."
        )
        return {
            "is_valid": False,
            "errors": errors,
            "warnings": warnings,
            "row_count": len(df),
            "valid_rows": 0,
            "duplicate_count": 0,
            "clean_dataframe": None,
        }

    # Inspect for duplicates on feature columns
    dup_mask = df_norm.duplicated(subset=CANONICAL_FEATURES, keep="first")
    dup_count = int(dup_mask.sum())
    if dup_count > 0:
        warnings.append(
            f"Detected {dup_count} duplicate telemetry reading(s) across feature dimensions. "
            f"Rows will be retained for historical recording."
        )

    # Per-row validation
    invalid_rows = []
    for idx, row in df_norm[CANONICAL_FEATURES].iterrows():
        row_dict = row.to_dict()
        valid, row_errs, _ = validate_single_reading(row_dict)
        if not valid:
            invalid_rows.append({"row_index": int(idx) + 1, "issues": row_errs})

    if invalid_rows:
        sample_issues = invalid_rows[:5]
        for item in sample_issues:
            errors.append(f"Row {item['row_index']}: {'; '.join(item['issues'])}")
        if len(invalid_rows) > 5:
            errors.append(f"... and {len(invalid_rows) - 5} more rows with data-quality issues.")

    is_valid = len(errors) == 0
    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "valid_rows": len(df) - len(invalid_rows),
        "duplicate_count": dup_count,
        "clean_dataframe": df_norm if is_valid else None,
    }
