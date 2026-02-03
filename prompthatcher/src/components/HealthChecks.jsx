import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HeartPulse, Plus, Clock, Target, Zap, Trash2, Play, Pause, Settings, ChevronDown, ChevronUp, AlertCircle, CheckCircle, Sparkles, Egg, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react'
import useStore from '../store/useStore'
import HealthCheckModal from './HealthCheckModal'
import EggIcon from './EggIcon'

export default function HealthChecks() {
  const healthChecks = useStore((state) => state.healthChecks) || []
  const eggs = useStore((state) => state.eggs) || []
  const signals = useStore((state) => state.signals) || []
  const showHealthCheckModal = useStore((state) => state.showHealthCheckModal) || false
  const updateHealthCheck = useStore((state) => state.updateHealthCheck)
  const deleteHealthCheck = useStore((state) => state.deleteHealthCheck)
  const setActiveTab = useStore((state) => state.setActiveTab)
  const setNavigateToEggId = useStore((state) => state.setNavigateToEggId)
  const [expandedCheck, setExpandedCheck] = useState(null)
  const [editingCheck, setEditingCheck] = useState(null)
  const [activeSubTab, setActiveSubTab] = useState('active')

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
  const displayedChecks = activeSubTab === 'active' ? activeChecks : finalisedChecks

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

  // Get eggs related to a health check based on its prompts
  const getHealthCheckEggs = (check) => {
    if (!check?.prompts?.length) return []
    const promptIds = check.prompts.map(p => p.id)
    return eggs.filter(egg => promptIds.includes(egg.promptId))
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
                          <h3 className="font-semibold text-white truncate">{check.name}</h3>
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
                          {/* Configuration Details */}
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

                          {/* Prompts List */}
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

                          {/* Related Eggs */}
                          {(() => {
                            const relatedEggs = getHealthCheckEggs(check)
                            if (relatedEggs.length === 0) return null

                            return (
                              <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1.5">
                                    <Egg size={10} className="text-accent-orange" />
                                    Eggs ({relatedEggs.length})
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {relatedEggs.map((egg) => {
                                    const stats = getEggStats(egg)
                                    const isProfitable = stats.totalPnl >= 0

                                    return (
                                      <button
                                        key={egg.id}
                                        onClick={(e) => navigateToEgg(egg.id, e)}
                                        className="w-full p-2.5 rounded-xl bg-quant-surface border border-quant-border hover:border-accent-cyan/50 transition-all group text-left"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          {/* Egg Icon */}
                                          <div className="w-8 h-8 shrink-0">
                                            <EggIcon
                                              status={stats.isCompleted ? 'hatched' : 'incubating'}
                                              size={32}
                                              progress={stats.progress}
                                            />
                                          </div>

                                          {/* Egg Info */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-xs font-medium text-white truncate">
                                                {egg.promptName}
                                              </span>
                                              <div className="flex items-center gap-1.5">
                                                {/* PnL */}
                                                <span className={`text-xs font-mono flex items-center gap-0.5 ${
                                                  isProfitable ? 'text-accent-green' : 'text-accent-red'
                                                }`}>
                                                  {isProfitable ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                  {isProfitable ? '+' : ''}{stats.totalPnl.toFixed(2)}%
                                                </span>
                                                {/* Link indicator */}
                                                <ExternalLink size={12} className="text-gray-500 group-hover:text-accent-cyan transition-colors" />
                                              </div>
                                            </div>

                                            {/* Progress bar */}
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

                          {/* Last Run Info */}
                          {check.lastRun && (
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <AlertCircle size={12} />
                              Last run: {new Date(check.lastRun).toLocaleString()}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleCheckStatus(check.id)
                              }}
                              className={`flex-1 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                                check.isActive
                                  ? 'bg-accent-orange/20 border border-accent-orange/30 text-accent-orange'
                                  : 'bg-accent-green/20 border border-accent-green/30 text-accent-green'
                              }`}
                            >
                              {check.isActive ? <Pause size={14} /> : <Play size={14} />}
                              {check.isActive ? 'Pause' : 'Activate'}
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
