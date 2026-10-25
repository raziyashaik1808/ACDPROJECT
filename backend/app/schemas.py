from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class SensorDataInput(BaseModel):
    Air_temperature_K: float
    Process_temperature_K: float
    Rotational_speed_rpm: float
    Torque_Nm: float
    Tool_wear_min: float
    machine_id: Optional[str] = None

    def to_model_input(self):
        return {
            "Air temperature [K]": self.Air_temperature_K,
            "Process temperature [K]": self.Process_temperature_K,
            "Rotational speed [rpm]": self.Rotational_speed_rpm,
            "Torque [Nm]": self.Torque_Nm,
            "Tool wear [min]": self.Tool_wear_min,
        }


class MachineCreate(BaseModel):
    machine_id: str
    name: Optional[str] = "Industrial Equipment Unit"
    type: Optional[str] = "M"
    Air_temperature_K: float = 300.0
    Process_temperature_K: float = 310.0
    Rotational_speed_rpm: float = 1500.0
    Torque_Nm: float = 40.0
    Tool_wear_min: float = 10.0


class MachineUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    Air_temperature_K: Optional[float] = None
    Process_temperature_K: Optional[float] = None
    Rotational_speed_rpm: Optional[float] = None
    Torque_Nm: Optional[float] = None
    Tool_wear_min: Optional[float] = None
    health_status: Optional[str] = None


class WorkOrderCreate(BaseModel):
    machine_id: str
    action: str
    priority: Optional[str] = "Medium"
    scheduled_date: Optional[str] = "Next Shift"
    assigned_to: Optional[str] = "Reliability Specialist"
    notes: Optional[str] = None


class WorkOrderUpdateStatus(BaseModel):
    status: str  # "Pending", "In Progress", "Completed"
    notes: Optional[str] = None


class AlertUpdateStatus(BaseModel):
    status: str  # "Active", "In Review", "Investigating", "Resolved"


class AnomalyDetectionInput(BaseModel):
    Air_temperature_K: float
    Process_temperature_K: float
    Rotational_speed_rpm: float
    Torque_Nm: float
    Tool_wear_min: float
    machine_id: Optional[str] = None

    def to_features(self):
        return {
            "Air temperature [K]": self.Air_temperature_K,
            "Process temperature [K]": self.Process_temperature_K,
            "Rotational speed [rpm]": self.Rotational_speed_rpm,
            "Torque [Nm]": self.Torque_Nm,
            "Tool wear [min]": self.Tool_wear_min,
        }


class RecommendationGenerateInput(BaseModel):
    Air_temperature_K: float
    Process_temperature_K: float
    Rotational_speed_rpm: float
    Torque_Nm: float
    Tool_wear_min: float
    machine_id: Optional[str] = None
    save_to_db: Optional[bool] = True

    def to_features(self):
        return {
            "Air temperature [K]": self.Air_temperature_K,
            "Process temperature [K]": self.Process_temperature_K,
            "Rotational speed [rpm]": self.Rotational_speed_rpm,
            "Torque [Nm]": self.Torque_Nm,
            "Tool wear [min]": self.Tool_wear_min,
        }


class RecommendationUpdateStatus(BaseModel):
    status: str  # "open", "in_progress", "completed", "dismissed"
    notes: Optional[str] = None