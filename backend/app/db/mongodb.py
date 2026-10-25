import os
from pathlib import Path
from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables from backend/.env
ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "predictive_maintenance")


class MongoManager:
    client: MongoClient = None
    db = None


manager = MongoManager()


def get_db():
    if manager.db is None:
        raise ConnectionError(
            f"MongoDB connection is not established. Verify local MongoDB is running at {MONGODB_URI}."
        )
    return manager.db


def serialize_doc(doc: dict) -> dict:
    """Transform MongoDB document into JSON-serializable dictionary with string ID and ISO timestamps."""
    if not doc:
        return {}
    res = {}
    for k, v in doc.items():
        if k == "_id":
            res["id"] = str(v)
        elif isinstance(v, ObjectId):
            res[k] = str(v)
        elif isinstance(v, datetime):
            res[k] = v.isoformat()
        elif isinstance(v, dict):
            res[k] = serialize_doc(v)
        elif isinstance(v, list):
            res[k] = [
                serialize_doc(item) if isinstance(item, dict)
                else str(item) if isinstance(item, ObjectId)
                else item.isoformat() if isinstance(item, datetime)
                else item
                for item in v
            ]
        else:
            res[k] = v
    return res


def serialize_docs(docs) -> list:
    return [serialize_doc(d) for d in docs]


def connect_to_mongo():
    """Establish and verify connection to local MongoDB Community Server."""
    try:
        manager.client = MongoClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000,
        )
        # Force a network call to verify connectivity
        manager.client.admin.command("ping")
        manager.db = manager.client[MONGODB_DATABASE]
        print(f"Successfully connected to MongoDB at {MONGODB_URI}, Database: {MONGODB_DATABASE}")

        # Ensure collections & indexes exist
        setup_indexes()

        # Seed initial records if collections are empty
        seed_initial_data()

    except (ConnectionFailure, ServerSelectionTimeoutError) as e:
        manager.client = None
        manager.db = None
        raise ConnectionError(
            f"Failed to connect to local MongoDB at {MONGODB_URI}. "
            f"Please ensure MongoDB Community Server is installed and running on port 27017. Details: {str(e)}"
        )


def close_mongo_connection():
    """Gracefully terminate MongoDB connections."""
    if manager.client is not None:
        manager.client.close()
        manager.client = None
        manager.db = None
        print("MongoDB connection closed.")


def setup_indexes():
    """Create indexes for optimized query performance and unique constraints."""
    db = manager.db
    if db is None:
        return

    # machines collection
    db.machines.create_index("machine_id", unique=True)
    db.machines.create_index("health_status")

    # prediction_history collection
    db.prediction_history.create_index([("created_at", DESCENDING)])
    db.prediction_history.create_index("prediction_id")
    db.prediction_history.create_index("machine_id")

    # anomaly_history collection
    db.anomaly_history.create_index([("created_at", DESCENDING)])
    db.anomaly_history.create_index("anomaly_id")
    db.anomaly_history.create_index("machine_id")

    # alerts collection
    db.alerts.create_index([("created_at", DESCENDING)])
    db.alerts.create_index("alert_id", unique=True)
    db.alerts.create_index("machine_id")
    db.alerts.create_index("status")
    db.alerts.create_index("severity")
    db.alerts.create_index("alert_type")
    db.alerts.create_index([("machine_id", ASCENDING), ("alert_type", ASCENDING), ("status", ASCENDING)])

    # maintenance_work_orders collection
    db.maintenance_work_orders.create_index("task_id", unique=True)
    db.maintenance_work_orders.create_index("work_order_id", sparse=True)
    db.maintenance_work_orders.create_index([("created_at", DESCENDING)])
    db.maintenance_work_orders.create_index("machine_id")
    db.maintenance_work_orders.create_index("status")
    db.maintenance_work_orders.create_index("priority")
    db.maintenance_work_orders.create_index("alert_id")

    # dataset_uploads collection
    db.dataset_uploads.create_index([("created_at", DESCENDING)])

    # maintenance_recommendations collection
    db.maintenance_recommendations.create_index("recommendation_id", unique=True)
    db.maintenance_recommendations.create_index("machine_id")
    db.maintenance_recommendations.create_index("priority")
    db.maintenance_recommendations.create_index("status")
    db.maintenance_recommendations.create_index([("created_at", DESCENDING)])


def seed_initial_data():
    """Seed baseline fleet and maintenance work orders if collections are empty."""
    db = manager.db
    now = datetime.now(timezone.utc)

    # 1. Seed initial machines if empty
    if db.machines.count_documents({}) == 0:
        initial_machines = [
            {
                "machine_id": "M-14860",
                "name": "CNC Milling Station 01",
                "type": "M",
                "Air_temperature_K": 298.1,
                "Process_temperature_K": 308.6,
                "Rotational_speed_rpm": 1551.0,
                "Torque_Nm": 42.8,
                "Tool_wear_min": 12.0,
                "failure_prediction": 0,
                "failure_probability": 0.0014,
                "risk_score": 0.14,
                "health_status": "Healthy",
                "recommendation": "No immediate action required. Continue routine monitoring.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47181",
                "name": "Heavy Lathe Unit 02",
                "type": "L",
                "Air_temperature_K": 298.2,
                "Process_temperature_K": 308.7,
                "Rotational_speed_rpm": 1408.0,
                "Torque_Nm": 46.3,
                "Tool_wear_min": 24.0,
                "failure_prediction": 0,
                "failure_probability": 0.0018,
                "risk_score": 0.18,
                "health_status": "Healthy",
                "recommendation": "No immediate action required. Continue routine monitoring.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47182",
                "name": "Drilling Center 03",
                "type": "L",
                "Air_temperature_K": 298.1,
                "Process_temperature_K": 308.5,
                "Rotational_speed_rpm": 1498.0,
                "Torque_Nm": 49.4,
                "Tool_wear_min": 45.0,
                "failure_prediction": 0,
                "failure_probability": 0.0022,
                "risk_score": 0.22,
                "health_status": "Healthy",
                "recommendation": "No immediate action required. Continue routine monitoring.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47183",
                "name": "Precision Boring Unit 04",
                "type": "L",
                "Air_temperature_K": 298.2,
                "Process_temperature_K": 308.6,
                "Rotational_speed_rpm": 1433.0,
                "Torque_Nm": 39.5,
                "Tool_wear_min": 58.0,
                "failure_prediction": 0,
                "failure_probability": 0.0019,
                "risk_score": 0.19,
                "health_status": "Healthy",
                "recommendation": "No immediate action required. Continue routine monitoring.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47184",
                "name": "Hydraulic Press 05",
                "type": "L",
                "Air_temperature_K": 302.5,
                "Process_temperature_K": 312.2,
                "Rotational_speed_rpm": 1380.0,
                "Torque_Nm": 54.0,
                "Tool_wear_min": 172.0,
                "failure_prediction": 0,
                "failure_probability": 0.442,
                "risk_score": 44.2,
                "health_status": "Warning",
                "recommendation": "Check motor load and shaft alignment.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "M-14865",
                "name": "Rotary Grinder 06",
                "type": "M",
                "Air_temperature_K": 306.0,
                "Process_temperature_K": 315.0,
                "Rotational_speed_rpm": 1350.0,
                "Torque_Nm": 58.0,
                "Tool_wear_min": 220.0,
                "failure_prediction": 1,
                "failure_probability": 0.625,
                "risk_score": 62.5,
                "health_status": "Warning",
                "recommendation": "Inspect cooling system and consider tool replacement.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47186",
                "name": "Automated Saw 07",
                "type": "L",
                "Air_temperature_K": 298.1,
                "Process_temperature_K": 308.6,
                "Rotational_speed_rpm": 1558.0,
                "Torque_Nm": 42.4,
                "Tool_wear_min": 88.0,
                "failure_prediction": 0,
                "failure_probability": 0.0015,
                "risk_score": 0.15,
                "health_status": "Healthy",
                "recommendation": "No immediate action required. Continue routine monitoring.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47187",
                "name": "Gear Shaper 08",
                "type": "L",
                "Air_temperature_K": 298.1,
                "Process_temperature_K": 308.6,
                "Rotational_speed_rpm": 1527.0,
                "Torque_Nm": 40.2,
                "Tool_wear_min": 96.0,
                "failure_prediction": 0,
                "failure_probability": 0.0016,
                "risk_score": 0.16,
                "health_status": "Healthy",
                "recommendation": "No immediate action required. Continue routine monitoring.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47230",
                "name": "Extrusion Mill 09",
                "type": "L",
                "Air_temperature_K": 305.5,
                "Process_temperature_K": 314.8,
                "Rotational_speed_rpm": 1290.0,
                "Torque_Nm": 66.5,
                "Tool_wear_min": 198.0,
                "failure_prediction": 1,
                "failure_probability": 0.785,
                "risk_score": 78.5,
                "health_status": "Critical",
                "recommendation": "Inspect overheating and vibration-related components. Reduce motor load.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "machine_id": "L-47257",
                "name": "Heavy Machining Center 10",
                "type": "L",
                "Air_temperature_K": 308.2,
                "Process_temperature_K": 316.5,
                "Rotational_speed_rpm": 1260.0,
                "Torque_Nm": 69.2,
                "Tool_wear_min": 246.0,
                "failure_prediction": 1,
                "failure_probability": 0.894,
                "risk_score": 89.4,
                "health_status": "Critical",
                "recommendation": "Inspect cooling system and consider tool replacement immediately.",
                "created_at": now,
                "updated_at": now,
            },
        ]
        db.machines.insert_many(initial_machines)
        print("Seeded initial 10 baseline machines into MongoDB.")

    # 2. Seed initial maintenance tasks if empty
    if db.maintenance_work_orders.count_documents({}) == 0:
        initial_tasks = [
            {
                "task_id": "WO-8821",
                "machine_id": "L-47257",
                "action": "Cooling system flush & cutter tool replacement",
                "priority": "High",
                "scheduled_date": "Immediate",
                "status": "Pending",
                "assigned_to": "Marcus Vance (Senior Tech)",
                "created_at": now,
                "updated_at": now,
            },
            {
                "task_id": "WO-8822",
                "machine_id": "L-47230",
                "action": "Drive motor vibration test & torque recalibration",
                "priority": "High",
                "scheduled_date": "Today, 16:00",
                "status": "In Progress",
                "assigned_to": "Sarah Jenkins (Mechanical)",
                "created_at": now,
                "updated_at": now,
            },
            {
                "task_id": "WO-8823",
                "machine_id": "M-14865",
                "action": "Spindle tool wear measurement & thermal sensor audit",
                "priority": "Medium",
                "scheduled_date": "Tomorrow, 09:30",
                "status": "Pending",
                "assigned_to": "David Liu (Reliability)",
                "created_at": now,
                "updated_at": now,
            },
            {
                "task_id": "WO-8824",
                "machine_id": "L-47184",
                "action": "Hydraulic pressure inspection & seal check",
                "priority": "Medium",
                "scheduled_date": "Oct 26, 2026",
                "status": "Pending",
                "assigned_to": "Sarah Jenkins (Mechanical)",
                "created_at": now,
                "updated_at": now,
            },
            {
                "task_id": "WO-8820",
                "machine_id": "M-14860",
                "action": "Scheduled 200-hour preventive lubrication & calibration",
                "priority": "Low",
                "scheduled_date": "Oct 22, 2026",
                "status": "Completed",
                "assigned_to": "Elena Ramos (Field Tech)",
                "created_at": now,
                "updated_at": now,
            },
        ]
        db.maintenance_work_orders.insert_many(initial_tasks)
        print("Seeded initial maintenance work orders into MongoDB.")

    # 3. Seed initial alerts if empty
    if db.alerts.count_documents({}) == 0:
        initial_alerts = [
            {
                "alert_id": "ALT-1001",
                "machine_id": "L-47257",
                "severity": "Critical",
                "alert_type": "Failure Risk",
                "reason": "Risk score 89.4% exceeds critical limit. Thermal dissipation stress and high tool wear.",
                "recommendation": "Inspect cooling system and consider tool replacement immediately.",
                "status": "Active",
                "risk_score": 89.4,
                "sensor_readings": {
                    "Air_temperature_K": 308.2,
                    "Process_temperature_K": 316.5,
                    "Rotational_speed_rpm": 1260.0,
                    "Torque_Nm": 69.2,
                    "Tool_wear_min": 246.0,
                },
                "created_at": now,
                "updated_at": now,
            },
            {
                "alert_id": "ALT-1002",
                "machine_id": "L-47230",
                "severity": "Critical",
                "alert_type": "Failure Risk",
                "reason": "Risk score 78.5%. Elevated torque with vibration indication.",
                "recommendation": "Inspect overheating and vibration-related components. Reduce motor load.",
                "status": "Active",
                "risk_score": 78.5,
                "sensor_readings": {
                    "Air_temperature_K": 305.5,
                    "Process_temperature_K": 314.8,
                    "Rotational_speed_rpm": 1290.0,
                    "Torque_Nm": 66.5,
                    "Tool_wear_min": 198.0,
                },
                "created_at": now,
                "updated_at": now,
            },
            {
                "alert_id": "ALT-1003",
                "machine_id": "M-14865",
                "severity": "Warning",
                "alert_type": "Failure Risk",
                "reason": "Risk score 62.5%. Excessive tool wear duration exceeding 200 min.",
                "recommendation": "Inspect cooling system and consider tool replacement.",
                "status": "Active",
                "risk_score": 62.5,
                "sensor_readings": {
                    "Air_temperature_K": 306.0,
                    "Process_temperature_K": 315.0,
                    "Rotational_speed_rpm": 1350.0,
                    "Torque_Nm": 58.0,
                    "Tool_wear_min": 220.0,
                },
                "created_at": now,
                "updated_at": now,
            },
            {
                "alert_id": "ALT-1004",
                "machine_id": "L-47184",
                "severity": "Warning",
                "alert_type": "Failure Risk",
                "reason": "Risk score 44.2%. Torque approaching warning threshold.",
                "recommendation": "Check motor load and shaft alignment.",
                "status": "Active",
                "risk_score": 44.2,
                "sensor_readings": {
                    "Air_temperature_K": 302.5,
                    "Process_temperature_K": 312.2,
                    "Rotational_speed_rpm": 1380.0,
                    "Torque_Nm": 54.0,
                    "Tool_wear_min": 172.0,
                },
                "created_at": now,
                "updated_at": now,
            },
        ]
        db.alerts.insert_many(initial_alerts)
        print("Seeded initial active alerts into MongoDB.")

    # 4. Seed initial maintenance recommendations if empty
    if db.maintenance_recommendations.count_documents({}) == 0:
        initial_recommendations = [
            {
                "recommendation_id": "REC-1001",
                "machine_id": "L-47257",
                "priority": "Critical",
                "primary_reason": "Extreme cutting tool wear approaching structural insert breakdown",
                "full_reason": "Extreme cutting tool wear approaching structural insert breakdown; Excessive mechanical load / overstrain (69.2 Nm)",
                "urgency_timeframe": "Immediate (Halt cycle or address within current shift)",
                "maintenance_type": "Corrective / Emergency Overhaul",
                "recommended_actions": [
                    "Halt spindle cycle and replace cutting insert immediately to prevent tool fracture and workpiece gouging.",
                    "Inspect toolholder seat and spindle taper for micro-fretting or thermal distortion.",
                    "Verify workpiece feed rate, depth of cut, and material hardness for mechanical overload.",
                ],
                "contributing_factors": [
                    {
                        "parameter": "Tool wear [min]",
                        "observed_value": 246.0,
                        "threshold": 215.0,
                        "unit": "min",
                        "severity": "Critical",
                        "indicator": "Accumulated tool cut time (246 min) exceeds critical failure boundary (215 min).",
                    },
                    {
                        "parameter": "Torque [Nm]",
                        "observed_value": 69.2,
                        "threshold": 62.0,
                        "unit": "Nm",
                        "severity": "Critical",
                        "indicator": "Drive motor torque (69.2 Nm) operates near maximum continuous rating.",
                    },
                ],
                "risk_score": 89.4,
                "health_status": "Critical",
                "is_anomaly": True,
                "anomaly_score": 88.5,
                "sensor_readings": {
                    "Air temperature [K]": 308.2,
                    "Process temperature [K]": 316.5,
                    "Rotational speed [rpm]": 1260.0,
                    "Torque [Nm]": 69.2,
                    "Tool wear [min]": 246.0,
                },
                "status": "open",
                "notes": "Triggered by predictive health evaluation.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "recommendation_id": "REC-1002",
                "machine_id": "L-47230",
                "priority": "Critical",
                "primary_reason": "Heat dissipation failure hazard: insufficient cooling delta (9.30 K)",
                "full_reason": "Heat dissipation failure hazard: insufficient cooling delta (9.30 K); Elevated motor torque (66.5 Nm) observed during standard cycle",
                "urgency_timeframe": "Immediate (Halt cycle or address within current shift)",
                "maintenance_type": "Corrective / Emergency Overhaul",
                "recommended_actions": [
                    "Inspect coolant circulation pump, clean heat exchanger fins, and check coolant reservoir level.",
                    "Verify spindle chiller flow rate and purge thermal jacket channels.",
                    "Inspect spindle drive coupling, gearbox lubrication, and axis guide rails for mechanical binding.",
                ],
                "contributing_factors": [
                    {
                        "parameter": "Torque [Nm]",
                        "observed_value": 66.5,
                        "threshold": 62.0,
                        "unit": "Nm",
                        "severity": "Critical",
                        "indicator": "Drive motor torque (66.5 Nm) operates near maximum continuous rating.",
                    },
                    {
                        "parameter": "Tool wear [min]",
                        "observed_value": 198.0,
                        "threshold": 175.0,
                        "unit": "min",
                        "severity": "High",
                        "indicator": "Tool cut time (198 min) is within accelerated flank wear stage.",
                    },
                ],
                "risk_score": 78.5,
                "health_status": "Critical",
                "is_anomaly": True,
                "anomaly_score": 76.0,
                "sensor_readings": {
                    "Air temperature [K]": 305.5,
                    "Process temperature [K]": 314.8,
                    "Rotational speed [rpm]": 1290.0,
                    "Torque [Nm]": 66.5,
                    "Tool wear [min]": 198.0,
                },
                "status": "open",
                "notes": "Generated from live telemetry drift.",
                "created_at": now,
                "updated_at": now,
            },
            {
                "recommendation_id": "REC-1003",
                "machine_id": "M-14865",
                "priority": "High",
                "primary_reason": "Extreme cutting tool wear approaching structural insert breakdown",
                "full_reason": "Extreme cutting tool wear approaching structural insert breakdown; Elevated motor torque (58.0 Nm) observed during standard cycle",
                "urgency_timeframe": "Within 24 Hours (Prioritize before next production run)",
                "maintenance_type": "Predictive Preventive Action",
                "recommended_actions": [
                    "Halt spindle cycle and replace cutting insert immediately to prevent tool fracture and workpiece gouging.",
                    "Stage replacement tooling cutter and schedule changeout before the next production shift.",
                ],
                "contributing_factors": [
                    {
                        "parameter": "Tool wear [min]",
                        "observed_value": 220.0,
                        "threshold": 215.0,
                        "unit": "min",
                        "severity": "Critical",
                        "indicator": "Accumulated tool cut time (220 min) exceeds critical failure boundary (215 min).",
                    },
                ],
                "risk_score": 62.5,
                "health_status": "Warning",
                "is_anomaly": False,
                "anomaly_score": 38.0,
                "sensor_readings": {
                    "Air temperature [K]": 306.0,
                    "Process temperature [K]": 315.0,
                    "Rotational speed [rpm]": 1350.0,
                    "Torque [Nm]": 58.0,
                    "Tool wear [min]": 220.0,
                },
                "status": "in_progress",
                "notes": "Technician dispatched for cutter audit.",
                "created_at": now,
                "updated_at": now,
            },
        ]
        db.maintenance_recommendations.insert_many(initial_recommendations)
        print("Seeded initial intelligent maintenance recommendations into MongoDB.")


def save_maintenance_recommendation(rec_dict: dict) -> str:
    """Persist an intelligent maintenance recommendation into MongoDB."""
    db = get_db()
    now = datetime.now(timezone.utc)
    if "created_at" not in rec_dict:
        rec_dict["created_at"] = now
    rec_dict["updated_at"] = now
    rec_id = rec_dict.get("recommendation_id")
    if rec_id:
        db.maintenance_recommendations.update_one(
            {"recommendation_id": rec_id},
            {"$set": rec_dict},
            upsert=True,
        )
        return rec_id
    else:
        res = db.maintenance_recommendations.insert_one(rec_dict)
        return str(res.inserted_id)


def get_maintenance_recommendations(
    machine_id: str = None,
    priority: str = None,
    status: str = None,
    limit: int = 50,
) -> list:
    """Retrieve maintenance recommendations with optional filters."""
    db = get_db()
    query = {}
    if machine_id:
        query["machine_id"] = machine_id
    if priority:
        query["priority"] = priority
    if status:
        query["status"] = status
    cursor = db.maintenance_recommendations.find(query).sort("created_at", DESCENDING).limit(limit)
    return serialize_docs(cursor)


def update_recommendation_status(recommendation_id: str, new_status: str) -> bool:
    """Update status of a maintenance recommendation."""
    db = get_db()
    res = db.maintenance_recommendations.update_one(
        {"recommendation_id": recommendation_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc)}},
    )
    return res.matched_count > 0

