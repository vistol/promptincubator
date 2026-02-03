/**
 * @fileoverview EggCard component - Displays a single egg with tabs
 * @module trading/components/Incubator/EggCard
 */

import React, { useState } from 'react';
import { EventLog } from '../EventLog/index.js';

/**
 * Tab definitions
 */
const TABS = [
  { id: 'trades', label: 'Trades', icon: '📈' },
  { id: 'config', label: 'Config', icon: '⚙️' },
  { id: 'ai', label: 'AI', icon: '🤖' },
  { id: 'log', label: 'LOG', icon: '📋' }
];

/**
 * TradesTab - Shows the trades generated
 */
function TradesTab({ egg }) {
  const trades = egg.trades || [];

  if (trades.length === 0) {
    return (
      <div style={styles.emptyTab}>
        <span>No hay trades generados</span>
      </div>
    );
  }

  return (
    <div style={styles.tradesContainer}>
      {trades.map((trade, index) => (
        <div key={trade.id || index} style={styles.tradeCard}>
          <div style={styles.tradeHeader}>
            <span style={{
              ...styles.tradeBadge,
              backgroundColor: trade.direction === 'LONG' ? '#22c55e' : '#ef4444'
            }}>
              {trade.direction === 'LONG' ? '📈 LONG' : '📉 SHORT'}
            </span>
            <span style={styles.tradeAsset}>{trade.asset}</span>
            <span style={styles.tradeIpe}>IPE: {trade.ipe}%</span>
          </div>

          <div style={styles.tradeLevels}>
            <div style={styles.levelItem}>
              <span style={styles.levelLabel}>Entry</span>
              <span style={styles.levelValue}>${Number(trade.entry).toLocaleString()}</span>
            </div>
            <div style={styles.levelItem}>
              <span style={{ ...styles.levelLabel, color: '#22c55e' }}>Take Profit</span>
              <span style={styles.levelValue}>${Number(trade.takeProfit).toLocaleString()}</span>
            </div>
            <div style={styles.levelItem}>
              <span style={{ ...styles.levelLabel, color: '#ef4444' }}>Stop Loss</span>
              <span style={styles.levelValue}>${Number(trade.stopLoss).toLocaleString()}</span>
            </div>
            <div style={styles.levelItem}>
              <span style={styles.levelLabel}>R:R</span>
              <span style={styles.levelValue}>{trade.riskRewardRatio || 'N/A'}:1</span>
            </div>
          </div>

          {trade.summary && (
            <div style={styles.tradeSummary}>{trade.summary}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * ConfigTab - Shows the execution configuration
 */
function ConfigTab({ egg }) {
  const config = egg.config || {};

  return (
    <div style={styles.configContainer}>
      <div style={styles.configGrid}>
        <ConfigItem label="Capital" value={`$${Number(config.capital || 0).toLocaleString()}`} />
        <ConfigItem label="Leverage" value={`${config.leverage || 1}x`} />
        <ConfigItem label="Timeframe" value={config.executionTime || 'N/A'} />
        <ConfigItem label="Target" value={config.targetPct ? `${config.targetPct}%` : 'N/A'} />
        <ConfigItem label="Min IPE" value={config.minIpe ? `${config.minIpe}%` : 'N/A'} />
        <ConfigItem label="Trades" value={config.numResults || 'N/A'} />
        <ConfigItem label="AI Provider" value={config.aiProvider || 'N/A'} />
      </div>
    </div>
  );
}

function ConfigItem({ label, value }) {
  return (
    <div style={styles.configItem}>
      <span style={styles.configLabel}>{label}</span>
      <span style={styles.configValue}>{value}</span>
    </div>
  );
}

/**
 * AITab - Shows AI reasoning and Glass Box data
 */
function AITab({ egg }) {
  const glassBox = egg.glassBoxData || {};
  const aiMetadata = egg.aiMetadata || {};

  return (
    <div style={styles.aiContainer}>
      {/* AI Metadata */}
      <div style={styles.aiSection}>
        <h4 style={styles.sectionTitle}>🤖 AI Provider</h4>
        <div style={styles.aiMeta}>
          <span>Provider: {aiMetadata.provider || 'N/A'}</span>
          <span>Model: {aiMetadata.model || 'N/A'}</span>
          <span>Tokens: {aiMetadata.inputTokens || 0} → {aiMetadata.outputTokens || 0}</span>
          <span>Latency: {aiMetadata.latency || 0}ms</span>
        </div>
      </div>

      {/* Reasoning */}
      {glassBox.reasoning && (
        <div style={styles.aiSection}>
          <h4 style={styles.sectionTitle}>💭 Reasoning</h4>
          <div style={styles.reasoningList}>
            {Object.entries(glassBox.reasoning).map(([key, value]) => (
              <div key={key} style={styles.reasoningItem}>
                <span style={styles.reasoningKey}>{key.replace('why', '')}</span>
                <span style={styles.reasoningValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Criteria Matched */}
      {glassBox.criteriaMatched && glassBox.criteriaMatched.length > 0 && (
        <div style={styles.aiSection}>
          <h4 style={styles.sectionTitle}>✅ Criteria Matched</h4>
          <div style={styles.criteriaList}>
            {glassBox.criteriaMatched.map((criteria, i) => (
              <div key={i} style={styles.criteriaItem}>
                <span style={{
                  ...styles.criteriaIcon,
                  color: criteria.passed ? '#22c55e' : '#ef4444'
                }}>
                  {criteria.passed ? '✓' : '✗'}
                </span>
                <span style={styles.criteriaName}>{criteria.criterion}</span>
                <span style={styles.criteriaValue}>{criteria.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * LogTab - Shows the streaming event log
 */
function LogTab({ egg }) {
  const events = egg.events || [];
  const isLive = egg.status === 'incubating';

  return (
    <div style={styles.logContainer}>
      <EventLog
        events={events}
        isLive={isLive}
        executionId={egg.id}
      />
    </div>
  );
}

/**
 * EggCard component
 * Displays a single egg with expandable tabs
 */
export function EggCard({ egg, isExpanded: initialExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [activeTab, setActiveTab] = useState('trades');

  const trades = egg.trades || [];
  const status = egg.status || 'pending';

  // Calculate PnL (mock for now)
  const avgIpe = trades.length > 0
    ? Math.round(trades.reduce((sum, t) => sum + (t.ipe || 0), 0) / trades.length)
    : 0;

  // Status badge color
  const statusColors = {
    incubating: { bg: '#3b82f6', text: 'Incubando' },
    hatched: { bg: '#22c55e', text: 'Completado' },
    failed: { bg: '#ef4444', text: 'Fallido' },
    pending: { bg: '#6b7280', text: 'Pendiente' }
  };

  const statusConfig = statusColors[status] || statusColors.pending;

  return (
    <div style={styles.card}>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={styles.headerLeft}>
          <span style={styles.eggIcon}>🥚</span>
          <div style={styles.headerInfo}>
            <span style={styles.eggName}>{egg.promptName || 'Sin nombre'}</span>
            <span style={styles.eggMeta}>
              {trades.length} trades • IPE avg: {avgIpe}%
            </span>
          </div>
        </div>

        <div style={styles.headerRight}>
          <span style={{
            ...styles.statusBadge,
            backgroundColor: statusConfig.bg
          }}>
            {statusConfig.text}
          </span>
          <span style={styles.expandIcon}>
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EXPANDED CONTENT */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {isExpanded && (
        <div style={styles.content}>
          {/* Tabs */}
          <div style={styles.tabs}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.tab,
                  ...(activeTab === tab.id ? styles.tabActive : {})
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            {activeTab === 'trades' && <TradesTab egg={egg} />}
            {activeTab === 'config' && <ConfigTab egg={egg} />}
            {activeTab === 'ai' && <AITab egg={egg} />}
            {activeTab === 'log' && <LogTab egg={egg} />}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Styles
 */
const styles = {
  card: {
    backgroundColor: '#1a1a2e',
    borderRadius: '12px',
    overflow: 'hidden',
    marginBottom: '12px',
    border: '1px solid #2d2d44'
  },

  // ═══════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease'
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },

  eggIcon: {
    fontSize: '28px'
  },

  headerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },

  eggName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#f1f5f9'
  },

  eggMeta: {
    fontSize: '12px',
    color: '#9ca3af'
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },

  statusBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'white'
  },

  expandIcon: {
    color: '#6b7280',
    fontSize: '12px'
  },

  // ═══════════════════════════════════════════════════════════════
  // CONTENT
  // ═══════════════════════════════════════════════════════════════
  content: {
    borderTop: '1px solid #2d2d44'
  },

  tabs: {
    display: 'flex',
    backgroundColor: '#0f0f1a',
    padding: '4px'
  },

  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px 16px',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.15s ease'
  },

  tabActive: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },

  tabContent: {
    minHeight: '300px',
    maxHeight: '500px',
    overflow: 'auto'
  },

  // ═══════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ═══════════════════════════════════════════════════════════════
  emptyTab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: '#6b7280'
  },

  // ═══════════════════════════════════════════════════════════════
  // TRADES TAB
  // ═══════════════════════════════════════════════════════════════
  tradesContainer: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  tradeCard: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #334155'
  },

  tradeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  },

  tradeBadge: {
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
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px'
  },

  levelItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },

  levelLabel: {
    fontSize: '10px',
    color: '#9ca3af',
    textTransform: 'uppercase'
  },

  levelValue: {
    fontSize: '14px',
    fontFamily: 'monospace',
    color: '#e5e7eb'
  },

  tradeSummary: {
    marginTop: '12px',
    padding: '10px',
    backgroundColor: '#1e293b',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#cbd5e1',
    lineHeight: '1.5'
  },

  // ═══════════════════════════════════════════════════════════════
  // CONFIG TAB
  // ═══════════════════════════════════════════════════════════════
  configContainer: {
    padding: '16px'
  },

  configGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '16px'
  },

  configItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    backgroundColor: '#0f172a',
    borderRadius: '8px'
  },

  configLabel: {
    fontSize: '11px',
    color: '#9ca3af',
    textTransform: 'uppercase'
  },

  configValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#f1f5f9'
  },

  // ═══════════════════════════════════════════════════════════════
  // AI TAB
  // ═══════════════════════════════════════════════════════════════
  aiContainer: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },

  aiSection: {
    backgroundColor: '#0f172a',
    borderRadius: '8px',
    padding: '16px'
  },

  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#f1f5f9'
  },

  aiMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    fontSize: '13px',
    color: '#9ca3af'
  },

  reasoningList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },

  reasoningItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },

  reasoningKey: {
    fontSize: '11px',
    color: '#60a5fa',
    textTransform: 'uppercase'
  },

  reasoningValue: {
    fontSize: '13px',
    color: '#e5e7eb',
    lineHeight: '1.5'
  },

  criteriaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },

  criteriaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px'
  },

  criteriaIcon: {
    fontWeight: 'bold'
  },

  criteriaName: {
    color: '#e5e7eb'
  },

  criteriaValue: {
    marginLeft: 'auto',
    color: '#9ca3af',
    fontFamily: 'monospace'
  },

  // ═══════════════════════════════════════════════════════════════
  // LOG TAB
  // ═══════════════════════════════════════════════════════════════
  logContainer: {
    height: '400px'
  }
};

export default EggCard;
