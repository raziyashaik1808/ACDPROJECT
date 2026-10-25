import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  IconLogo,
  IconDashboard,
  IconMachines,
  IconUpload,
  IconActivity,
  IconWrench,
  IconHistory,
  IconMetrics,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
} from './Icons';
import { useFleet } from '../context/FleetContext';

export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) {
  const { alerts, tasks, totalCount, backendOnline, dbStatus } = useFleet();

  const pendingTasksCount = tasks.filter(t => t.status !== "Completed").length;
  const activeAlertsCount = alerts.filter(a => a.status === 'Active' || a.status === 'In Review' || a.status === 'Investigating' || !a.status).length;

  const navItems = [
    {
      to: "/",
      label: "Dashboard",
      icon: <IconDashboard size={19} />,
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
      badgeColor: "critical",
    },
    {
      to: "/machines",
      label: "Machines",
      icon: <IconMachines size={19} />,
      badge: totalCount,
      badgeColor: "subtle",
    },
    {
      to: "/upload",
      label: "Upload Data",
      icon: <IconUpload size={19} />,
    },
    {
      to: "/predictions",
      label: "Predictions & Anomalies",
      icon: <IconActivity size={19} />,
    },
    {
      to: "/maintenance",
      label: "Maintenance",
      icon: <IconWrench size={19} />,
      badge: pendingTasksCount > 0 ? pendingTasksCount : null,
      badgeColor: "warning",
    },
    {
      to: "/history",
      label: "Machine History",
      icon: <IconHistory size={19} />,
    },
    {
      to: "/metrics",
      label: "Model Metrics",
      icon: <IconMetrics size={19} />,
    },
  ];

  const handleNavClick = () => {
    if (mobileOpen) {
      setMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 19, 41, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 998,
          }}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
          backgroundColor: 'var(--bg-sidebar)',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 999,
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* Sidebar Brand Header */}
        <div
          style={{
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
            padding: collapsed ? '0' : '0 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            position: 'relative',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
              }}
            >
              <IconLogo size={20} />
            </div>

            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Industrial PM
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--navy-400)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Predictive Maintenance
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="sidebar-collapse-btn"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--navy-300)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="sidebar-mobile-close-btn"
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Navigation Links */}
        <div
          style={{
            flex: 1,
            padding: '16px 10px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {!collapsed && (
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--navy-400)',
                padding: '6px 12px 10px',
              }}
            >
              Operations & Analytics
            </div>
          )}

          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={handleNavClick}
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: collapsed ? '11px 0' : '10px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: '8px',
                color: isActive ? '#ffffff' : '#94a3b8',
                backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13.5px',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
                position: 'relative',
              })}
              onMouseEnter={(e) => {
                if (!e.currentTarget.classList.contains('active')) {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = '#f1f5f9';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.currentTarget.classList.contains('active')) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>

              {!collapsed && (
                <span
                  style={{
                    flex: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.label}
                </span>
              )}

              {!collapsed && item.badge && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '9999px',
                    backgroundColor:
                      item.badgeColor === 'critical'
                        ? 'var(--status-critical)'
                        : item.badgeColor === 'warning'
                        ? 'var(--status-warning)'
                        : 'rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    lineHeight: 1.2,
                  }}
                >
                  {item.badge}
                </span>
              )}

              {/* Tiny dot indicator when collapsed if badge exists */}
              {collapsed && item.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '18px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor:
                      item.badgeColor === 'critical'
                        ? 'var(--status-critical)'
                        : item.badgeColor === 'warning'
                        ? 'var(--status-warning)'
                        : 'var(--primary)',
                  }}
                />
              )}
            </NavLink>
          ))}
        </div>

        {/* Footer / System Status Widget */}
        <div
          style={{
            padding: collapsed ? '12px 6px' : '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          {collapsed ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              title={`ML Engine: ${backendOnline ? 'Online' : 'Offline'}`}
            >
              <span
                style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  backgroundColor: backendOnline ? 'var(--status-healthy)' : 'var(--status-critical)',
                  boxShadow: backendOnline ? '0 0 8px var(--status-healthy)' : 'none',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '8px',
                padding: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--navy-300)', fontWeight: 600 }}>
                  ML Engine (RF-200)
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    color: backendOnline ? 'var(--status-healthy)' : 'var(--status-critical)',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: backendOnline ? 'var(--status-healthy)' : 'var(--status-critical)',
                      boxShadow: backendOnline ? '0 0 6px var(--status-healthy)' : 'none',
                    }}
                  />
                  {backendOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span style={{ fontSize: '11px', color: 'var(--navy-300)', fontWeight: 600 }}>
                  MongoDB Local
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    color: dbStatus?.connected ? 'var(--status-healthy)' : 'var(--status-warning)',
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: dbStatus?.connected ? 'var(--status-healthy)' : 'var(--status-warning)',
                      boxShadow: dbStatus?.connected ? '0 0 6px var(--status-healthy)' : 'none',
                    }}
                  />
                  {dbStatus?.connected ? 'Connected' : 'Checking'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--navy-400)',
                  lineHeight: 1.4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '4px',
                  paddingTop: '4px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span>Monitored Fleet:</span>
                <strong style={{ color: '#ffffff' }}>{totalCount} Units</strong>
              </div>
            </div>
          )}
        </div>
      </aside>

      <style>{`
        @media (min-width: 1025px) {
          .sidebar-collapse-btn {
            display: inline-flex !important;
          }
        }
        @media (max-width: 1024px) {
          .sidebar {
            transform: translateX(-100%);
            width: 260px !important;
          }
          .sidebar.mobile-open {
            transform: translateX(0);
          }
          .sidebar-mobile-close-btn {
            display: inline-flex !important;
          }
        }
      `}</style>
    </>
  );
}
