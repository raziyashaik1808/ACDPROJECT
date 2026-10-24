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
    WorkOrderUpdateStatus,
    AlertUpdateStatus,
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
        alert_id = f"ALT-{uuid.uuid4().hex[:8].upper()}"
        alert_doc = {
            "alert_id": alert_id,
            "machine_id": machine_id,
            "severity": result["health_status"],
            "alert_type": "Failure Risk",
            "reason": f"Failure risk reached {result['risk_score']}% ({result['health_status']}).",
            "recommendation": result["recommendation"],
            "status": "Active",
            "risk_score": result["risk_score"],
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

    # If critical anomaly, create alert in alerts collection
    if result["is_anomaly"] or result["anomaly_level"] == "Critical Anomaly":
        alert_doc = {
            "alert_id": f"ALT-ANOM-{uuid.uuid4().hex[:8].upper()}",
            "machine_id": machine_id,
            "severity": "Warning" if result["anomaly_level"] == "Moderate Anomaly" else "Critical",
            "alert_type": "Sensor Anomaly",
            "reason": result["explanation"],
            "recommendation": "Inspect anomalous sensor telemetry channels for sensor drift or mechanical overload.",
            "status": "Active",
            "risk_score": result["anomaly_score"],
            "sensor_readings": features,
            "created_at": now,
            "updated_at": now,
        }
        db.alerts.insert_one(alert_doc)

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
@app.get("/alerts")
def get_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
):
    db = get_db()
    query = {}
    if status_filter and status_filter.upper() != "ALL":
        query["status"] = status_filter

    docs = list(db.alerts.find(query).sort("created_at", -1).limit(limit))
    return serialize_docs(docs)


@app.put("/alerts/{alert_id}/status")
def update_alert_status(alert_id: str, data: AlertUpdateStatus):
    db = get_db()
    res = db.alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {"status": data.status, "updated_at": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")
    updated = db.alerts.find_one({"alert_id": alert_id})
    return serialize_doc(updated)


# ---------------------------------------------------------
# Maintenance Work Orders (MongoDB: maintenance_work_orders)
# ---------------------------------------------------------
@app.get("/maintenance/tasks")
def get_maintenance_tasks(
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
):
    db = get_db()
    query = {}
    if status_filter and status_filter.upper() != "ALL":
        query["status"] = status_filter
    if priority and priority.upper() != "ALL":
        query["priority"] = priority

    docs = list(db.maintenance_work_orders.find(query).sort("created_at", -1))
    return serialize_docs(docs)


@app.post("/maintenance/tasks")
def create_maintenance_task(data: WorkOrderCreate):
    db = get_db()
    now = datetime.now(timezone.utc)
    task_id = f"WO-{uuid.uuid4().hex[:6].upper()}"

    task_doc = {
        "task_id": task_id,
        "machine_id": data.machine_id,
        "action": data.action,
        "priority": data.priority,
        "scheduled_date": data.scheduled_date,
        "assigned_to": data.assigned_to,
        "status": "Pending",
        "notes": data.notes,
        "created_at": now,
        "updated_at": now,
    }
    db.maintenance_work_orders.insert_one(task_doc)
    return serialize_doc(task_doc)


@app.put("/maintenance/tasks/{task_id}/status")
def update_task_status(task_id: str, data: WorkOrderUpdateStatus):
    db = get_db()
    update_data = {
        "status": data.status,
        "updated_at": datetime.now(timezone.utc)
    }
    if data.notes:
        update_data["notes"] = data.notes

    res = db.maintenance_work_orders.update_one(
        {"task_id": task_id},
        {"$set": update_data}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found.")

    updated = db.maintenance_work_orders.find_one({"task_id": task_id})
    return serialize_doc(updated)


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