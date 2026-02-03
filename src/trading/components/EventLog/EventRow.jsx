/**
 * @fileoverview EventRow component for displaying individual events
 * @module trading/components/EventLog/EventRow
 */

import React, { useState } from 'react';
import { formatTimestamp, getLevelColor } from './eventTypes.js';

/**
 * TradeCard - Special card for trade events
 */
function TradeCard({ trade }) {
  if (!trade) return null;

  const isLong = trade.direction === 'LONG';

  return (
    <div style={styles.tradeCard}>
      <div style={styles.tradeHeader}>
        <span style={{
          ...styles.tradeDirection,
          backgroundColor: isLong ? '#22c55e' : '#ef4444'
        }}>
          {isLong ? '📈 LONG' : '📉 SHORT'}
        </span>
        <span style={styles.tradeAsset}>{trade.asset}</span>
        {trade.ipe && (
          <span style={styles.tradeIpe}>IPE: {trade.ipe}%</span>
        )}
      </div>
      <div style={styles.tradeLevels}>
        <div style={styles.tradeLevel}>
          <span style={styles.tradeLevelLabel}>Entry</span>
          <span style={styles.tradeLevelValue}>${Number(trade.entry).toLocaleString()}</span>
        </div>
        <div style={styles.tradeLevel}>
          <span style={{ ...styles.tradeLevelLabel, color: '#22c55e' }}>TP</span>
          <span style={styles.tradeLevelValue}>${Number(trade.takeProfit).toLocaleString()}</span>
        </div>
        <div style={styles.tradeLevel}>
          <span style={{ ...styles.tradeLevelLabel, color: '#ef4444' }}>SL</span>
          <span style={styles.tradeLevelValue}>${Number(trade.stopLoss).toLocaleString()}</span>
        </div>
        {trade.riskReward && (
          <div style={styles.tradeLevel}>
            <span style={styles.tradeLevelLabel}>R:R</span>
            <span style={styles.tradeLevelValue}>{trade.riskReward}:1</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ExpandableContent - Collapsible content section
 */
function ExpandableContent({ data, label }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!data) return null;

  return (
    <div style={styles.expandable}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={styles.expandButton}
      >
        {isExpanded ? '▼' : '▶'} {label || 'Ver más'}
      </button>
      {isExpanded && (
        <pre style={styles.expandedContent}>
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * EventRow component
 * Renders a single event in the log
 */
export function EventRow({ event, viewMode = 'normal', onClick }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const levelColor = getLevelColor(event.level);
  const timestamp = formatTimestamp(event.timestamp);

  // ═══════════════════════════════════════════════════════════════
  // COMPACT MODE
  // ═══════════════════════════════════════════════════════════════
  if (viewMode === 'compact') {
    return (
      <div
        style={{
          ...styles.rowCompact,
          borderLeftColor: levelColor
        }}
        onClick={onClick}
      >
        <span style={styles.timestampCompact}>{timestamp}</span>
        <span style={styles.icon}>{event.icon}</span>
        <span style={styles.typeCompact}>{event.type.split('_')[0]}</span>
        <span style={styles.titleCompact}>{event.title}</span>
        {event.duration && (
          <span style={styles.durationCompact}>({event.duration}ms)</span>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPANDED MODE (debug)
  // ═══════════════════════════════════════════════════════════════
  if (viewMode === 'expanded') {
    return (
      <div
        style={{
          ...styles.rowExpanded,
          borderLeftColor: levelColor
        }}
      >
        <div style={styles.headerExpanded}>
          <span style={styles.timestamp}>{timestamp}</span>
          <span style={styles.icon}>{event.icon}</span>
          <span style={styles.type}>{event.type}</span>
        </div>
        <pre style={styles.rawJson}>
          {JSON.stringify(event.raw, null, 2)}
        </pre>
        <div style={styles.actions}>
          <button style={styles.actionButton} onClick={() => navigator.clipboard.writeText(JSON.stringify(event.raw, null, 2))}>
            📋 Copy JSON
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // NORMAL MODE (default)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div
      style={{
        ...styles.row,
        ...(event.isHighlighted ? styles.rowHighlighted : {}),
        borderLeftColor: levelColor
      }}
      onClick={() => event.expandable && setIsExpanded(!isExpanded)}
    >
      {/* Header line */}
      <div style={styles.header}>
        <span style={styles.timestamp}>{timestamp}</span>
        <span style={styles.icon}>{event.icon}</span>
        <span style={styles.type}>{event.type}</span>
        <span style={styles.title}>{event.title}</span>
        {event.duration && (
          <span style={styles.duration}>{event.duration}ms</span>
        )}
        {event.expandable && (
          <span style={styles.expandToggle}>
            {isExpanded ? '▼' : '▶'}
          </span>
        )}
      </div>

      {/* Subtitle */}
      {event.subtitle && (
        <div style={styles.subtitle}>{event.subtitle}</div>
      )}

      {/* Details list */}
      {event.details && event.details.length > 0 && (
        <div style={styles.details}>
          {event.details.map((detail, i) => (
            <div key={i} style={styles.detailLine}>{detail}</div>
          ))}
        </div>
      )}

      {/* Trade card (special rendering for trades) */}
      {event.trade && <TradeCard trade={event.trade} />}

      {/* Expandable content */}
      {isExpanded && event.expandable && (
        <ExpandableContent
          data={event.expandable.data}
          label={event.expandable.label}
        />
      )}
    </div>
  );
}

/**
 * Styles
 */
const styles = {
  // ═══════════════════════════════════════════════════════════════
  // NORMAL MODE STYLES
  // ═══════════════════════════════════════════════════════════════
  row: {
    padding: '8px 12px',
    borderLeft: '3px solid',
    marginBottom: '4px',
    backgroundColor: '#1a1a2e',
    borderRadius: '0 4px 4px 0',
    cursor: 'default',
    transition: 'background-color 0.15s ease'
  },

  rowHighlighted: {
    backgroundColor: '#1e3a5f',
    border: '1px solid #3b82f6',
    borderLeft: '3px solid'
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },

  timestamp: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#6b7280',
    minWidth: '90px'
  },

  icon: {
    fontSize: '14px'
  },

  type: {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: '#9ca3af',
    backgroundColor: '#374151',
    padding: '2px 6px',
    borderRadius: '3px',
    textTransform: 'uppercase'
  },

  title: {
    color: '#e5e7eb',
    fontSize: '13px',
    flex: 1
  },

  duration: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#9ca3af',
    backgroundColor: '#374151',
    padding: '2px 6px',
    borderRadius: '3px'
  },

  expandToggle: {
    color: '#6b7280',
    fontSize: '10px',
    cursor: 'pointer'
  },

  subtitle: {
    marginLeft: '98px',
    marginTop: '4px',
    color: '#9ca3af',
    fontSize: '12px'
  },

  details: {
    marginLeft: '98px',
    marginTop: '6px',
    padding: '8px',
    backgroundColor: '#111827',
    borderRadius: '4px'
  },

  detailLine: {
    color: '#d1d5db',
    fontSize: '12px',
    lineHeight: '1.6',
    fontFamily: 'monospace'
  },

  // ═══════════════════════════════════════════════════════════════
  // COMPACT MODE STYLES
  // ═══════════════════════════════════════════════════════════════
  rowCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    borderLeft: '2px solid',
    backgroundColor: '#1a1a2e',
    marginBottom: '2px',
    fontSize: '12px'
  },

  timestampCompact: {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: '#6b7280',
    minWidth: '85px'
  },

  typeCompact: {
    fontFamily: 'monospace',
    fontSize: '9px',
    color: '#9ca3af',
    minWidth: '60px'
  },

  titleCompact: {
    color: '#e5e7eb',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },

  durationCompact: {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: '#6b7280'
  },

  // ═══════════════════════════════════════════════════════════════
  // EXPANDED MODE STYLES
  // ═══════════════════════════════════════════════════════════════
  rowExpanded: {
    padding: '12px',
    borderLeft: '3px solid',
    marginBottom: '8px',
    backgroundColor: '#1a1a2e',
    borderRadius: '0 4px 4px 0'
  },

  headerExpanded: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },

  rawJson: {
    backgroundColor: '#111827',
    padding: '12px',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#d1d5db',
    overflow: 'auto',
    maxHeight: '200px',
    margin: '8px 0'
  },

  actions: {
    display: 'flex',
    gap: '8px'
  },

  actionButton: {
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: '#374151',
    color: '#e5e7eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },

  // ═══════════════════════════════════════════════════════════════
  // TRADE CARD STYLES
  // ═══════════════════════════════════════════════════════════════
  tradeCard: {
    marginLeft: '98px',
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    border: '1px solid #334155'
  },

  tradeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px'
  },

  tradeDirection: {
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white'
  },

  tradeAsset: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#f1f5f9'
  },

  tradeIpe: {
    marginLeft: 'auto',
    padding: '4px 8px',
    backgroundColor: '#1e40af',
    borderRadius: '4px',
    fontSize: '12px',
    color: 'white'
  },

  tradeLevels: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap'
  },

  tradeLevel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },

  tradeLevelLabel: {
    fontSize: '10px',
    color: '#9ca3af',
    textTransform: 'uppercase'
  },

  tradeLevelValue: {
    fontSize: '14px',
    fontFamily: 'monospace',
    color: '#e5e7eb'
  },

  // ═══════════════════════════════════════════════════════════════
  // EXPANDABLE STYLES
  // ═══════════════════════════════════════════════════════════════
  expandable: {
    marginTop: '8px',
    marginLeft: '98px'
  },

  expandButton: {
    padding: '4px 8px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    color: '#60a5fa',
    border: '1px solid #3b82f6',
    borderRadius: '4px',
    cursor: 'pointer'
  },

  expandedContent: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#111827',
    borderRadius: '4px',
    fontSize: '11px',
    color: '#d1d5db',
    overflow: 'auto',
    maxHeight: '300px'
  }
};

export default EventRow;
