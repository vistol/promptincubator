import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeartPulse, Plus, Clock, Target, Zap, Trash2, Play, Pause, Settings, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Sparkles, Egg, ExternalLink, TrendingUp, TrendingDown, Shield, Filter, ArrowUpDown, BarChart3, ScrollText, Wrench } from 'lucide-react'
import useStore from '../store/useStore'
import HealthCheckModal from './HealthCheckModal'
import HealthCheckReportSummary from './HealthCheckReportSummary'
import HealthCheckEventLog from './HealthCheckEventLog'
import EggIcon from './EggIcon'

export default function HealthChecks() {
  const healthChecks = useStore((state) => state.healthChecks) || []
  const settings = useStore((state) => state.settings)
  const eggs = useStore((state) => state.eggs) || []
  const signals = useStore((state) => state.signals) || []
  const showHealthCheckModal = useStore((state) => state.showHealthCheckModal) || false
  const updateHealthCheck = useStore((state) => state.updateHealthCheck)
  const deleteHealthCheck = useStore((state) => state.deleteHealthCheck)
  const runHealthCheck = useStore((state) => state.runHealthCheck)
  const retryFailedVariations = useStore((state) => state.retryFailedVariations)
  const healthCheckRunning = useStore((state) => state.healthCheckRunning)
  const healthCheckProgress = useStore((state) => state.healthCheckProgress)
  const setActiveTab = useStore((state) => state.setActiveTab)
  const setNavigateToEggId = useStore((state) => state.setNavigateToEggId)
  const [expandedCheck, setExpandedCheck] = useState(null)
  const [editingCheck, setEditingCheck] = useState(null)
  const [activeSubTab, setActiveSubTab] = useState('active')
  const [filterBy, setFilterBy] = useState('all')
  const [sortBy, setSortBy] = useState('pnl')
  const [expandedDetailTab, setExpandedDetailTab] = useState({}) // { [checkId]: 'report' | 'eggs' | 'log' | 'config' }

  const filterOptions = [
    { id: 'all', label: 'All' },
    { id: 'profitable', label: 'Profitable' },
    { id: 'unprofitable', label: 'Loss' }
  ]

  const sortOptions = [
    { id: 'pnl', label: 'PnL' },
    { id: 'winRate', label: 'Win Rate' },
    { id: 'eggs', label: 'Most Eggs' },
    { id: 'trades', label: 'Most Trades' },
    { id: 'recent', label: 'Reciente' }
  ]

  const handleOpenModal = (check = null) => {
    setEditingCheck(check)
    useStore.setState({ showHealthCheckModal: true })
  }

  const handleCloseModal = () => {
    setEditingCheck(null)
    useStore.setState({ showHealthCheckModal: false })
  }

  const toggleCheckStatus = (checkId) => {
    const check = healthChecks.find(c => c.id === checkId)
    if (check) {
      updateHealthCheck(checkId, { isActive: !check.isActive })
    }
  }

  const handleDeleteCheck = (checkId) => {
    deleteHealthCheck(checkId)
  }

  const formatSchedule = (schedule) => {
    if (!schedule) return 'Not set'
    const { frequency, time, days } = schedule
    if (frequency === 'daily') return `Daily at ${time}`
    if (frequency === 'weekly') return `Weekly on ${days?.join(', ')} at ${time}`
    if (frequency === 'hourly') return `Every ${schedule.interval || 1} hour(s)`
    return 'Custom'
  }

  // Filter health checks by status
  const activeChecks = healthChecks.filter(check => check.isActive)
  const finalisedChecks = healthChecks.filter(check => !check.isActive)

  // Format variation for display
  const formatVariation = (variation) => {
    return Object.entries(variation).map(([key, value]) => {
      // Shorten key names
      const shortKey = key
        .replace('leverage', 'lev')
        .replace('aiModel', 'ai')
        .replace('executionTime', 'time')
        .replace('targetPct', 'tp')
        .replace('stopLoss', 'sl')
        .replace('minIpe', 'ipe')
        .replace('numResults', 'res')
      return `${shortKey}:${value}`
    }).join(' ')
  }

  // Get eggs related to a health check
  const getHealthCheckEggs = (check) => {
    if (!check?.id) return []
    // Primary: match by healthCheckId (exact linkage)
    const byHealthCheckId = eggs.filter(egg => egg.healthCheckId === check.id)
    if (byHealthCheckId.length > 0) return byHealthCheckId
    // Fallback: match by promptId (for eggs created before healthCheckId was added)
    // Only include eggs created AFTER the health check was created to avoid showing stale eggs
    if (!check.prompts?.length) return []
    const promptIds = check.prompts.map(p => p.id)
    const checkCreatedAt = check.createdAt ? new Date(check.createdAt).getTime() : 0
    return eggs.filter(egg => {
      if (!promptIds.includes(egg.promptId)) return false
      // If health check has a createdAt, only show eggs created after it
      if (checkCreatedAt > 0 && egg.createdAt) {
        return new Date(egg.createdAt).getTime() >= checkCreatedAt
      }
      return true
    })
  }

  // Calculate egg stats (PnL, status)
  const getEggStats = (egg) => {
    const eggSignals = signals.filter(s => egg.trades?.includes(s.id))
    const closedSignals = eggSignals.filter(s => s.status === 'closed')
    const totalTrades = eggSignals.length
    const closedTrades = closedSignals.length

    // Calculate PnL - use AVERAGE to match Incubator page
    let sumPnl = 0
    let sumPnlDollar = 0
    closedSignals.forEach(s => {
      sumPnl += s.pnl || 0
      sumPnlDollar += s.pnlDollar || 0
    })

    // Average PnL across all closed trades (same calculation as Incubator)
    const totalPnl = closedTrades > 0 ? sumPnl / closedTrades : 0
    const totalPnlDollar = closedTrades > 0 ? sumPnlDollar / closedTrades : 0

    // Check if expired
    const isExpired = egg.expiresAt && new Date(egg.expiresAt) < new Date()
    const isCompleted = egg.status === 'hatched' || isExpired

    return {
      totalTrades,
      closedTrades,
      totalPnl,
      totalPnlDollar,
      isExpired,
      isCompleted,
      progress: totalTrades > 0 ? (closedTrades / totalTrades) * 100 : 0
    }
  }

  // Calculate aggregate stats for a health check
  const getHealthCheckStats = (check) => {
    const relatedEggs = getHealthCheckEggs(check)
    if (relatedEggs.length === 0) return { totalPnl: 0, winRate: 0, totalEggs: 0, totalTrades: 0 }

    let totalTrades = 0
    let totalWins = 0
    let sumPnl = 0
    let eggsWithTrades = 0

    relatedEggs.forEach(egg => {
      const stats = getEggStats(egg)
      if (stats.closedTrades > 0) {
        eggsWithTrades++
        sumPnl += stats.totalPnl
        totalTrades += stats.closedTrades

        const eggSignals = signals.filter(s => egg.trades?.includes(s.id) && s.status === 'closed')
        totalWins += eggSignals.filter(s => (s.pnl || 0) > 0).length
      }
    })

    return {
      totalPnl: eggsWithTrades > 0 ? sumPnl / eggsWithTrades : 0,
      winRate: totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0,
      totalEggs: relatedEggs.length,
      totalTrades
    }
  }

  // Apply filter/sort to displayed checks
  const displayedChecks = useMemo(() => {
    const baseChecks = activeSubTab === 'active' ? activeChecks : finalisedChecks

    // Apply filter
    let filtered = baseChecks
    if (filterBy === 'profitable') {
      filtered = baseChecks.filter(check => getHealthCheckStats(check).totalPnl >= 0)
    } else if (filterBy === 'unprofitable') {
      filtered = baseChecks.filter(check => getHealthCheckStats(check).totalPnl < 0)
    }

    // Apply sort
    const sorted = [...filtered].sort((a, b) => {
      const statsA = getHealthCheckStats(a)
      const statsB = getHealthCheckStats(b)
      switch (sortBy) {
        case 'winRate':
          return (statsB.winRate || 0) - (statsA.winRate || 0)
        case 'eggs':
          return (statsB.totalEggs || 0) - (statsA.totalEggs || 0)
        case 'trades':
          return (statsB.totalTrades || 0) - (statsA.totalTrades || 0)
        case 'recent':
          return new Date(b.lastRun || b.createdAt || 0).getTime() - new Date(a.lastRun || a.createdAt || 0).getTime()
        case 'pnl':
        default:
          return (statsB.totalPnl || 0) - (statsA.totalPnl || 0)
      }
    })

    return sorted
  }, [activeSubTab, activeChecks, finalisedChecks, filterBy, sortBy, eggs, signals])

  // Navigate to egg in Incubator
  const navigateToEgg = (eggId, e) => {
    e.stopPropagation()
    setNavigateToEggId(eggId)
    setActiveTab('incubator')
  }

  return (
    <div className="px-4 pb-4">
      {/* Tabs for Active/Finalised */}
      <div className="flex bg-quant-surface rounded-xl p-1 mb-4">
        <button
          onClick={() => setActiveSubTab('active')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'active'
              ? 'bg-quant-card text-white shadow'
              : 'text-gray-400'
          }`}
        >
          <Play size={14} />
          Active ({activeChecks.length})
        </button>
        <button
          onClick={() => setActiveSubTab('finalised')}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'finalised'
              ? 'bg-quant-card text-white shadow'
              : 'text-gray-400'
          }`}
        >
          <CheckCircle size={14} />
          Finalised ({finalisedChecks.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto hide-scrollbar">
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

      {/* Sort Options */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto hide-scrollbar">
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

      {/* Health Checks List */}
      <div className="space-y-3">
        {displayedChecks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-quant-surface flex items-center justify-center">
              <HeartPulse size={32} className="text-gray-600" />
            </div>
            <p className="text-gray-400 mb-2">
              {activeSubTab === 'active' ? 'No active health checks' : 'No finalised health checks'}
            </p>
            <p className="text-sm text-gray-500">
              {activeSubTab === 'active'
                ? 'Create a health check to automate your trading analysis'
                : 'Paused health checks will appear here'
              }
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {displayedChecks.map((check, index) => {
              const isExpanded = expandedCheck === check.id

              return (
                <motion.div
                  key={check.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.03 }}
                  className={`bg-quant-card border rounded-2xl overflow-hidden ${
                    check.isActive ? 'border-accent-green/30' : 'border-quant-border'
                  }`}
                >
                  {/* Check Header */}
                  <button
                    onClick={() => setExpandedCheck(isExpanded ? null : check.id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {/* Status Indicator */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        check.isActive ? 'bg-accent-green/20' : 'bg-quant-surface'
                      }`}>
                        {check.isActive ? (
                          <HeartPulse size={20} className="text-accent-green" />
                        ) : (
                          <Pause size={20} className="text-gray-500" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-white truncate">{check.name}</h3>
                            {check.createdAt && (
                              <span className="text-[9px] text-gray-500 flex items-center gap-1">
                                <Clock size={8} />
                                {new Date(check.createdAt).toLocaleDateString()} {new Date(check.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                              check.isActive
                                ? 'bg-accent-green/20 text-accent-green'
                                : 'bg-quant-surface text-gray-500'
                            }`}>
                              {check.isActive ? 'Active' : 'Paused'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp size={16} className="text-gray-500" />
                            ) : (
                              <ChevronDown size={16} className="text-gray-500" />
                            )}
                          </div>
                        </div>

                        {/* Info Row */}
                        {(() => {
                          const relatedEggs = getHealthCheckEggs(check)
                          const liveEggs = relatedEggs.filter(e => e.status === 'incubating' && (!e.expiresAt || new Date(e.expiresAt) > new Date()))
                          return (
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatSchedule(check.schedule)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Target size={12} />
                                {check.prompts?.length || 0} prompts
                              </span>
                              {relatedEggs.length > 0 && (
                                <span className={`flex items-center gap-1 ${liveEggs.length > 0 ? 'text-accent-cyan' : 'text-gray-500'}`}>
                                  <Egg size={12} />
                                  {relatedEggs.length} eggs {liveEggs.length > 0 && `(${liveEggs.length} live)`}
                                </span>
                              )}
                            </div>
                          )
                        })()}

                        {/* Test Variations Preview */}
                        {check.variations && check.variations.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-quant-border">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Sparkles size={10} className="text-accent-cyan" />
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Test Variations ({check.variations.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {check.variations.slice(0, 6).map((variation, i) => (
                                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-quant-surface text-gray-400 font-mono">
                                  {formatVariation(variation)}
                                </span>
                              ))}
                              {check.variations.length > 6 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan font-mono">
                                  +{check.variations.length - 6} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-quant-border overflow-hidden"
                      >
                        <div className="p-4 bg-quant-surface/30 space-y-3">
                          {/* Sub-tabs within expanded card */}
                          {(() => {
                            const currentDetailTab = expandedDetailTab[check.id] || 'report'
                            const relatedEggs = getHealthCheckEggs(check)
                            const runLogCount = (check.runLog || []).length
                            const isCurrentlyRunning = healthCheckRunning === check.id

                            const detailTabs = [
                              { id: 'report', label: 'Report', icon: BarChart3 },
                              { id: 'eggs', label: `Eggs (${relatedEggs.length})`, icon: Egg },
                              { id: 'log', label: `Log${runLogCount > 0 || isCurrentlyRunning ? ` (${runLogCount}${isCurrentlyRunning ? '+' : ''})` : ''}`, icon: ScrollText },
                              { id: 'config', label: 'Config', icon: Wrench }
                            ]

                            return (
                              <>
                                {/* Detail Tab Bar */}
                                <div className="flex bg-quant-card rounded-xl p-0.5 border border-quant-border">
                                  {detailTabs.map((tab) => {
                                    const TabIcon = tab.icon
                                    return (
                                      <button
                                        key={tab.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setExpandedDetailTab(prev => ({ ...prev, [check.id]: tab.id }))
                                        }}
                                        className={`flex-1 py-2 px-1.5 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
                                          currentDetailTab === tab.id
                                            ? 'bg-quant-surface text-white shadow-sm'
                                            : 'text-gray-500 hover:text-gray-300'
                                        }`}
                                      >
                                        <TabIcon size={11} />
                                        {tab.label}
                                      </button>
                                    )
                                  })}
                                </div>

                                {/* Report Tab */}
                                {currentDetailTab === 'report' && (
                                  <HealthCheckReportSummary
                                    check={check}
                                    relatedEggs={relatedEggs}
                                    signals={signals}
                                    getEggStats={getEggStats}
                                  />
                                )}

                                {/* Eggs Tab */}
                                {currentDetailTab === 'eggs' && (() => {
                                  const variationCount = check.variations?.length || 0
                                  const promptCount = check.prompts?.length || 0
                                  const expectedEggs = variationCount * promptCount

                                  // Show placeholder eggs if no real eggs yet
                                  if (relatedEggs.length === 0 && expectedEggs > 0) {
                                    return (
                                      <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                        <div className="flex items-center justify-between mb-3">
                                          <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1.5">
                                            <Egg size={10} className="text-gray-600" />
                                            Eggs (0/{expectedEggs})
                                          </span>
                                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-quant-surface text-gray-500">
                                            Pending
                                          </span>
                                        </div>
                                        <div className="space-y-2">
                                          {check.variations.map((variation, i) => {
                                            const variationLabel = Object.entries(variation).map(([k, v]) => `${k}:${v}`).join(' ')
                                            return (
                                              <div
                                                key={i}
                                                className="w-full p-2.5 rounded-xl bg-quant-surface/50 border border-quant-border/50 opacity-40"
                                              >
                                                <div className="flex items-center gap-2.5">
                                                  <div className="w-8 h-8 shrink-0 opacity-30">
                                                    <EggIcon status="incubating" size={32} progress={0} isHealthCheck={true} />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                      <div className="min-w-0 flex-1">
                                                        <span className="text-xs font-medium text-gray-500 truncate block">
                                                          {check.prompts?.[0]?.name || 'Prompt'}
                                                        </span>
                                                        <span className="text-[9px] text-gray-600 font-mono">
                                                          {variationLabel}
                                                        </span>
                                                      </div>
                                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-quant-surface text-gray-600">
                                                        Waiting
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <div className="flex-1 h-1 bg-quant-card rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full bg-gray-700" style={{ width: '0%' }} />
                                                      </div>
                                                      <span className="text-[9px] text-gray-600 font-mono shrink-0">0/0</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  }

                                  if (relatedEggs.length === 0) {
                                    return (
                                      <div className="text-center py-6">
                                        <Egg size={28} className="text-gray-600 mx-auto mb-2" />
                                        <p className="text-sm text-gray-400">No eggs yet</p>
                                        <p className="text-xs text-gray-500 mt-1">Run the health check to generate eggs</p>
                                      </div>
                                    )
                                  }

                                  return (
                                    <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                      <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1.5">
                                          <Egg size={10} className="text-accent-orange" />
                                          Eggs ({relatedEggs.length}{expectedEggs > 0 ? `/${expectedEggs}` : ''})
                                        </span>
                                      </div>
                                      <div className="space-y-2 max-h-[300px] overflow-y-auto hide-scrollbar">
                                        {[...relatedEggs].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).map((egg) => {
                                          const stats = getEggStats(egg)
                                          const isProfitable = stats.totalPnl >= 0

                                          return (
                                            <button
                                              key={egg.id}
                                              onClick={(e) => navigateToEgg(egg.id, e)}
                                              className="w-full p-2.5 rounded-xl bg-quant-surface border border-quant-border hover:border-accent-cyan/50 transition-all group text-left"
                                            >
                                              <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 shrink-0">
                                                  <EggIcon
                                                    status={stats.isCompleted ? 'hatched' : 'incubating'}
                                                    size={32}
                                                    progress={stats.progress}
                                                    isHealthCheck={true}
                                                  />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <div className="min-w-0 flex-1">
                                                      <span className="text-xs font-medium text-white truncate block">
                                                        {egg.promptName}
                                                      </span>
                                                      {egg.createdAt && (
                                                        <span className="text-[9px] text-gray-500 flex items-center gap-1">
                                                          <Clock size={8} />
                                                          {new Date(egg.createdAt).toLocaleDateString()} {new Date(egg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                      <span className={`text-xs font-mono flex items-center gap-0.5 ${
                                                        isProfitable ? 'text-accent-green' : 'text-accent-red'
                                                      }`}>
                                                        {isProfitable ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                        {isProfitable ? '+' : ''}{stats.totalPnl.toFixed(2)}%
                                                      </span>
                                                      <ExternalLink size={12} className="text-gray-500 group-hover:text-accent-cyan transition-colors" />
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-quant-card rounded-full overflow-hidden">
                                                      <div
                                                        className={`h-full rounded-full transition-all ${
                                                          stats.isCompleted
                                                            ? isProfitable ? 'bg-accent-green' : 'bg-accent-red'
                                                            : 'bg-accent-cyan'
                                                        }`}
                                                        style={{ width: `${stats.progress}%` }}
                                                      />
                                                    </div>
                                                    <span className="text-[9px] text-gray-500 font-mono shrink-0">
                                                      {stats.closedTrades}/{stats.totalTrades}
                                                    </span>
                                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                                      stats.isCompleted
                                                        ? stats.isExpired
                                                          ? 'bg-accent-orange/20 text-accent-orange'
                                                          : 'bg-accent-green/20 text-accent-green'
                                                        : 'bg-accent-cyan/20 text-accent-cyan'
                                                    }`}>
                                                      {stats.isCompleted
                                                        ? stats.isExpired ? 'Expired' : 'Hatched'
                                                        : 'Live'
                                                      }
                                                    </span>
                                                  </div>
                                                </div>
                                              </div>
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })()}

                                {/* Event Log Tab */}
                                {currentDetailTab === 'log' && (
                                  <HealthCheckEventLog
                                    runLog={check.runLog || []}
                                    liveRunLog={isCurrentlyRunning ? healthCheckProgress?.liveRunLog : null}
                                    isRunning={isCurrentlyRunning}
                                    onNavigateToEgg={navigateToEgg}
                                    onGoToSettings={() => setActiveTab('settings')}
                                    onRetryFailed={(variations) => retryFailedVariations(check.id, variations)}
                                    onRetryAll={() => runHealthCheck(check.id)}
                                    onEditCheck={() => handleOpenModal(check)}
                                  />
                                )}

                                {/* Config Tab */}
                                {currentDetailTab === 'config' && (
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                        <span className="text-[10px] text-gray-500 uppercase block mb-1">Capital</span>
                                        <span className="text-sm font-mono text-white">${check.capital || 1000}</span>
                                      </div>
                                      <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                        <span className="text-[10px] text-gray-500 uppercase block mb-1">Leverage</span>
                                        <span className="text-sm font-mono text-white">{check.leverage || 5}x</span>
                                      </div>
                                      <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                        <span className="text-[10px] text-gray-500 uppercase block mb-1">Target</span>
                                        <span className="text-sm font-mono text-accent-green">+{check.targetPct || 10}%</span>
                                      </div>
                                      <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                        <span className="text-[10px] text-gray-500 uppercase block mb-1">Min IPE</span>
                                        <span className="text-sm font-mono text-accent-cyan">{check.minIpe || 80}%</span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-2.5 bg-accent-yellow/10 border border-accent-yellow/20 rounded-xl">
                                      <Shield size={14} className="text-accent-yellow shrink-0" />
                                      <span className="text-xs text-gray-300">
                                        Grace Period:{' '}
                                        <span className="text-accent-yellow font-mono font-bold">
                                          {settings.gracePeriodMinutes || 5}min
                                        </span>
                                        {' '}de warmup
                                      </span>
                                    </div>

                                    {check.prompts && check.prompts.length > 0 && (
                                      <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                        <span className="text-[10px] text-gray-500 uppercase block mb-2">Included Prompts</span>
                                        <div className="space-y-1">
                                          {check.prompts.map((prompt, idx) => (
                                            <div key={idx} className="text-xs text-gray-300 flex items-center gap-2">
                                              <Zap size={10} className="text-accent-cyan" />
                                              {prompt.name || prompt}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {check.variations && check.variations.length > 0 && (
                                      <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                        <span className="text-[10px] text-gray-500 uppercase block mb-2">Test Variations ({check.variations.length})</span>
                                        <div className="flex flex-wrap gap-1">
                                          {check.variations.map((variation, i) => (
                                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-quant-surface text-gray-400 font-mono">
                                              {formatVariation(variation)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </>
                            )
                          })()}

                          {/* Last Run Info */}
                          {check.lastRun && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <AlertCircle size={12} />
                              Last run: {new Date(check.lastRun).toLocaleString()}
                            </div>
                          )}

                          {/* Health Check Run Progress */}
                          {healthCheckRunning === check.id && healthCheckProgress && (
                            <div className="p-3 bg-accent-cyan/10 border border-accent-cyan/20 rounded-xl">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-accent-cyan font-medium flex items-center gap-1.5">
                                  <Zap size={12} className="animate-pulse" />
                                  Running...
                                </span>
                                <div className="flex items-center gap-2">
                                  {healthCheckProgress.skipped > 0 && (
                                    <span className="text-[9px] text-accent-orange font-mono">
                                      {healthCheckProgress.skipped} skipped
                                    </span>
                                  )}
                                  <span className="text-xs font-mono text-white">
                                    {healthCheckProgress.current}/{healthCheckProgress.total}
                                  </span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-quant-surface rounded-full overflow-hidden mb-1.5">
                                <div
                                  className="h-full bg-accent-cyan rounded-full transition-all duration-500"
                                  style={{ width: `${(healthCheckProgress.current / healthCheckProgress.total) * 100}%` }}
                                />
                              </div>
                              {healthCheckProgress.currentVariation && (
                                <span className="text-[9px] text-gray-500 font-mono block">
                                  {healthCheckProgress.currentVariation}
                                </span>
                              )}
                              {healthCheckProgress.errors?.length > 0 && (
                                <span className="text-[9px] text-accent-red mt-1 block">
                                  {healthCheckProgress.errors.length} error(s)
                                </span>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                runHealthCheck(check.id)
                              }}
                              disabled={!!healthCheckRunning}
                              className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                                healthCheckRunning === check.id
                                  ? 'bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan/50 cursor-wait'
                                  : healthCheckRunning
                                    ? 'bg-quant-surface border border-quant-border text-gray-600 cursor-not-allowed'
                                    : 'bg-accent-cyan/20 border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/30'
                              }`}
                            >
                              <Zap size={14} />
                              {healthCheckRunning === check.id ? 'Running...' : 'Run Now'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCheckStatus(check.id)
                              }}
                              className={`py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                                check.isActive
                                  ? 'bg-accent-orange/20 border border-accent-orange/30 text-accent-orange'
                                  : 'bg-accent-green/20 border border-accent-green/30 text-accent-green'
                              }`}
                            >
                              {check.isActive ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenModal(check)
                              }}
                              className="py-2.5 px-4 rounded-xl bg-quant-surface border border-quant-border text-gray-400 font-medium text-sm flex items-center justify-center gap-2 hover:text-white transition-colors"
                            >
                              <Settings size={14} />
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteCheck(check.id)
                              }}
                              className="py-2.5 px-4 rounded-xl bg-accent-red/10 border border-accent-red/30 text-accent-red font-medium text-sm flex items-center justify-center gap-2 hover:bg-accent-red/20 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Health Check Modal */}
      <AnimatePresence>
        {showHealthCheckModal && (
          <HealthCheckModal
            check={editingCheck}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
