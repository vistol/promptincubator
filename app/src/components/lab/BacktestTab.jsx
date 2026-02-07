import { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Play, Trash2, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Clock, X, ArrowLeft, Loader2, Calendar, BarChart3, Award, Info, ChevronRight } from 'lucide-react'
import useStore from '../../store/useStore'
import { fetchHistoricalData, fetchMultiSymbolData, getPricesAtTime } from '../../lib/historicalDataService'
import { generateTradesFromPrompt } from '../../lib/aiService'
import { runBacktest } from '../../lib/backtestEngine'
import EquityCurve from './EquityCurve'

const INTERVALS = [
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '1h', label: '1h' },
  { id: '4h', label: '4h' },
]

const ASSETS_LIST = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'AVAX/USDT', 'LINK/USDT', 'DOT/USDT', 'NEAR/USDT'
]

const RANGE_PRESETS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
]

// ─── Scoring System ───────────────────────────────────────────────

/**
 * Calculate a grade (A-F) for a backtest based on key metrics
 * Returns { grade, color, bgColor, score, verdict }
 */
const calculateBacktestGrade = (result) => {
  if (!result) return { grade: '?', color: 'text-gray-400', bgColor: 'bg-gray-500/10 border-gray-500/30', score: 0, verdict: 'Sin datos' }

  const pnl = result.totalPnlPercent || 0
  const winRate = result.winRate || 0
  const profitFactor = result.profitFactor === Infinity ? 10 : (result.profitFactor || 0)
  const maxDD = result.maxDrawdown || 0
  const sharpe = result.sharpeRatio || 0
  const totalTrades = result.totalTrades || 0

  // Score each metric (0-100)
  // PnL: -20% = 0pts, 0% = 30pts, +20% = 70pts, +50% = 100pts
  const pnlScore = Math.max(0, Math.min(100, ((pnl + 20) / 70) * 100))

  // Win Rate: 30% = 0pts, 50% = 40pts, 60% = 70pts, 75%+ = 100pts
  const wrScore = Math.max(0, Math.min(100, ((winRate - 30) / 45) * 100))

  // Profit Factor: 0 = 0pts, 1 = 30pts, 1.5 = 60pts, 2.5+ = 100pts
  const pfScore = Math.max(0, Math.min(100, (profitFactor / 2.5) * 100))

  // Max Drawdown (inverted — lower is better): 50% = 0pts, 20% = 50pts, 5% = 100pts
  const ddScore = Math.max(0, Math.min(100, ((50 - maxDD) / 45) * 100))

  // Sharpe Ratio: -1 = 0pts, 0 = 30pts, 1 = 60pts, 2+ = 100pts
  const sharpeScore = Math.max(0, Math.min(100, ((sharpe + 1) / 3) * 100))

  // Trade count penalty — fewer than 5 trades = unreliable
  const tradePenalty = totalTrades < 3 ? 0.5 : totalTrades < 5 ? 0.75 : totalTrades < 10 ? 0.9 : 1.0

  // Weighted composite score
  const rawScore = (
    pnlScore * 0.30 +
    wrScore * 0.20 +
    pfScore * 0.20 +
    ddScore * 0.15 +
    sharpeScore * 0.15
  ) * tradePenalty

  const score = Math.round(rawScore)

  // Grade thresholds
  let grade, color, bgColor
  if (score >= 80) { grade = 'A'; color = 'text-emerald-400'; bgColor = 'bg-emerald-500/10 border-emerald-500/40' }
  else if (score >= 65) { grade = 'B'; color = 'text-accent-cyan'; bgColor = 'bg-accent-cyan/10 border-accent-cyan/40' }
  else if (score >= 50) { grade = 'C'; color = 'text-yellow-400'; bgColor = 'bg-yellow-500/10 border-yellow-500/40' }
  else if (score >= 35) { grade = 'D'; color = 'text-orange-400'; bgColor = 'bg-orange-500/10 border-orange-500/40' }
  else { grade = 'F'; color = 'text-accent-red'; bgColor = 'bg-accent-red/10 border-accent-red/40' }

  // Generate human-readable verdict
  const verdict = generateVerdict(pnl, winRate, profitFactor, maxDD, sharpe, totalTrades, grade)

  return { grade, color, bgColor, score, verdict }
}

/**
 * Generate a contextual verdict in Spanish
 */
const generateVerdict = (pnl, winRate, profitFactor, maxDD, sharpe, totalTrades, grade) => {
  const parts = []

  // Main assessment
  if (grade === 'A') {
    parts.push('Estrategia excelente.')
  } else if (grade === 'B') {
    parts.push('Estrategia buena con potencial.')
  } else if (grade === 'C') {
    parts.push('Resultados medianos.')
  } else if (grade === 'D') {
    parts.push('Estrategia debil.')
  } else {
    parts.push('Estrategia no viable.')
  }

  // PnL insight
  if (pnl > 20) parts.push(`+${pnl.toFixed(1)}% de retorno es fuerte.`)
  else if (pnl > 5) parts.push(`+${pnl.toFixed(1)}% positivo pero moderado.`)
  else if (pnl > 0) parts.push(`+${pnl.toFixed(1)}% apenas cubre costos.`)
  else if (pnl > -5) parts.push(`${pnl.toFixed(1)}% perdida menor.`)
  else parts.push(`${pnl.toFixed(1)}% perdida significativa.`)

  // Key weakness
  if (maxDD > 30) parts.push(`Drawdown de ${maxDD.toFixed(0)}% es muy riesgoso.`)
  else if (winRate < 40 && totalTrades >= 5) parts.push(`Win rate bajo (${winRate.toFixed(0)}%), muchos trades perdedores.`)
  else if (profitFactor < 1 && profitFactor > 0) parts.push(`PF < 1 significa que pierde mas de lo que gana.`)
  else if (profitFactor >= 2) parts.push(`PF de ${profitFactor.toFixed(1)} indica buena relacion riesgo/beneficio.`)

  // Trade count warning
  if (totalTrades < 5) parts.push(`Solo ${totalTrades} trades — resultados poco confiables.`)

  return parts.join(' ')
}

// ─── Component ────────────────────────────────────────────────────

export default function BacktestTab() {
  const backtests = useStore((s) => s.backtests) || []
  const addBacktest = useStore((s) => s.addBacktest)
  const deleteBacktest = useStore((s) => s.deleteBacktest)
  const prompts = useStore((s) => s.prompts) || []
  const settings = useStore((s) => s.settings)

  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState({})

  // Wizard state
  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [selectedAssets, setSelectedAssets] = useState(['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])
  const [selectedInterval, setSelectedInterval] = useState('1h')
  const [rangeDays, setRangeDays] = useState(30)
  const [slippage, setSlippage] = useState(0.1)
  const [takerFee, setTakerFee] = useState(0.1)
  const [samplePoints, setSamplePoints] = useState(5)
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState(null)

  const labWizardOpen = useStore((s) => s.labWizardOpen)
  const setLabWizardOpen = useStore((s) => s.setLabWizardOpen)

  const activePrompts = prompts.filter(p => p.status === 'active')
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId)

  // ─── Group backtests by prompt name ───
  const groupedBacktests = useMemo(() => {
    const groups = {}
    for (const bt of backtests) {
      const key = bt.promptName || 'Unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(bt)
    }
    // Sort groups by most recent backtest, and within each group sort by date desc
    const entries = Object.entries(groups).map(([name, items]) => {
      const sorted = [...items].sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
      return { name, items: sorted, latestTime: sorted[0]?.endTime || 0 }
    })
    entries.sort((a, b) => b.latestTime - a.latestTime)
    return entries
  }, [backtests])

  // Best grade per group (for group header)
  const groupBestGrade = useMemo(() => {
    const map = {}
    for (const group of groupedBacktests) {
      let best = { score: -1 }
      for (const bt of group.items) {
        const g = calculateBacktestGrade(bt.result)
        if (g.score > best.score) best = g
      }
      map[group.name] = best
    }
    return map
  }, [groupedBacktests])

  const toggleGroup = (name) => {
    setCollapsedGroups(prev => ({ ...prev, [name]: !prev[name] }))
  }

  // Listen for FAB trigger
  useEffect(() => {
    if (labWizardOpen) {
      resetWizard()
      setShowWizard(true)
      setLabWizardOpen(false)
    }
  }, [labWizardOpen])

  const toggleAsset = (asset) => {
    setSelectedAssets(prev =>
      prev.includes(asset) ? prev.filter(a => a !== asset) : [...prev, asset]
    )
  }

  const resetWizard = () => {
    setWizardStep(1)
    setSelectedPromptId(null)
    setSelectedAssets(['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])
    setSelectedInterval('1h')
    setRangeDays(30)
    setSlippage(0.1)
    setTakerFee(0.1)
    setSamplePoints(5)
    setRunProgress(null)
  }

  const runBacktestFlow = useCallback(async () => {
    if (!selectedPrompt) return

    setIsRunning(true)
    setWizardStep(3)

    const endTime = Date.now()
    const startTime = endTime - rangeDays * 24 * 60 * 60 * 1000

    // Check API key upfront — map model names to API key names
    const MODEL_TO_KEY = { gemini: 'google', 'gemini-2.5-flash': 'google', 'gemini-2.0-flash': 'google', 'gemini-2.5-flash-lite': 'google', 'gemini-2.5-pro': 'google', claude: 'anthropic', 'claude-sonnet-4-20250514': 'anthropic', 'claude-3-5-sonnet-20241022': 'anthropic', gpt4: 'openai', 'gpt-4': 'openai', 'gpt-4-turbo': 'openai', grok: 'xai', 'grok-3-mini': 'xai', 'grok-3': 'xai', groq: 'groq', 'llama-3.3-70b-versatile': 'groq', 'llama-3.1-8b-instant': 'groq', sambanova: 'sambanova', 'Meta-Llama-3.1-405B-Instruct': 'sambanova', 'Meta-Llama-3.1-70B-Instruct': 'sambanova' }
    const rawProvider = selectedPrompt.aiModel || settings.aiProvider || 'google'
    const aiProvider = MODEL_TO_KEY[rawProvider] || rawProvider
    const apiKey = settings.apiKeys?.[aiProvider]
    if (!apiKey) {
      setRunProgress({ phase: 'error', message: `No API key for ${rawProvider}. Add it in Settings.`, pct: 0 })
      setIsRunning(false)
      return
    }

    let lastError = null

    try {
      // Step 1: Fetch historical data
      setRunProgress({ phase: 'data', message: 'Fetching historical data...', pct: 5 })

      let historicalData
      try {
        historicalData = await fetchMultiSymbolData(
          selectedAssets, selectedInterval, startTime, endTime,
          (symbol, loaded, total, completed, totalSymbols) => {
            const pct = 5 + ((completed / totalSymbols) * 25)
            setRunProgress({ phase: 'data', message: `Loading ${symbol} (${loaded} candles)...`, pct })
          }
        )
      } catch (dataErr) {
        throw new Error(`Historical data fetch failed: ${dataErr.message}`)
      }

      // Validate we got data
      const totalCandles = Object.values(historicalData).reduce((s, c) => s + c.length, 0)
      if (totalCandles === 0) {
        throw new Error('No historical data received from Binance. Try a different time range or assets.')
      }

      setRunProgress({ phase: 'data', message: `Loaded ${totalCandles} candles across ${Object.keys(historicalData).length} assets`, pct: 30 })

      // Step 1.5: Get BTC performance for market context
      let btcContext = null
      try {
        const btcCandles = historicalData['BTC/USDT']
        if (btcCandles && btcCandles.length >= 2) {
          const firstPrice = btcCandles[0].close
          const lastPrice = btcCandles[btcCandles.length - 1].close
          btcContext = {
            startPrice: firstPrice,
            endPrice: lastPrice,
            changePercent: ((lastPrice - firstPrice) / firstPrice) * 100
          }
        }
      } catch (e) {
        // BTC context is optional — continue without it
      }

      // Step 2: Walk-Forward Sampling — call AI at N evenly spaced historical points
      // FIX 4: Each sample window is isolated — trades can only see data within their window
      const allTrades = []
      const step = (endTime - startTime) / samplePoints
      let successfulSamples = 0
      const sampleBoundaries = [] // For walk-forward data isolation

      for (let i = 0; i < samplePoints; i++) {
        const windowStart = startTime + (i * step)
        const windowEnd = startTime + ((i + 1) * step)
        const sampleTime = windowStart + (step * 0.5) // Center of window
        const sampleDate = new Date(sampleTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

        // Record boundary for this sample window
        sampleBoundaries.push({ start: windowStart, end: windowEnd })

        setRunProgress({
          phase: 'ai',
          message: `Sample ${i + 1}/${samplePoints} (prices from ${sampleDate})...`,
          pct: 30 + ((i / samplePoints) * 40)
        })

        try {
          const historicalPrices = getPricesAtTime(historicalData, sampleTime)

          if (!historicalPrices || Object.keys(historicalPrices).length === 0) {
            lastError = `No price data at sample point ${i + 1}`
            console.warn(`Sample ${i + 1}: no prices at ${sampleDate}`)
            continue
          }

          const trades = await generateTradesFromPrompt(
            selectedPrompt,
            settings,
            selectedPrompt.numResults || 3,
            (event, step) => {
              if (step === 'error') {
                setRunProgress({ phase: 'ai', message: `Sample ${i + 1}: ${event.message || 'AI error'}`, pct: 30 + ((i / samplePoints) * 40) })
              }
            },
            historicalPrices
          )

          if (!trades || trades.length === 0) {
            lastError = 'AI returned 0 trades'
            continue
          }

          const mappedTrades = trades.map((t) => ({
            ...t,
            entry: parseFloat(t.entry),
            takeProfit: parseFloat(t.takeProfit),
            stopLoss: parseFloat(t.stopLoss),
            time: sampleTime,
          }))

          allTrades.push(...mappedTrades)
          successfulSamples++
        } catch (err) {
          lastError = err.message
          console.warn(`Walk-forward sample ${i + 1} failed:`, err.message)
          setRunProgress({
            phase: 'ai',
            message: `Sample ${i + 1} failed: ${err.message.slice(0, 80)}...`,
            pct: 30 + ((i / samplePoints) * 40)
          })
          await new Promise(r => setTimeout(r, 2000))
        }
      }

      if (allTrades.length === 0) {
        throw new Error(`All ${samplePoints} sample points failed. Last error: ${lastError || 'Unknown'}`)
      }

      // Step 3: Run single backtest with all collected trades
      setRunProgress({
        phase: 'backtest',
        message: `Simulating ${allTrades.length} trades across ${successfulSamples} sample points...`,
        pct: 75
      })

      const avgResult = runBacktest({
        trades: allTrades,
        historicalData,
        initialCapital: selectedPrompt.capital || 1000,
        leverage: selectedPrompt.leverage || 5,
        slippage: slippage / 100,
        takerFee: takerFee / 100,
        sampleBoundaries // FIX 4: Walk-forward isolation — trades only see data within their window
      })

      const successMsg = successfulSamples < samplePoints
        ? `Backtest done (${successfulSamples}/${samplePoints} samples, ${allTrades.length} trades)`
        : `Backtest complete! (${allTrades.length} trades across ${samplePoints} samples)`

      setRunProgress({ phase: 'done', message: successMsg, pct: 100 })

      // Save backtest with BTC context
      addBacktest({
        promptId: selectedPrompt.id,
        promptName: selectedPrompt.name,
        assets: selectedAssets,
        interval: selectedInterval,
        rangeDays,
        startTime,
        endTime,
        slippage,
        takerFee,
        samplePoints,
        runsCompleted: successfulSamples,
        btcContext,
        config: {
          capital: selectedPrompt.capital,
          leverage: selectedPrompt.leverage,
          aiModel: selectedPrompt.aiModel,
        },
        result: avgResult,
        status: 'completed'
      })

      await new Promise(r => setTimeout(r, 1200))
      setShowWizard(false)
      resetWizard()

    } catch (err) {
      console.error('Backtest failed:', err)
      setRunProgress({ phase: 'error', message: err.message, pct: 0 })
    } finally {
      setIsRunning(false)
    }
  }, [selectedPrompt, selectedAssets, selectedInterval, rangeDays, slippage, takerFee, samplePoints, settings, addBacktest])

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Results list */}
      {backtests.length === 0 && !showWizard ? (
        <div className="text-center py-12">
          <BarChart3 size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No backtests yet</p>
          <p className="text-[10px] text-gray-600 mb-4">Test your prompts against historical data</p>
          <button
            onClick={() => { resetWizard(); setShowWizard(true) }}
            className="px-4 py-2 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-xs font-medium"
          >
            <Plus size={14} className="inline mr-1" />
            Run Backtest
          </button>
        </div>
      ) : (
        <>
          {!showWizard && (
            <button
              onClick={() => { resetWizard(); setShowWizard(true) }}
              className="w-full p-3 rounded-xl border border-dashed border-quant-border text-gray-400 text-xs hover:border-accent-cyan hover:text-accent-cyan transition-all"
            >
              <Plus size={14} className="inline mr-1" />
              New Backtest
            </button>
          )}

          {/* Grouped backtests */}
          {groupedBacktests.map((group) => {
            const isCollapsed = collapsedGroups[group.name]
            const bestGrade = groupBestGrade[group.name] || { grade: '?', color: 'text-gray-400', bgColor: 'bg-gray-500/10 border-gray-500/30' }

            return (
              <div key={group.name} className="space-y-2">
                {/* Group Header */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-quant-surface/50 border border-quant-border hover:border-gray-600 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <motion.div
                      animate={{ rotate: isCollapsed ? 0 : 90 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ChevronRight size={14} className="text-gray-500" />
                    </motion.div>
                    <span className="text-sm font-semibold text-white truncate">{group.name}</span>
                    <span className="text-[10px] text-gray-500 shrink-0">
                      {group.items.length} run{group.items.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Best grade badge */}
                    <div className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${bestGrade.bgColor} ${bestGrade.color}`}>
                      Mejor: {bestGrade.grade}
                    </div>
                  </div>
                </button>

                {/* Group Items */}
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-2 overflow-hidden pl-2"
                    >
                      {group.items.map((bt) => (
                        <BacktestCard
                          key={bt.id}
                          bt={bt}
                          isExpanded={expandedId === bt.id}
                          onToggle={() => setExpandedId(expandedId === bt.id ? null : bt.id)}
                          onDelete={() => deleteBacktest(bt.id)}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </>
      )}

      {/* Wizard Modal */}
      <AnimatePresence>
        {showWizard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!isRunning) { setShowWizard(false); resetWizard() } }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-quant-card rounded-t-3xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-4 flex items-center justify-between border-b border-quant-border shrink-0">
                <div className="flex items-center gap-3">
                  {wizardStep > 1 && !isRunning && (
                    <button onClick={() => setWizardStep(Math.max(1, wizardStep - 1))} className="p-1">
                      <ArrowLeft size={18} className="text-gray-400" />
                    </button>
                  )}
                  <div>
                    <h2 className="text-base font-bold text-white">
                      {wizardStep === 3 ? 'Running Backtest' : 'New Backtest'}
                    </h2>
                    <p className="text-[10px] text-gray-500">
                      {wizardStep === 1 ? 'Select a strategy to test' : wizardStep === 2 ? 'Configure parameters' : runProgress?.message}
                    </p>
                  </div>
                </div>
                {!isRunning && (
                  <button onClick={() => { setShowWizard(false); resetWizard() }} className="p-2 rounded-full hover:bg-quant-surface">
                    <X size={18} className="text-gray-400" />
                  </button>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto hide-scrollbar p-4">
                {/* Step 1: Select Prompt */}
                {wizardStep === 1 && (
                  <div className="space-y-2">
                    {activePrompts.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-8">No active prompts. Create one first.</p>
                    ) : (
                      activePrompts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPromptId(p.id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all ${
                            selectedPromptId === p.id
                              ? 'bg-accent-cyan/10 border-accent-cyan/30'
                              : 'bg-quant-surface border-quant-border hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full border-2 ${selectedPromptId === p.id ? 'border-accent-cyan bg-accent-cyan' : 'border-gray-500'}`} />
                            <span className="text-sm font-medium text-white">{p.name}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1 ml-5 line-clamp-1">
                            {p.executionTime} · {p.aiModel} · ${p.capital} · {p.leverage}x
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Step 2: Configure */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    {/* Date Range */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Date Range</label>
                      <div className="flex gap-2 mt-1">
                        {RANGE_PRESETS.map((p) => (
                          <button
                            key={p.days}
                            onClick={() => setRangeDays(p.days)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                              rangeDays === p.days
                                ? 'bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan'
                                : 'bg-quant-surface border border-quant-border text-gray-400'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Interval */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Candle Interval</label>
                      <div className="flex gap-2 mt-1">
                        {INTERVALS.map((itv) => (
                          <button
                            key={itv.id}
                            onClick={() => setSelectedInterval(itv.id)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                              selectedInterval === itv.id
                                ? 'bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan'
                                : 'bg-quant-surface border border-quant-border text-gray-400'
                            }`}
                          >
                            {itv.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Assets */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Assets</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ASSETS_LIST.map((asset) => (
                          <button
                            key={asset}
                            onClick={() => toggleAsset(asset)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                              selectedAssets.includes(asset)
                                ? 'bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan'
                                : 'bg-quant-surface border border-quant-border text-gray-500'
                            }`}
                          >
                            {asset.replace('/USDT', '')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Walk-Forward Sample Points */}
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Walk-Forward Samples</label>
                      <p className="text-[9px] text-gray-600 mb-1">AI analyzes historical prices at N points across the range</p>
                      <input
                        type="range" min="3" max="10" step="1"
                        value={samplePoints}
                        onChange={(e) => setSamplePoints(parseInt(e.target.value))}
                        className="w-full h-1.5 accent-accent-cyan"
                      />
                      <div className="text-right text-[10px] text-accent-cyan font-mono">{samplePoints} sample{samplePoints > 1 ? 's' : ''}</div>
                    </div>

                    {/* Fees */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Slippage %</label>
                        <input
                          type="number" step="0.01" min="0" max="1"
                          value={slippage}
                          onChange={(e) => setSlippage(parseFloat(e.target.value) || 0)}
                          className="w-full mt-1 bg-quant-surface border border-quant-border rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider">Taker Fee %</label>
                        <input
                          type="number" step="0.01" min="0" max="1"
                          value={takerFee}
                          onChange={(e) => setTakerFee(parseFloat(e.target.value) || 0)}
                          className="w-full mt-1 bg-quant-surface border border-quant-border rounded-lg px-3 py-2 text-xs text-white font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Running */}
                {wizardStep === 3 && (
                  <div className="py-4 space-y-4">
                    <div className="w-full bg-quant-surface rounded-full h-2 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${runProgress?.phase === 'error' ? 'bg-accent-red' : runProgress?.phase === 'done' ? 'bg-accent-green' : 'bg-accent-cyan'}`}
                        animate={{ width: `${runProgress?.pct || 0}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="text-center">
                      {isRunning ? (
                        <Loader2 size={32} className="text-accent-cyan animate-spin mx-auto mb-2" />
                      ) : runProgress?.phase === 'done' ? (
                        <div className="text-accent-green text-lg mb-2">✓</div>
                      ) : runProgress?.phase === 'error' ? (
                        <div className="text-accent-red text-lg mb-2">✗</div>
                      ) : null}
                      <p className="text-xs text-gray-400">{runProgress?.message}</p>
                    </div>
                    {runProgress?.phase === 'error' && (
                      <button
                        onClick={() => { setShowWizard(false); resetWizard() }}
                        className="w-full p-3 rounded-xl bg-quant-surface border border-quant-border text-xs text-gray-300"
                      >
                        Close
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              {wizardStep < 3 && (
                <div className="px-4 pb-6 pt-2 border-t border-quant-border shrink-0 safe-area-bottom">
                  {wizardStep === 1 && (
                    <button
                      onClick={() => selectedPromptId && setWizardStep(2)}
                      disabled={!selectedPromptId}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Continue
                    </button>
                  )}
                  {wizardStep === 2 && (
                    <button
                      onClick={runBacktestFlow}
                      disabled={selectedAssets.length === 0}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-sm disabled:opacity-40"
                      style={{ boxShadow: '0 0 20px rgba(0, 240, 255, 0.25)' }}
                    >
                      <Play size={16} className="inline mr-1" />
                      Run Backtest
                    </button>
                  )}
                </div>
              )}

              {wizardStep >= 3 && <div className="h-6 safe-area-bottom" />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Backtest Card Component ──────────────────────────────────────

function BacktestCard({ bt, isExpanded, onToggle, onDelete }) {
  const r = bt.result || {}
  const isProfitable = (r.totalPnlPercent || 0) >= 0
  const gradeInfo = useMemo(() => calculateBacktestGrade(r), [r])
  const btcCtx = bt.btcContext

  // Format date
  const dateStr = bt.endTime
    ? new Date(bt.endTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <motion.div
      layout
      className="bg-quant-card border border-quant-border rounded-xl overflow-hidden"
    >
      <button
        onClick={onToggle}
        className="w-full p-3 text-left"
      >
        {/* Top row: grade + config + PnL */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Grade badge */}
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-sm font-black shrink-0 ${gradeInfo.bgColor} ${gradeInfo.color}`}>
              {gradeInfo.grade}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">{bt.rangeDays}d · {bt.interval} · {bt.config?.aiModel || '?'}</span>
              </div>
              <span className="text-[10px] text-gray-600">{dateStr}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-base font-mono font-black ${isProfitable ? 'text-accent-green' : 'text-accent-red'}`}>
              {isProfitable ? '+' : ''}{(r.totalPnlPercent || 0).toFixed(1)}%
            </span>
            {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </div>

        {/* Mini stats row */}
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {[
            { label: 'Win Rate', value: `${(r.winRate || 0).toFixed(0)}%`, color: (r.winRate || 0) >= 50 ? 'text-accent-green' : 'text-accent-red' },
            { label: 'PF', value: (r.profitFactor || 0) === Infinity ? '∞' : (r.profitFactor || 0).toFixed(2), color: (r.profitFactor || 0) >= 1.5 ? 'text-accent-green' : (r.profitFactor || 0) >= 1 ? 'text-yellow-400' : 'text-accent-red' },
            { label: 'Max DD', value: `-${(r.maxDrawdown || 0).toFixed(1)}%`, color: 'text-accent-red' },
            { label: 'Trades', value: Math.round(r.totalTrades || 0), color: 'text-white' },
          ].map((stat) => (
            <div key={stat.label} className="bg-quant-surface rounded-lg p-1.5 text-center">
              <div className={`text-[10px] font-mono font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-[8px] text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Verdict text */}
        <p className="text-[10px] text-gray-400 leading-relaxed">{gradeInfo.verdict}</p>

        {/* BTC Market Context */}
        {btcCtx && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
            <span className="text-gray-600">BTC en el mismo periodo:</span>
            <span className={`font-mono font-bold ${btcCtx.changePercent >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {btcCtx.changePercent >= 0 ? '+' : ''}{btcCtx.changePercent.toFixed(1)}%
            </span>
            <span className="text-gray-600">
              (${btcCtx.startPrice?.toLocaleString()} → ${btcCtx.endPrice?.toLocaleString()})
            </span>
          </div>
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-quant-border"
          >
            <div className="p-3 space-y-3">
              {/* Score detail */}
              <div className="bg-quant-surface rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Score Breakdown</span>
                  <span className={`text-xs font-black ${gradeInfo.color}`}>{gradeInfo.score}/100</span>
                </div>
                <div className="w-full h-2 bg-quant-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      gradeInfo.score >= 80 ? 'bg-emerald-500' :
                      gradeInfo.score >= 65 ? 'bg-accent-cyan' :
                      gradeInfo.score >= 50 ? 'bg-yellow-500' :
                      gradeInfo.score >= 35 ? 'bg-orange-500' :
                      'bg-accent-red'
                    }`}
                    style={{ width: `${gradeInfo.score}%` }}
                  />
                </div>
              </div>

              {/* Equity curve */}
              {r.equityCurve && r.equityCurve.length > 1 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Equity Curve</p>
                  <EquityCurve data={r.equityCurve} height={100} />
                </div>
              )}

              {/* Extended stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Sharpe', value: (r.sharpeRatio || 0).toFixed(2) },
                  { label: 'Wins', value: Math.round(r.wins || 0) },
                  { label: 'Losses', value: Math.round(r.losses || 0) },
                  { label: 'Capital', value: `$${(r.initialCapital || 0).toLocaleString()}` },
                  { label: 'Final', value: `$${(r.finalCapital || 0).toFixed(0)}` },
                  { label: 'Samples', value: bt.samplePoints || 1 },
                ].map((stat) => (
                  <div key={stat.label} className="bg-quant-surface rounded-lg p-2 text-center">
                    <div className="text-xs font-mono font-bold text-white">{stat.value}</div>
                    <div className="text-[9px] text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Trade list */}
              {r.trades && r.trades.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Trades ({r.trades.length})</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto hide-scrollbar">
                    {r.trades.slice(0, 20).map((t, i) => (
                      <div key={i} className="flex items-center justify-between py-1 px-2 bg-quant-surface rounded-lg text-[10px]">
                        <span className="text-gray-400">{t.asset} {t.strategy}</span>
                        <span className={`font-mono font-bold ${(t.pnlPercent || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                          {(t.pnlPercent || 0) >= 0 ? '+' : ''}{(t.pnlPercent || 0).toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delete */}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete() }}
                className="w-full p-2 rounded-lg text-[10px] text-accent-red/60 hover:text-accent-red hover:bg-accent-red/10 transition-all"
              >
                <Trash2 size={12} className="inline mr-1" />
                Delete backtest
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
