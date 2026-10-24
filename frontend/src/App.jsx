import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FleetProvider } from "./context/FleetContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Machines from "./pages/Machines";
import UploadData from "./pages/UploadData";
import Predictions from "./pages/Predictions";
import Maintenance from "./pages/Maintenance";
import MachineHistory from "./pages/MachineHistory";
import Metrics from "./pages/Metrics";

function App() {
  return (
    <FleetProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/machines" element={<Machines />} />
            <Route path="/upload" element={<UploadData />} />
            <Route path="/predictions" element={<Predictions />} />
            <Route path="/maintenance" element={<Maintenance />} />
            <Route path="/history" element={<MachineHistory />} />
            <Route path="/metrics" element={<Metrics />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </FleetProvider>
  );
}

export default App;