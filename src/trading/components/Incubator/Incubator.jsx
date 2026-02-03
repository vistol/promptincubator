/**
 * @fileoverview Incubator component - Main view for managing eggs
 * @module trading/components/Incubator/Incubator
 */

import React, { useState, useMemo } from 'react';
import { EggCard } from './EggCard.jsx';

/**
 * Tab filter options
 */
const FILTER_TABS = [
  { id: 'all', label: 'Todos', icon: '📋' },
  { id: 'live', label: 'En vivo', icon: '🔴' },
  { id: 'completed', label: 'Completados', icon: '✅' }
];

/**
 * Sort options
 */
const SORT_OPTIONS = [
  { id: 'newest', label: 'Más recientes' },
  { id: 'oldest', label: 'Más antiguos' },
  { id: 'trades', label: 'Más trades' },
  { id: 'ipe', label: 'Mayor IPE' }
];

/**
 * Incubator component
 * Displays and manages all eggs (trade generation sessions)
 *
 * @param {Object} props
 * @param {Array} props.eggs - Array of egg objects
 * @param {string} props.expandedEggId - ID of egg to expand by default
 * @param {Function} props.onEggClick - Callback when egg is clicked
 */
export function Incubator({
  eggs = [],
  expandedEggId,
  onEggClick
}) {
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // ═══════════════════════════════════════════════════════════════
  // FILTER & SORT EGGS
  // ═══════════════════════════════════════════════════════════════
  const filteredEggs = useMemo(() => {
    let result = [...eggs];

    // Apply filter
    if (activeFilter === 'live') {
      result = result.filter(egg => egg.status === 'incubating');
    } else if (activeFilter === 'completed') {
      result = result.filter(egg => egg.status === 'hatched' || egg.status === 'failed');
    }

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(egg =>
        egg.promptName?.toLowerCase().includes(query) ||
        egg.trades?.some(t => t.asset?.toLowerCase().includes(query))
      );
    }

    // Apply sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'trades':
          return (b.trades?.length || 0) - (a.trades?.length || 0);
        case 'ipe':
          const avgIpeA = a.trades?.length > 0
            ? a.trades.reduce((sum, t) => sum + (t.ipe || 0), 0) / a.trades.length
            : 0;
          const avgIpeB = b.trades?.length > 0
            ? b.trades.reduce((sum, t) => sum + (t.ipe || 0), 0) / b.trades.length
            : 0;
          return avgIpeB - avgIpeA;
        case 'newest':
        default:
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });

    return result;
  }, [eggs, activeFilter, sortBy, searchQuery]);

  // ═══════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════
  const stats = useMemo(() => {
    const totalTrades = eggs.reduce((sum, egg) => sum + (egg.trades?.length || 0), 0);
    const liveCount = eggs.filter(e => e.status === 'incubating').length;
    const completedCount = eggs.filter(e => e.status === 'hatched' || e.status === 'failed').length;

    return {
      total: eggs.length,
      live: liveCount,
      completed: completedCount,
      totalTrades
    };
  }, [eggs]);

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
          <h1 style={styles.title}>🥚 Incubator</h1>
          <div style={styles.statsBar}>
            <span style={styles.stat}>📊 {stats.total} eggs</span>
            <span style={styles.stat}>📈 {stats.totalTrades} trades</span>
            {stats.live > 0 && (
              <span style={{ ...styles.stat, color: '#22c55e' }}>
                🔴 {stats.live} en vivo
              </span>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={styles.filterTabs}>
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                ...styles.filterTab,
                ...(activeFilter === tab.id ? styles.filterTabActive : {})
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.id === 'all' && <span style={styles.tabCount}>{stats.total}</span>}
              {tab.id === 'live' && stats.live > 0 && (
                <span style={styles.tabCount}>{stats.live}</span>
              )}
              {tab.id === 'completed' && (
                <span style={styles.tabCount}>{stats.completed}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div style={styles.controls}>
          <div style={styles.searchContainer}>
            <input
              type="text"
              placeholder="🔍 Buscar por nombre o asset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={styles.sortSelect}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* EGG LIST */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div style={styles.eggList}>
        {filteredEggs.length === 0 ? (
          <div style={styles.emptyState}>
            {eggs.length === 0 ? (
              <>
                <span style={styles.emptyIcon}>🥚</span>
                <span style={styles.emptyTitle}>No hay eggs todavía</span>
                <span style={styles.emptySubtext}>
                  Genera trades para crear tu primer egg
                </span>
              </>
            ) : (
              <>
                <span style={styles.emptyIcon}>🔍</span>
                <span style={styles.emptyTitle}>No se encontraron eggs</span>
                <span style={styles.emptySubtext}>
                  Intenta cambiar los filtros o la búsqueda
                </span>
              </>
            )}
          </div>
        ) : (
          filteredEggs.map(egg => (
            <EggCard
              key={egg.id}
              egg={egg}
              isExpanded={egg.id === expandedEggId}
            />
          ))
        )}
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
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },

  // ═══════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════
  header: {
    padding: '20px',
    backgroundColor: '#1a1a2e',
    borderBottom: '1px solid #2d2d44'
  },

  headerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },

  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#f1f5f9'
  },

  statsBar: {
    display: 'flex',
    gap: '20px'
  },

  stat: {
    fontSize: '14px',
    color: '#9ca3af'
  },

  filterTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px'
  },

  filterTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    backgroundColor: '#111827',
    color: '#9ca3af',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.15s ease'
  },

  filterTabActive: {
    backgroundColor: '#3b82f6',
    color: 'white'
  },

  tabCount: {
    padding: '2px 8px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '10px',
    fontSize: '11px'
  },

  controls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },

  searchContainer: {
    flex: 1
  },

  searchInput: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '14px',
    backgroundColor: '#111827',
    color: '#e5e7eb',
    border: '1px solid #374151',
    borderRadius: '8px',
    outline: 'none'
  },

  sortSelect: {
    padding: '10px 14px',
    fontSize: '13px',
    backgroundColor: '#111827',
    color: '#e5e7eb',
    border: '1px solid #374151',
    borderRadius: '8px',
    cursor: 'pointer',
    outline: 'none'
  },

  // ═══════════════════════════════════════════════════════════════
  // EGG LIST
  // ═══════════════════════════════════════════════════════════════
  eggList: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px'
  },

  // ═══════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ═══════════════════════════════════════════════════════════════
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    gap: '12px'
  },

  emptyIcon: {
    fontSize: '48px'
  },

  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#e5e7eb'
  },

  emptySubtext: {
    fontSize: '14px',
    color: '#6b7280'
  }
};

export default Incubator;
