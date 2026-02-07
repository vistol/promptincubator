import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Trophy, X, ArrowLeft, Play, Trash2, ChevronDown, ChevronUp,
  Loader2, Crown, Medal
} from 'lucide-react'
import useStore from '../../store/useStore'
import { fetchMultiSymbolData, getPricesAtTime } from '../../lib/historicalDataService'
import { generateTradesFromPrompt } from '../../lib/aiService'
import { runBenchmark, generateRadarData } from '../../lib/benchmarkEngine'
import { STRATEGIES } from '../../lib/technicalStrategies'
import EquityCurve from './EquityCurve'

const ASSETS_LIST = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'AVAX/USDT', 'LINK/USDT'
]

const RANGE_PRESETS = [
  { label: '1W', days: 7 },
  { label: '2W', days: 14 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
]

const STRATEGY_COLORS = {
  prompt: '#00f0ff',
  stochastic: '#8b5cf6',
  vwap: '#f97316',
  tripleEMA: '#10b981',
  adx: '#3b82f6',
  rsi: '#fbbf24',
  bollingerBands: '#ef4444',
  macd: '#ec4899',
}

export default function BenchmarkTab() {
  const benchmarks = useStore((s) => s.benchmarks) || []
  const addBenchmark = useStore((s) => s.addBenchmark)
  const deleteBenchmark = useStore((s) => s.deleteBenchmark)
  const prompts = useStore((s) => s.prompts) || []
  const settings = useStore((s) => s.settings)

  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedTab, setExpandedTab] = useState('ranking')

  // Wizard state
  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [selectedStrategies, setSelectedStrategies] = useState(['stochastic', 'vwap', 'tripleEMA', 'adx'])
  const [selectedAssets, setSelectedAssets] = useState(['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])
  const [rangeDays, setRangeDays] = useState(30)
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState(null)

  const labWizardOpen = useStore((s) => s.labWizardOpen)
  const setLabWizardOpen = useStore((s) => s.setLabWizardOpen)

  const activePrompts = prompts.filter(p => p.status === 'active')
  const selectedPrompt = prompts.find(p => p.id === selectedPromptId)

  // Listen for FAB trigger
  useEffect(() => {
    if (labWizardOpen) {
      resetWizard()
      setShowWizard(true)
      setLabWizardOpen(false)
    }
  }, [labWizardOpen])

  const toggleStrategy = (id) => {
    setSelectedStrategies(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleAsset = (asset) => {
    setSelectedAssets(prev =>
      prev.includes(asset) ? prev.filter(a => a !== asset) : [...prev, asset]
    )
  }

  const resetWizard = () => {
    setWizardStep(1)
    setSelectedPromptId(null)
    setSelectedStrategies(['stochastic', 'vwap', 'tripleEMA', 'adx'])
    setSelectedAssets(['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])
    setRangeDays(30)
    setRunProgress(null)
  }

  const runBenchmarkFlow = useCallback(async () => {
    if (!selectedPrompt) return

    setIsRunning(true)
    setWizardStep(3)

    const endTime = Date.now()
    const startTime = endTime - rangeDays * 24 * 60 * 60 * 1000

    try {
      // 1. Fetch historical data
      setRunProgress({ message: 'Fetching historical data...', pct: 10 })

      const historicalData = await fetchMultiSymbolData(
        selectedAssets, '1h', startTime, endTime
      )

      // 2. Walk-Forward: Generate prompt trades at 3 sample points using historical prices
      const MODEL_TO_KEY = { gemini: 'google', 'gemini-2.5-flash': 'google', 'gemini-2.0-flash': 'google', 'gemini-2.5-flash-lite': 'google', 'gemini-2.5-pro': 'google', claude: 'anthropic', 'claude-sonnet-4-20250514': 'anthropic', 'claude-3-5-sonnet-20241022': 'anthropic', gpt4: 'openai', 'gpt-4': 'openai', 'gpt-4-turbo': 'openai', grok: 'xai', 'grok-3-mini': 'xai', 'grok-3': 'xai', groq: 'groq', 'llama-3.3-70b-versatile': 'groq', 'llama-3.1-8b-instant': 'groq', sambanova: 'sambanova', 'Meta-Llama-3.1-405B-Instruct': 'sambanova', 'Meta-Llama-3.1-70B-Instruct': 'sambanova' }
      const rawProvider = selectedPrompt.aiModel || settings.aiProvider || 'google'
      const aiProvider = MODEL_TO_KEY[rawProvider] || rawProvider
      const apiKey = settings.apiKeys?.[aiProvider]

      let promptTrades = []
      const benchmarkSamples = 3 // Fixed 3 sample points for benchmark (cost-effective)

      if (!apiKey) {
        setRunProgress({ message: `No API key for ${rawProvider} (${aiProvider}) — skipping prompt, running classics only...`, pct: 35 })
      } else {
        const step = (endTime - startTime) / benchmarkSamples

        for (let i = 0; i < benchmarkSamples; i++) {
          const sampleTime = startTime + (i * step) + (step * 0.5)
          const sampleDate = new Date(sampleTime).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

          setRunProgress({ message: `AI sample ${i + 1}/${benchmarkSamples} (${sampleDate})...`, pct: 20 + ((i / benchmarkSamples) * 20) })

          try {
            const historicalPrices = getPricesAtTime(historicalData, sampleTime)

            if (!historicalPrices || Object.keys(historicalPrices).length === 0) {
              console.warn(`Benchmark sample ${i + 1}: no prices at ${sampleDate}`)
              continue
            }

            const trades = await generateTradesFromPrompt(
              selectedPrompt, settings, selectedPrompt.numResults || 3,
              (event, eventStep) => {
                if (eventStep === 'error') {
                  setRunProgress({ message: `AI sample ${i + 1}: ${event.message || 'Unknown'}`, pct: 20 + ((i / benchmarkSamples) * 20) })
                }
              },
              historicalPrices // Walk-forward: use historical prices
            )

            if (trades && trades.length > 0) {
              const mappedTrades = trades.map((t) => ({
                ...t,
                entry: parseFloat(t.entry),
                takeProfit: parseFloat(t.takeProfit),
                stopLoss: parseFloat(t.stopLoss),
                time: sampleTime
              }))
              promptTrades.push(...mappedTrades)
            }
          } catch (err) {
            console.warn(`Benchmark sample ${i + 1} failed:`, err.message)
            setRunProgress({ message: `AI sample ${i + 1} failed: ${err.message.slice(0, 60)}...`, pct: 20 + ((i / benchmarkSamples) * 20) })
            await new Promise(r => setTimeout(r, 2000))
          }
        }

        if (promptTrades.length === 0) {
          setRunProgress({ message: 'AI generated 0 trades, running classics only...', pct: 35 })
        }
      }

      // 3. Run benchmark
      const result = await runBenchmark({
        promptTrades,
        promptName: selectedPrompt.name,
        strategyIds: selectedStrategies,
        historicalData,
        assets: selectedAssets,
        initialCapital: selectedPrompt.capital || 1000,
        leverage: selectedPrompt.leverage || 5,
        slippage: 0.001,
        takerFee: 0.001,
        onProgress: (step, total, label) => {
          const pct = 40 + ((step / total) * 55)
          setRunProgress({ message: label, pct })
        }
      })

      setRunProgress({ message: 'Benchmark complete!', pct: 100 })

      addBenchmark({
        promptId: selectedPrompt.id,
        promptName: selectedPrompt.name,
        strategyIds: selectedStrategies,
        assets: selectedAssets,
        rangeDays,
        startTime,
        endTime,
        result,
        radarData: generateRadarData(result.results),
        status: 'completed'
      })

      await new Promise(r => setTimeout(r, 800))
      setShowWizard(false)
      resetWizard()

    } catch (err) {
      setRunProgress({ message: `Error: ${err.message}`, pct: 0, error: true })
    } finally {
      setIsRunning(false)
    }
  }, [selectedPrompt, selectedStrategies, selectedAssets, rangeDays, settings, addBenchmark])

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown size={14} className="text-accent-yellow" />
    if (rank === 2) return <Medal size={14} className="text-gray-300" />
    if (rank === 3) return <Medal size={14} className="text-accent-orange" />
    return <span className="text-[10px] text-gray-500 font-mono w-3.5 text-center">#{rank}</span>
  }

  return (
    <div className="space-y-3">
      {/* Results list */}
      {benchmarks.length === 0 && !showWizard ? (
        <div className="text-center py-12">
          <Trophy size={48} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No benchmarks yet</p>
          <p className="text-[10px] text-gray-600 mb-4">Compare your prompts against classic strategies</p>
          <button
            onClick={() => { resetWizard(); setShowWizard(true) }}
            className="px-4 py-2 rounded-xl bg-accent-orange/10 border border-accent-orange/30 text-accent-orange text-xs font-medium"
          >
            <Plus size={14} className="inline mr-1" />
            Run Benchmark
          </button>
        </div>
      ) : (
        <>
          {!showWizard && (
            <button
              onClick={() => { resetWizard(); setShowWizard(true) }}
              className="w-full p-3 rounded-xl border border-dashed border-quant-border text-gray-400 text-xs hover:border-accent-orange hover:text-accent-orange transition-all"
            >
              <Plus size={14} className="inline mr-1" />
              New Benchmark
            </button>
          )}

          {benchmarks.map((bm) => {
            const isExpanded = expandedId === bm.id
            const r = bm.result || {}
            const results = r.results || []
            const promptResult = results.find(x => x.type === 'prompt')

            return (
              <motion.div
                key={bm.id}
                layout
                className="bg-quant-card border border-quant-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : bm.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Trophy size={14} className="text-accent-orange" />
                      <span className="text-sm font-medium text-white truncate">{bm.promptName} vs Classics</span>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>

                  <p className="text-[10px] text-gray-500 mb-2">
                    {bm.assets?.join(', ')} · {bm.rangeDays}d · {results.length} strategies
                  </p>

                  {/* Ranking bars */}
                  <div className="space-y-1">
                    {results.slice(0, 5).map((res) => {
                      const maxPnl = Math.max(...results.map(r => Math.abs(r.totalPnlPercent || 0)), 1)
                      const barWidth = Math.max(5, (Math.abs(res.totalPnlPercent || 0) / maxPnl) * 100)
                      const isPrompt = res.type === 'prompt'
                      const isProfitable = (res.totalPnlPercent || 0) >= 0

                      return (
                        <div key={res.id} className="flex items-center gap-2">
                          <div className="w-4 flex justify-center shrink-0">{getRankIcon(res.rank)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-[10px] truncate ${isPrompt ? 'text-accent-cyan font-bold' : 'text-gray-400'}`}>
                                {res.icon} {res.shortName || res.name}
                              </span>
                            </div>
                            <div className="w-full bg-quant-surface rounded-full h-1.5">
                              <div
                                className={`h-full rounded-full ${isPrompt ? 'bg-accent-cyan' : isProfitable ? 'bg-gray-500' : 'bg-accent-red/50'}`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                          <span className={`text-[10px] font-mono font-bold shrink-0 ${isProfitable ? 'text-accent-green' : 'text-accent-red'}`}>
                            {isProfitable ? '+' : ''}{(res.totalPnlPercent || 0).toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </button>

                {/* Expanded */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-quant-border"
                    >
                      <div className="p-3 space-y-3">
                        {/* Sub-tabs */}
                        <div className="flex gap-1 bg-quant-surface rounded-lg p-0.5">
                          {['ranking', 'metrics', 'equity'].map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setExpandedTab(tab)}
                              className={`flex-1 py-1.5 rounded-md text-[10px] font-medium capitalize transition-all ${
                                expandedTab === tab ? 'bg-quant-card text-white shadow' : 'text-gray-500'
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>

                        {/* Ranking view */}
                        {expandedTab === 'ranking' && (
                          <div className="space-y-1">
                            {results.map((res) => {
                              const isProfitable = (res.totalPnlPercent || 0) >= 0
                              const isPrompt = res.type === 'prompt'
                              return (
                                <div
                                  key={res.id}
                                  className={`flex items-center justify-between p-2 rounded-lg ${isPrompt ? 'bg-accent-cyan/5 border border-accent-cyan/20' : 'bg-quant-surface'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    {getRankIcon(res.rank)}
                                    <span className={`text-xs ${isPrompt ? 'text-accent-cyan font-medium' : 'text-gray-300'}`}>
                                      {res.icon} {res.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[10px] font-mono">
                                    <span className="text-gray-500">{res.totalTrades}t</span>
                                    <span className="text-gray-500">{(res.winRate || 0).toFixed(0)}%w</span>
                                    <span className={`font-bold ${isProfitable ? 'text-accent-green' : 'text-accent-red'}`}>
                                      {isProfitable ? '+' : ''}{(res.totalPnlPercent || 0).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Metrics table */}
                        {expandedTab === 'metrics' && (
                          <div className="overflow-x-auto hide-scrollbar">
                            <table className="w-full text-[10px]">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1 pr-2">Strategy</th>
                                  <th className="text-right py-1 px-1">PnL</th>
                                  <th className="text-right py-1 px-1">Win%</th>
                                  <th className="text-right py-1 px-1">PF</th>
                                  <th className="text-right py-1 px-1">DD</th>
                                  <th className="text-right py-1 pl-1">Sharpe</th>
                                </tr>
                              </thead>
                              <tbody>
                                {results.map((res) => {
                                  const isPrompt = res.type === 'prompt'
                                  const isProfitable = (res.totalPnlPercent || 0) >= 0
                                  return (
                                    <tr key={res.id} className={isPrompt ? 'text-accent-cyan' : 'text-gray-300'}>
                                      <td className="py-1 pr-2 font-medium">{res.icon} {res.shortName}</td>
                                      <td className={`py-1 px-1 text-right font-mono font-bold ${isProfitable ? 'text-accent-green' : 'text-accent-red'}`}>
                                        {isProfitable ? '+' : ''}{(res.totalPnlPercent || 0).toFixed(1)}%
                                      </td>
                                      <td className="py-1 px-1 text-right font-mono">{(res.winRate || 0).toFixed(0)}%</td>
                                      <td className="py-1 px-1 text-right font-mono">
                                        {(res.profitFactor || 0) === Infinity ? '∞' : (res.profitFactor || 0).toFixed(2)}
                                      </td>
                                      <td className="py-1 px-1 text-right font-mono text-accent-red">-{(res.maxDrawdown || 0).toFixed(1)}%</td>
                                      <td className="py-1 pl-1 text-right font-mono">{(res.sharpeRatio || 0).toFixed(2)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Equity curves */}
                        {expandedTab === 'equity' && (
                          <div className="space-y-2">
                            {results.filter(r => r.equityCurve?.length > 1).map((res) => (
                              <div key={res.id}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-[10px] ${res.type === 'prompt' ? 'text-accent-cyan' : 'text-gray-400'}`}>
                                    {res.icon} {res.shortName}
                                  </span>
                                  <span className={`text-[10px] font-mono font-bold ${(res.totalPnlPercent || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                                    {(res.totalPnlPercent || 0) >= 0 ? '+' : ''}{(res.totalPnlPercent || 0).toFixed(1)}%
                                  </span>
                                </div>
                                <EquityCurve
                                  data={res.equityCurve}
                                  height={50}
                                  color={STRATEGY_COLORS[res.id] || '#6b7280'}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Delete */}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteBenchmark(bm.id) }}
                          className="w-full p-2 rounded-lg text-[10px] text-accent-red/60 hover:text-accent-red hover:bg-accent-red/10 transition-all"
                        >
                          <Trash2 size={12} className="inline mr-1" />
                          Delete benchmark
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
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
                      {wizardStep === 3 ? 'Running Benchmark' : 'New Benchmark'}
                    </h2>
                    <p className="text-[10px] text-gray-500">
                      {wizardStep === 1 ? 'Select prompt & challengers' : wizardStep === 2 ? 'Configure test' : runProgress?.message}
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
                {/* Step 1: Select prompt and strategies */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Challenge Prompt</label>
                      {activePrompts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPromptId(p.id)}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs mb-1.5 transition-all ${
                            selectedPromptId === p.id
                              ? 'bg-accent-cyan/10 border-accent-cyan/30 text-white'
                              : 'bg-quant-surface border-quant-border text-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full border-2 ${selectedPromptId === p.id ? 'border-accent-cyan bg-accent-cyan' : 'border-gray-500'}`} />
                            {p.name}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 block">Challengers</label>
                      <div className="space-y-1.5">
                        {Object.values(STRATEGIES).map((s) => (
                          <button
                            key={s.id}
                            onClick={() => toggleStrategy(s.id)}
                            className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                              selectedStrategies.includes(s.id)
                                ? 'bg-accent-orange/10 border-accent-orange/20'
                                : 'bg-quant-surface border-quant-border'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[8px] ${
                                selectedStrategies.includes(s.id) ? 'border-accent-orange bg-accent-orange text-white' : 'border-gray-500'
                              }`}>
                                {selectedStrategies.includes(s.id) ? '✓' : ''}
                              </div>
                              <span className="text-xs text-white">{s.icon} {s.name}</span>
                              <span className="text-[10px] text-gray-600">{s.params}</span>
                            </div>
                            <p className="text-[9px] text-gray-500 ml-6 mt-0.5">{s.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Configure */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Date Range</label>
                      <div className="flex gap-2 mt-1">
                        {RANGE_PRESETS.map((p) => (
                          <button
                            key={p.days}
                            onClick={() => setRangeDays(p.days)}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                              rangeDays === p.days
                                ? 'bg-accent-orange/10 border border-accent-orange/30 text-accent-orange'
                                : 'bg-quant-surface border border-quant-border text-gray-400'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Assets</label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {ASSETS_LIST.map((asset) => (
                          <button
                            key={asset}
                            onClick={() => toggleAsset(asset)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                              selectedAssets.includes(asset)
                                ? 'bg-accent-orange/10 border border-accent-orange/30 text-accent-orange'
                                : 'bg-quant-surface border border-quant-border text-gray-500'
                            }`}
                          >
                            {asset.replace('/USDT', '')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-quant-surface rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Summary</p>
                      <div className="text-xs text-gray-300 space-y-1">
                        <div>Prompt: <span className="text-accent-cyan">{selectedPrompt?.name}</span></div>
                        <div>vs: <span className="text-accent-orange">{selectedStrategies.length} strategies</span></div>
                        <div>Period: <span className="text-white">{rangeDays} days</span></div>
                        <div>Assets: <span className="text-white">{selectedAssets.length} pairs</span></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Running */}
                {wizardStep === 3 && (
                  <div className="py-4 space-y-4">
                    <div className="w-full bg-quant-surface rounded-full h-2 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${runProgress?.error ? 'bg-accent-red' : (runProgress?.pct || 0) >= 100 ? 'bg-accent-green' : 'bg-accent-orange'}`}
                        animate={{ width: `${runProgress?.pct || 0}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div className="text-center">
                      {isRunning ? (
                        <Loader2 size={32} className="text-accent-orange animate-spin mx-auto mb-2" />
                      ) : (runProgress?.pct || 0) >= 100 ? (
                        <div className="text-accent-green text-lg mb-2">✓</div>
                      ) : runProgress?.error ? (
                        <div className="text-accent-red text-lg mb-2">✗</div>
                      ) : null}
                      <p className="text-xs text-gray-400">{runProgress?.message}</p>
                    </div>
                    {runProgress?.error && (
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
                      onClick={() => selectedPromptId && selectedStrategies.length > 0 && setWizardStep(2)}
                      disabled={!selectedPromptId || selectedStrategies.length === 0}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-orange to-accent-yellow text-quant-bg font-bold text-sm disabled:opacity-40"
                    >
                      Continue
                    </button>
                  )}
                  {wizardStep === 2 && (
                    <button
                      onClick={runBenchmarkFlow}
                      disabled={selectedAssets.length === 0}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-orange to-accent-yellow text-quant-bg font-bold text-sm disabled:opacity-40"
                      style={{ boxShadow: '0 0 20px rgba(249, 115, 22, 0.25)' }}
                    >
                      <Play size={16} className="inline mr-1" />
                      Run Benchmark
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
