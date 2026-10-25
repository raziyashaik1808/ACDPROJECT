"""
Intelligent Predictive Maintenance Recommendation Engine.

Synthesizes failure prediction probabilities, 5-parameter operational sensor telemetry,
unsupervised Isolation Forest anomaly detections, SHAP feature attributions, and machine context
into actionable, prioritized, and explainable industrial maintenance work directives.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


# Threshold boundaries based on AI4I physical domain principles
# (Matan et al., UCI ML Repository: Tool wear failure ~200-240 min,
# Heat dissipation failure: ΔT < 8.6K with speed < 1380 rpm,
# Overstrain failure: Torque * Tool Wear > 11,000,
# Power failure: Power = 2*pi*speed*torque/60 < 3500W or > 9000W)
LIMITS = {
    "TOOL_WEAR_CRITICAL": 215.0,     # minutes
    "TOOL_WEAR_WARNING": 175.0,      # minutes
    "TOOL_WEAR_MODERATE": 120.0,     # minutes
    "TORQUE_CRITICAL": 62.0,         # Nm
    "TORQUE_WARNING": 52.0,          # Nm
    "SPEED_LOW_WARNING": 1360.0,     # rpm
    "SPEED_HIGH_WARNING": 2600.0,    # rpm
    "TEMP_DELTA_CRITICAL": 8.6,      # K (Process temp - Air temp below 8.6K indicates heat dissipation hazard)
    "AIR_TEMP_WARNING": 303.5,       # K (~30.35 °C)
    "PROCESS_TEMP_WARNING": 312.5,   # K (~39.35 °C)
}


def evaluate_maintenance_recommendation(
    sensor_readings: Dict[str, float],
    risk_score: float,
    health_status: str,
    failure_prediction: int = 0,
    anomaly_result: Optional[Dict[str, Any]] = None,
    shap_contributions: Optional[List[Dict[str, Any]]] = None,
    machine_id: Optional[str] = None,
    prediction_id: Optional[str] = None,
    anomaly_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate an intelligent, evidence-grounded maintenance recommendation.
    Combines supervised risk, sensor limits, anomaly detection, and SHAP feature impacts.
    Does NOT invent exact failure dates or fabricate causation.
    """
    air_temp = float(sensor_readings.get("Air temperature [K]", 300.0))
    proc_temp = float(sensor_readings.get("Process temperature [K]", 310.0))
    speed = float(sensor_readings.get("Rotational speed [rpm]", 1500.0))
    torque = float(sensor_readings.get("Torque [Nm]", 40.0))
    tool_wear = float(sensor_readings.get("Tool wear [min]", 10.0))

    temp_delta = proc_temp - air_temp
    power_watts = (2.0 * 3.14159265 * speed * torque) / 60.0

    is_anomaly = bool(anomaly_result.get("is_anomaly", False)) if anomaly_result else False
    anomaly_score = float(anomaly_result.get("anomaly_score", 0.0)) if anomaly_result else 0.0
    anomaly_level = anomaly_result.get("anomaly_level", "Normal") if anomaly_result else "Normal"

    # Identify top SHAP drivers if provided
    top_shap_driver = None
    if shap_contributions and len(shap_contributions) > 0:
        risk_increasing = [c for c in shap_contributions if c.get("shap_value", 0) > 0]
        if risk_increasing:
            top_shap_driver = max(risk_increasing, key=lambda x: x.get("shap_value", 0))

    # Evaluate supporting physical indicators
    contributing_factors: List[Dict[str, Any]] = []
    actions: List[str] = []
    reasons: List[str] = []

    # 1. Tool wear evaluation
    if tool_wear >= LIMITS["TOOL_WEAR_CRITICAL"]:
        contributing_factors.append({
            "parameter": "Tool wear [min]",
            "observed_value": tool_wear,
            "threshold": LIMITS["TOOL_WEAR_CRITICAL"],
            "unit": "min",
            "severity": "Critical",
            "indicator": f"Accumulated tool cut time ({tool_wear:.0f} min) exceeds critical failure boundary ({LIMITS['TOOL_WEAR_CRITICAL']:.0f} min).",
        })
        reasons.append("Extreme cutting tool wear approaching structural insert breakdown")
        actions.append("Halt spindle cycle and replace cutting insert immediately to prevent tool fracture and workpiece gouging.")
        actions.append("Inspect toolholder seat and spindle taper for micro-fretting or thermal distortion.")
    elif tool_wear >= LIMITS["TOOL_WEAR_WARNING"]:
        contributing_factors.append({
            "parameter": "Tool wear [min]",
            "observed_value": tool_wear,
            "threshold": LIMITS["TOOL_WEAR_WARNING"],
            "unit": "min",
            "severity": "High",
            "indicator": f"Tool cut time ({tool_wear:.0f} min) is within accelerated flank wear stage.",
        })
        reasons.append("Tool wear approaching end-of-life replacement threshold")
        actions.append("Stage replacement tooling cutter and schedule changeout before the next production shift.")
    elif tool_wear >= LIMITS["TOOL_WEAR_MODERATE"]:
        contributing_factors.append({
            "parameter": "Tool wear [min]",
            "observed_value": tool_wear,
            "threshold": LIMITS["TOOL_WEAR_MODERATE"],
            "unit": "min",
            "severity": "Medium",
            "indicator": f"Tool wear ({tool_wear:.0f} min) has consumed over 50% of nominal wear life.",
        })

    # 2. Torque and Overstrain evaluation
    overstrain_product = torque * tool_wear
    if torque >= LIMITS["TORQUE_CRITICAL"]:
        contributing_factors.append({
            "parameter": "Torque [Nm]",
            "observed_value": torque,
            "threshold": LIMITS["TORQUE_CRITICAL"],
            "unit": "Nm",
            "severity": "Critical",
            "indicator": f"Drive motor torque ({torque:.1f} Nm) operates near maximum continuous rating.",
        })
        reasons.append(f"Excessive mechanical load / overstrain ({torque:.1f} Nm)")
        actions.append("Verify workpiece feed rate, depth of cut, and material hardness for mechanical overload.")
        actions.append("Inspect spindle drive coupling, gearbox lubrication, and axis guide rails for mechanical binding.")
    elif torque >= LIMITS["TORQUE_WARNING"]:
        contributing_factors.append({
            "parameter": "Torque [Nm]",
            "observed_value": torque,
            "threshold": LIMITS["TORQUE_WARNING"],
            "unit": "Nm",
            "severity": "Warning",
            "indicator": f"Elevated motor torque ({torque:.1f} Nm) observed during standard cycle.",
        })
        if speed < LIMITS["SPEED_LOW_WARNING"]:
            reasons.append("Combination of high torque and low spindle RPM indicating motor overstrain")
            actions.append("Check motor drive current draw and check for chip packing in milling flute.")

    if overstrain_product > 11500.0:
        reasons.append("Overstrain product (Torque × Tool Wear) exceeds physical failure threshold")
        actions.append("Reduce feed override to 80% until tool wear inspection is completed.")

    # 3. Thermal and Heat Dissipation evaluation
    if temp_delta < LIMITS["TEMP_DELTA_CRITICAL"] and speed < LIMITS["SPEED_LOW_WARNING"]:
        contributing_factors.append({
            "parameter": "Temperature Difference (ΔT)",
            "observed_value": round(temp_delta, 2),
            "threshold": LIMITS["TEMP_DELTA_CRITICAL"],
            "unit": "K",
            "severity": "Critical",
            "indicator": f"Process-air temperature delta ({temp_delta:.2f} K) is below heat dissipation threshold ({LIMITS['TEMP_DELTA_CRITICAL']} K).",
        })
        reasons.append(f"Heat dissipation failure hazard: insufficient cooling delta ({temp_delta:.2f} K)")
        actions.append("Inspect coolant circulation pump, clean heat exchanger fins, and check coolant reservoir level.")
        actions.append("Verify spindle chiller flow rate and purge thermal jacket channels.")
    elif air_temp >= LIMITS["AIR_TEMP_WARNING"] or proc_temp >= LIMITS["PROCESS_TEMP_WARNING"]:
        contributing_factors.append({
            "parameter": "Process temperature [K]",
            "observed_value": proc_temp,
            "threshold": LIMITS["PROCESS_TEMP_WARNING"],
            "unit": "K",
            "severity": "Warning",
            "indicator": f"Elevated thermal readings (Air: {air_temp:.1f} K, Process: {proc_temp:.1f} K).",
        })
        reasons.append("Elevated thermal environment accelerating mechanical component degradation")
        actions.append("Check electrical cabinet air conditioning and clean cabinet fan air intake filters.")

    # 4. Power anomaly evaluation
    if power_watts < 3200.0 or power_watts > 9200.0:
        contributing_factors.append({
            "parameter": "Calculated Spindle Power",
            "observed_value": round(power_watts, 1),
            "threshold": 9000.0,
            "unit": "W",
            "severity": "High",
            "indicator": f"Estimated spindle power consumption ({power_watts:.0f} W) deviates from nominal operational range (3500 - 9000 W).",
        })
        reasons.append(f"Spindle electrical power anomaly ({power_watts:.0f} W)")
        actions.append("Verify variable frequency drive (VFD) bus voltage and inspect motor stator windings.")

    # 5. Isolation Forest Unsupervised Anomaly evaluation
    if is_anomaly or anomaly_score >= 60.0:
        contributing_factors.append({
            "parameter": "Multivariate Sensor Pattern (Isolation Forest)",
            "observed_value": anomaly_score,
            "threshold": 60.0,
            "unit": "score",
            "severity": "Critical" if anomaly_score >= 80.0 else "High",
            "indicator": f"Unsupervised Isolation Forest detected multivariate anomaly (Score: {anomaly_score:.1f}, Level: {anomaly_level}).",
        })
        reasons.append(f"Unsupervised sensor anomaly flagged ({anomaly_level})")
        actions.append("Audit all 5 sensor telemetry channels for signal drift, loose wiring, or acoustic vibration spikes.")

    # 6. SHAP Driver Alignment
    if top_shap_driver and top_shap_driver.get("relative_contribution", 0) > 25.0:
        contributing_factors.append({
            "parameter": f"SHAP Top Risk Driver: {top_shap_driver['feature']}",
            "observed_value": top_shap_driver.get("value"),
            "threshold": None,
            "unit": "",
            "severity": "High",
            "indicator": f"SHAP TreeExplainer identifies {top_shap_driver['feature']} as contributing {top_shap_driver['relative_contribution']}% to failure probability.",
        })

    # Priority and Urgency Timeframe Determination
    # Assign priorities strictly based on objective risk and physical indicators
    if risk_score >= 70.0 or failure_prediction == 1 or (is_anomaly and risk_score >= 45.0) or tool_wear >= LIMITS["TOOL_WEAR_CRITICAL"]:
        priority = "Critical"
        urgency_timeframe = "Immediate (Halt cycle or address within current shift)"
        maintenance_type = "Corrective / Emergency Overhaul"
    elif risk_score >= 40.0 or is_anomaly or torque >= LIMITS["TORQUE_WARNING"] or tool_wear >= LIMITS["TOOL_WEAR_WARNING"]:
        priority = "High"
        urgency_timeframe = "Within 24 Hours (Prioritize before next production run)"
        maintenance_type = "Predictive Preventive Action"
    elif risk_score >= 18.0 or anomaly_score >= 40.0 or tool_wear >= LIMITS["TOOL_WEAR_MODERATE"]:
        priority = "Medium"
        urgency_timeframe = "Next Scheduled Maintenance Window (48 - 72 Hours)"
        maintenance_type = "Routine Condition-Based Inspection"
    else:
        priority = "Low"
        urgency_timeframe = "Routine Continuous Telemetry Monitoring"
        maintenance_type = "Continuous Preventive Monitoring"

    # Default fallback actions and reasons if all parameters are within healthy envelope
    if not actions:
        actions.append("All 5 operational sensor parameters reside within nominal baselines. Continue routine lubrication and periodic audit.")
        actions.append("Maintain standard tool wear logging and vibration trend tracking.")
    if not reasons:
        reasons.append("Machine telemetry parameters indicate healthy operational status with nominal failure risk.")

    primary_reason = reasons[0]
    full_reason = "; ".join(reasons)

    return {
        "priority": priority,
        "primary_reason": primary_reason,
        "reason": primary_reason,
        "full_reason": full_reason,
        "urgency_timeframe": urgency_timeframe,
        "maintenance_type": maintenance_type,
        "recommended_actions": actions,
        "actions": actions,
        "requires_immediate_action": priority == "Critical",
        "contributing_factors": contributing_factors,
        "risk_score": risk_score,
        "health_status": health_status,
        "is_anomaly": is_anomaly,
        "anomaly_score": anomaly_score,
        "machine_id": machine_id or "ADHOC-INSPECT",
        "prediction_id": prediction_id,
        "anomaly_id": anomaly_id,
        "sensor_readings": sensor_readings,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }
