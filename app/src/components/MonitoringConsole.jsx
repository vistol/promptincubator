import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, ChevronDown, ChevronUp, Trash2, Circle, Wifi, WifiOff, Database, TrendingUp, Cpu, AlertTriangle, RefreshCw, Activity } from 'lucide-react'
import useStore from '../store/useStore'
import EggIcon from './EggIcon'

// Log type icons and colors
const LOG_CONFIG = {
  price: { icon: TrendingUp, color: 'text-accent-green', bgColor: 'bg-accent-green/20' },
  sync: { icon: Database, color: 'text-accent-cyan', bgColor: 'bg-accent-cyan/20' },
  trade: { icon: Activity, color: 'text-accent-yellow', bgColor: 'bg-accent-yellow/20' },
  egg: { icon: EggIcon, color: 'text-purple-400', bgColor: 'bg-purple-400/20', isComponent: true },
  system: { icon: Terminal, color: 'text-blue-400', bgColor: 'bg-blue-400/20' },
  error: { icon: AlertTriangle, color: 'text-accent-red', bgColor: 'bg-accent-red/20' },
  ai: { icon: Cpu, color: 'text-pink-400', bgColor: 'bg-pink-400/20' }
}

function formatTimestamp(isoString) {
  const date = new Date(isoString)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function LogEntry({ log, isNew }) {
  const config = LOG_CONFIG[log.type] || LOG_CONFIG.system
  const Icon = config.icon

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -20 } : false}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 py-1.5 px-2 hover:bg-white/5 rounded transition-colors group"
    >
      <div className={`shrink-0 p-1 rounded ${config.bgColor}`}>
        {config.isComponent ? (
          <div className="w-3 h-3">
            <EggIcon size={12} status="incubating" />
          </div>
        ) : (
          <Icon size={12} className={config.color} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-300 font-mono leading-relaxed break-words">
          {log.message}
        </p>
      </div>
      <span className="shrink-0 text-[10px] text-gray-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
        {formatTimestamp(log.timestamp)}
      </span>
    </motion.div>
  )
}

function StatusSummary() {
  const { eggs, signals, prices, priceStatus, refreshPrices } = useStore()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const incubatingEggs = eggs.filter(e => e.status === 'incubating')
  const activeTrades = signals.filter(s => s.status === 'active')
  const closedTrades = signals.filter(s => s.status === 'closed')

  // Calculate totals for incubating eggs
  const eggStats = incubatingEggs.map(egg => {
    const eggSignals = signals.filter(s => egg.trades.includes(s.id))
    const closed = eggSignals.filter(s => s.status === 'closed').length
    const wins = eggSignals.filter(s => s.result === 'win').length
    const losses = eggSignals.filter(s => s.result === 'loss').length
    return { egg, total: eggSignals.length, closed, wins, losses }
  })

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshPrices()
    setIsRefreshing(false)
  }

  // Calculate time until next auto-refresh
  const [nextRefresh, setNextRefresh] = useState(60)
  useEffect(() => {
    const interval = setInterval(() => {
      setNextRefresh(prev => prev <= 1 ? 60 : prev - 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [priceStatus.lastUpdated])

  // Reset counter when prices update
  useEffect(() => {
    setNextRefresh(60)
  }, [priceStatus.lastUpdated])

  return (
    <div className="p-3 border-b border-quant-border bg-black/30 space-y-3">
      {/* Status Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-quant-surface">
            <EggIcon size={16} status="incubating" />
            <span className="text-xs font-mono text-white">{incubatingEggs.length} eggs</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-quant-surface">
            <Activity size={14} className="text-accent-yellow" />
            <span className="text-xs font-mono text-white">{activeTrades.length} active</span>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing || priceStatus.isFetching}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono transition-all ${
            isRefreshing || priceStatus.isFetching
              ? 'bg-accent-cyan/20 text-accent-cyan'
              : 'bg-quant-surface text-gray-400 hover:text-white hover:bg-quant-border'
          }`}
        >
          <RefreshCw size={12} className={isRefreshing || priceStatus.isFetching ? 'animate-spin' : ''} />
          {isRefreshing || priceStatus.isFetching ? 'Checking...' : `Check (${nextRefresh}s)`}
        </button>
      </div>

      {/* Eggs Progress */}
      {eggStats.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Egg Execution Progress</span>
          {eggStats.map(({ egg, total, closed, wins, losses }) => {
            const progress = total > 0 ? (closed / total) * 100 : 0
            const active = total - closed

            return (
              <div key={egg.id} className="bg-quant-surface/50 rounded-lg p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-white font-medium truncate max-w-[150px]">{egg.promptName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-accent-green font-mono">{wins}W</span>
                    <span className="text-[10px] text-accent-red font-mono">{losses}L</span>
                    <span className="text-[10px] text-accent-cyan font-mono">{active}A</span>
                  </div>
                </div>
                <div className="h-1.5 bg-quant-bg rounded-full overflow-hidden flex">
                  {wins > 0 && (
                    <div
                      className="h-full bg-accent-green"
                      style={{ width: `${(wins / total) * 100}%` }}
                    />
                  )}
                  {losses > 0 && (
                    <div
                      className="h-full bg-accent-red"
                      style={{ width: `${(losses / total) * 100}%` }}
                    />
                  )}
                  {active > 0 && (
                    <div
                      className="h-full bg-accent-cyan/30 animate-pulse"
                      style={{ width: `${(active / total) * 100}%` }}
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-500">{closed}/{total} executed</span>
                  <span className="text-[10px] text-gray-500">{progress.toFixed(0)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Active Trades List */}
      {activeTrades.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Active Trades Monitoring</span>
          <div className="grid grid-cols-2 gap-1">
            {activeTrades.slice(0, 6).map(trade => {
              const currentPrice = prices[trade.asset]?.price
              const entry = parseFloat(trade.entry)
              const tp = parseFloat(trade.takeProfit)
              const sl = parseFloat(trade.stopLoss)
              const isLong = trade.strategy === 'LONG'

              let tpProgress = 0
              let slProgress = 0
              if (currentPrice) {
                if (isLong) {
                  tpProgress = Math.min(100, Math.max(0, ((currentPrice - entry) / (tp - entry)) * 100))
                  slProgress = Math.min(100, Math.max(0, ((entry - currentPrice) / (entry - sl)) * 100))
                } else {
                  tpProgress = Math.min(100, Math.max(0, ((entry - currentPrice) / (entry - tp)) * 100))
                  slProgress = Math.min(100, Math.max(0, ((currentPrice - entry) / (sl - entry)) * 100))
                }
              }

              return (
                <div key={trade.id} className="bg-quant-surface/30 rounded p-1.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-white">{trade.asset}</span>
                    <span className={`text-[9px] px-1 rounded ${isLong ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'}`}>
                      {trade.strategy}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1 bg-quant-bg rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent-red via-accent-yellow to-accent-green"
                        style={{ width: `${tpProgress}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-accent-cyan font-mono">
                      {tpProgress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          {activeTrades.length > 6 && (
            <span className="text-[10px] text-gray-500">+{activeTrades.length - 6} more trades...</span>
          )}
        </div>
      )}

      {incubatingEggs.length === 0 && activeTrades.length === 0 && (
        <div className="text-center py-2">
          <span className="text-xs text-gray-500">No active incubations</span>
        </div>
      )}
    </div>
  )
}

export default function MonitoringConsole() {
  const { activityLogs, clearLogs, priceStatus, syncStatus } = useStore()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showLogs, setShowLogs] = useState(true)
  const scrollRef = useRef(null)
  const [newLogIds, setNewLogIds] = useState(new Set())

  // Mark new logs for animation
  useEffect(() => {
    if (activityLogs.length > 0 && activityLogs[0]) {
      const newId = activityLogs[0].id
      setNewLogIds(prev => new Set([...prev, newId]))

      setTimeout(() => {
        setNewLogIds(prev => {
          const updated = new Set(prev)
          updated.delete(newId)
          return updated
        })
      }, 500)
    }
  }, [activityLogs])

  useEffect(() => {
    if (scrollRef.current && activityLogs.length > 0) {
      scrollRef.current.scrollTop = 0
    }
  }, [activityLogs])

  const isOnline = priceStatus.source !== null || syncStatus.lastSynced !== null
  const isFetching = priceStatus.isFetching || syncStatus.syncing || syncStatus.loading

  return (
    <div className="bg-quant-card border border-quant-border rounded-2xl overflow-hidden">
      {/* Console Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-quant-surface/50 hover:bg-quant-surface/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-accent-cyan" />
            <span className="text-sm font-medium text-white font-mono">Monitor</span>
          </div>

          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${
              isOnline ? 'bg-accent-green/20 text-accent-green' : 'bg-gray-500/20 text-gray-500'
            }`}>
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </div>

            {isFetching && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-cyan/20 text-accent-cyan text-[10px] font-mono">
                <Circle size={6} className="fill-current animate-pulse" />
                CHECKING
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">
            {activityLogs.length} logs
          </span>
          {isExpanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Console Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Status Summary Panel */}
            <StatusSummary />

            {/* Log Toggle */}
            <div className="px-3 py-2 border-b border-quant-border flex items-center justify-between bg-black/20">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowLogs(!showLogs)
                }}
                className="text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                {showLogs ? '▼ Hide Logs' : '▶ Show Logs'}
              </button>

              <div className="flex items-center gap-2">
                {/* Log type badges */}
                <div className="flex items-center gap-1">
                  {Object.entries(LOG_CONFIG).slice(0, 4).map(([type, config]) => {
                    const Icon = config.icon
                    const count = activityLogs.filter(l => l.type === type).length
                    if (count === 0) return null
                    return (
                      <div
                        key={type}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${config.bgColor}`}
                        title={`${type}: ${count}`}
                      >
                        {!config.isComponent && <Icon size={10} className={config.color} />}
                        <span className={`text-[10px] font-mono ${config.color}`}>{count}</span>
                      </div>
                    )
                  })}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    clearLogs()
                  }}
                  className="p-1 rounded hover:bg-quant-surface transition-colors"
                  title="Clear logs"
                >
                  <Trash2 size={12} className="text-gray-500 hover:text-gray-300" />
                </button>
              </div>
            </div>

            {/* Log entries */}
            {showLogs && (
              <div
                ref={scrollRef}
                className="max-h-48 overflow-y-auto hide-scrollbar bg-black/30"
              >
                {activityLogs.length === 0 ? (
                  <div className="py-6 text-center">
                    <Terminal size={20} className="mx-auto mb-2 text-gray-600" />
                    <p className="text-xs text-gray-500 font-mono">Waiting for activity...</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {activityLogs.map((log) => (
                      <LogEntry
                        key={log.id}
                        log={log}
                        isNew={newLogIds.has(log.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {priceStatus.lastUpdated && (
              <div className="px-3 py-1.5 border-t border-quant-border bg-black/20 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">
                  Last check: {formatTimestamp(priceStatus.lastUpdated)}
                </span>
                {priceStatus.source && (
                  <span className="text-[10px] text-accent-cyan font-mono uppercase">
                    {priceStatus.source}
                  </span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
