# Real Experimental Dataset Integration & Evaluation Guide

## 1. Overview & Dataset Context

The primary supervised model in this platform is a Random Forest classifier trained on the **AI4I 2020 Predictive Maintenance Dataset** (UCI Machine Learning Repository / Matan et al.). 

- **Primary Dataset Nature**: AI4I 2020 reflects a synthetic, realistic industrial digital twin generated from physical milling process models.
- **Goal of this Guide**: Provide rigorous protocols for acquiring, formatting, mapping, and independently evaluating real experimental industrial datasets against the platform.
- **Critical Caveat**: Cross-dataset generalization between synthetic models and real-world machinery cannot be assumed or claimed without empirical validation and domain transfer calibration.

---

## 2. Expected Model Input Schema

The predictive maintenance model bundle strictly expects a 5-dimensional numerical telemetry feature vector:

| Field Name | Physical Quantity | Standard Units | Nominal Training Range | Sensor Description |
|---|---|---|---|---|
| `Air temperature [K]` | Ambient Temperature | Kelvin ($K$) | 295.3 – 304.4 $K$ ($22^\circ\text{C} - 31^\circ\text{C}$) | Plant ambient temperature thermocouple |
| `Process temperature [K]` | Tool/Workpiece Interface Temp | Kelvin ($K$) | 305.7 – 313.8 $K$ ($32^\circ\text{C} - 40^\circ\text{C}$) | Process thermal sensor measuring tool contact zone |
| `Rotational speed [rpm]` | Spindle Speed | Revolutions per Minute | 1,168 – 2,886 rpm | Optical/magnetic encoder on spindle shaft |
| `Torque [Nm]` | Motor Torque Output | Newton-meters ($N\cdot m$) | 3.8 – 76.6 $N\cdot m$ | Drive motor torque transducer |
| `Tool wear [min]` | Cumulative Tool Usage | Minutes ($min$) | 0 – 253 minutes | Controller counter tracking active tool cut time |

### Schema Rules & Anti-Leakage Constraints:
1. **Target Column**: `Machine failure` (binary $0$ = healthy, $1$ = failure).
2. **Strictly Dropped Columns**: Specific failure modes (`TWF`, `HDF`, `PWF`, `OSF`, `RNF`) and equipment metadata (`UDI`, `Product ID`, `Type`) MUST NEVER be included in model inputs as they cause direct target leakage.

---

## 3. Mapping Compatible External Experimental Datasets

If you obtain an experimental milling, lathe, or CNC machining dataset (such as from a Haas CNC mill, an instrumented research testbed, or industrial SCADA logging):

### Step 3.1: Unit Conversion
Ensure units match the model's expected physical scales:
- Celsius to Kelvin: $T_K = T_C + 273.15$
- Angular Velocity (rad/s) to RPM: $\text{rpm} = \omega \times \frac{60}{2\pi}$
- Tool wear counters in hours to minutes: $t_{\min} = t_{\text{hours}} \times 60$

### Step 3.2: CSV Column Mapping
Ensure CSV headers match either the bracket notation or the clean underscore notation:
```csv
Air temperature [K],Process temperature [K],Rotational speed [rpm],Torque [Nm],Tool wear [min]
298.5,308.8,1520,42.5,45
```
Or:
```csv
Air_temperature_K,Process_temperature_K,Rotational_speed_rpm,Torque_Nm,Tool_wear_min
298.5,308.8,1520,42.5,45
```

---

## 4. Why Incompatible Datasets Cannot Be Fed Directly

A common mistake in industrial ML is attempting to feed high-frequency vibration datasets directly into a low-frequency telemetry model.

### Incompatible Dataset Examples:
- **NASA IMS Bearing Dataset**: High-frequency accelerometers ($20\text{ kHz}$) logging raw acoustic vibration waveforms ($m/s^2$ or $g$).
- **Case Western Reserve University (CWRU) Bearing Data**: High-speed vibration signals with seeded ball/race faults.
- **NASA C-MAPSS Turbofan Engine Degradation Simulation**: 21 gas turbine sensor measurements including fan temperatures, pressure ratios, fuel flow, and bypass ratio.

### Technical Reasons:
1. **Dimensional Mismatch**: C-MAPSS has 21 aero-thermal sensors with non-overlapping distributions; raw vibration data consists of continuous 1D time-series signals rather than static aggregated tabular features.
2. **Domain Invariance Violation**: A Random Forest split on $1500\text{ rpm}$ is meaningless when evaluated on a $g$-force vibration amplitude of $0.05\text{ g}$.
3. **Required Feature Extraction Pipeline**:
   To use high-frequency vibration data with ML models, engineers must first run signal processing:
   - Time-domain statistics: RMS, Peak-to-Peak, Crest Factor, Kurtosis, Skewness.
   - Frequency-domain features: FFT peak harmonics, spectral energy, envelope analysis.
   - Time-frequency features: Wavelet transform scalograms.

---

## 5. Protocol for Separate Experimental Evaluation

To evaluate an external compatible dataset without contaminating the baseline AI4I models:

1. **Keep the Datasets Isolated**: Store the external dataset as `data/external_experimental_<name>.csv`.
2. **Execute Independent Evaluation Script**:
   ```bash
   python -c "
   import pandas as pd, joblib
   bundle = joblib.load('backend/app/ml/model.pkl')
   model = bundle['model']
   feature_names = bundle['feature_names']
   
   df_exp = pd.read_csv('data/external_experimental_sample.csv')
   X_exp = df_exp[feature_names]
   y_true = df_exp['Machine failure'] if 'Machine failure' in df_exp.columns else None
   
   preds = model.predict(X_exp)
   probs = model.predict_proba(X_exp)[:, 1]
   print('Predictions evaluated on', len(X_exp), 'samples.')
   if y_true is not None:
       from sklearn.metrics import classification_report
       print(classification_report(y_true, preds))
   "
   ```
3. **Unsupervised Anomaly Calibration**:
   Use the Isolation Forest endpoint `/anomalies/detect` or train a dedicated Isolation Forest on the baseline operating envelope of the specific machine to establish new normal operating limits ($\mu \pm 3\sigma$).
