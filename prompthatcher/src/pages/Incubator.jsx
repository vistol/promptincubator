import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, Clock, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Activity, DollarSign, Zap, Cpu, Target, Hash, Radio, Filter, ArrowUpDown, Brain, MessageSquare, CheckCircle2, XCircle, Shield, Lightbulb, HelpCircle, ScrollText, Search, Play, Sparkles, AlertTriangle, CheckCheck } from 'lucide-react'
import useStore from '../store/useStore'
import Header from '../components/Header'
import EggIcon from '../components/EggIcon'
import MonitoringConsole from '../components/MonitoringConsole'

// Execution time labels
const EXECUTION_LABELS = {
  target: 'Target Based',
  scalping: 'Scalping',
  intraday: 'Intraday',
  swing: 'Swing'
}

// AI Model labels
const AI_MODEL_LABELS = {
  anthropic: { name: 'Claude', icon: '🧠' },
  google: { name: 'Gemini', icon: '🔮' },
  gemini: { name: 'Gemini', icon: '🔮' },
  openai: { name: 'GPT-4', icon: '🤖' },
  xai: { name: 'Grok', icon: '⚡' },
  grok: { name: 'Grok', icon: '⚡' }
}

export default function Incubator() {
  const eggs = useStore((state) => state.eggs) || []
  const signals = useStore((state) => state.signals) || []
  const prices = useStore((state) => state.prices) || {}
  const priceStatus = useStore((state) => state.priceStatus) || {}
  const healthChecks = useStore((state) => state.healthChecks) || []
  const activityLogs = useStore((state) => state.activityLogs) || []
  const navigateToEggId = useStore((state) => state.navigateToEggId)
  const clearNavigateToEggId = useStore((state) => state.clearNavigateToEggId)
  const [activeFilter, setActiveFilter] = useState('live')
  const [expandedEgg, setExpandedEgg] = useState(null)
  const eggRefs = useRef({})

  // Handle navigation from Prompts/HealthChecks - expand the correct egg
  useEffect(() => {
    if (navigateToEggId) {
      // Find if the egg exists and determine which filter to use
      const targetEgg = eggs.find(e => String(e.id) === String(navigateToEggId))
      if (targetEgg) {
        // Check if egg is completed (hatched or expired)
        const isExpired = targetEgg.expiresAt && new Date(targetEgg.expiresAt) <= new Date()
        const isCompleted = targetEgg.status === 'hatched' || (targetEgg.status === 'incubating' && isExpired)

        // Check if egg belongs to a health check
        const isFromHealthCheck = healthChecks.some(hc =>
          hc.prompts?.some(p => p.id === targetEgg.promptId)
        )

        // Switch to completed tab if the egg is completed
        if (isCompleted) {
          setActiveFilter('completed')
          // If it's a health check egg, also set the healthChecks filter
          if (isFromHealthCheck) {
            setFilterBy('healthChecks')
          }
        } else {
          setActiveFilter('live')
        }

        // Expand the egg
        setExpandedEgg(navigateToEggId)
      }
      // Clear the navigation state
      clearNavigateToEggId()
    }
  }, [navigateToEggId, eggs, healthChecks, clearNavigateToEggId])

  // Note: Auto-scroll removed to allow users to read egg content without interruption

  const [expandedConfig, setExpandedConfig] = useState({}) // Track expanded config per egg
  const [expandedTrades, setExpandedTrades] = useState({}) // Track expanded trades for minimal list design
  const [activeTab, setActiveTab] = useState({}) // Track active tab per egg: 'config', 'trades', 'ai'
  const [showConsole, setShowConsole] = useState(false)

  // Get active tab for an egg (default to 'trades')
  const getActiveTab = (eggId) => activeTab[eggId] || 'trades'

  // Set active tab for an egg
  const setEggTab = (eggId, tab) => {
    setActiveTab(prev => ({ ...prev, [eggId]: tab }))
  }
  const [sortBy, setSortBy] = useState('pnl') // 'pnl', 'recent', 'winRate', 'trades'
  const [filterBy, setFilterBy] = useState('all') // 'all', 'profitable', 'unprofitable', 'hatched', 'expired'

  // Sort options - PnL first (default)
  const sortOptions = [
    { id: 'pnl', label: 'PnL' },
    { id: 'recent', label: 'Reciente' },
    { id: 'winRate', label: 'Win Rate' },
    { id: 'trades', label: 'Trades' }
  ]

  // Filter options - shared between Live and Historial (Option A: Consistencia Total)
  const baseFilterOptions = [
    { id: 'all', label: 'Todos' },
    { id: 'healthChecks', label: 'Health Checks' },
    { id: 'profitable', label: 'En Verde' },
    { id: 'unprofitable', label: 'En Rojo' }
  ]

  // Additional filters only for Historial tab
  const historialOnlyFilters = [
    { id: 'hatched', label: 'Completados' },
    { id: 'expired', label: 'Expirados' }
  ]

  // Get filter options based on active tab
  const filterOptions = activeFilter === 'live'
    ? baseFilterOptions
    : [...baseFilterOptions, ...historialOnlyFilters]

  // Reset filter when switching tabs if current filter is not available
  useEffect(() => {
    const availableFilterIds = filterOptions.map(f => f.id)
    if (!availableFilterIds.includes(filterBy)) {
      setFilterBy('all')
    }
  }, [activeFilter])

  // Get all prompt IDs that belong to health checks
  const healthCheckPromptIds = useMemo(() => {
    const ids = new Set()
    healthChecks.forEach(hc => {
      if (hc.prompts?.length) {
        hc.prompts.forEach(p => ids.add(p.id))
      }
    })
    return ids
  }, [healthChecks])

  // Check if an egg belongs to a health check
  const isHealthCheckEgg = (egg) => healthCheckPromptIds.has(egg.promptId)

  // Toggle config expansion for an egg
  const toggleConfigExpand = (eggId) => {
    setExpandedConfig(prev => ({ ...prev, [eggId]: !prev[eggId] }))
  }

  // Toggle trade expansion for minimal list design
  const toggleTradeExpand = (tradeId) => {
    setExpandedTrades(prev => ({ ...prev, [tradeId]: !prev[tradeId] }))
  }

  // Check if egg is expired
  const isEggExpired = (egg) => egg.expiresAt && new Date(egg.expiresAt) <= new Date()

  // Get current price
  const getPrice = (asset) => prices[asset]?.price || null

  // Calculate unrealized PnL for a signal
  const getPnlForSort = (signal) => {
    const price = getPrice(signal.asset)
    if (!price || signal.status === 'closed') return signal.pnl || 0
    const entry = parseFloat(signal.entry)
    return signal.strategy === 'LONG'
      ? ((price - entry) / entry) * 100
      : ((entry - price) / entry) * 100
  }

  // Build prompt content display from egg data
  const getEggPromptContent = (egg) => {
    // If promptContent exists, use it
    if (egg.promptContent && egg.promptContent.trim() !== '') {
      return egg.promptContent
    }

    // Build fallback content from egg configuration
    const config = egg.config || {}
    const name = egg.promptName || 'Estrategia'

    return `Estrategia: ${name}

Configuración:
• Modo: ${config.mode || 'auto'}
• Ejecución: ${config.executionTime || 'target'}
• Capital: $${(config.capital || 1000).toLocaleString()}
• Apalancamiento: ${config.leverage || 5}x
• Objetivo: ${config.targetPct ? `+${config.targetPct}%` : 'N/A'}
• IPE Mínimo: ${config.minIpe || 80}%
• Modelo AI: ${config.aiModel || config.aiProvider || 'gemini'}`
  }

  // Calculate egg PnL for sorting (same as header display)
  const getEggPnlForSort = (egg) => {
    try {
      if (!egg?.trades || !Array.isArray(egg.trades)) return 0
      const eggSignals = signals.filter(s => egg.trades.includes(s.id))
      if (eggSignals.length === 0) return 0

      let totalPnl = 0
      eggSignals.forEach(signal => {
        totalPnl += getPnlForSort(signal) || 0
      })
      return totalPnl / eggSignals.length
    } catch (error) {
      console.error('Error calculating egg PnL:', error)
      return 0
    }
  }

  // Get egg results for filtering/sorting
  const getEggResults = (egg) => {
    try {
      // Defensive check for egg.trades
      if (!egg?.trades || !Array.isArray(egg.trades)) {
        return { totalPnl: 0, winRate: 0, totalTrades: 0 }
      }

      const eggSignals = signals.filter(s => egg.trades.includes(s.id))
      const closedSignals = eggSignals.filter(s => s.status === 'closed')
      const expired = isEggExpired(egg)
      const signalsForPnl = expired ? eggSignals : closedSignals

      if (signalsForPnl.length === 0) {
        return { totalPnl: 0, winRate: 0, totalTrades: eggSignals.length }
      }

      const pnlValues = signalsForPnl.map(s => {
        if (s.status === 'closed' && s.pnl !== undefined) return s.pnl
        const currentPrice = prices[s.asset]?.price
        if (!currentPrice) return 0
        const entry = parseFloat(s.entry) || 0
        if (entry === 0) return 0
        return s.strategy === 'LONG'
          ? ((currentPrice - entry) / entry) * 100
          : ((entry - currentPrice) / entry) * 100
      })

      const wins = pnlValues.filter(p => p > 0).length
      return {
        totalPnl: pnlValues.length > 0 ? pnlValues.reduce((sum, p) => sum + p, 0) / pnlValues.length : 0,
        winRate: signalsForPnl.length > 0 ? Math.round((wins / signalsForPnl.length) * 100) : 0,
        totalTrades: eggSignals.length
      }
    } catch (error) {
      console.error('Error calculating egg results:', error)
      return { totalPnl: 0, winRate: 0, totalTrades: 0 }
    }
  }

  // Filter eggs: Live (active & not expired) vs Completed (hatched or expired)
  // Option A: Consistencia Total - filters apply to both tabs
  const filteredEggs = useMemo(() => {
    try {
      // Ensure eggs is an array
      if (!Array.isArray(eggs)) return []

      return eggs
        .filter(e => {
          if (!e) return false
          const expired = isEggExpired(e)
          const results = getEggResults(e)

          if (activeFilter === 'live') {
            // First: must be live (incubating and not expired)
            if (!(e.status === 'incubating' && !expired)) return false

            // Then apply sub-filters (Option A)
            switch (filterBy) {
              case 'healthChecks':
                return healthCheckPromptIds.has(e.promptId)
              case 'profitable':
                return results.totalPnl >= 0
              case 'unprofitable':
                return results.totalPnl < 0
              default:
                return true
            }
          } else {
            // Completed tab shows: naturally hatched OR expired eggs
            const isCompleted = e.status === 'hatched' || (e.status === 'incubating' && expired)
            if (!isCompleted) return false

            // Apply sub-filter for completed tab
            switch (filterBy) {
              case 'healthChecks':
                return healthCheckPromptIds.has(e.promptId)
              case 'profitable':
                return results.totalPnl >= 0
              case 'unprofitable':
                return results.totalPnl < 0
              case 'hatched':
                return e.status === 'hatched'
              case 'expired':
                return e.status === 'incubating' && expired
              default:
                return true
            }
          }
        })
        .map(e => ({
          ...e,
          _results: getEggResults(e),
          _pnl: getEggPnlForSort(e) || 0 // Real-time PnL for sorting
        }))
        .sort((a, b) => {
          // Note: Expanded egg stays in place - no reordering on expand
          switch (sortBy) {
            case 'pnl':
              return (b._pnl || 0) - (a._pnl || 0)
            case 'winRate':
              return (b._results?.winRate || 0) - (a._results?.winRate || 0)
            case 'trades':
              return (b._results?.totalTrades || 0) - (a._results?.totalTrades || 0)
            case 'recent':
            default:
              return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
          }
        })
    } catch (error) {
      console.error('Error filtering eggs:', error)
      return []
    }
  // Note: 'prices' intentionally excluded from dependencies to keep list order stable
  // PnL display updates in real-time via getEggPnl, but sort order only changes when
  // eggs/signals/filters change, not on every price tick
  }, [eggs, signals, activeFilter, filterBy, sortBy, healthCheckPromptIds])

  // Get egg status info
  const getEggStatus = (egg) => {
    try {
      if (!egg?.trades || !Array.isArray(egg.trades)) {
        return { total: 0, closed: 0, active: 0, isExpired: false, progress: 0 }
      }
      const eggSignals = signals.filter(s => egg.trades.includes(s.id))
      const closedCount = eggSignals.filter(s => s.status === 'closed').length
      const isExpired = egg.expiresAt && new Date(egg.expiresAt) <= new Date()
      const activeCount = isExpired ? 0 : (eggSignals.length - closedCount)

      return {
        total: eggSignals.length,
        closed: closedCount,
        active: activeCount,
        isExpired,
        progress: eggSignals.length > 0 ? (closedCount / eggSignals.length) * 100 : 0
      }
    } catch (error) {
      console.error('Error in getEggStatus:', error)
      return { total: 0, closed: 0, active: 0, isExpired: false, progress: 0 }
    }
  }

  // Format time remaining
  const formatTime = (egg) => {
    if (!egg.expiresAt) return null
    const diff = new Date(egg.expiresAt) - new Date()
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h`
    return '<1h'
  }

  // Calculate unrealized PnL
  const getPnl = (signal) => {
    const price = getPrice(signal.asset)
    if (!price || signal.status === 'closed') return null
    const entry = parseFloat(signal.entry)
    return signal.strategy === 'LONG'
      ? ((price - entry) / entry) * 100
      : ((entry - price) / entry) * 100
  }

  // Calculate egg PnL (average of ALL trades - open and closed)
  const getEggPnl = (egg, status) => {
    if (status.isExpired) return null

    // Get ALL signals for this egg (both active and closed)
    const eggSignals = signals.filter(s => egg.trades.includes(s.id))
    if (eggSignals.length === 0) return null

    let totalPnl = 0
    let validCount = 0

    eggSignals.forEach(signal => {
      let pnl = null

      // For closed trades, use stored pnl
      if (signal.status === 'closed' && signal.pnl !== undefined) {
        pnl = signal.pnl
      } else {
        // For active trades, calculate real-time pnl
        pnl = getPnl(signal)
      }

      if (pnl !== null) {
        totalPnl += pnl
        validCount++
      }
    })

    // Return average PnL across all trades
    return validCount > 0 ? totalPnl / validCount : null
  }

  // CVD validation (simplified)
  const getCVD = (signal) => {
    const price = getPrice(signal.asset)
    if (!price) return null
    const delta = ((price - parseFloat(signal.entry)) / parseFloat(signal.entry)) * 100
    return signal.strategy === 'LONG' ? delta > -0.5 : delta < 0.5
  }

  // Calculate PnL percentage for a signal (handles both closed and active trades)
  const getSignalPnl = (signal) => {
    // If closed, use stored pnl
    if (signal.status === 'closed' && signal.pnl !== undefined) {
      return signal.pnl
    }
    // Calculate from current price (for active trades in expired eggs)
    const currentPrice = prices[signal.asset]?.price
    if (!currentPrice) return 0
    const entry = parseFloat(signal.entry)
    if (signal.strategy === 'LONG') {
      return ((currentPrice - entry) / entry) * 100
    } else {
      return ((entry - currentPrice) / entry) * 100
    }
  }

  // Calculate results for an egg (handles both closed and expired trades)
  const calculateEggResults = (egg) => {
    try {
      if (!egg?.trades || !Array.isArray(egg.trades)) {
        return {
          totalTrades: 0, closedTrades: 0, expiredTrades: 0,
          wins: 0, losses: 0, winRate: 0, totalPnl: 0, profitFactor: 0
        }
      }

      const eggSignals = signals.filter(s => egg.trades.includes(s.id))
      const closedSignals = eggSignals.filter(s => s.status === 'closed')
      const activeSignals = eggSignals.filter(s => s.status === 'active')

      // For expired eggs, treat active trades as "expired" with their unrealized PnL
      const expired = isEggExpired(egg)

      // All signals to consider for PnL calculation
      const signalsForPnl = expired ? eggSignals : closedSignals

      if (signalsForPnl.length === 0) {
        return {
          totalTrades: eggSignals.length,
          closedTrades: closedSignals.length,
          expiredTrades: expired ? activeSignals.length : 0,
          wins: 0, losses: 0, winRate: 0, totalPnl: 0, profitFactor: 0
        }
      }

      // Calculate PnL for all relevant signals
      const pnlValues = signalsForPnl.map(s => getSignalPnl(s) || 0)
      const avgPnl = pnlValues.length > 0 ? pnlValues.reduce((sum, p) => sum + p, 0) / pnlValues.length : 0

      // Count wins/losses based on PnL
      const wins = pnlValues.filter(p => p > 0).length
      const losses = pnlValues.filter(p => p < 0).length

      // Profit factor
      const grossProfit = pnlValues.filter(p => p > 0).reduce((sum, p) => sum + p, 0)
      const grossLoss = Math.abs(pnlValues.filter(p => p < 0).reduce((sum, p) => sum + p, 0))

      return {
        totalTrades: eggSignals.length,
        closedTrades: closedSignals.length,
        expiredTrades: expired ? activeSignals.length : 0,
        wins,
        losses,
        winRate: signalsForPnl.length > 0 ? Math.round((wins / signalsForPnl.length) * 100) : 0,
        totalPnl: avgPnl,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0)
      }
    } catch (error) {
      console.error('Error in calculateEggResults:', error)
      return {
        totalTrades: 0, closedTrades: 0, expiredTrades: 0,
        wins: 0, losses: 0, winRate: 0, totalPnl: 0, profitFactor: 0
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-4"
    >
      <Header
        title="Incubator"
        subtitle={`${filteredEggs.length} ${activeFilter === 'live' ? 'active' : 'completed'}`}
      />

      {/* Filter Tabs - Full Width */}
      <div className="px-4 py-3">
        <div className="flex gap-2 w-full">
          <button
            onClick={() => setActiveFilter('live')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeFilter === 'live'
                ? 'bg-accent-cyan text-quant-bg'
                : 'bg-quant-surface text-gray-400 border border-quant-border'
            }`}
          >
            <Radio size={16} />
            Live
          </button>
          <button
            onClick={() => setActiveFilter('completed')}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              activeFilter === 'completed'
                ? 'bg-accent-green text-quant-bg'
                : 'bg-quant-surface text-gray-400 border border-quant-border'
            }`}
          >
            <Archive size={16} />
            Historial
          </button>
        </div>
        {/* Console Toggle - Below tabs */}
        <button
          onClick={() => setShowConsole(!showConsole)}
          className={`w-full mt-2 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
            showConsole
              ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
              : 'bg-quant-surface/50 text-gray-500 border border-transparent'
          }`}
        >
          <Activity size={12} />
          {showConsole ? 'Ocultar Consola' : 'Mostrar Consola'}
        </button>
      </div>

      {/* Collapsible Console */}
      <AnimatePresence>
        {showConsole && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-3 overflow-hidden"
          >
            <MonitoringConsole />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter & Sort Options */}
      <div className="px-4 pb-3 space-y-2">
        {/* Filter (available in both tabs - Option A: Consistencia Total) */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <Filter size={14} className="text-gray-500 shrink-0" />
          {filterOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setFilterBy(option.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                filterBy === option.id
                  ? 'bg-accent-cyan/20 text-accent-cyan'
                  : 'bg-quant-surface text-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
          <ArrowUpDown size={14} className="text-gray-500 shrink-0" />
          {sortOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setSortBy(option.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                sortBy === option.id
                  ? 'bg-accent-purple/20 text-accent-purple'
                  : 'bg-quant-surface text-gray-400'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Eggs List */}
      <div className="px-4 space-y-3">
        {filteredEggs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-quant-surface flex items-center justify-center">
              <EggIcon size={48} status={activeFilter === 'live' ? 'incubating' : 'hatched'} />
            </div>
            <p className="text-gray-400 mb-1">No {activeFilter === 'live' ? 'live' : 'completed'} eggs</p>
            <p className="text-sm text-gray-500">
              {activeFilter === 'live' ? 'Create a prompt to start incubating' : 'Completed eggs appear here'}
            </p>
          </div>
        ) : (
            filteredEggs.map((egg, index) => {
              const status = getEggStatus(egg)
              const eggSignals = signals.filter(s => egg.trades.includes(s.id))
              const isExpanded = expandedEgg && String(expandedEgg) === String(egg.id)
              const isExpiredEgg = isEggExpired(egg)
              const isCompleted = egg.status === 'hatched' || isExpiredEgg
              const pnl = !isCompleted ? getEggPnl(egg, status) : null
              const timeLeft = formatTime(egg)

              // Calculate results for completed eggs (hatched or expired)
              const results = isCompleted
                ? (egg.results || calculateEggResults(egg))
                : null

              return (
                <div
                  key={egg.id}
                  ref={(el) => eggRefs.current[egg.id] = el}
                  className={`bg-quant-card rounded-2xl overflow-hidden border ${
                    isExpanded
                      ? 'border-accent-cyan shadow-[0_0_20px_rgba(0,255,255,0.3)] ring-1 ring-accent-cyan/50'
                      : isExpiredEgg
                        ? 'border-accent-orange/30'
                        : egg.status === 'hatched'
                          ? 'border-accent-green/30'
                          : 'border-quant-border'
                  }`}
                  style={{
                    scrollMarginTop: '80px' // Account for header when scrolling
                  }}
                >
                  {/* Card Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedEgg(isExpanded ? null : egg.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Egg Icon with status indicator */}
                      <div className="relative flex-shrink-0">
                        <EggIcon
                          size={52}
                          status={isExpiredEgg ? 'expired' : egg.status}
                          winRate={results?.winRate || 0}
                        />
                        {!isCompleted && status.active > 0 && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-accent-green rounded-full border-2 border-quant-card animate-pulse" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-white truncate text-base">{egg.promptName}</h3>
                          {pnl !== null && pnl !== undefined && !isNaN(pnl) && (
                            <span className={`text-lg font-mono font-bold flex-shrink-0 ${
                              pnl >= 0 ? 'text-accent-green' : 'text-accent-red'
                            }`}>
                              {pnl >= 0 ? '+' : ''}{(pnl || 0).toFixed(2)}%
                            </span>
                          )}
                        </div>

                        {/* Status row - single line */}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          {isCompleted ? (
                            // Completed egg status
                            <span className={isExpiredEgg ? 'text-accent-orange' : 'text-accent-green'}>
                              {isExpiredEgg ? '⏱ Expired' : '✓ Hatched'}
                              <span className="text-gray-500 mx-1">·</span>
                              <span className="text-gray-400">{results?.closedTrades || status.closed}/{status.total} closed</span>
                            </span>
                          ) : (
                            // Active egg status
                            <span className="text-accent-cyan">
                              {status.active} open
                              <span className="text-gray-500 mx-1">·</span>
                              <span className="text-gray-400">{status.closed}/{status.total} closed</span>
                            </span>
                          )}

                          {/* Time - only show for active eggs */}
                          {!isCompleted && timeLeft && (
                            <>
                              <span className="text-gray-600">|</span>
                              <span className="flex items-center gap-1">
                                <Clock size={11} />
                                {timeLeft}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Progress bar - minimal */}
                        {!isCompleted && (
                          <div className="mt-3 h-1.5 bg-quant-surface rounded-full overflow-hidden">
                            <div
                              style={{ width: `${status.progress}%` }}
                              className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-green"
                            />
                          </div>
                        )}
                      </div>

                      {/* Expand indicator */}
                      <div className="flex-shrink-0 text-gray-500">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>

                    {/* Results for completed eggs (hatched or expired) */}
                    {isCompleted && results && (
                      <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-quant-border">
                        {[
                          { label: 'Closed', value: `${results.closedTrades || 0}/${results.totalTrades || 0}`, color: 'text-white' },
                          { label: 'Win Rate', value: `${results.winRate || 0}%`, color: (results.winRate || 0) >= 50 ? 'text-accent-green' : 'text-accent-red' },
                          { label: 'PF', value: results.profitFactor === Infinity ? '∞' : (results.profitFactor || 0).toFixed(1), color: (results.profitFactor || 0) >= 1 ? 'text-accent-green' : 'text-accent-red' },
                          { label: 'PnL', value: `${(results.totalPnl || 0) >= 0 ? '+' : ''}${(results.totalPnl || 0).toFixed(1)}%`, color: (results.totalPnl || 0) >= 0 ? 'text-accent-green' : 'text-accent-red' }
                        ].map(stat => (
                          <div key={stat.label} className="text-center">
                            <span className="text-[10px] text-gray-500 uppercase block">{stat.label}</span>
                            <span className={`text-sm font-mono ${stat.color}`}>{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-quant-border">
                      <div className="bg-quant-surface/20">
                          {/* Tab Navigation */}
                          <div className="flex border-b border-quant-border">
                            {[
                              { id: 'trades', label: 'Trades', icon: TrendingUp },
                              { id: 'config', label: 'Config', icon: DollarSign },
                              { id: 'ai', label: 'AI Reasoning', icon: Brain },
                              { id: 'log', label: 'LOG', icon: ScrollText }
                            ].map(tab => (
                              <button
                                key={tab.id}
                                onClick={() => setEggTab(egg.id, tab.id)}
                                className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                                  getActiveTab(egg.id) === tab.id
                                    ? 'text-accent-cyan border-b-2 border-accent-cyan bg-accent-cyan/5'
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                              >
                                <tab.icon size={14} />
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          <div className="p-3 space-y-4">
                          {/* Configuration Section - Show when config tab active */}
                          {getActiveTab(egg.id) === 'config' && (() => {
                            // Create fallback config for old eggs without config
                            const baseConfig = egg.config || {
                              capital: egg.totalCapital || 1000,
                              leverage: 5,
                              executionTime: egg.executionTime || 'target',
                              aiModel: 'gemini',
                              minIpe: 80,
                              numResults: eggSignals.length,
                              targetPct: null
                            }

                            // Calculate target % from trade data if not stored
                            let effectiveTargetPct = baseConfig.targetPct
                            if (!effectiveTargetPct && eggSignals.length > 0) {
                              const firstSignal = eggSignals[0]
                              const rewardPct = parseFloat(firstSignal.rewardPercent) || 0
                              const lev = firstSignal.leverage || baseConfig.leverage || 5
                              effectiveTargetPct = Math.round(rewardPct * lev)
                            }

                            const config = { ...baseConfig, targetPct: effectiveTargetPct }
                            const potentialGain = config.targetPct ? (config.capital * config.targetPct / 100) : 0
                            const finalAmount = config.capital + potentialGain
                            const priceMove = config.targetPct ? (config.targetPct / config.leverage) : 0
                            const isConfigExpanded = expandedConfig[egg.id]

                            return (
                            <div className="bg-quant-card rounded-xl border border-quant-border overflow-hidden">
                              {/* Collapsed Header - Always visible */}
                              <button
                                onClick={() => toggleConfigExpand(egg.id)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-quant-surface/50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <DollarSign size={16} className="text-accent-cyan" />
                                  <span className="font-mono text-white font-medium">
                                    ${config.capital.toLocaleString()}
                                  </span>
                                  <span className="text-gray-500">→</span>
                                  <span className="font-mono text-accent-green font-medium">
                                    ${finalAmount.toLocaleString()}
                                  </span>
                                  {config.targetPct > 0 && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green font-medium">
                                      +{config.targetPct}%
                                    </span>
                                  )}
                                </div>
                                <ChevronDown
                                  size={18}
                                  className={`text-gray-500 transition-transform ${isConfigExpanded ? 'rotate-180' : ''}`}
                                />
                              </button>

                              {/* Expanded Content */}
                              {isConfigExpanded && (
                                <div className="px-4 pb-4 pt-2 border-t border-quant-border">
                                  {/* Explanation */}
                                  {config.targetPct > 0 && (
                                    <div className="text-center text-sm text-gray-400 mb-3">
                                      Con <span className="text-white font-medium">{config.leverage || 1}x</span> leverage,
                                      solo necesitas <span className="text-accent-cyan font-medium">{(priceMove || 0).toFixed(1)}%</span> de movimiento
                                    </div>
                                  )}

                                  {/* Config Pills Row */}
                                  <div className="flex items-center justify-center gap-3 text-[10px] text-gray-500">
                                    <span>{EXECUTION_LABELS[config.executionTime] || config.executionTime}</span>
                                    <span>•</span>
                                    <span>{AI_MODEL_LABELS[config.aiModel]?.icon} {AI_MODEL_LABELS[config.aiModel]?.name || config.aiModel}</span>
                                    <span>•</span>
                                    <span>IPE {config.minIpe}%</span>
                                    <span>•</span>
                                    <span>{config.numResults} trade{config.numResults !== 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )})()}

                          {/* Trades Section - Show when trades tab active */}
                          {/* DESIGN: Grouped by Active/Closed with headers */}
                          {getActiveTab(egg.id) === 'trades' && (
                          <div>
                            {(() => {
                              // Format currency in English format: +$3,000.00 or -$30.00
                              const formatCurrency = (amount) => {
                                const sign = amount >= 0 ? '+' : '-'
                                const absAmount = Math.abs(amount)
                                return `${sign}$${absAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              }

                              // Separate trades into active and closed
                              const activeTrades = eggSignals.filter(s => s.status !== 'closed')
                              const closedTrades = eggSignals.filter(s => s.status === 'closed')

                              // Render a single trade row
                              const renderTradeRow = (signal, idx, isFirstInGroup) => {
                                const isLong = signal.strategy === 'LONG'
                                const isClosed = signal.status === 'closed'
                                const price = getPrice(signal.asset)
                                const unrealizedPnl = getPnl(signal)
                                const isTradeExpanded = expandedTrades[signal.id]

                                // Calculate PnL values
                                const entry = parseFloat(signal.entry)
                                const tp = parseFloat(signal.takeProfit)
                                const sl = parseFloat(signal.stopLoss)
                                const lev = signal.leverage || egg.config?.leverage || 5
                                const totalCap = egg.config?.capital || signal.capital || 1000
                                const numTrades = eggSignals.length || 1
                                const cap = signal.capital || (totalCap / numTrades)

                                const tpMovePct = isLong ? ((tp - entry) / entry) * 100 : ((entry - tp) / entry) * 100
                                const slMovePct = isLong ? ((entry - sl) / entry) * 100 : ((sl - entry) / entry) * 100
                                const potentialProfit = (tpMovePct / 100) * lev * cap
                                const potentialLoss = (slMovePct / 100) * lev * cap

                                const currentPnlPct = isClosed ? (signal.pnl || 0) : (unrealizedPnl || 0)
                                const currentPnlDollar = (currentPnlPct / 100) * lev * cap
                                const isProfit = currentPnlPct >= 0

                                const statusColor = isClosed
                                  ? (signal.result === 'win' ? 'bg-accent-green' : 'bg-accent-red')
                                  : (isProfit ? 'bg-accent-green' : 'bg-accent-red')

                                return (
                                  <div key={signal.id}>
                                    {/* COLLAPSED STATE: Minimal List Row */}
                                    <div
                                      onClick={() => toggleTradeExpand(signal.id)}
                                      className={`flex items-center cursor-pointer transition-colors hover:bg-quant-surface/50 ${
                                        !isFirstInGroup ? 'border-t border-quant-border/50' : ''
                                      } ${isTradeExpanded ? 'bg-quant-surface/30' : ''} ${isClosed ? 'opacity-60' : ''}`}
                                    >
                                      {/* Color bar indicator */}
                                      <div className={`w-1 self-stretch ${statusColor}`} />

                                      {/* Asset with direction */}
                                      <div className="flex items-center gap-1.5 py-2.5 px-3 min-w-[80px]">
                                        {isLong ? (
                                          <TrendingUp size={12} className="text-accent-green" />
                                        ) : (
                                          <TrendingDown size={12} className="text-accent-red" />
                                        )}
                                        <span className={`font-medium text-sm ${isClosed ? 'text-gray-400' : 'text-white'}`}>
                                          {signal.asset?.replace('/USDT', '')}
                                        </span>
                                      </div>

                                      {/* Entry → Current/Exit */}
                                      <div className="flex-1 py-2.5 px-2 font-mono text-xs">
                                        <span className="text-gray-500">{entry.toFixed(2)}</span>
                                        <span className="text-gray-600 mx-1">→</span>
                                        <span className={isClosed ? 'text-gray-400' : 'text-white'}>
                                          {isClosed ? (signal.exitPrice || entry).toFixed(2) : (price || entry).toFixed(2)}
                                        </span>
                                      </div>

                                      {/* PnL in $ for active, WIN/LOSS badge for closed */}
                                      {isClosed ? (
                                        <div className={`py-2.5 px-2 text-xs font-bold min-w-[70px] text-right flex items-center justify-end gap-1 ${
                                          signal.result === 'win' ? 'text-accent-green' : 'text-accent-red'
                                        }`}>
                                          {signal.result === 'win' ? (
                                            <>WIN <CheckCircle2 size={12} /></>
                                          ) : (
                                            <>LOSS <XCircle size={12} /></>
                                          )}
                                        </div>
                                      ) : (
                                        <div className={`py-2.5 px-2 font-mono text-sm font-bold min-w-[85px] text-right ${
                                          isProfit ? 'text-accent-green' : 'text-accent-red'
                                        }`}>
                                          {formatCurrency(currentPnlDollar)}
                                        </div>
                                      )}

                                      {/* PnL in % */}
                                      <div className={`py-2.5 px-3 font-mono text-xs min-w-[65px] text-right ${
                                        isProfit ? 'text-accent-green' : 'text-accent-red'
                                      }`}>
                                        {currentPnlPct >= 0 ? '+' : ''}{currentPnlPct.toFixed(2)}%
                                      </div>
                                    </div>

                                    {/* EXPANDED STATE: PnL-First Design */}
                                    {isTradeExpanded && (
                                      <div className="border-t border-quant-border/30">
                                          <div className="p-3 bg-quant-surface/20">
                                            {/* PnL Dominant Display */}
                                            <div className="flex items-center justify-between mb-3">
                                              <div className={`text-2xl font-bold font-mono ${isProfit ? 'text-accent-green' : 'text-accent-red'}`}>
                                                {formatCurrency(currentPnlDollar)}
                                                <span className="text-sm ml-2 opacity-70">
                                                  ({currentPnlPct >= 0 ? '+' : ''}{currentPnlPct.toFixed(2)}%)
                                                </span>
                                              </div>
                                              {isClosed && (
                                                <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                                                  signal.result === 'win'
                                                    ? 'bg-accent-green/20 text-accent-green'
                                                    : 'bg-accent-red/20 text-accent-red'
                                                }`}>
                                                  {signal.result === 'win' ? <><CheckCircle2 size={12} /> WIN</> : <><XCircle size={12} /> LOSS</>}
                                                </span>
                                              )}
                                            </div>

                                            {/* Progress Bar (only for active trades) */}
                                            {!isClosed && price && !status.isExpired && (
                                              <div className="mb-3">
                                                {(() => {
                                                  const range = tp - sl
                                                  const progressRaw = ((price - sl) / range) * 100
                                                  const entryRaw = ((entry - sl) / range) * 100
                                                  const progress = Math.max(0, Math.min(100, isLong ? progressRaw : (100 - progressRaw)))
                                                  const entryPos = Math.max(0, Math.min(100, isLong ? entryRaw : (100 - entryRaw)))
                                                  const isProfitBar = isLong ? (price > entry) : (price < entry)

                                                  return (
                                                    <div className="h-2 bg-quant-bg rounded-full relative">
                                                      <div
                                                        className="absolute top-0 bottom-0 w-0.5 bg-white z-10"
                                                        style={{ left: `${entryPos}%` }}
                                                      />
                                                      <div
                                                        style={{ width: `${progress}%` }}
                                                        className={`h-full rounded-full ${isProfitBar ? 'bg-accent-green' : 'bg-accent-red'}`}
                                                      />
                                                      <div className="absolute -bottom-4 left-0 text-[9px] text-accent-red font-mono">SL</div>
                                                      <div className="absolute -bottom-4 right-0 text-[9px] text-accent-green font-mono">TP</div>
                                                    </div>
                                                  )
                                                })()}
                                              </div>
                                            )}

                                            {/* Price Levels - Chips style */}
                                            <div className="flex items-center gap-2 mb-3 mt-4 flex-wrap">
                                              <span className="text-xs px-2 py-1 rounded-lg bg-quant-bg text-gray-400 font-mono">
                                                E {entry.toFixed(2)}
                                              </span>
                                              {!isClosed && price && (
                                                <span className="text-xs px-2 py-1 rounded-lg bg-accent-cyan/10 text-accent-cyan font-mono">
                                                  Now {price.toFixed(2)}
                                                </span>
                                              )}
                                              {isClosed && signal.exitPrice && (
                                                <span className="text-xs px-2 py-1 rounded-lg bg-gray-500/10 text-gray-400 font-mono">
                                                  Exit {parseFloat(signal.exitPrice).toFixed(2)}
                                                </span>
                                              )}
                                              <span className="text-xs px-2 py-1 rounded-lg bg-accent-green/10 text-accent-green font-mono">
                                                TP {tp.toFixed(2)}
                                              </span>
                                              <span className="text-xs px-2 py-1 rounded-lg bg-accent-red/10 text-accent-red font-mono">
                                                SL {sl.toFixed(2)}
                                              </span>
                                            </div>

                                            {/* Potential Profit/Loss (only for active trades) */}
                                            {!isClosed && (
                                              <div className="flex items-center justify-between p-2 rounded-lg bg-quant-bg">
                                                <div>
                                                  <div className="text-[10px] text-gray-500 mb-0.5">si gana</div>
                                                  <div className="text-accent-green font-bold font-mono">
                                                    {formatCurrency(potentialProfit)}
                                                    <span className="text-xs opacity-70 ml-1">(+{(tpMovePct * lev).toFixed(0)}%)</span>
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="text-[10px] text-gray-500 mb-0.5">si pierde</div>
                                                  <div className="text-accent-red font-bold font-mono">
                                                    {formatCurrency(-potentialLoss)}
                                                    <span className="text-xs opacity-70 ml-1">(-{(slMovePct * lev).toFixed(0)}%)</span>
                                                  </div>
                                                </div>
                                              </div>
                                            )}

                                            {/* Capital info */}
                                            <div className="text-[10px] text-gray-500 text-center mt-2">
                                              {formatCurrency(cap).replace('+', '')} × {lev}x leverage
                                            </div>
                                          </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              }

                              return (
                                <div className="space-y-3">
                                  {/* ACTIVE TRADES SECTION */}
                                  {activeTrades.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green"></span>
                                        </span>
                                        <span className="text-[10px] text-accent-green uppercase tracking-wider font-medium">
                                          Activos ({activeTrades.length})
                                        </span>
                                      </div>
                                      <div className="rounded-xl overflow-hidden border border-accent-green/30 bg-accent-green/5">
                                        {activeTrades.map((signal, idx) => renderTradeRow(signal, idx, idx === 0))}
                                      </div>
                                    </div>
                                  )}

                                  {/* CLOSED TRADES SECTION */}
                                  {closedTrades.length > 0 && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gray-500"></span>
                                        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                                          Cerrados ({closedTrades.length})
                                        </span>
                                      </div>
                                      <div className="rounded-xl overflow-hidden border border-quant-border">
                                        {closedTrades.map((signal, idx) => renderTradeRow(signal, idx, idx === 0))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Empty state */}
                                  {eggSignals.length === 0 && (
                                    <div className="text-center text-gray-500 py-8">
                                      No hay trades en este egg
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                          )}

                          {/* AI Reasoning Section - Show when ai tab active */}
                          {getActiveTab(egg.id) === 'ai' && (
                            <div className="space-y-4">
                              {/* User's Prompt Strategy */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <MessageSquare size={14} className="text-accent-purple" />
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tu Estrategia de Trading</span>
                                </div>
                                <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                  <p className="text-sm text-gray-300 whitespace-pre-wrap">
                                    {getEggPromptContent(egg)}
                                  </p>
                                </div>
                              </div>

                              {/* Configuration Summary - Always show with fallback values */}
                              <div className="flex flex-wrap gap-2">
                                <span className="text-xs px-2 py-1 rounded-full bg-accent-cyan/10 text-accent-cyan">
                                  ${(egg.config?.capital || egg.totalCapital || 1000).toLocaleString()} capital
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-accent-purple/10 text-accent-purple">
                                  {egg.config?.leverage || 5}x leverage
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-accent-green/10 text-accent-green">
                                  +{egg.config?.targetPct || 10}% objetivo
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-quant-surface text-gray-400">
                                  {AI_MODEL_LABELS[egg.config?.aiProvider || egg.config?.aiModel]?.icon || '🤖'} {AI_MODEL_LABELS[egg.config?.aiProvider || egg.config?.aiModel]?.name || 'AI'}
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-quant-surface text-gray-400">
                                  IPE ≥{egg.config?.minIpe || 80}%
                                </span>
                                <span className="text-xs px-2 py-1 rounded-full bg-quant-surface text-gray-400">
                                  {egg.config?.mode || 'auto'}
                                </span>
                              </div>

                              {/* Full AI Prompt - Always show section, with fallback message */}
                              <div>
                                <button
                                  onClick={() => toggleConfigExpand(`prompt-${egg.id}`)}
                                  className="flex items-center gap-2 mb-2 w-full"
                                >
                                  <Cpu size={14} className="text-accent-orange" />
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Prompt Enviado al AI</span>
                                  {expandedConfig[`prompt-${egg.id}`] ? (
                                    <ChevronUp size={14} className="text-gray-500 ml-auto" />
                                  ) : (
                                    <ChevronDown size={14} className="text-gray-500 ml-auto" />
                                  )}
                                </button>
                                {expandedConfig[`prompt-${egg.id}`] && (
                                  <div className="bg-quant-bg rounded-xl p-3 border border-accent-orange/20 max-h-96 overflow-y-auto">
                                    {egg.fullAIPrompt ? (
                                      <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono">
                                        {egg.fullAIPrompt}
                                      </pre>
                                    ) : (
                                      <div className="text-center py-4">
                                        <Cpu size={24} className="text-gray-600 mx-auto mb-2" />
                                        <p className="text-xs text-gray-500">
                                          El prompt original no fue capturado para este egg.
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">
                                          Los nuevos eggs incluirán el prompt completo.
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* AI Reasoning per Trade - Glass Box Trading */}
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <Brain size={14} className="text-accent-cyan" />
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                    Glass Box: Transparencia Total ({eggSignals.length} trades)
                                  </span>
                                </div>
                                <div className="space-y-3">
                                  {eggSignals.map((signal, idx) => (
                                    <div key={signal.id} className="bg-quant-card rounded-xl border border-quant-border overflow-hidden">
                                      {/* Trade Header */}
                                      <div className="p-3 border-b border-quant-border bg-quant-surface/50">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                            signal.strategy === 'LONG'
                                              ? 'bg-accent-green/20 text-accent-green'
                                              : 'bg-accent-red/20 text-accent-red'
                                          }`}>
                                            {signal.strategy}
                                          </span>
                                          <span className="font-medium text-white">{signal.asset}</span>
                                          <span className="ml-auto text-xs text-gray-500">IPE: {signal.ipe}%</span>
                                        </div>

                                        {/* One-line Summary */}
                                        <div className="flex items-start gap-2 mt-2 p-2 bg-quant-bg/50 rounded-lg">
                                          <Lightbulb size={12} className="text-accent-yellow shrink-0 mt-0.5" />
                                          <p className="text-xs text-gray-300">
                                            {signal.summary || signal.explanation || 'Trade generado según tu estrategia'}
                                          </p>
                                        </div>

                                        <div className="grid grid-cols-4 gap-2 text-xs mt-2">
                                          <div>
                                            <span className="text-gray-500">Entry</span>
                                            <span className="text-white font-mono ml-1">${signal.entry}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">TP</span>
                                            <span className="text-accent-green font-mono ml-1">${signal.takeProfit}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">SL</span>
                                            <span className="text-accent-red font-mono ml-1">${signal.stopLoss}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">R:R</span>
                                            <span className="text-white font-mono ml-1">1:{signal.riskRewardRatio || '2.0'}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Decision Breakdown */}
                                      <div className="p-3 space-y-3">
                                        {/* Why Questions */}
                                        {signal.reasoning && (
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider">
                                              <HelpCircle size={10} />
                                              Desglose de Decisión
                                            </div>
                                            <div className="grid gap-2">
                                              <div className="p-2 bg-quant-bg/30 rounded-lg">
                                                <span className="text-[10px] text-accent-cyan block mb-0.5">¿Por qué {signal.asset}?</span>
                                                <p className="text-xs text-gray-300">{signal.reasoning.whyAsset}</p>
                                              </div>
                                              <div className="p-2 bg-quant-bg/30 rounded-lg">
                                                <span className="text-[10px] text-accent-cyan block mb-0.5">¿Por qué {signal.strategy}?</span>
                                                <p className="text-xs text-gray-300">{signal.reasoning.whyDirection}</p>
                                              </div>
                                              <div className="p-2 bg-quant-bg/30 rounded-lg">
                                                <span className="text-[10px] text-accent-cyan block mb-0.5">¿Por qué Entry ${signal.entry}?</span>
                                                <p className="text-xs text-gray-300">{signal.reasoning.whyEntry}</p>
                                              </div>
                                              <div className="p-2 bg-quant-bg/30 rounded-lg">
                                                <span className="text-[10px] text-accent-cyan block mb-0.5">¿Por qué estos TP/SL?</span>
                                                <p className="text-xs text-gray-300">{signal.reasoning.whyLevels}</p>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Criteria Matched */}
                                        {signal.criteriaMatched && signal.criteriaMatched.length > 0 && (
                                          <div>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                                              <CheckCircle2 size={10} />
                                              Criterios de Estrategia
                                            </div>
                                            <div className="space-y-1">
                                              {signal.criteriaMatched.map((c, i) => (
                                                <div key={i} className="flex items-center justify-between p-1.5 bg-quant-bg/30 rounded">
                                                  <div className="flex items-center gap-1.5">
                                                    {c.passed ? (
                                                      <CheckCircle2 size={10} className="text-accent-green" />
                                                    ) : (
                                                      <XCircle size={10} className="text-accent-red" />
                                                    )}
                                                    <span className="text-xs text-gray-300">{c.criterion}</span>
                                                  </div>
                                                  <span className={`text-xs font-mono ${c.passed ? 'text-accent-green' : 'text-accent-red'}`}>
                                                    {c.value}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Confidence Factors */}
                                        {signal.confidenceFactors && signal.confidenceFactors.length > 0 && (
                                          <div>
                                            <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                                              <Shield size={10} />
                                              IPE {signal.ipe}% Breakdown
                                            </div>
                                            <div className="space-y-1.5">
                                              {signal.confidenceFactors.map((f, i) => (
                                                <div key={i}>
                                                  <div className="flex items-center justify-between text-xs mb-0.5">
                                                    <span className="text-gray-400">{f.factor}</span>
                                                    <span className="font-mono text-accent-cyan">
                                                      +{(f.contribution || (f.weight * f.score / 100)).toFixed(1)}%
                                                    </span>
                                                  </div>
                                                  <div className="h-1 bg-quant-bg rounded-full overflow-hidden">
                                                    <div
                                                      className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple"
                                                      style={{ width: `${f.score}%` }}
                                                    />
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Legacy fallback for old trades */}
                                        {!signal.reasoning && (
                                          <div className="text-sm text-gray-400">
                                            {signal.aiReasoning || signal.explanation || 'Datos de transparencia no disponibles para trades antiguos.'}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Metadata */}
                              <div className="flex items-center justify-center gap-4 text-[10px] text-gray-500 pt-2">
                                <span>Generado: {new Date(egg.createdAt).toLocaleString()}</span>
                                <span>•</span>
                                <span>{AI_MODEL_LABELS[egg.config?.aiModel]?.name || 'AI'}</span>
                                <span>•</span>
                                <span>{eggSignals.length} trades</span>
                              </div>
                            </div>
                          )}

                          {/* LOG Tab - Event streaming log */}
                          {getActiveTab(egg.id) === 'log' && (() => {
                            // Filter logs related to this egg
                            const eggLogs = activityLogs.filter(log => {
                              // Match by eggId in data
                              if (log.data?.eggId === egg.id) return true
                              // Match by eggName in data
                              if (log.data?.eggName === egg.promptName) return true
                              // Match AI generation logs by prompt name in message
                              if (log.type === 'ai' && log.message?.includes(egg.promptName)) return true
                              // Match trade logs for this egg's signals
                              if (log.type === 'trade' && log.data?.asset) {
                                const signalAssets = eggSignals.map(s => s.asset?.replace('/USDT', ''))
                                return signalAssets.some(a => log.message?.includes(a))
                              }
                              return false
                            }).slice(0, 50) // Limit to 50 most recent

                            // Log type icons and colors
                            const LOG_STYLES = {
                              ai: { icon: Sparkles, color: 'text-accent-purple', bg: 'bg-accent-purple/10' },
                              trade: { icon: TrendingUp, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
                              egg: { icon: Target, color: 'text-accent-green', bg: 'bg-accent-green/10' },
                              price: { icon: DollarSign, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
                              system: { icon: Cpu, color: 'text-gray-400', bg: 'bg-gray-500/10' },
                              error: { icon: AlertTriangle, color: 'text-accent-red', bg: 'bg-accent-red/10' },
                              sync: { icon: Activity, color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' }
                            }

                            return (
                              <div className="space-y-3">
                                {/* Log Header */}
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <ScrollText size={14} className="text-accent-cyan" />
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                      Event Log ({eggLogs.length} eventos)
                                    </span>
                                  </div>
                                  {!isExpiredEgg && egg.status === 'incubating' && (
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent-green/10">
                                      <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green"></span>
                                      </span>
                                      <span className="text-[10px] text-accent-green font-medium">LIVE</span>
                                    </div>
                                  )}
                                </div>

                                {/* Log List */}
                                <div className="bg-quant-bg rounded-xl border border-quant-border overflow-hidden max-h-80 overflow-y-auto">
                                  {eggLogs.length === 0 ? (
                                    <div className="p-8 text-center">
                                      <ScrollText size={32} className="mx-auto mb-2 text-gray-600" />
                                      <p className="text-sm text-gray-500">No hay eventos registrados</p>
                                      <p className="text-xs text-gray-600 mt-1">Los eventos aparecerán aquí durante la ejecución</p>
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-quant-border/50">
                                      {eggLogs.map((log, idx) => {
                                        const style = LOG_STYLES[log.type] || LOG_STYLES.system
                                        const LogIcon = style.icon
                                        const isError = log.type === 'error'
                                        const isSuccess = log.message?.includes('✓') || log.message?.includes('WIN') || log.message?.includes('complete')

                                        return (
                                          <div
                                            key={log.id || idx}
                                            className={`p-3 hover:bg-quant-surface/30 transition-colors ${
                                              isError ? 'bg-accent-red/5' : isSuccess ? 'bg-accent-green/5' : ''
                                            }`}
                                          >
                                            <div className="flex items-start gap-3">
                                              {/* Icon */}
                                              <div className={`p-1.5 rounded-lg ${style.bg} shrink-0`}>
                                                <LogIcon size={12} className={style.color} />
                                              </div>

                                              {/* Content */}
                                              <div className="flex-1 min-w-0">
                                                <p className={`text-xs ${isError ? 'text-accent-red' : 'text-gray-300'}`}>
                                                  {log.message}
                                                </p>

                                                {/* Extra data for trades */}
                                                {log.type === 'trade' && log.data && (
                                                  <div className="flex flex-wrap gap-2 mt-1.5">
                                                    {log.data.asset && (
                                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-quant-surface text-gray-400">
                                                        {log.data.asset}
                                                      </span>
                                                    )}
                                                    {log.data.strategy && (
                                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                        log.data.strategy === 'LONG' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                                                      }`}>
                                                        {log.data.strategy}
                                                      </span>
                                                    )}
                                                    {log.data.pnl !== undefined && (
                                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                                        log.data.pnl >= 0 ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                                                      }`}>
                                                        {log.data.pnl >= 0 ? '+' : ''}{log.data.pnl?.toFixed(2)}%
                                                      </span>
                                                    )}
                                                  </div>
                                                )}

                                                {/* Timestamp */}
                                                <span className="text-[9px] text-gray-600 mt-1 block">
                                                  {new Date(log.timestamp).toLocaleTimeString('es-ES', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit'
                                                  })}
                                                </span>
                                              </div>

                                              {/* Type badge */}
                                              <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${style.bg} ${style.color}`}>
                                                {log.type}
                                              </span>
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-3 justify-center text-[9px] text-gray-500">
                                  {Object.entries(LOG_STYLES).slice(0, 5).map(([type, style]) => {
                                    const Icon = style.icon
                                    return (
                                      <div key={type} className="flex items-center gap-1">
                                        <Icon size={10} className={style.color} />
                                        <span className="uppercase">{type}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              )
            })
          )}
      </div>
    </motion.div>
  )
}
