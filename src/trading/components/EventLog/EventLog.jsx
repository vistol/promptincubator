/**
 * @fileoverview EventLog component - Main streaming event log display
 * @module trading/components/EventLog/EventLog
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { EventRow } from './EventRow.jsx';
import { formatEvent, LEVEL_COLORS } from './eventTypes.js';

/**
 * EventLog component
 * Displays a streaming log of execution events with filtering and search
 *
 * @param {Object} props
 * @param {Array} props.events - Array of raw events from pipeline
 * @param {boolean} props.isLive - Whether events are still streaming
 * @param {string} props.executionId - Current execution ID
 * @param {Function} props.onExport - Callback for export action
 */
export function EventLog({
  events = [],
  isLive = false,
  executionId,
  onExport
}) {
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  const [viewMode, setViewMode] = useState('normal'); // 'compact' | 'normal' | 'expanded'
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    levels: ['info', 'success', 'warning', 'error'],
    steps: [] // Empty = all steps
  });
  const [showFilters, setShowFilters] = useState(false);

  const listRef = useRef(null);
  const lastEventCountRef = useRef(events.length);

  // ═══════════════════════════════════════════════════════════════
  // FORMAT EVENTS
  // ═══════════════════════════════════════════════════════════════
  const formattedEvents = useMemo(() => {
    return events.map((event, index) => ({
      ...formatEvent(event),
      sequence: event.sequence || index + 1
    }));
  }, [events]);

  // ═══════════════════════════════════════════════════════════════
  // FILTER EVENTS
  // ═══════════════════════════════════════════════════════════════
  const filteredEvents = useMemo(() => {
    return formattedEvents.filter(event => {
      // Filter by level
      if (!filters.levels.includes(event.level)) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesTitle = event.title?.toLowerCase().includes(searchLower);
        const matchesSubtitle = event.subtitle?.toLowerCase().includes(searchLower);
        const matchesType = event.type?.toLowerCase().includes(searchLower);
        const matchesDetails = event.details?.some(d =>
          d?.toLowerCase().includes(searchLower)
        );

        if (!matchesTitle && !matchesSubtitle && !matchesType && !matchesDetails) {
          return false;
        }
      }

      return true;
    });
  }, [formattedEvents, filters, searchQuery]);

  // ═══════════════════════════════════════════════════════════════
  // AUTO-SCROLL EFFECT
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (autoScroll && events.length > lastEventCountRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
    lastEventCountRef.current = events.length;
  }, [events.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    return {
      total: formattedEvents.length,
      info: formattedEvents.filter(e => e.level === 'info').length,
      success: formattedEvents.filter(e => e.level === 'success').length,
      warning: formattedEvents.filter(e => e.level === 'warning').length,
      error: formattedEvents.filter(e => e.level === 'error').length
    };
  }, [formattedEvents]);

  // Calculate duration
  const duration = useMemo(() => {
    if (formattedEvents.length < 2) return 0;
    const first = formattedEvents[0]?.timestamp || 0;
    const last = formattedEvents[formattedEvents.length - 1]?.timestamp || 0;
    return last - first;
  }, [formattedEvents]);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════
  const toggleLevel = (level) => {
    setFilters(prev => ({
      ...prev,
      levels: prev.levels.includes(level)
        ? prev.levels.filter(l => l !== level)
        : [...prev.levels, level]
    }));
  };

  const handleExport = (format) => {
    if (format === 'json') {
      const data = JSON.stringify(events, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `events-${executionId || 'export'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'clipboard') {
      const text = filteredEvents
        .map(e => `${e.timestamp} ${e.icon} ${e.type} ${e.title}`)
        .join('\n');
      navigator.clipboard.writeText(text);
    }

    if (onExport) onExport(format);
  };

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={styles.container}>
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* HEADER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.headerLeft}>
            <span style={styles.title}>📋 Event Log</span>
            {isLive && <span style={styles.liveBadge}>🔴 LIVE</span>}
          </div>
          <div style={styles.headerRight}>
            <span style={styles.stat}>⏱ {(duration / 1000).toFixed(2)}s</span>
            <span style={styles.stat}>📊 {stats.total} eventos</span>
          </div>
        </div>

        {/* View mode toggle */}
        <div style={styles.controls}>
          <div style={styles.viewModes}>
            {['compact', 'normal', 'expanded'].map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  ...styles.modeButton,
                  ...(viewMode === mode ? styles.modeButtonActive : {})
                }}
              >
                {mode === 'compact' ? 'Compacto' : mode === 'normal' ? 'Normal' : 'Expandido'}
              </button>
            ))}
          </div>

          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="🔍 Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={styles.clearSearch}
              >
                ×
              </button>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              ...styles.filterToggle,
              ...(showFilters ? styles.filterToggleActive : {})
            }}
          >
            ⚙️ Filtros
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div style={styles.filtersPanel}>
            <div style={styles.filterGroup}>
              <span style={styles.filterLabel}>Nivel:</span>
              {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  style={{
                    ...styles.filterButton,
                    borderColor: color,
                    backgroundColor: filters.levels.includes(level) ? color + '33' : 'transparent',
                    opacity: filters.levels.includes(level) ? 1 : 0.5
                  }}
                >
                  {level === 'info' && 'ℹ️ Info'}
                  {level === 'success' && '✅ Success'}
                  {level === 'warning' && '⚠️ Warning'}
                  {level === 'error' && '❌ Error'}
                  {level === 'debug' && '🔍 Debug'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EVENT LIST */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div
        ref={listRef}
        style={styles.eventList}
        onScroll={handleScroll}
      >
        {filteredEvents.length === 0 ? (
          <div style={styles.emptyState}>
            {events.length === 0 ? (
              <>
                <span style={styles.emptyIcon}>📭</span>
                <span>No hay eventos todavía</span>
                {isLive && <span style={styles.emptySubtext}>Esperando eventos...</span>}
              </>
            ) : (
              <>
                <span style={styles.emptyIcon}>🔍</span>
                <span>No se encontraron eventos</span>
                <span style={styles.emptySubtext}>Intenta cambiar los filtros o la búsqueda</span>
              </>
            )}
          </div>
        ) : (
          filteredEvents.map((event, index) => (
            <EventRow
              key={event.id || index}
              event={event}
              viewMode={viewMode}
            />
          ))
        )}

        {/* Auto-scroll indicator */}
        {!autoScroll && filteredEvents.length > 0 && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (listRef.current) {
                listRef.current.scrollTop = listRef.current.scrollHeight;
              }
            }}
            style={styles.scrollToBottom}
          >
            ↓ Scroll al final
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* FOOTER */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={styles.footer}>
        <div style={styles.statsBar}>
          <span style={{ color: LEVEL_COLORS.success }}>✅ {stats.success}</span>
          <span style={{ color: LEVEL_COLORS.info }}>ℹ️ {stats.info}</span>
          <span style={{ color: LEVEL_COLORS.warning }}>⚠️ {stats.warning}</span>
          <span style={{ color: LEVEL_COLORS.error }}>❌ {stats.error}</span>
        </div>
        <div style={styles.actions}>
          <button
            onClick={() => handleExport('clipboard')}
            style={styles.actionButton}
            title="Copiar al portapapeles"
          >
            📋 Copy
          </button>
          <button
            onClick={() => handleExport('json')}
            style={styles.actionButton}
            title="Exportar como JSON"
          >
            💾 Export
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Styles
 */
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#0f0f1a',
    borderRadius: '8px',
    overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  // ═══════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════
  header: {
    padding: '12px',
    backgroundColor: '#1a1a2e',
    borderBottom: '1px solid #2d2d44'
  },

  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px'
  },

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },

  headerRight: {
    display: 'flex',
    gap: '16px'
  },

  title: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#e5e7eb'
  },

  liveBadge: {
    padding: '2px 8px',
    backgroundColor: '#dc2626',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'white',
    animation: 'pulse 2s infinite'
  },

  stat: {
    fontSize: '12px',
    color: '#9ca3af'
  },

  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },

  viewModes: {
    display: 'flex',
    backgroundColor: '#111827',
    borderRadius: '6px',
    padding: '2px'
  },

  modeButton: {
    padding: '6px 12px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    color: '#9ca3af',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },

  modeButtonActive: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },

  searchContainer: {
    position: 'relative',
    flex: 1,
    minWidth: '150px'
  },

  searchInput: {
    width: '100%',
    padding: '6px 28px 6px 10px',
    fontSize: '12px',
    backgroundColor: '#111827',
    color: '#e5e7eb',
    border: '1px solid #374151',
    borderRadius: '6px',
    outline: 'none'
  },

  clearSearch: {
    position: 'absolute',
    right: '6px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: '#6b7280',
    fontSize: '14px',
    cursor: 'pointer'
  },

  filterToggle: {
    padding: '6px 12px',
    fontSize: '11px',
    backgroundColor: '#111827',
    color: '#9ca3af',
    border: '1px solid #374151',
    borderRadius: '6px',
    cursor: 'pointer'
  },

  filterToggleActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
    color: '#60a5fa'
  },

  filtersPanel: {
    marginTop: '10px',
    padding: '10px',
    backgroundColor: '#111827',
    borderRadius: '6px'
  },

  filterGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap'
  },

  filterLabel: {
    fontSize: '11px',
    color: '#9ca3af'
  },

  filterButton: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: 'transparent',
    border: '1px solid',
    borderRadius: '4px',
    cursor: 'pointer',
    color: '#e5e7eb',
    transition: 'all 0.15s ease'
  },

  // ═══════════════════════════════════════════════════════════════
  // EVENT LIST
  // ═══════════════════════════════════════════════════════════════
  eventList: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
    position: 'relative'
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6b7280',
    gap: '8px'
  },

  emptyIcon: {
    fontSize: '32px'
  },

  emptySubtext: {
    fontSize: '12px',
    color: '#4b5563'
  },

  scrollToBottom: {
    position: 'sticky',
    bottom: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '6px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    fontSize: '12px',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
  },

  // ═══════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#1a1a2e',
    borderTop: '1px solid #2d2d44'
  },

  statsBar: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px'
  },

  actions: {
    display: 'flex',
    gap: '8px'
  },

  actionButton: {
    padding: '4px 10px',
    fontSize: '11px',
    backgroundColor: '#374151',
    color: '#e5e7eb',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

// Add keyframes for pulse animation
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default EventLog;
