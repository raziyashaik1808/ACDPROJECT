import urllib.request
import urllib.error
import json
import uuid
import sys
from datetime import datetime, timezone
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
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.getcode()

def put_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.getcode()

def get_json(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.getcode()

def delete_req(url):
    req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.getcode()

def run_tests():
    print("=================================================================")
    print("PERSON 2: SMART ALERTS & MAINTENANCE WORK ORDERS TEST SUITE")
    print("=================================================================\n")

    results = {}
    test_prefix = f"TEST-P2-{uuid.uuid4().hex[:6].upper()}"
    test_machine = f"{test_prefix}-M1"
    created_alert_ids = []
    created_wo_ids = []

    # 1. MongoDB connectivity check
    try:
        client = pymongo.MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        client.admin.command("ping")
        db = client[DB_NAME]
        indexes = db.alerts.index_information()
        wo_indexes = db.maintenance_work_orders.index_information()
        print(f"[TEST 1 PASS] MongoDB connected. Alerts indexes: {list(indexes.keys())}. WO indexes: {list(wo_indexes.keys())}")
        results["1_mongodb_connectivity"] = True
    except Exception as e:
        print(f"[TEST 1 FAIL] MongoDB error: {e}")
        results["1_mongodb_connectivity"] = False
        return results

    # 2. Failure-risk alert generation via /alerts/evaluate
    try:
        critical_eval_payload = {
            "machine_id": test_machine,
            "Air_temperature_K": 308.2,
            "Process_temperature_K": 316.5,
            "Rotational_speed_rpm": 1260.0,
            "Torque_Nm": 69.2,
            "Tool_wear_min": 246.0,
            "risk_threshold_warning": 30.0,
            "risk_threshold_critical": 70.0,
        }
        res, code = post_json(f"{BASE_URL}/alerts/evaluate", critical_eval_payload)
        assert code == 200, f"Expected 200, got {code}"
        assert res.get("evaluated") is True
        assert res.get("alert_created") is True
        alert = res.get("alert")
        assert alert["severity"] in ["Critical", "Warning"]
        assert alert["alert_type"] == "Failure Risk"
        assert alert["machine_id"] == test_machine
        assert alert["status"] == "Active"
        alert_id_1 = alert["alert_id"]
        created_alert_ids.append(alert_id_1)
        print(f"[TEST 2 PASS] Evaluated high risk and created alert: {alert_id_1} (Severity: {alert['severity']})")
        results["2_failure_risk_alert_generation"] = True
    except Exception as e:
        print(f"[TEST 2 FAIL] Failure risk alert evaluation failed: {e}")
        results["2_failure_risk_alert_generation"] = False

    # 3. Duplicate active alert suppression
    try:
        # Same machine and condition without force_new_alert
        dup_res, dup_code = post_json(f"{BASE_URL}/alerts/evaluate", critical_eval_payload)
        assert dup_code == 200
        assert dup_res.get("evaluated") is True
        assert dup_res.get("alert_created") is False, "Duplicate alert was created instead of suppressed!"
        assert dup_res.get("duplicate_suppressed") is True
        assert dup_res.get("alert")["alert_id"] == alert_id_1
        print(f"[TEST 3 PASS] Duplicate alert evaluation correctly suppressed and returned existing: {alert_id_1}")
        results["3_duplicate_alert_suppression"] = True
    except Exception as e:
        print(f"[TEST 3 FAIL] Duplicate suppression check failed: {e}")
        results["3_duplicate_alert_suppression"] = False

    # 4. Anomaly alert generation via /alerts/evaluate
    alert_id_2 = None
    try:
        anomaly_payload = {
            "machine_id": test_machine,
            "Air_temperature_K": 308.0,
            "Process_temperature_K": 318.0,
            "Rotational_speed_rpm": 2750.0,
            "Torque_Nm": 78.5,
            "Tool_wear_min": 240.0,
            "alert_type": "Sensor Anomaly",
            "anomaly_threshold": 40.0,
        }
        anom_res, anom_code = post_json(f"{BASE_URL}/alerts/evaluate", anomaly_payload)
        assert anom_code == 200, f"Expected 200, got {anom_code}"
        assert anom_res.get("evaluated") is True
        assert anom_res.get("alert_created") is True, f"Alert was not created: {anom_res}"
        anom_alert = anom_res.get("alert")
        assert anom_alert["alert_type"] == "Sensor Anomaly"
        assert anom_alert["machine_id"] == test_machine
        alert_id_2 = anom_alert["alert_id"]
        created_alert_ids.append(alert_id_2)
        print(f"[TEST 4 PASS] Evaluated sensor anomaly and created alert: {alert_id_2} (Type: {anom_alert['alert_type']})")
        results["4_anomaly_alert_generation"] = True
    except Exception as e:
        print(f"[TEST 4 FAIL] Anomaly alert generation failed: {e}")
        results["4_anomaly_alert_generation"] = False

    # 5. Severity thresholds check: Nominal baseline readings should NOT create alerts
    try:
        nominal_payload = {
            "machine_id": test_machine,
            "Air_temperature_K": 300.0,
            "Process_temperature_K": 310.0,
            "Rotational_speed_rpm": 1538.8,
            "Torque_Nm": 40.0,
            "Tool_wear_min": 108.0,
        }
        nom_res, nom_code = post_json(f"{BASE_URL}/alerts/evaluate", nominal_payload)
        assert nom_code == 200
        assert nom_res.get("evaluated") is True
        assert nom_res.get("alert_created") is False, f"Nominal readings created alert: {nom_res}"
        print("[TEST 5 PASS] Nominal operational readings correctly evaluated with zero alerts created.")
        results["5_severity_thresholds"] = True
    except Exception as e:
        print(f"[TEST 5 FAIL] Severity threshold test failed: {e}")
        results["5_severity_thresholds"] = False


    # 6. Alert filtering and retrieval
    try:
        fetched_alerts, get_code = get_json(f"{BASE_URL}/alerts?machine_id={test_machine}")
        assert get_code == 200
        assert isinstance(fetched_alerts, list)
        machine_alert_ids = [a["alert_id"] for a in fetched_alerts]
        assert alert_id_1 in machine_alert_ids
        assert alert_id_2 in machine_alert_ids

        # Fetch single alert by ID
        single_alert, single_code = get_json(f"{BASE_URL}/alerts/{alert_id_1}")
        assert single_code == 200
        assert single_alert["alert_id"] == alert_id_1
        print(f"[TEST 6 PASS] Filtered alerts by machine_id returned {len(fetched_alerts)} alerts. GET /alerts/{alert_id_1} verified.")
        results["6_alert_filtering_and_retrieval"] = True
    except Exception as e:
        print(f"[TEST 6 FAIL] Alert filtering / retrieval failed: {e}")
        results["6_alert_filtering_and_retrieval"] = False

    # 7. Alert status lifecycle & transition validation
    try:
        # Acknowledge alert
        ack_res, ack_code = put_json(f"{BASE_URL}/alerts/{alert_id_1}/acknowledge", {
            "acknowledged_by": "Shift Lead",
            "notes": "Verified high thermal dissipation"
        })
        assert ack_code == 200
        assert ack_res["status"] == "Acknowledged"
        assert "acknowledged_at" in ack_res

        # Resolve alert
        res_res, res_code = put_json(f"{BASE_URL}/alerts/{alert_id_1}/resolve", {
            "resolved_by": "Senior Technician",
            "resolution_notes": "Flushed cooling loop and tested nominal temp"
        })
        assert res_code == 200
        assert res_res["status"] == "Resolved"
        assert "resolved_at" in res_res

        # Invalid transition: Cannot acknowledge a resolved alert directly
        invalid_rejected = False
        try:
            put_json(f"{BASE_URL}/alerts/{alert_id_1}/acknowledge", {"notes": "Illegal transition"})
        except urllib.error.HTTPError as err:
            invalid_rejected = (err.code == 400)
        assert invalid_rejected, "Invalid status transition (Resolved -> Acknowledged) was not rejected with 400!"

        # Reopen alert
        reopen_res, reopen_code = put_json(f"{BASE_URL}/alerts/{alert_id_1}/reopen", {
            "reopened_by": "Inspector",
            "reason": "Vibration residual observed"
        })
        assert reopen_code == 200
        assert reopen_res["status"] == "Active"
        assert "reopened_at" in reopen_res
        print(f"[TEST 7 PASS] Full alert lifecycle validated: Active -> Acknowledged -> Resolved -> Invalid rejection (400) -> Reopened (Active).")
        results["7_alert_lifecycle_and_transitions"] = True
    except Exception as e:
        print(f"[TEST 7 FAIL] Alert lifecycle validation failed: {e}")
        results["7_alert_lifecycle_and_transitions"] = False

    # 8. Work Order creation and link to alert
    try:
        wo_payload = {
            "machine_id": test_machine,
            "title": "Emergency Spindle Calibration",
            "action": "Cooling loop flush & spindle recalibration",
            "priority": "High",
            "scheduled_date": "Immediate",
            "assigned_to": "Marcus Vance",
            "alert_id": alert_id_1,
            "notes": "Triggered by predictive risk"
        }
        wo_res, wo_code = post_json(f"{BASE_URL}/maintenance/work-orders", wo_payload)
        assert wo_code == 201
        wo_id = wo_res.get("work_order_id") or wo_res.get("task_id")
        created_wo_ids.append(wo_id)
        assert wo_res["machine_id"] == test_machine
        assert wo_res["alert_id"] == alert_id_1
        assert wo_res["status"] == "Pending"

        # Duplicate work order prevention for same machine and active action
        dup_wo_rejected = False
        try:
            post_json(f"{BASE_URL}/maintenance/work-orders", wo_payload)
        except urllib.error.HTTPError as err:
            dup_wo_rejected = (err.code == 409)
        assert dup_wo_rejected, "Duplicate active work order was not rejected with 409 Conflict!"

        print(f"[TEST 8 PASS] Work order {wo_id} created with alert link {alert_id_1}. Duplicate active WO rejected with 409.")
        results["8_work_order_creation_and_link"] = True
    except Exception as e:
        print(f"[TEST 8 FAIL] Work order creation failed: {e}")
        results["8_work_order_creation_and_link"] = False

    # 9. Work Order status transitions and validation
    try:
        # Advance: Pending -> In Progress
        in_prog_res, ip_code = put_json(f"{BASE_URL}/maintenance/work-orders/{wo_id}/status", {
            "status": "In Progress",
            "notes": "Tech on site"
        })
        assert ip_code == 200
        assert in_prog_res["status"] == "In Progress"

        # Advance: In Progress -> Completed
        comp_res, comp_code = put_json(f"{BASE_URL}/maintenance/work-orders/{wo_id}/status", {
            "status": "Completed",
            "notes": "Maintenance work certified"
        })
        assert comp_code == 200
        assert comp_res["status"] == "Completed"
        assert "completed_at" in comp_res

        # Invalid transition: Completed -> Cancelled is illegal (must reopen first)
        invalid_wo_transition = False
        try:
            put_json(f"{BASE_URL}/maintenance/work-orders/{wo_id}/status", {
                "status": "Cancelled"
            })
        except urllib.error.HTTPError as err:
            invalid_wo_transition = (err.code == 400)
        assert invalid_wo_transition, "Invalid work order transition was not rejected with 400!"

        # Reopen: Completed -> Pending
        reopen_wo, rwo_code = put_json(f"{BASE_URL}/maintenance/work-orders/{wo_id}/status", {
            "status": "Pending",
            "notes": "Reopening for secondary audit"
        })
        assert rwo_code == 200
        assert reopen_wo["status"] == "Pending"

        print(f"[TEST 9 PASS] Work order status transitions validated: Pending -> In Progress -> Completed (completed_at stamped) -> Invalid rejection (400) -> Reopened.")
        results["9_work_order_status_validation"] = True
    except Exception as e:
        print(f"[TEST 9 FAIL] Work order status validation failed: {e}")
        results["9_work_order_status_validation"] = False

    # 10. Work Order retrieval and filtering
    try:
        wo_list, wo_list_code = get_json(f"{BASE_URL}/maintenance/work-orders?machine_id={test_machine}")
        assert wo_list_code == 200
        assert any(w.get("work_order_id") == wo_id for w in wo_list)

        # Backward compatibility with /maintenance/tasks
        task_list, task_list_code = get_json(f"{BASE_URL}/maintenance/tasks?machine_id={test_machine}")
        assert task_list_code == 200
        assert any(t.get("task_id") == wo_id for t in task_list)

        # Retrieve single work order
        single_wo, swo_code = get_json(f"{BASE_URL}/maintenance/work-orders/{wo_id}")
        assert swo_code == 200
        assert single_wo["work_order_id"] == wo_id
        print(f"[TEST 10 PASS] Work orders queryable via /maintenance/work-orders and backward-compatible /maintenance/tasks.")
        results["10_work_order_retrieval_and_filtering"] = True
    except Exception as e:
        print(f"[TEST 10 FAIL] Work order retrieval failed: {e}")
        results["10_work_order_retrieval_and_filtering"] = False

    # 11. MongoDB persistence and non-existent IDs
    try:
        # Direct MongoDB queries
        alert_db_doc = db.alerts.find_one({"alert_id": alert_id_1})
        assert alert_db_doc is not None
        wo_db_doc = db.maintenance_work_orders.find_one({"work_order_id": wo_id})
        assert wo_db_doc is not None

        # Non-existent ID checks (404)
        missing_alert_404 = False
        try:
            get_json(f"{BASE_URL}/alerts/ALT-NONEXISTENT-99999")
        except urllib.error.HTTPError as err:
            missing_alert_404 = (err.code == 404)
        assert missing_alert_404, "Nonexistent alert did not return 404!"

        missing_wo_404 = False
        try:
            get_json(f"{BASE_URL}/maintenance/work-orders/WO-NONEXISTENT-99999")
        except urllib.error.HTTPError as err:
            missing_wo_404 = (err.code == 404)
        assert missing_wo_404, "Nonexistent work order did not return 404!"

        print("[TEST 11 PASS] MongoDB direct records verified. Non-existent IDs correctly return HTTP 404.")
        results["11_mongodb_persistence_and_404s"] = True
    except Exception as e:
        print(f"[TEST 11 FAIL] MongoDB persistence / 404 test failed: {e}")
        results["11_mongodb_persistence_and_404s"] = False

    # 12. Cleanup of isolated test data
    try:
        del_alerts = db.alerts.delete_many({"alert_id": {"$in": created_alert_ids}})
        del_wos = db.maintenance_work_orders.delete_many({"$or": [{"work_order_id": {"$in": created_wo_ids}}, {"task_id": {"$in": created_wo_ids}}]})
        print(f"[CLEANUP PASS] Removed {del_alerts.deleted_count} test alerts and {del_wos.deleted_count} test work orders without touching production records.")
        results["12_test_cleanup"] = True
    except Exception as e:
        print(f"[CLEANUP FAIL] Cleanup error: {e}")
        results["12_test_cleanup"] = False

    print("\n=================================================================")
    print("PERSON 2 TEST SUITE RESULTS:")
    print(json.dumps(results, indent=2))
    all_passed = all(results.values())
    print(f"OVERALL STATUS: {'ALL TESTS PASSED' if all_passed else 'SOME TESTS FAILED'}")
    print("=================================================================")
    return results

if __name__ == "__main__":
    res = run_tests()
    if not all(res.values()):
        sys.exit(1)
