import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Target, Egg, Clock, CheckCircle, XCircle, AlertTriangle, Sparkles, BarChart3 } from 'lucide-react'
import { getModelDisplayName, formatVariationLabel } from '../lib/healthCheckUtils'

export default function HealthCheckReportSummary({ check, relatedEggs, signals, getEggStats }) {
  const latestRun = (check.runLog || [])[0] || null

  // Calculate aggregate stats from eggs
  const stats = useMemo(() => {
    if (!relatedEggs || relatedEggs.length === 0) {
      return { totalPnl: 0, winRate: 0, totalEggs: 0, totalTrades: 0, bestVariation: null }
    }

    let totalTrades = 0
    let totalWins = 0
    let sumPnl = 0
    let eggsWithTrades = 0
    let bestEgg = null
    let bestPnl = -Infinity

    relatedEggs.forEach(egg => {
      const eggSt = getEggStats(egg)
      if (eggSt.closedTrades > 0) {
        eggsWithTrades++
        sumPnl += eggSt.totalPnl
        totalTrades += eggSt.closedTrades

        const eggSignals = signals.filter(s => egg.trades?.includes(s.id) && s.status === 'closed')
        totalWins += eggSignals.filter(s => (s.pnl || 0) > 0).length

        if (eggSt.totalPnl > bestPnl) {
          bestPnl = eggSt.totalPnl
          bestEgg = egg
        }
      }
    })

    const avgPnl = eggsWithTrades > 0 ? sumPnl / eggsWithTrades : 0
    const winRate = totalTrades > 0 ? Math.round((totalWins / totalTrades) * 100) : 0

    // Determine best variation label
    let bestVariationLabel = null
    if (bestEgg?.variation) {
      bestVariationLabel = formatVariationLabel(bestEgg.variation)
    }

    return {
      totalPnl: avgPnl,
      winRate,
      totalEggs: relatedEggs.length,
      totalTrades,
      bestVariation: bestVariationLabel,
      bestPnl
    }
  }, [relatedEggs, signals, getEggStats])

  // Success rate from latest run
  const successRate = latestRun
    ? latestRun.summary.totalVariations > 0
      ? Math.round((latestRun.summary.succeeded / latestRun.summary.totalVariations) * 100)
      : 0
    : null

  // Build variation breakdown: match each variation to its egg
  const variationBreakdown = useMemo(() => {
    if (!check.variations || check.variations.length === 0) return []

    return check.variations.map((variation) => {
      const variationLabel = formatVariationLabel(variation)

      // Find egg for this variation
      const matchedEgg = relatedEggs.find(egg => {
        if (egg.variation) {
          return JSON.stringify(egg.variation) === JSON.stringify(variation)
        }
        // Fallback: match by config fields
        return Object.entries(variation).every(([k, v]) => {
          if (k === 'aiModel') return egg.config?.aiModel === v || egg.config?.aiProvider === v
          return egg.config?.[k] == v
        })
      })

      let eggStatus = 'no_egg'
      let pnl = null
      let winRate = null

      if (matchedEgg) {
        const eggSt = getEggStats(matchedEgg)
        const isExpired = matchedEgg.expiresAt && new Date(matchedEgg.expiresAt) < new Date()
        eggStatus = matchedEgg.status === 'hatched' ? 'hatched'
          : isExpired ? 'expired'
          : 'live'
        if (eggSt.closedTrades > 0) {
          pnl = eggSt.totalPnl
          const eggSignals = signals.filter(s => matchedEgg.trades?.includes(s.id) && s.status === 'closed')
          const wins = eggSignals.filter(s => (s.pnl || 0) > 0).length
          winRate = Math.round((wins / eggSt.closedTrades) * 100)
        }
      }

      // Check latest run events for this variation
      let runStatus = null
      if (latestRun) {
        const event = latestRun.events.find(e =>
          JSON.stringify(e.variation) === JSON.stringify(variation)
        )
        if (event) {
          runStatus = event.status // 'success' | 'failed' | 'skipped'
        }
      }

      return {
        variation,
        variationLabel,
        eggStatus,
        runStatus,
        pnl,
        winRate,
        eggId: matchedEgg?.id
      }
    })
  }, [check.variations, relatedEggs, signals, latestRun, getEggStats])

  // Time since last run
  const lastRunAgo = check.lastRun
    ? getTimeAgo(new Date(check.lastRun))
    : 'Never'

  if (!latestRun && relatedEggs.length === 0) {
    return (
      <div className="text-center py-6">
        <BarChart3 size={28} className="text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No runs yet</p>
        <p className="text-xs text-gray-500 mt-1">Click "Run Now" to generate your first health report</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Top Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Success Rate */}
        <div className="bg-quant-card rounded-xl p-2.5 border border-quant-border">
          <span className="text-[9px] text-gray-500 uppercase block mb-0.5">Success Rate</span>
          {successRate !== null ? (
            <span className={`text-sm font-mono font-bold ${
              successRate >= 70 ? 'text-accent-green' : successRate >= 40 ? 'text-accent-yellow' : 'text-accent-red'
            }`}>
              {successRate}%
            </span>
          ) : (
            <span className="text-sm font-mono text-gray-500">--</span>
          )}
        </div>

        {/* Total Eggs */}
        <div className="bg-quant-card rounded-xl p-2.5 border border-quant-border">
          <span className="text-[9px] text-gray-500 uppercase block mb-0.5">Eggs</span>
          <span className="text-sm font-mono text-accent-cyan font-bold">
            {stats.totalEggs}
            {latestRun && <span className="text-[9px] text-gray-500">/{latestRun.summary.totalVariations}</span>}
          </span>
        </div>

        {/* Avg PnL */}
        <div className="bg-quant-card rounded-xl p-2.5 border border-quant-border">
          <span className="text-[9px] text-gray-500 uppercase block mb-0.5">Avg PnL</span>
          {stats.totalTrades > 0 ? (
            <span className={`text-sm font-mono font-bold flex items-center gap-0.5 ${
              stats.totalPnl >= 0 ? 'text-accent-green' : 'text-accent-red'
            }`}>
              {stats.totalPnl >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)}%
            </span>
          ) : (
            <span className="text-sm font-mono text-gray-500">--</span>
          )}
        </div>

        {/* Win Rate */}
        <div className="bg-quant-card rounded-xl p-2.5 border border-quant-border">
          <span className="text-[9px] text-gray-500 uppercase block mb-0.5">Win Rate</span>
          {stats.totalTrades > 0 ? (
            <span className={`text-sm font-mono font-bold ${
              stats.winRate >= 60 ? 'text-accent-green' : stats.winRate >= 40 ? 'text-accent-yellow' : 'text-accent-red'
            }`}>
              {stats.winRate}%
            </span>
          ) : (
            <span className="text-sm font-mono text-gray-500">--</span>
          )}
        </div>

        {/* Best Variation */}
        <div className="bg-quant-card rounded-xl p-2.5 border border-quant-border">
          <span className="text-[9px] text-gray-500 uppercase block mb-0.5">Best</span>
          {stats.bestVariation ? (
            <span className="text-[10px] font-mono text-accent-purple truncate block" title={stats.bestVariation}>
              {stats.bestVariation}
            </span>
          ) : (
            <span className="text-sm font-mono text-gray-500">--</span>
          )}
        </div>

        {/* Last Run */}
        <div className="bg-quant-card rounded-xl p-2.5 border border-quant-border">
          <span className="text-[9px] text-gray-500 uppercase block mb-0.5">Last Run</span>
          <span className="text-[10px] font-mono text-gray-300">{lastRunAgo}</span>
        </div>
      </div>

      {/* Variation Performance Breakdown */}
      {variationBreakdown.length > 0 && (
        <div className="bg-quant-card rounded-xl p-3 border border-quant-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={10} className="text-accent-cyan" />
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Variation Breakdown</span>
          </div>

          <div className="space-y-1.5">
            {variationBreakdown.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                  item.runStatus === 'failed' ? 'bg-accent-red/5 border border-accent-red/10'
                  : item.runStatus === 'skipped' ? 'bg-accent-orange/5 border border-accent-orange/10'
                  : item.eggStatus === 'live' ? 'bg-accent-cyan/5 border border-accent-cyan/10'
                  : 'bg-quant-surface/50 border border-transparent'
                }`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {item.runStatus === 'success' || item.eggStatus !== 'no_egg' ? (
                    <CheckCircle size={14} className="text-accent-green" />
                  ) : item.runStatus === 'failed' ? (
                    <XCircle size={14} className="text-accent-red" />
                  ) : item.runStatus === 'skipped' ? (
                    <AlertTriangle size={14} className="text-accent-orange" />
                  ) : (
                    <Clock size={14} className="text-gray-600" />
                  )}
                </div>

                {/* Variation label */}
                <span className="font-mono text-gray-300 truncate flex-1 min-w-0" title={item.variationLabel}>
                  {item.variationLabel}
                </span>

                {/* Status badge */}
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${
                  item.eggStatus === 'live' ? 'bg-accent-cyan/20 text-accent-cyan'
                  : item.eggStatus === 'hatched' ? 'bg-accent-green/20 text-accent-green'
                  : item.eggStatus === 'expired' ? 'bg-accent-orange/20 text-accent-orange'
                  : item.runStatus === 'failed' ? 'bg-accent-red/20 text-accent-red'
                  : item.runStatus === 'skipped' ? 'bg-accent-orange/20 text-accent-orange'
                  : 'bg-quant-surface text-gray-600'
                }`}>
                  {item.eggStatus === 'live' ? 'Live'
                  : item.eggStatus === 'hatched' ? 'Hatched'
                  : item.eggStatus === 'expired' ? 'Expired'
                  : item.runStatus === 'failed' ? 'Failed'
                  : item.runStatus === 'skipped' ? 'Skipped'
                  : 'Pending'}
                </span>

                {/* PnL */}
                {item.pnl !== null ? (
                  <span className={`text-[10px] font-mono shrink-0 ${
                    item.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'
                  }`}>
                    {item.pnl >= 0 ? '+' : ''}{item.pnl.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-gray-600 shrink-0">--</span>
                )}

                {/* Win rate */}
                {item.winRate !== null ? (
                  <span className="text-[10px] font-mono text-gray-400 shrink-0">
                    {item.winRate}% WR
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-gray-600 shrink-0">--</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Latest Run Summary Banner */}
      {latestRun && (
        <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${
          latestRun.summary.failed > 0 || latestRun.summary.skipped > 0
            ? 'bg-accent-orange/5 border-accent-orange/20'
            : 'bg-accent-green/5 border-accent-green/20'
        }`}>
          <Target size={14} className={`shrink-0 ${
            latestRun.summary.failed > 0 ? 'text-accent-orange' : 'text-accent-green'
          }`} />
          <span className="text-xs text-gray-300">
            Last run: <span className="text-white font-mono">{latestRun.summary.succeeded}</span> succeeded
            {latestRun.summary.failed > 0 && (
              <>, <span className="text-accent-red font-mono">{latestRun.summary.failed}</span> failed</>
            )}
            {latestRun.summary.skipped > 0 && (
              <>, <span className="text-accent-orange font-mono">{latestRun.summary.skipped}</span> skipped</>
            )}
            {' '}— {latestRun.summary.totalTradesGenerated} trades total
          </span>
        </div>
      )}
    </div>
  )
}

// Helper: humanize time difference
function getTimeAgo(date) {
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}
