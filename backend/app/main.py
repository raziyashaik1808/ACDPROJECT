import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from bson import ObjectId
import pandas as pd

from app.schemas import (
    SensorDataInput,
    MachineCreate,
    MachineUpdate,
    WorkOrderCreate,
    WorkOrderUpdate,
    WorkOrderUpdateStatus,
    AlertCreate,
    AlertUpdateStatus,
    AlertAcknowledgeInput,
    AlertResolveInput,
    AlertReopenInput,
    AlertEvaluationInput,
    AnomalyDetectionInput,
)
from app.ml.predictor import predict_single, predict_batch, metrics
from app.ml.anomaly_detector import detect_anomaly_single, detect_anomaly_batch
from app.db.mongodb import (
    connect_to_mongo,
    close_mongo_connection,
    get_db,
    serialize_doc,
    serialize_docs,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Establish MongoDB connection on startup
    connect_to_mongo()
    yield
    # Terminate connection on shutdown
    close_mongo_connection()


app = FastAPI(
    title="Industrial Predictive Maintenance & Anomaly Detection API",
    description="FastAPI ML backend backed by local MongoDB Community Server persistence",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS Configuration
allowed_origins = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")


# ---------------------------------------------------------
# Health & Database Status
# ---------------------------------------------------------
@app.get("/")
def root():
    return {
        "message": "Predictive Maintenance API is running",
        "database": "MongoDB Community Server",
        "status": "connected"
    }


@app.get("/health")
def health_check():
    try:
        db = get_db()
        # Verify connection through ping
        db.client.admin.command("ping")
        return {
            "status": "healthy",
            "database": "connected",
            "database_name": db.name,
            "collections": {
                "machines": db.machines.count_documents({}),
                "prediction_history": db.prediction_history.count_documents({}),
                "anomaly_history": db.anomaly_history.count_documents({}),
                "alerts": db.alerts.count_documents({}),
                "maintenance_work_orders": db.maintenance_work_orders.count_documents({}),
                "dataset_uploads": db.dataset_uploads.count_documents({}),
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}"
        )


@app.get("/metrics")
def get_metrics():
    return metrics


# ---------------------------------------------------------
# Machine Registry Endpoints (MongoDB: machines)
# ---------------------------------------------------------
@app.get("/machines")
def get_machines(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = Query(None),
):
    db = get_db()
    query = {}
    if status_filter and status_filter.upper() != "ALL":
        query["health_status"] = status_filter
    if search:
        query["$or"] = [
            {"machine_id": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"recommendation": {"$regex": search, "$options": "i"}},
        ]

    docs = list(db.machines.find(query).sort("machine_id", 1))
    return serialize_docs(docs)


@app.get("/machines/{machine_id}")
def get_machine_by_id(machine_id: str):
    db = get_db()
    doc = db.machines.find_one({"machine_id": machine_id})
    if not doc:
        raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found.")
    return serialize_doc(doc)


@app.post("/machines")
def create_machine(data: MachineCreate):
    db = get_db()
    existing = db.machines.find_one({"machine_id": data.machine_id})
    if existing:
        raise HTTPException(
            status_code=400, detail=f"Machine with ID {data.machine_id} already exists."
        )

    # Calculate initial health prediction
    sensor_input = {
        "Air temperature [K]": data.Air_temperature_K,
        "Process temperature [K]": data.Process_temperature_K,
        "Rotational speed [rpm]": data.Rotational_speed_rpm,
        "Torque [Nm]": data.Torque_Nm,
        "Tool wear [min]": data.Tool_wear_min,
    }
    pred_res = predict_single(sensor_input)
    anom_res = detect_anomaly_single(sensor_input)

    now = datetime.now(timezone.utc)
    machine_doc = {
        "machine_id": data.machine_id,
        "name": data.name,
        "type": data.type,
        "Air_temperature_K": data.Air_temperature_K,
        "Process_temperature_K": data.Process_temperature_K,
        "Rotational_speed_rpm": data.Rotational_speed_rpm,
        "Torque_Nm": data.Torque_Nm,
        "Tool_wear_min": data.Tool_wear_min,
        "failure_prediction": pred_res["failure_prediction"],
        "failure_probability": pred_res["failure_probability"],
        "risk_score": pred_res["risk_score"],
        "health_status": pred_res["health_status"],
        "recommendation": pred_res["recommendation"],
        "is_anomaly": anom_res["is_anomaly"],
        "anomaly_score": anom_res["anomaly_score"],
        "created_at": now,
        "updated_at": now,
    }
    db.machines.insert_one(machine_doc)
    return serialize_doc(machine_doc)


@app.put("/machines/{machine_id}")
def update_machine(machine_id: str, data: MachineUpdate):
    db = get_db()
    existing = db.machines.find_one({"machine_id": machine_id})
    if not existing:
        raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found.")

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc)

    # If telemetry parameters changed, recalculate prediction
    sensor_changed = any(
        k in update_fields
        for k in ["Air_temperature_K", "Process_temperature_K", "Rotational_speed_rpm", "Torque_Nm", "Tool_wear_min"]
    )
    if sensor_changed:
        current = {**existing, **update_fields}
        sensor_input = {
            "Air temperature [K]": current["Air_temperature_K"],
            "Process temperature [K]": current["Process_temperature_K"],
            "Rotational speed [rpm]": current["Rotational_speed_rpm"],
            "Torque [Nm]": current["Torque_Nm"],
            "Tool wear [min]": current["Tool_wear_min"],
        }
        pred_res = predict_single(sensor_input)
        anom_res = detect_anomaly_single(sensor_input)
        update_fields.update({
            "failure_prediction": pred_res["failure_prediction"],
            "failure_probability": pred_res["failure_probability"],
            "risk_score": pred_res["risk_score"],
            "health_status": pred_res["health_status"],
            "recommendation": pred_res["recommendation"],
            "is_anomaly": anom_res["is_anomaly"],
            "anomaly_score": anom_res["anomaly_score"],
        })

    db.machines.update_one({"machine_id": machine_id}, {"$set": update_fields})
    updated = db.machines.find_one({"machine_id": machine_id})
    return serialize_doc(updated)


@app.delete("/machines/{machine_id}")
def delete_machine(machine_id: str):
    db = get_db()
    res = db.machines.delete_one({"machine_id": machine_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found.")
    return {"message": f"Machine {machine_id} deleted successfully."}


# ---------------------------------------------------------
# Single Failure Prediction (MongoDB: prediction_history, alerts)
# ---------------------------------------------------------
@app.post("/predict")
def predict(data: SensorDataInput):
    db = get_db()
    model_input = data.to_model_input()
    result = predict_single(model_input)
    now = datetime.now(timezone.utc)

    machine_id = data.machine_id or "ADHOC-INSPECT"
    prediction_id = f"PRED-{uuid.uuid4().hex[:8].upper()}"

    # 1. Persist to prediction_history
    history_entry = {
        "prediction_id": prediction_id,
        "machine_id": machine_id,
        "input_features": model_input,
        "failure_prediction": result["failure_prediction"],
        "failure_probability": result["failure_probability"],
        "risk_score": result["risk_score"],
        "health_status": result["health_status"],
        "recommendation": result["recommendation"],
        "feature_contributions": result.get("feature_contributions", []),
        "source": "single_inference",
        "created_at": now,
    }
    ins_res = db.prediction_history.insert_one(history_entry)
    result["prediction_id"] = prediction_id
    result["id"] = str(ins_res.inserted_id)

    # 2. Update machine record in machines collection if machine exists or if specified
    if data.machine_id:
        db.machines.update_one(
            {"machine_id": data.machine_id},
            {
                "$set": {
                    "Air_temperature_K": data.Air_temperature_K,
                    "Process_temperature_K": data.Process_temperature_K,
                    "Rotational_speed_rpm": data.Rotational_speed_rpm,
                    "Torque_Nm": data.Torque_Nm,
                    "Tool_wear_min": data.Tool_wear_min,
                    "failure_prediction": result["failure_prediction"],
                    "failure_probability": result["failure_probability"],
                    "risk_score": result["risk_score"],
                    "health_status": result["health_status"],
                    "recommendation": result["recommendation"],
                    "updated_at": now,
                }
            },
            upsert=False
        )

    # 3. Create or update alert if status is Warning or Critical
    if result["health_status"] in ["Warning", "Critical"]:
        existing_alert = db.alerts.find_one({
            "machine_id": machine_id,
            "alert_type": "Failure Risk",
            "status": {"$in": ["Active", "Acknowledged", "In Review"]}
        })
        if existing_alert:
            db.alerts.update_one(
                {"_id": existing_alert["_id"]},
                {
                    "$set": {
                        "severity": result["health_status"],
                        "risk_score": result["risk_score"],
                        "prediction_id": prediction_id,
                        "reason": f"Failure risk reached {result['risk_score']}% ({result['health_status']}).",
                        "recommendation": result["recommendation"],
                        "sensor_readings": data.model_dump(),
                        "updated_at": now,
                    }
                }
            )
            result["alert_id"] = existing_alert.get("alert_id")
        else:
            alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
            alert_doc = {
                "alert_id": alert_id,
                "machine_id": machine_id,
                "severity": result["health_status"],
                "alert_type": "Failure Risk",
                "title": f"{result['health_status']} Failure Risk on {machine_id}",
                "reason": f"Failure risk reached {result['risk_score']}% ({result['health_status']}).",
                "recommendation": result["recommendation"],
                "status": "Active",
                "risk_score": result["risk_score"],
                "prediction_id": prediction_id,
                "sensor_readings": data.model_dump(),
                "created_at": now,
                "updated_at": now,
            }
            db.alerts.insert_one(alert_doc)
            result["alert_id"] = alert_id

    return result



@app.get("/predictions/{prediction_id}")
def get_prediction_by_id(prediction_id: str):
    db = get_db()
    query = {"$or": [{"prediction_id": prediction_id}]}
    if ObjectId.is_valid(prediction_id):
        query["$or"].append({"_id": ObjectId(prediction_id)})
    doc = db.prediction_history.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Prediction record {prediction_id} not found.")
    return serialize_doc(doc)


# ---------------------------------------------------------
# Batch CSV Prediction (MongoDB: dataset_uploads, prediction_history, alerts)
# ---------------------------------------------------------
@app.post("/predict-batch")
async def predict_batch_endpoint(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    try:
        db = get_db()
        df = pd.read_csv(file.file)
        df.columns = df.columns.str.strip()

        if len(df) == 0:
            raise HTTPException(status_code=400, detail="The uploaded CSV file contains no data rows.")

        rename_map = {
            "Air_temperature_K": "Air temperature [K]",
            "Process_temperature_K": "Process temperature [K]",
            "Rotational_speed_rpm": "Rotational speed [rpm]",
            "Torque_Nm": "Torque [Nm]",
            "Tool_wear_min": "Tool wear [min]",
        }
        df = df.rename(columns=rename_map)

        expected_columns = [
            "Air temperature [K]",
            "Process temperature [K]",
            "Rotational speed [rpm]",
            "Torque [Nm]",
            "Tool wear [min]",
        ]

        missing = [col for col in expected_columns if col not in df.columns]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {missing}",
            )

        results = predict_batch(df)
        anomaly_results = detect_anomaly_batch(df)

        now = datetime.now(timezone.utc)
        upload_id = f"UPL-{uuid.uuid4().hex[:8].upper()}"

        healthy_cnt = sum(1 for r in results if r["health_status"] == "Healthy")
        warning_cnt = sum(1 for r in results if r["health_status"] == "Warning")
        critical_cnt = sum(1 for r in results if r["health_status"] == "Critical")
        failure_cnt = sum(1 for r in results if r["failure_prediction"] == 1)
        anomaly_cnt = sum(1 for a in anomaly_results if a["is_anomaly"])

        # 1. Record in dataset_uploads
        upload_doc = {
            "upload_id": upload_id,
            "filename": file.filename,
            "total_rows": len(results),
            "healthy_count": healthy_cnt,
            "warning_count": warning_cnt,
            "critical_count": critical_cnt,
            "failure_count": failure_cnt,
            "anomaly_count": anomaly_cnt,
            "created_at": now,
        }
        db.dataset_uploads.insert_one(upload_doc)

        # 2. Batch insert into prediction_history
        history_docs = []
        alerts_to_insert = []

        for i, res in enumerate(results):
            row_dict = df.iloc[i].to_dict()
            machine_id = str(row_dict.get("Product ID") or row_dict.get("UDI") or f"BAT-{i+1:03d}")
            anom_info = anomaly_results[i] if i < len(anomaly_results) else {}

            hist_item = {
                "prediction_id": f"PRED-BAT-{uuid.uuid4().hex[:8].upper()}",
                "upload_id": upload_id,
                "machine_id": machine_id,
                "input_features": {c: row_dict[c] for c in expected_columns},
                "failure_prediction": res["failure_prediction"],
                "failure_probability": res["failure_probability"],
                "risk_score": res["risk_score"],
                "health_status": res["health_status"],
                "recommendation": res["recommendation"],
                "feature_contributions": res.get("feature_contributions", []),
                "is_anomaly": anom_info.get("is_anomaly", False),
                "anomaly_score": anom_info.get("anomaly_score", 0.0),
                "source": "batch_upload",
                "created_at": now,
            }
            history_docs.append(hist_item)

            # Generate alerts for high risk rows
            if res["health_status"] in ["Warning", "Critical"]:
                alerts_to_insert.append({
                    "alert_id": f"ALT-{uuid.uuid4().hex[:8].upper()}",
                    "upload_id": upload_id,
                    "machine_id": machine_id,
                    "severity": res["health_status"],
                    "alert_type": "Failure Risk (Batch)",
                    "reason": f"Row #{i+1} flagged with {res['health_status']} risk score ({res['risk_score']}%).",
                    "recommendation": res["recommendation"],
                    "status": "Active",
                    "risk_score": res["risk_score"],
                    "sensor_readings": {c: row_dict[c] for c in expected_columns},
                    "created_at": now,
                    "updated_at": now,
                })

        if history_docs:
            db.prediction_history.insert_many(history_docs)

        if alerts_to_insert:
            db.alerts.insert_many(alerts_to_insert)

        return {
            "upload_id": upload_id,
            "filename": file.filename,
            "total_rows": len(results),
            "total_samples": len(results),
            "predictions": results,
            "summary": {
                "healthy": healthy_cnt,
                "warning": warning_cnt,
                "critical": critical_cnt,
                "failures_predicted": failure_cnt,
                "anomalies_detected": anomaly_cnt,
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")


# ---------------------------------------------------------
# Anomaly Detection (Isolation Forest) (MongoDB: anomaly_history)
# ---------------------------------------------------------
@app.post("/anomalies/detect")
def detect_anomaly_endpoint(data: AnomalyDetectionInput):
    db = get_db()
    features = data.to_features()
    result = detect_anomaly_single(features)
    now = datetime.now(timezone.utc)

    machine_id = data.machine_id or "ADHOC-ANOMALY-CHECK"
    anomaly_id = f"ANOM-{uuid.uuid4().hex[:8].upper()}"

    # Persist to anomaly_history collection
    anomaly_doc = {
        "anomaly_id": anomaly_id,
        "machine_id": machine_id,
        "input_features": features,
        "is_anomaly": result["is_anomaly"],
        "anomaly_score": result["anomaly_score"],
        "anomaly_level": result["anomaly_level"],
        "raw_score": result["raw_score"],
        "deviating_features": result["deviating_features"],
        "explanation": result["explanation"],
        "created_at": now,
    }
    ins_res = db.anomaly_history.insert_one(anomaly_doc)
    result["anomaly_id"] = anomaly_id
    result["id"] = str(ins_res.inserted_id)
    result["machine_id"] = machine_id

    # If critical anomaly, create or update alert in alerts collection
    if result["is_anomaly"] or result["anomaly_level"] == "Critical Anomaly":
        severity = "Warning" if result["anomaly_level"] == "Moderate Anomaly" else "Critical"
        existing_anom_alert = db.alerts.find_one({
            "machine_id": machine_id,
            "alert_type": "Sensor Anomaly",
            "status": {"$in": ["Active", "Acknowledged", "In Review"]}
        })
        if existing_anom_alert:
            db.alerts.update_one(
                {"_id": existing_anom_alert["_id"]},
                {
                    "$set": {
                        "severity": severity,
                        "anomaly_id": anomaly_id,
                        "risk_score": result["anomaly_score"],
                        "reason": result["explanation"],
                        "sensor_readings": features,
                        "updated_at": now,
                    }
                }
            )
            result["alert_id"] = existing_anom_alert.get("alert_id")
        else:
            alert_id = f"ALT-ANOM-{uuid.uuid4().hex[:8].upper()}"
            alert_doc = {
                "alert_id": alert_id,
                "machine_id": machine_id,
                "severity": severity,
                "alert_type": "Sensor Anomaly",
                "title": f"Sensor Anomaly Flagged: {machine_id}",
                "reason": result["explanation"],
                "recommendation": "Inspect anomalous sensor telemetry channels for sensor drift or mechanical overload.",
                "status": "Active",
                "risk_score": result["anomaly_score"],
                "anomaly_id": anomaly_id,
                "sensor_readings": features,
                "created_at": now,
                "updated_at": now,
            }
            db.alerts.insert_one(alert_doc)
            result["alert_id"] = alert_id

    return result


@app.get("/anomalies/{anomaly_id}")
def get_anomaly_by_id(anomaly_id: str):
    db = get_db()
    query = {"$or": [{"anomaly_id": anomaly_id}]}
    if ObjectId.is_valid(anomaly_id):
        query["$or"].append({"_id": ObjectId(anomaly_id)})
    doc = db.anomaly_history.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Anomaly record {anomaly_id} not found.")
    return serialize_doc(doc)


@app.get("/anomalies/history")
def get_anomaly_history(
    limit: int = Query(50, ge=1, le=200),
    machine_id: Optional[str] = Query(None),
):
    db = get_db()
    query = {}
    if machine_id:
        query["machine_id"] = machine_id

    docs = list(db.anomaly_history.find(query).sort("created_at", -1).limit(limit))
    return serialize_docs(docs)


# ---------------------------------------------------------
# Prediction History (MongoDB: prediction_history)
# ---------------------------------------------------------
@app.get("/predictions/history")
def get_prediction_history(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    machine_id: Optional[str] = Query(None),
):
    db = get_db()
    query = {}
    if machine_id:
        query["machine_id"] = machine_id

    total = db.prediction_history.count_documents(query)
    docs = list(db.prediction_history.find(query).sort("created_at", -1).skip(skip).limit(limit))
    return {
        "total": total,
        "limit": limit,
        "skip": skip,
        "records": serialize_docs(docs)
    }


# ---------------------------------------------------------
# Alerts (MongoDB: alerts)
# ---------------------------------------------------------
ALERT_VALID_TRANSITIONS = {
    "Active": {"Acknowledged", "In Review", "Resolved"},
    "Acknowledged": {"Resolved", "Active", "In Review"},
    "In Review": {"Resolved", "Active", "Acknowledged"},
    "Resolved": {"Active"},  # Reopening required to move away from Resolved
}


@app.get("/alerts")
def get_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    machine_id: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    alert_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    db = get_db()
    query = {}
    if status_filter and status_filter.upper() != "ALL":
        query["status"] = status_filter
    if machine_id:
        query["machine_id"] = machine_id
    if severity and severity.upper() != "ALL":
        query["severity"] = severity
    if alert_type and alert_type.upper() != "ALL":
        query["alert_type"] = alert_type
    if date_from or date_to:
        date_query = {}
        if date_from:
            try:
                date_query["$gte"] = datetime.fromisoformat(date_from)
            except Exception:
                pass
        if date_to:
            try:
                date_query["$lte"] = datetime.fromisoformat(date_to)
            except Exception:
                pass
        if date_query:
            query["created_at"] = date_query

    docs = list(db.alerts.find(query).sort("created_at", -1).skip(skip).limit(limit))
    return serialize_docs(docs)


@app.get("/alerts/{alert_id}")
def get_alert_by_id(alert_id: str):
    db = get_db()
    query = {"$or": [{"alert_id": alert_id}]}
    if ObjectId.is_valid(alert_id):
        query["$or"].append({"_id": ObjectId(alert_id)})
    doc = db.alerts.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    return serialize_doc(doc)


@app.post("/alerts", status_code=status.HTTP_201_CREATED)
def create_alert(data: AlertCreate):
    db = get_db()
    now = datetime.now(timezone.utc)

    # Duplicate prevention: Check if active alert already exists for same machine and alert type
    existing_active = db.alerts.find_one({
        "machine_id": data.machine_id,
        "alert_type": data.alert_type or "Failure Risk",
        "status": {"$in": ["Active", "Acknowledged", "In Review"]}
    })
    if existing_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active alert ({existing_active.get('alert_id')}) already exists for machine {data.machine_id} with type '{data.alert_type or 'Failure Risk'}'."
        )

    alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
    alert_doc = {
        "alert_id": alert_id,
        "machine_id": data.machine_id,
        "alert_type": data.alert_type or "Failure Risk",
        "severity": data.severity or "Warning",
        "title": data.title or f"{data.severity or 'Warning'} {data.alert_type or 'Alert'}: {data.machine_id}",
        "reason": data.reason,
        "recommendation": data.recommendation or "Inspect equipment operating condition.",
        "status": "Active",
        "risk_score": data.risk_score or 50.0,
        "sensor_readings": data.sensor_readings or {},
        "prediction_id": data.prediction_id,
        "anomaly_id": data.anomaly_id,
        "recommendation_id": data.recommendation_id,
        "created_at": now,
        "updated_at": now,
    }
    db.alerts.insert_one(alert_doc)
    return serialize_doc(alert_doc)


@app.post("/alerts/evaluate")
def evaluate_telemetry_for_alerts(data: AlertEvaluationInput):
    db = get_db()
    now = datetime.now(timezone.utc)
    sensor_input = data.to_model_input()

    # 1. Run model inference & anomaly detector
    pred_res = predict_single(sensor_input)
    anom_res = detect_anomaly_single(sensor_input)

    risk_score = pred_res["risk_score"]
    health_status = pred_res["health_status"]
    is_anom = anom_res["is_anomaly"]
    anom_score = anom_res["anomaly_score"]

    alert_severity = None
    alert_type = None
    reason = None
    recommendation = pred_res["recommendation"]

    # Evaluate against thresholds
    if data.alert_type == "Sensor Anomaly":
        if is_anom or anom_score >= data.anomaly_threshold:
            alert_severity = "Critical" if (anom_res.get("anomaly_level") == "Critical Anomaly" or anom_score >= 65.0) else "Warning"
            alert_type = "Sensor Anomaly"
            reason = anom_res.get("explanation", "Unusual sensor telemetry anomaly pattern detected.")
            recommendation = "Inspect anomalous sensor telemetry channels for sensor drift or mechanical overload."
        elif risk_score >= data.risk_threshold_critical:
            alert_severity = "Critical"
            alert_type = "Failure Risk"
            reason = f"Failure risk reached {risk_score}% exceeding critical limit ({data.risk_threshold_critical}%)."
        elif risk_score >= data.risk_threshold_warning:
            alert_severity = "Warning"
            alert_type = "Failure Risk"
            reason = f"Failure risk reached {risk_score}% exceeding warning limit ({data.risk_threshold_warning}%)."
    else:
        if risk_score >= data.risk_threshold_critical:
            alert_severity = "Critical"
            alert_type = "Failure Risk"
            reason = f"Failure risk reached {risk_score}% exceeding critical limit ({data.risk_threshold_critical}%)."
        elif risk_score >= data.risk_threshold_warning:
            alert_severity = "Warning"
            alert_type = "Failure Risk"
            reason = f"Failure risk reached {risk_score}% exceeding warning limit ({data.risk_threshold_warning}%)."
        elif is_anom or anom_score >= data.anomaly_threshold or (anom_res.get("anomaly_level") in ["Critical Anomaly", "Moderate Anomaly"] and anom_score >= 40.0):
            alert_severity = "Critical" if (anom_res.get("anomaly_level") == "Critical Anomaly" or anom_score >= 65.0) else "Warning"
            alert_type = "Sensor Anomaly"
            reason = anom_res.get("explanation", "Unusual sensor telemetry anomaly pattern detected.")
            recommendation = "Inspect anomalous sensor telemetry channels for sensor drift or mechanical overload."


    if not alert_severity:
        return {
            "evaluated": True,
            "alert_created": False,
            "risk_score": risk_score,
            "health_status": health_status,
            "is_anomaly": is_anom,
            "anomaly_score": anom_score,
            "message": "Telemetry is within nominal operational boundaries. No alert triggered.",
        }

    # Duplicate prevention: Check for existing active alert
    if not data.force_new_alert:
        existing_alert = db.alerts.find_one({
            "machine_id": data.machine_id,
            "alert_type": alert_type,
            "status": {"$in": ["Active", "Acknowledged", "In Review"]}
        })
        if existing_alert:
            db.alerts.update_one(
                {"_id": existing_alert["_id"]},
                {
                    "$set": {
                        "severity": alert_severity,
                        "risk_score": risk_score if alert_type == "Failure Risk" else anom_score,
                        "reason": reason,
                        "recommendation": recommendation,
                        "sensor_readings": sensor_input,
                        "updated_at": now,
                    }
                }
            )
            refreshed = db.alerts.find_one({"_id": existing_alert["_id"]})
            return {
                "evaluated": True,
                "alert_created": False,
                "duplicate_suppressed": True,
                "message": f"Active alert already exists for {data.machine_id} and {alert_type}. Refreshed existing record.",
                "alert": serialize_doc(refreshed)
            }

    alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
    new_alert = {
        "alert_id": alert_id,
        "machine_id": data.machine_id,
        "severity": alert_severity,
        "alert_type": alert_type,
        "title": f"{alert_severity} {alert_type}: {data.machine_id}",
        "reason": reason,
        "recommendation": recommendation,
        "status": "Active",
        "risk_score": risk_score if alert_type == "Failure Risk" else anom_score,
        "sensor_readings": sensor_input,
        "created_at": now,
        "updated_at": now,
    }
    db.alerts.insert_one(new_alert)
    return {
        "evaluated": True,
        "alert_created": True,
        "duplicate_suppressed": False,
        "message": f"New {alert_severity} alert triggered successfully.",
        "alert": serialize_doc(new_alert)
    }


@app.put("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, data: Optional[AlertAcknowledgeInput] = None):
    db = get_db()
    query = {"$or": [{"alert_id": alert_id}]}
    if ObjectId.is_valid(alert_id):
        query["$or"].append({"_id": ObjectId(alert_id)})
    alert = db.alerts.find_one(query)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

    curr_status = alert.get("status")
    if curr_status == "Resolved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot acknowledge a resolved alert. Reopen the alert first."
        )

    now = datetime.now(timezone.utc)
    update_fields = {
        "status": "Acknowledged",
        "acknowledged_at": now,
        "updated_at": now,
    }
    if data:
        if data.acknowledged_by:
            update_fields["acknowledged_by"] = data.acknowledged_by
        if data.notes:
            update_fields["acknowledgement_notes"] = data.notes

    db.alerts.update_one({"_id": alert["_id"]}, {"$set": update_fields})
    updated = db.alerts.find_one({"_id": alert["_id"]})
    return serialize_doc(updated)


@app.put("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, data: Optional[AlertResolveInput] = None):
    db = get_db()
    query = {"$or": [{"alert_id": alert_id}]}
    if ObjectId.is_valid(alert_id):
        query["$or"].append({"_id": ObjectId(alert_id)})
    alert = db.alerts.find_one(query)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

    now = datetime.now(timezone.utc)
    update_fields = {
        "status": "Resolved",
        "resolved_at": now,
        "updated_at": now,
    }
    if data:
        if data.resolved_by:
            update_fields["resolved_by"] = data.resolved_by
        if data.resolution_notes:
            update_fields["resolution_notes"] = data.resolution_notes

    db.alerts.update_one({"_id": alert["_id"]}, {"$set": update_fields})
    updated = db.alerts.find_one({"_id": alert["_id"]})
    return serialize_doc(updated)


@app.put("/alerts/{alert_id}/reopen")
def reopen_alert(alert_id: str, data: Optional[AlertReopenInput] = None):
    db = get_db()
    query = {"$or": [{"alert_id": alert_id}]}
    if ObjectId.is_valid(alert_id):
        query["$or"].append({"_id": ObjectId(alert_id)})
    alert = db.alerts.find_one(query)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

    now = datetime.now(timezone.utc)
    update_fields = {
        "status": "Active",
        "reopened_at": now,
        "updated_at": now,
    }
    if data:
        if data.reopened_by:
            update_fields["reopened_by"] = data.reopened_by
        if data.reason:
            update_fields["reopen_reason"] = data.reason

    db.alerts.update_one({"_id": alert["_id"]}, {"$set": update_fields})
    updated = db.alerts.find_one({"_id": alert["_id"]})
    return serialize_doc(updated)


@app.put("/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, data: AlertUpdateStatus):
    db = get_db()
    query = {"$or": [{"alert_id": alert_id}]}
    if ObjectId.is_valid(alert_id):
        query["$or"].append({"_id": ObjectId(alert_id)})
    alert = db.alerts.find_one(query)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

    curr_status = alert.get("status", "Active")
    target_status = data.status

    allowed = ALERT_VALID_TRANSITIONS.get(curr_status, set())
    if target_status != curr_status and target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid alert status transition from '{curr_status}' to '{target_status}'. Allowed: {sorted(list(allowed))}"
        )

    now = datetime.now(timezone.utc)
    update_fields = {
        "status": target_status,
        "updated_at": now,
    }
    if target_status == "Acknowledged":
        update_fields["acknowledged_at"] = now
    elif target_status == "Resolved":
        update_fields["resolved_at"] = now
    elif target_status == "Active" and curr_status == "Resolved":
        update_fields["reopened_at"] = now

    if data.notes:
        update_fields["status_notes"] = data.notes

    db.alerts.update_one({"_id": alert["_id"]}, {"$set": update_fields})
    updated = db.alerts.find_one({"_id": alert["_id"]})
    return serialize_doc(updated)


# ---------------------------------------------------------
# Maintenance Work Orders (MongoDB: maintenance_work_orders)
# ---------------------------------------------------------
WORK_ORDER_VALID_TRANSITIONS = {
    "Pending": {"In Progress", "Cancelled"},
    "Open": {"In Progress", "Cancelled"},
    "In Progress": {"Completed", "Cancelled", "Pending", "Open"},
    "Completed": {"Pending", "Open", "In Progress"},  # Reopening
    "Cancelled": {"Pending", "Open"},                 # Reopening
}


def _normalize_wo_status(status_str: str) -> str:
    s = status_str.strip().title()
    if s == "Open":
        return "Pending"
    return s


def _get_work_orders_helper(
    status_filter: Optional[str] = None,
    priority: Optional[str] = None,
    machine_id: Optional[str] = None,
    alert_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    db = get_db()
    query = {}
    if status_filter and status_filter.upper() != "ALL":
        normalized = _normalize_wo_status(status_filter)
        if normalized == "Pending":
            query["status"] = {"$in": ["Pending", "Open"]}
        else:
            query["status"] = normalized
    if priority and priority.upper() != "ALL":
        query["priority"] = priority.capitalize()
    if machine_id:
        query["machine_id"] = machine_id
    if alert_id:
        query["alert_id"] = alert_id
    if date_from or date_to:
        date_query = {}
        if date_from:
            try:
                date_query["$gte"] = datetime.fromisoformat(date_from)
            except Exception:
                pass
        if date_to:
            try:
                date_query["$lte"] = datetime.fromisoformat(date_to)
            except Exception:
                pass
        if date_query:
            query["created_at"] = date_query

    docs = list(db.maintenance_work_orders.find(query).sort("created_at", -1).skip(skip).limit(limit))
    # Ensure both work_order_id and task_id are present on each doc
    for d in docs:
        wo_id = d.get("work_order_id") or d.get("task_id")
        d["work_order_id"] = wo_id
        d["task_id"] = wo_id
    return serialize_docs(docs)


def _create_work_order_helper(data: WorkOrderCreate):
    db = get_db()
    now = datetime.now(timezone.utc)

    # Duplicate prevention: Check if active work order exists for same machine and action
    existing = db.maintenance_work_orders.find_one({
        "machine_id": data.machine_id,
        "action": data.action,
        "status": {"$in": ["Pending", "Open", "In Progress"]}
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active work order ({existing.get('task_id') or existing.get('work_order_id')}) already exists for machine {data.machine_id} with action '{data.action}'."
        )

    task_id = f"WO-{uuid.uuid4().hex[:6].upper()}"
    task_doc = {
        "task_id": task_id,
        "work_order_id": task_id,
        "machine_id": data.machine_id,
        "title": data.title or data.action,
        "action": data.action,
        "priority": data.priority or "Medium",
        "scheduled_date": data.scheduled_date or "Next Shift",
        "assigned_to": data.assigned_to or "Reliability Specialist",
        "status": "Pending",
        "notes": data.notes,
        "alert_id": data.alert_id,
        "recommendation_id": data.recommendation_id,
        "created_at": now,
        "updated_at": now,
    }
    db.maintenance_work_orders.insert_one(task_doc)
    return serialize_doc(task_doc)


def _update_work_order_status_helper(order_id: str, data: WorkOrderUpdateStatus):
    db = get_db()
    query = {"$or": [{"task_id": order_id}, {"work_order_id": order_id}]}
    if ObjectId.is_valid(order_id):
        query["$or"].append({"_id": ObjectId(order_id)})
    doc = db.maintenance_work_orders.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Work order / task {order_id} not found.")

    curr_status = doc.get("status", "Pending")
    target_status = data.status.strip().title()
    if target_status == "Open":
        target_status = "Pending"

    allowed = WORK_ORDER_VALID_TRANSITIONS.get(curr_status, set())
    if target_status != curr_status and target_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid work order status transition from '{curr_status}' to '{target_status}'. Allowed: {sorted(list(allowed))}"
        )

    now = datetime.now(timezone.utc)
    update_data = {
        "status": target_status,
        "updated_at": now,
    }
    if target_status == "Completed":
        update_data["completed_at"] = now
    elif target_status in ["Pending", "Open", "In Progress"] and curr_status == "Completed":
        update_data["reopened_at"] = now

    if data.notes:
        update_data["notes"] = data.notes

    db.maintenance_work_orders.update_one({"_id": doc["_id"]}, {"$set": update_data})
    updated = db.maintenance_work_orders.find_one({"_id": doc["_id"]})
    wo_id = updated.get("work_order_id") or updated.get("task_id")
    updated["work_order_id"] = wo_id
    updated["task_id"] = wo_id
    return serialize_doc(updated)


@app.get("/maintenance/work-orders")
def get_work_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    machine_id: Optional[str] = Query(None),
    alert_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    return _get_work_orders_helper(
        status_filter=status_filter,
        priority=priority,
        machine_id=machine_id,
        alert_id=alert_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        skip=skip,
    )


@app.get("/maintenance/tasks")
def get_maintenance_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    machine_id: Optional[str] = Query(None),
):
    return _get_work_orders_helper(
        status_filter=status_filter,
        priority=priority,
        machine_id=machine_id,
    )


@app.get("/maintenance/work-orders/{work_order_id}")
def get_work_order_by_id(work_order_id: str):
    db = get_db()
    query = {"$or": [{"work_order_id": work_order_id}, {"task_id": work_order_id}]}
    if ObjectId.is_valid(work_order_id):
        query["$or"].append({"_id": ObjectId(work_order_id)})
    doc = db.maintenance_work_orders.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Work order {work_order_id} not found.")
    wo_id = doc.get("work_order_id") or doc.get("task_id")
    doc["work_order_id"] = wo_id
    doc["task_id"] = wo_id
    return serialize_doc(doc)


@app.post("/maintenance/work-orders", status_code=status.HTTP_201_CREATED)
def create_work_order(data: WorkOrderCreate):
    return _create_work_order_helper(data)


@app.post("/maintenance/tasks", status_code=status.HTTP_201_CREATED)
def create_maintenance_task(data: WorkOrderCreate):
    return _create_work_order_helper(data)


@app.put("/maintenance/work-orders/{work_order_id}")
def update_work_order(work_order_id: str, data: WorkOrderUpdate):
    db = get_db()
    query = {"$or": [{"work_order_id": work_order_id}, {"task_id": work_order_id}]}
    if ObjectId.is_valid(work_order_id):
        query["$or"].append({"_id": ObjectId(work_order_id)})
    doc = db.maintenance_work_orders.find_one(query)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Work order {work_order_id} not found.")

    update_fields = {k: v for k, v in data.model_dump().items() if v is not None}
    update_fields["updated_at"] = datetime.now(timezone.utc)

    db.maintenance_work_orders.update_one({"_id": doc["_id"]}, {"$set": update_fields})
    updated = db.maintenance_work_orders.find_one({"_id": doc["_id"]})
    wo_id = updated.get("work_order_id") or updated.get("task_id")
    updated["work_order_id"] = wo_id
    updated["task_id"] = wo_id
    return serialize_doc(updated)


@app.put("/maintenance/work-orders/{work_order_id}/status")
def update_work_order_status(work_order_id: str, data: WorkOrderUpdateStatus):
    return _update_work_order_status_helper(work_order_id, data)


@app.put("/maintenance/tasks/{task_id}/status")
def update_task_status(task_id: str, data: WorkOrderUpdateStatus):
    return _update_work_order_status_helper(task_id, data)



# ---------------------------------------------------------
# Machine History & Telemetry Progression
# ---------------------------------------------------------
@app.get("/machines/{machine_id}/history")
def get_machine_history(machine_id: str, limit: int = Query(24, ge=1, le=100)):
    db = get_db()
    machine = db.machines.find_one({"machine_id": machine_id})
    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine {machine_id} not found.")

    pred_history = list(
        db.prediction_history.find({"machine_id": machine_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    anomaly_history = list(
        db.anomaly_history.find({"machine_id": machine_id})
        .sort("created_at", -1)
        .limit(limit)
    )
    work_orders = list(
        db.maintenance_work_orders.find({"machine_id": machine_id})
        .sort("created_at", -1)
    )
    machine_alerts = list(
        db.alerts.find({"machine_id": machine_id})
        .sort("created_at", -1)
    )

    return {
        "machine": serialize_doc(machine),
        "prediction_history": serialize_docs(pred_history),
        "anomaly_history": serialize_docs(anomaly_history),
        "work_orders": serialize_docs(work_orders),
        "alerts": serialize_docs(machine_alerts),
    }


# ---------------------------------------------------------
# Dataset Uploads History
# ---------------------------------------------------------
@app.get("/uploads/history")
def get_upload_history(limit: int = Query(20, ge=1, le=100)):
    db = get_db()
    docs = list(db.dataset_uploads.find({}).sort("created_at", -1).limit(limit))
    return serialize_docs(docs)