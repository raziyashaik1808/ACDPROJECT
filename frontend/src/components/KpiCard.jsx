import React from 'react';

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  badgeText,
  badgeType = "info", // "healthy" | "warning" | "critical" | "info" | "neutral"
  indicatorColor,
}) {
  const getBadgeStyle = () => {
    switch (badgeType) {
      case 'healthy':
        return {
          backgroundColor: 'var(--status-healthy-subtle)',
          color: 'var(--status-healthy-text)',
          border: '1px solid var(--status-healthy-border)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--status-warning-subtle)',
          color: 'var(--status-warning-text)',
          border: '1px solid var(--status-warning-border)',
        };
      case 'critical':
        return {
          backgroundColor: 'var(--status-critical-subtle)',
          color: 'var(--status-critical-text)',
          border: '1px solid var(--status-critical-border)',
        };
      case 'info':
        return {
          backgroundColor: 'var(--primary-subtle)',
          color: 'var(--primary)',
          border: '1px solid var(--primary-border)',
        };
      default:
        return {
          backgroundColor: 'var(--navy-100)',
          color: 'var(--navy-700)',
          border: '1px solid var(--navy-200)',
        };
    }
  };

  return (
    <div
      className="pm-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        minHeight: '135px',
      }}
    >
      {/* Top accent line if indicatorColor is provided */}
      {indicatorColor && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: indicatorColor,
          }}
        />
      )}

      {/* Top: Icon + Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '9px',
            backgroundColor: indicatorColor ? `${indicatorColor}15` : 'var(--navy-100)',
            color: indicatorColor || 'var(--navy-700)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>

        {badgeText && (
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '9999px',
              lineHeight: 1.3,
              ...getBadgeStyle(),
            }}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Value & Label */}
      <div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--navy-500)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '4px',
          }}
        >
          {title}
        </div>

        <div
          style={{
            fontSize: '30px',
            fontWeight: 700,
            color: 'var(--navy-900)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>

        {subtitle && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--navy-500)',
              marginTop: '6px',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
