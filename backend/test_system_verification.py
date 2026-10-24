import urllib.request
import json
import io
import time
import pymongo

BASE_URL = "http://127.0.0.1:8001"
MONGO_URI = "mongodb://127.0.0.1:27017"
DB_NAME = "predictive_maintenance"

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def put_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def delete_req(url):
    req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

def get_json(url):
    with urllib.request.urlopen(url) as response:
        return json.loads(response.read().decode("utf-8"))

def post_multipart(url, filename, content):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
        f"{content}\r\n"
        f"--{boundary}--\r\n"
    ).encode("utf-8")
    
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))

results = {}

print("=================================================================")
print("RUNNING PREDICTIVE MAINTENANCE SYSTEM LIVE VERIFICATION SUITE")
print("=================================================================\n")

# 1. Verify local MongoDB is reachable
try:
    client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
    info = client.server_info()
    db = client[DB_NAME]
    colls = db.list_collection_names()
    print(f"[TEST 1 PASS] Local MongoDB reachable. Server version: {info.get('version')}. Collections: {colls}")
    results["mongodb_reachable"] = True
except Exception as e:
    print(f"[TEST 1 FAIL] MongoDB connection error: {e}")
    results["mongodb_reachable"] = False

# 2 & 3. Verify FastAPI on port 8001 and /docs reachable
try:
    health = get_json(f"{BASE_URL}/health")
    with urllib.request.urlopen(f"{BASE_URL}/docs") as resp:
        docs_code = resp.getcode()
    print(f"[TEST 2 & 3 PASS] FastAPI is live on port 8001. /health: {health}. /docs returned HTTP {docs_code}.")
    results["fastapi_docs"] = True
except Exception as e:
    print(f"[TEST 2 & 3 FAIL] FastAPI error: {e}")
    results["fastapi_docs"] = False

# 4. Insert a test machine record and read it back from MongoDB
test_machine_id = "TEST-UNIT-999"
try:
    # Cleanup any previous test machine
    try:
        delete_req(f"{BASE_URL}/machines/{test_machine_id}")
    except:
        pass
    
    create_payload = {
        "machine_id": test_machine_id,
        "name": "Integration Test Machine 999",
        "type": "M",
        "Air_temperature_K": 298.5,
        "Process_temperature_K": 308.9,
        "Rotational_speed_rpm": 1520.0,
        "Torque_Nm": 42.0,
        "Tool_wear_min": 25.0,
        "installation_date": "2026-01-15",
        "location": "Sector 9 - Automated Cell"
    }
    created = post_json(f"{BASE_URL}/machines", create_payload)
    read_back = get_json(f"{BASE_URL}/machines/{test_machine_id}")
    assert read_back["machine_id"] == test_machine_id
    assert read_back["name"] == "Integration Test Machine 999"
    # Also verify direct MongoDB document
    direct_doc = db.machines.find_one({"machine_id": test_machine_id})
    assert direct_doc is not None
    print(f"[TEST 4 PASS] Created test machine {test_machine_id} and verified via API & direct MongoDB query.")
    results["test_machine_persisted"] = True
except Exception as e:
    print(f"[TEST 4 FAIL] Test machine persistence error: {e}")
    results["test_machine_persisted"] = False

# 5. Run a single failure prediction and confirm result + SHAP explanations + persistence
try:
    pred_payload = {
        "machine_id": test_machine_id,
        "Air_temperature_K": 304.5,
        "Process_temperature_K": 312.5,
        "Rotational_speed_rpm": 1350.0,
        "Torque_Nm": 58.0,
        "Tool_wear_min": 195.0
    }
    pred_res = post_json(f"{BASE_URL}/predict", pred_payload)
    pred_id = pred_res["prediction_id"]
    
    # Verify in MongoDB direct query by prediction_id
    saved_doc = db.prediction_history.find_one({"prediction_id": pred_id})
    assert saved_doc is not None, f"Prediction {pred_id} not found in MongoDB prediction_history"
    assert saved_doc["machine_id"] == test_machine_id
    
    # Verify API retrieval endpoint GET /predictions/{prediction_id}
    api_retrieved = get_json(f"{BASE_URL}/predictions/{pred_id}")
    assert api_retrieved["prediction_id"] == pred_id
    
    # Verify SHAP feature contributions structure
    fcs = pred_res.get("feature_contributions", [])
    assert isinstance(fcs, list) and len(fcs) == 5, f"Expected 5 feature contributions, got {len(fcs)}"
    assert all("feature" in fc and "relative_contribution" in fc and "shap_value" in fc and "direction" in fc for fc in fcs)
    
    print(f"[TEST 5 PASS] Prediction {pred_id} evaluated with SHAP (Risk: {pred_res['risk_score']}%, Status: {pred_res['health_status']}) and verified via API & MongoDB.")
    results["single_prediction_saved"] = True
    results["shap_explanations_verified"] = True
except Exception as e:
    print(f"[TEST 5 FAIL] Single prediction save / SHAP error: {e}")
    results["single_prediction_saved"] = False
    results["shap_explanations_verified"] = False

# 6. Upload a valid CSV and verify batch predictions are saved; test invalid CSV handling
try:
    csv_sample = """UDI,Product ID,Type,Air temperature [K],Process temperature [K],Rotational speed [rpm],Torque [Nm],Tool wear [min]
1,M14860,M,298.1,308.6,1551,42.8,0
2,L47181,L,298.2,308.7,1408,46.3,3
3,L47182,L,298.1,308.5,1498,49.4,5
4,M14863,M,304.5,312.2,1390,54.0,185
"""
    batch_res = post_multipart(f"{BASE_URL}/predict-batch", "test_verification_batch.csv", csv_sample)
    upload_id = batch_res.get("upload_id")
    upload_doc = db.dataset_uploads.find_one({"upload_id": upload_id})
    assert upload_doc is not None
    assert batch_res.get("total_samples") == 4
    assert batch_res.get("total_rows") == 4
    
    # Test invalid CSV rejection (missing required columns)
    invalid_csv = "ColA,ColB\n1,2\n"
    try:
        post_multipart(f"{BASE_URL}/predict-batch", "invalid.csv", invalid_csv)
        invalid_rejected = False
    except urllib.error.HTTPError as err:
        invalid_rejected = (err.code == 400)
    
    assert invalid_rejected, "Invalid CSV did not return expected HTTP 400"
    print(f"[TEST 6 PASS] CSV batch evaluated 4 samples (upload_id: {upload_id}). Invalid CSV correctly rejected with HTTP 400.")
    results["batch_csv_saved"] = True
    results["invalid_csv_rejected"] = True
except Exception as e:
    print(f"[TEST 6 FAIL] Batch CSV save error: {e}")
    results["batch_csv_saved"] = False
    results["invalid_csv_rejected"] = False

# 7. Run anomaly detection and confirm result is saved + API queryable
try:
    anom_payload = {
        "machine_id": test_machine_id,
        "Air_temperature_K": 308.0,
        "Process_temperature_K": 318.0,
        "Rotational_speed_rpm": 2750.0,
        "Torque_Nm": 78.5,
        "Tool_wear_min": 240.0
    }
    anom_res = post_json(f"{BASE_URL}/anomalies/detect", anom_payload)
    anom_id = anom_res["anomaly_id"]
    
    # Verify in MongoDB direct query by anomaly_id
    anom_doc = db.anomaly_history.find_one({"anomaly_id": anom_id})
    assert anom_doc is not None, f"Anomaly {anom_id} not found in MongoDB anomaly_history"
    assert anom_res["is_anomaly"] is True
    
    # Verify via API GET /anomalies/{anomaly_id}
    api_anom = get_json(f"{BASE_URL}/anomalies/{anom_id}")
    assert api_anom["anomaly_id"] == anom_id
    
    print(f"[TEST 7 PASS] Isolation Forest anomaly {anom_id} detected (Score: {anom_res['anomaly_score']}, Level: {anom_res['anomaly_level']}) and verified via API & MongoDB.")
    results["anomaly_detection_saved"] = True
    results["anomaly_api_retrieved"] = True
except Exception as e:
    print(f"[TEST 7 FAIL] Anomaly detection save error: {e}")
    results["anomaly_detection_saved"] = False
    results["anomaly_api_retrieved"] = False

# 8. Create or update a maintenance work order and verify persistence
try:
    wo_payload = {
        "machine_id": test_machine_id,
        "action": "Calibrate torque sensor and inspect tooling spindle",
        "priority": "High",
        "scheduled_date": "2026-10-28",
        "assigned_to": "Field Tech Lead",
        "notes": "Automated integration test work order"
    }
    created_wo = post_json(f"{BASE_URL}/maintenance/tasks", wo_payload)
    task_id = created_wo["task_id"]
    
    # Update status to In Progress
    updated_wo = put_json(f"{BASE_URL}/maintenance/tasks/{task_id}/status", {
        "status": "In Progress",
        "notes": "Technician dispatched to cell"
    })
    
    # Read back from MongoDB directly
    direct_wo = db.maintenance_work_orders.find_one({"task_id": task_id})
    assert direct_wo is not None
    assert direct_wo["status"] == "In Progress"
    print(f"[TEST 8 PASS] Work order {task_id} created, updated to 'In Progress', and verified in maintenance_work_orders collection.")
    results["work_order_persisted"] = True
except Exception as e:
    print(f"[TEST 8 FAIL] Work order persistence error: {e}")
    results["work_order_persisted"] = False

# Clean up test machine and test work order
try:
    db.machines.delete_one({"machine_id": test_machine_id})
    db.prediction_history.delete_many({"machine_id": test_machine_id})
    db.anomaly_history.delete_many({"machine_id": test_machine_id})
    db.maintenance_work_orders.delete_one({"task_id": task_id})
    print("[CLEANUP PASS] Removed temporary integration test machine and work order without affecting user data.")
except Exception as e:
    print(f"[CLEANUP NOTE] {e}")

print("\n=================================================================")
print("FINAL SUMMARY OF VERIFICATION CHECKS:")
print(json.dumps(results, indent=2))
print("=================================================================")
