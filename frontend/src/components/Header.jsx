import React from 'react';
import {
  IconMenu,
  IconRefresh,
  IconDatabase,
  IconClock,
  IconSparkles,
} from './Icons';
import { useFleet } from '../context/FleetContext';

export default function Header({
  title = "Equipment Health Overview",
  subtitle = "Monitor equipment condition, failure risk, and maintenance activity.",
  onOpenMobileNav,
}) {
  const {
    dataSource,
    timeRange,
    setTimeRange,
    isRefreshing,
    refreshFleet,
    resetToSampleData,
  } = useFleet();

  const isUploaded = dataSource.startsWith("Batch Feed");

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--navy-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
      }}
    >
      {/* Left: Mobile Toggle & Page Titles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
        <button
          onClick={onOpenMobileNav}
          className="mobile-menu-trigger"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            border: '1px solid var(--navy-200)',
            backgroundColor: '#ffffff',
            color: 'var(--navy-800)',
            cursor: 'pointer',
          }}
          aria-label="Open Navigation Menu"
        >
          <IconMenu size={20} />
        </button>

        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: '17.5px',
              fontWeight: 700,
              color: 'var(--navy-900)',
              letterSpacing: '-0.015em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </h1>
          <p
            style={{
              fontSize: '12.5px',
              color: 'var(--navy-500)',
              margin: '2px 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {/* Source Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            borderRadius: '9999px',
            backgroundColor: isUploaded ? '#eff6ff' : '#f8fafc',
            border: `1px solid ${isUploaded ? '#bfdbfe' : 'var(--navy-200)'}`,
            fontSize: '12px',
          }}
          className="header-source-badge"
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isUploaded ? 'var(--primary)' : 'var(--status-healthy)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              fontWeight: 600,
              color: isUploaded ? 'var(--primary)' : 'var(--navy-700)',
              maxWidth: '220px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={dataSource}
          >
            {dataSource}
          </span>

          {isUploaded && (
            <button
              onClick={resetToSampleData}
              title="Reset to Baseline Fleet"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--navy-500)',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                padding: '0 4px',
                textDecoration: 'underline',
              }}
            >
              Reset
            </button>
          )}
        </div>

        {/* Time Range Filter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#ffffff',
            border: '1px solid var(--navy-200)',
            borderRadius: 'var(--radius-md)',
            padding: '2px 8px',
          }}
          className="header-timerange"
        >
          <IconClock size={14} className="text-muted" style={{ color: 'var(--navy-400)' }} />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '12.5px',
              fontWeight: 500,
              color: 'var(--navy-700)',
              cursor: 'pointer',
              outline: 'none',
              padding: '4px 0',
            }}
          >
            <option value="Live Shift (24h)">Live Shift (24h)</option>
            <option value="Past 7 Days">Past 7 Days</option>
            <option value="Past 30 Days">Past 30 Days</option>
            <option value="All Telemetry">All Telemetry</option>
          </select>
        </div>

        {/* Refresh Action */}
        <button
          onClick={refreshFleet}
          disabled={isRefreshing}
          className="btn btn-secondary btn-sm"
          style={{
            height: '34px',
            fontSize: '12.5px',
            fontWeight: 600,
            padding: '0 12px',
          }}
          title="Run Real-Time Model Inference & Sync Telemetry"
        >
          <span className={isRefreshing ? 'animate-spin' : ''} style={{ display: 'flex' }}>
            <IconRefresh size={14} />
          </span>
          <span className="refresh-label">{isRefreshing ? 'Running...' : 'Refresh'}</span>
        </button>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .mobile-menu-trigger {
            display: inline-flex !important;
          }
          header {
            padding: 0 16px !important;
          }
          .header-source-badge {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .header-timerange {
            display: none !important;
          }
          .refresh-label {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}
