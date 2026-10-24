import React, { useState, useRef } from 'react';
import API from '../services/api';
import { useFleet } from '../context/FleetContext';
import {
  IconUpload,
  IconCheckCircle,
  IconAlertTriangle,
  IconDownload,
  IconSearch,
  IconEye,
  IconClock,
} from '../components/Icons';

export default function UploadData() {
  const { applyBatchPredictions } = useFleet();
  const [file, setFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [results, setResults] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [appliedToDashboard, setAppliedToDashboard] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef(null);

  const expectedColumns = [
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
  ];

  // Parse sample rows for preview
  const parseCSVPreview = (fileObj) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1, 6).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const rowObj = {};
          headers.forEach((h, i) => {
            rowObj[h] = values[i];
          });
          return rowObj;
        });
        setPreviewRows(rows);

        // Quick column validation
        const missing = expectedColumns.filter(c =>
          !headers.includes(c) &&
          !headers.includes(c.replace(/ /g, '_').replace(/[\[\]]/g, ''))
        );
        if (missing.length > 0) {
          setUploadError(`Warning: CSV header might be missing recommended columns: ${missing.join(', ')}`);
        } else {
          setUploadError(null);
        }
      }
    };
    reader.readAsText(fileObj);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        setUploadError('Please select a valid CSV (.csv) file.');
        return;
      }
      setFile(selectedFile);
      setUploadError(null);
      setAppliedToDashboard(false);
      setResults([]);
      parseCSVPreview(selectedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.toLowerCase().endsWith('.csv')) {
        setUploadError('Please drop a valid CSV (.csv) file.');
        return;
      }
      setFile(droppedFile);
      setUploadError(null);
      setAppliedToDashboard(false);
      setResults([]);
      parseCSVPreview(droppedFile);
    }
  };

  const uploadAndPredict = async () => {
    if (!file) {
      setUploadError('Please select or drop a CSV file first.');
      return;
    }

    setLoading(true);
    setUploadError(null);
    setResults([]);
    setAppliedToDashboard(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await API.post('/predict-batch', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data && Array.isArray(response.data.predictions)) {
        setResults(response.data.predictions);
      } else {
        throw new Error('Unexpected response format received from batch prediction endpoint.');
      }
    } catch (error) {
      console.error('Batch upload error:', error);
      setResults([]);
      setAppliedToDashboard(false);
      let detail = 'Batch prediction failed.';
      if (error.response?.data?.detail) {
        detail = error.response.data.detail;
      } else if (error.message) {
        detail = error.message;
      }
      setUploadError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setLoading(false);
    }
  };

  const handleApplyToDashboard = () => {
    if (results.length > 0) {
      applyBatchPredictions(results, file?.name || "Uploaded_Batch.csv");
      setAppliedToDashboard(true);
    }
  };

  // Download a sample CSV template
  const downloadSampleCSV = () => {
    const sampleCSVContent =
`Air temperature [K],Process temperature [K],Rotational speed [rpm],Torque [Nm],Tool wear [min]
298.1,308.6,1551,42.8,0
298.2,308.7,1408,46.3,3
302.5,311.8,1380,54.0,175
306.0,315.0,1350,58.0,220
298.9,309.1,1410,65.7,143
308.2,316.5,1260,69.2,246
300.5,310.2,1520,38.5,45
301.1,310.9,1490,41.2,60`;

    const blob = new Blob([sampleCSVContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sample_sensor_telemetry.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const healthyResults = results.filter(r => r.health_status === 'Healthy').length;
  const warningResults = results.filter(r => r.health_status === 'Warning').length;
  const criticalResults = results.filter(r => r.health_status === 'Critical').length;

  const filteredResults = results.filter(r => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(r.row_id).includes(term) ||
      r.health_status.toLowerCase().includes(term) ||
      r.recommendation?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Upload Zone & Instructions Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '20px',
        }}
        className="upload-grid"
      >
        {/* Drag & Drop Area Card */}
        <div className="pm-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">Upload Sensor Telemetry CSV</div>
              <div className="pm-card-subtitle">
                Execute batch machine failure predictions using the trained Random Forest pipeline
              </div>
            </div>

            <button
              onClick={downloadSampleCSV}
              className="btn btn-secondary btn-sm"
              title="Download verified AI4I sample CSV template"
            >
              <IconDownload size={14} />
              Sample CSV
            </button>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--navy-300)'}`,
              borderRadius: 'var(--radius-lg)',
              backgroundColor: isDragOver ? 'var(--primary-subtle)' : '#fcfcfd',
              padding: '36px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minHeight: '200px',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-subtle)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
              }}
            >
              <IconUpload size={24} />
            </div>

            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--navy-900)' }}>
              {file ? file.name : 'Drop your CSV file here, or browse'}
            </div>

            <div style={{ fontSize: '12.5px', color: 'var(--navy-500)', marginTop: '4px' }}>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB &bull; Click to choose different file`
                : 'Supports .csv up to 10MB formatted with standard sensor telemetry columns'}
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '16px' }}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Select CSV File
            </button>
          </div>

          {/* Error Message */}
          {uploadError && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-critical-subtle)',
                border: '1px solid var(--status-critical-border)',
                color: 'var(--status-critical-text)',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <IconAlertTriangle size={16} />
              <span>{uploadError}</span>
            </div>
          )}

          {/* Action Trigger */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '18px',
              paddingTop: '16px',
              borderTop: '1px solid var(--navy-100)',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--navy-500)' }}>
              {file ? `Ready to process ${file.name}` : 'No file chosen'}
            </span>

            <button
              onClick={uploadAndPredict}
              disabled={!file || loading}
              className="btn btn-primary"
              style={{ minWidth: '160px' }}
            >
              {loading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Executing Batch AI...</span>
                </>
              ) : (
                <>
                  <IconUpload size={16} />
                  <span>Upload & Run Predictions</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Schema Guide & Requirements Card */}
        <div className="pm-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">CSV Schema Specification</div>
              <div className="pm-card-subtitle">Required columns for predictive maintenance pipeline</div>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--navy-200)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy-900)' }}>
                Air temperature [K]
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                Ambient plant temperature (e.g., 295.0 – 305.0 Kelvin)
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--navy-200)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy-900)' }}>
                Process temperature [K]
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                Equipment tool/casing internal temperature (e.g., 305.0 – 315.0 Kelvin)
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--navy-200)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy-900)' }}>
                Rotational speed [rpm]
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                Spindle motor angular frequency (e.g., 1100 – 2800 RPM)
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--navy-200)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy-900)' }}>
                Torque [Nm]
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                Motor mechanical torque load (e.g., 5.0 – 80.0 Newton-meters)
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--navy-200)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--navy-900)' }}>
                Tool wear [min]
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--navy-500)' }}>
                Cumulative tool cut time elapsed (e.g., 0 – 250 minutes)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Preview (Before Upload) */}
      {previewRows.length > 0 && results.length === 0 && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">Uploaded CSV File Preview (First 5 Rows)</div>
              <div className="pm-card-subtitle">Verify that columns and values match expected telemetry</div>
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(previewRows[0]).map((header, i) => (
                    <th key={i}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j}>
                        <span className="telemetry-val">{val}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch Results Section (After Upload & Predict) */}
      {results.length > 0 && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div>
              <div className="pm-card-title">
                <IconCheckCircle size={18} style={{ color: 'var(--status-healthy)' }} />
                Batch Prediction Completed ({results.length} Rows Processed)
              </div>
              <div className="pm-card-subtitle">
                ML model inference finished successfully across all telemetry records
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handleApplyToDashboard}
                disabled={appliedToDashboard}
                className="btn btn-primary btn-sm"
              >
                <IconCheckCircle size={14} />
                {appliedToDashboard ? "Applied to Live Dashboard!" : "Apply to Live Dashboard"}
              </button>
            </div>
          </div>

          {/* Results Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginBottom: '20px',
            }}
            className="kpi-grid"
          >
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--navy-200)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--navy-500)', fontWeight: 600 }}>TOTAL ROWS</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--navy-900)' }}>{results.length}</div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-healthy-subtle)',
                border: '1px solid var(--status-healthy-border)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--status-healthy-text)', fontWeight: 600 }}>HEALTHY UNITS</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--status-healthy-text)' }}>{healthyResults}</div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-warning-subtle)',
                border: '1px solid var(--status-warning-border)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--status-warning-text)', fontWeight: 600 }}>WARNING UNITS</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--status-warning-text)' }}>{warningResults}</div>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--status-critical-subtle)',
                border: '1px solid var(--status-critical-border)',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--status-critical-text)', fontWeight: 600 }}>CRITICAL FAILURES</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--status-critical-text)' }}>{criticalResults}</div>
            </div>
          </div>

          {/* Results Table Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--navy-800)' }}>
              Inference Telemetry Records
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#ffffff',
                border: '1px solid var(--navy-200)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 10px',
                width: '200px',
              }}
            >
              <IconSearch size={14} style={{ color: 'var(--navy-400)' }} />
              <input
                type="text"
                placeholder="Filter results..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  color: 'var(--navy-900)',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row ID</th>
                  <th>Risk Score</th>
                  <th>Health Status</th>
                  <th>AI Prediction</th>
                  <th>Prescriptive Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.slice(0, 50).map((row) => {
                  const isFail = row.failure_prediction === 1;
                  return (
                    <tr key={row.row_id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          #{row.row_id + 1}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: 700, color: row.risk_score > 70 ? 'var(--status-critical)' : row.risk_score > 30 ? 'var(--status-warning)' : 'var(--status-healthy)' }}>
                          {row.risk_score.toFixed(1)}%
                        </span>
                      </td>

                      <td>
                        <span className={`status-badge ${row.health_status.toLowerCase()}`}>
                          {row.health_status}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isFail ? 'var(--status-critical)' : 'var(--navy-700)',
                          }}
                        >
                          {isFail ? 'Failure Imminent' : 'Normal Operation'}
                        </span>
                      </td>

                      <td style={{ maxWidth: '340px', fontSize: '12.5px' }}>
                        {row.recommendation}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredResults.length > 50 && (
            <div style={{ textAlign: 'center', padding: '12px', fontSize: '12px', color: 'var(--navy-500)' }}>
              Showing first 50 of {filteredResults.length} records.
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 900px) {
          .upload-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}