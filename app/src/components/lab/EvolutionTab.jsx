import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dna, Sprout, Trophy, GitBranch, BarChart3,
  Play, Loader2, Award, TrendingUp, TrendingDown,
  Download, Zap, RefreshCw, ChevronDown, ChevronUp,
  Info, Clock, Trash2
} from 'lucide-react'
import useStore from '../../store/useStore'
import { autoBacktestPrompt, tournamentRank } from '../../lib/autoBacktest'
import { fetchFreqtradeStrategies, fetchPineScriptStrategies, fetchAllFuturesData, formatMarketDataForLLM } from '../../lib/strategyImporter'
import { crossover, mutate, innovate } from '../../lib/evolutionEngine'

export default function EvolutionTab() {
  const prompts = useStore((s) => s.prompts) || []
  const settings = useStore((s) => s.settings)
  const addPrompt = useStore((s) => s.addPrompt)
  const addBacktest = useStore((s) => s.addBacktest)
  const evolution = useStore((s) => s.evolution)
  const setEvolutionStatus = useStore((s) => s.setEvolutionStatus)
  const addEvolutionLog = useStore((s) => s.addEvolutionLog)
  const clearEvolutionLog = useStore((s) => s.clearEvolutionLog)
  const setEvolutionRankings = useStore((s) => s.setEvolutionRankings)
  const addEvolutionGeneration = useStore((s) => s.addEvolutionGeneration)
  const addImportedStrategy = useStore((s) => s.addImportedStrategy)
  const setEvolutionMarketData = useStore((s) => s.setEvolutionMarketData)
  const resetEvolution = useStore((s) => s.resetEvolution)

  const [showHistory, setShowHistory] = useState(false)
  const [showLog, setShowLog] = useState(true)
  const logEndRef = useRef(null)

  const activePrompts = prompts.filter(p => p.status === 'active')
  const isRunning = evolution.status !== 'idle'

  // Auto-scroll log
  useEffect(() => {
    if (logEndRef.current && showLog) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [evolution.log.length, showLog])

  // Log helper
  const log = (message, type = 'info') => {
    addEvolutionLog(message, type)
  }

  // ─── Action: Import Inspiration ──────────────────────────────
  const handleImport = async () => {
    if (isRunning) return
    setEvolutionStatus('importing')
    clearEvolutionLog()
    log('Iniciando importacion de estrategias externas (Freqtrade + PineScript)...', 'info')

    const allNewPrompts = []

    try {
      // Source 1: Freqtrade (Python)
      log('─── Fuente 1: Freqtrade (Python) ───', 'info')
      const ftPrompts = await fetchFreqtradeStrategies(settings, log)
      allNewPrompts.push(...ftPrompts)
    } catch (err) {
      log(`Error Freqtrade: ${err.message}`, 'error')
    }

    try {
      // Source 2: PineScript/TradingView
      log('─── Fuente 2: PineScript (TradingView) ───', 'info')
      const psPrompts = await fetchPineScriptStrategies(settings, log)
      allNewPrompts.push(...psPrompts)
    } catch (err) {
      log(`Error PineScript: ${err.message}`, 'error')
    }

    if (allNewPrompts.length === 0) {
      log('No se pudieron importar estrategias de ninguna fuente', 'warning')
    } else {
      for (const p of allNewPrompts) {
        addPrompt(p)
        addImportedStrategy({
          source: p.source || 'github',
          name: p.name,
          content: p.content.slice(0, 200),
          qualityScore: p.qualityScore
        })
      }
      log(`Total: ${allNewPrompts.length} estrategias importadas (calidad promedio: ${Math.round(allNewPrompts.reduce((s, p) => s + (p.qualityScore || 0), 0) / allNewPrompts.length)}%)`, 'success')
    }

    setEvolutionStatus('idle')
  }

  // ─── Action: Tournament ──────────────────────────────────────
  const handleTournament = async () => {
    if (isRunning) return
    if (activePrompts.length === 0) {
      log('No hay prompts activos para el torneo', 'error')
      return
    }

    setEvolutionStatus('backtesting')
    clearEvolutionLog()
    log(`Iniciando torneo con ${activePrompts.length} prompts...`, 'info')

    const results = []

    for (let i = 0; i < activePrompts.length; i++) {
      const prompt = activePrompts[i]
      log(`[${i + 1}/${activePrompts.length}] ${prompt.name}...`, 'info')

      try {
        const result = await autoBacktestPrompt(prompt, settings, log)

        if (result) {
          // Save backtest to store
          addBacktest(result.backtestData)
          results.push({ prompt, backtestData: result.backtestData, grade: result.grade })
          log(`${prompt.name}: Grade ${result.grade.grade} (${result.grade.score}/100)`, 'success')
        } else {
          log(`${prompt.name}: Backtest fallido, saltando`, 'warning')
        }
      } catch (err) {
        log(`${prompt.name}: Error — ${err.message}`, 'error')
      }

      // Longer delay between prompts to respect rate limits (Groq free: 12K TPM)
      if (i < activePrompts.length - 1) {
        log('Esperando 15s antes del siguiente prompt (rate limit)...', 'info')
        await new Promise(r => setTimeout(r, 15000))
      }
    }

    if (results.length > 0) {
      const rankings = tournamentRank(results)
      setEvolutionRankings(rankings)
      log(`Torneo completado! ${rankings[0]?.promptName || '?'} es el ganador con Grade ${rankings[0]?.grade || '?'}`, 'success')
    } else {
      log('Torneo sin resultados — ningun backtest fue exitoso', 'error')
    }

    setEvolutionStatus('idle')
  }

  // ─── Action: Evolve ──────────────────────────────────────────
  const handleEvolve = async () => {
    if (isRunning) return
    if (evolution.rankings.length < 2) {
      log('Necesitas al menos 2 prompts rankeados. Ejecuta un torneo primero.', 'error')
      return
    }

    setEvolutionStatus('evolving')
    log(`Evolucionando generacion ${evolution.generation + 1}...`, 'info')

    const topRankings = evolution.rankings.slice(0, 3)
    const topPromptData = topRankings.map(r => ({
      prompt: prompts.find(p => p.id === r.promptId) || { id: r.promptId, name: r.promptName, content: '' },
      grade: { grade: r.grade, score: r.score }
    })).filter(p => p.prompt.content)

    if (topPromptData.length < 2) {
      log('No se encontraron prompts suficientes para evolucionar', 'error')
      setEvolutionStatus('idle')
      return
    }

    const newPrompts = []

    try {
      // 1. Crossover
      log('Cruzando top 2 prompts...', 'info')
      const child1 = await crossover(
        topPromptData[0].prompt,
        topPromptData[1].prompt,
        topPromptData[0].grade,
        topPromptData[1].grade,
        settings
      )
      addPrompt(child1)
      newPrompts.push(child1)
      log(`Crossover creado: ${child1.name}`, 'success')

      await new Promise(r => setTimeout(r, 2000))

      // 2. Mutation
      log('Mutando mejor prompt...', 'info')
      const backtestResult = useStore.getState().backtests.find(b => b.id === topRankings[0].backtestId)
      const child2 = await mutate(
        topPromptData[0].prompt,
        backtestResult,
        topPromptData[0].grade,
        settings
      )
      addPrompt(child2)
      newPrompts.push(child2)
      log(`Mutacion creada: ${child2.name}`, 'success')

      await new Promise(r => setTimeout(r, 2000))

      // 3. Innovation
      log('Generando innovacion con datos de mercado...', 'info')
      const child3 = await innovate(
        topPromptData,
        evolution.marketData,
        settings
      )
      addPrompt(child3)
      newPrompts.push(child3)
      log(`Innovacion creada: ${child3.name}`, 'success')

      // Save generation
      addEvolutionGeneration(evolution.rankings)
      log(`Generacion ${evolution.generation + 1}: ${newPrompts.length} nuevos prompts creados`, 'success')

    } catch (err) {
      log(`Error en evolucion: ${err.message}`, 'error')
    }

    setEvolutionStatus('idle')
  }

  // ─── Action: Feed Data ───────────────────────────────────────
  const handleFeedData = async () => {
    if (isRunning) return
    setEvolutionStatus('feeding')
    log('Obteniendo datos de Binance Futures...', 'info')

    try {
      const data = await fetchAllFuturesData(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'], log)
      setEvolutionMarketData(data)
      log('Datos de mercado actualizados. Seran usados en la proxima evolucion.', 'success')
    } catch (err) {
      log(`Error: ${err.message}`, 'error')
    }

    setEvolutionStatus('idle')
  }

  // ─── Render ──────────────────────────────────────────────────
  const getLogIcon = (type) => {
    switch (type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      default: return '📋'
    }
  }

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-accent-green'
      case 'error': return 'text-accent-red'
      case 'warning': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-quant-card border border-quant-border rounded-xl p-3 text-center">
          <span className="text-[10px] text-gray-500 uppercase block">Generacion</span>
          <span className="text-xl font-bold text-accent-cyan font-mono">{evolution.generation}</span>
        </div>
        <div className="bg-quant-card border border-quant-border rounded-xl p-3 text-center">
          <span className="text-[10px] text-gray-500 uppercase block">Prompts</span>
          <span className="text-xl font-bold text-white font-mono">{activePrompts.length}</span>
        </div>
        <div className="bg-quant-card border border-quant-border rounded-xl p-3 text-center">
          <span className="text-[10px] text-gray-500 uppercase block">Mejor</span>
          <span className={`text-xl font-bold font-mono ${evolution.rankings[0]?.color || 'text-gray-400'}`}>
            {evolution.rankings[0]?.grade || '-'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Import */}
        <button
          onClick={handleImport}
          disabled={isRunning}
          className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
            isRunning
              ? 'bg-quant-surface border-quant-border text-gray-500 cursor-not-allowed'
              : 'bg-quant-card border-accent-green/30 hover:border-accent-green/60 text-white active:scale-95'
          }`}
        >
          {evolution.status === 'importing' ? (
            <Loader2 size={18} className="text-accent-green animate-spin" />
          ) : (
            <Sprout size={18} className="text-accent-green" />
          )}
          <div className="text-left">
            <span className="text-xs font-bold block">Importar</span>
            <span className="text-[10px] text-gray-500">Freqtrade + PineScript</span>
          </div>
        </button>

        {/* Tournament */}
        <button
          onClick={handleTournament}
          disabled={isRunning || activePrompts.length === 0}
          className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
            isRunning || activePrompts.length === 0
              ? 'bg-quant-surface border-quant-border text-gray-500 cursor-not-allowed'
              : 'bg-quant-card border-accent-yellow/30 hover:border-accent-yellow/60 text-white active:scale-95'
          }`}
        >
          {evolution.status === 'backtesting' ? (
            <Loader2 size={18} className="text-accent-yellow animate-spin" />
          ) : (
            <Trophy size={18} className="text-accent-yellow" />
          )}
          <div className="text-left">
            <span className="text-xs font-bold block">Torneo</span>
            <span className="text-[10px] text-gray-500">{activePrompts.length} prompts</span>
          </div>
        </button>

        {/* Evolve */}
        <button
          onClick={handleEvolve}
          disabled={isRunning || evolution.rankings.length < 2}
          className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
            isRunning || evolution.rankings.length < 2
              ? 'bg-quant-surface border-quant-border text-gray-500 cursor-not-allowed'
              : 'bg-quant-card border-accent-cyan/30 hover:border-accent-cyan/60 text-white active:scale-95'
          }`}
        >
          {evolution.status === 'evolving' ? (
            <Loader2 size={18} className="text-accent-cyan animate-spin" />
          ) : (
            <Dna size={18} className="text-accent-cyan" />
          )}
          <div className="text-left">
            <span className="text-xs font-bold block">Evolucionar</span>
            <span className="text-[10px] text-gray-500">Cruzar + Mutar</span>
          </div>
        </button>

        {/* Feed Data */}
        <button
          onClick={handleFeedData}
          disabled={isRunning}
          className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
            isRunning
              ? 'bg-quant-surface border-quant-border text-gray-500 cursor-not-allowed'
              : 'bg-quant-card border-accent-orange/30 hover:border-accent-orange/60 text-white active:scale-95'
          }`}
        >
          {evolution.status === 'feeding' ? (
            <Loader2 size={18} className="text-accent-orange animate-spin" />
          ) : (
            <BarChart3 size={18} className="text-accent-orange" />
          )}
          <div className="text-left">
            <span className="text-xs font-bold block">Datos</span>
            <span className="text-[10px] text-gray-500">Binance Futures</span>
          </div>
        </button>
      </div>

      {/* How it works (compact) */}
      {evolution.generation === 0 && evolution.rankings.length === 0 && (
        <div className="bg-quant-card border border-quant-border rounded-xl p-3">
          <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5 mb-2">
            <Info size={12} className="text-accent-cyan" />
            Como funciona
          </h3>
          <div className="space-y-1.5 text-[10px] text-gray-500">
            <div className="flex items-start gap-2">
              <Sprout size={10} className="text-accent-green mt-0.5 shrink-0" />
              <span><strong className="text-gray-400">Importar:</strong> Trae estrategias de GitHub (Freqtrade + PineScript), las analiza con regex y las convierte en prompts tecnicos via LLM (2 fases + validacion)</span>
            </div>
            <div className="flex items-start gap-2">
              <Trophy size={10} className="text-accent-yellow mt-0.5 shrink-0" />
              <span><strong className="text-gray-400">Torneo:</strong> Backtestea todos tus prompts y los rankea (A-F)</span>
            </div>
            <div className="flex items-start gap-2">
              <Dna size={10} className="text-accent-cyan mt-0.5 shrink-0" />
              <span><strong className="text-gray-400">Evolucionar:</strong> Cruza los mejores, muta el #1, y genera innovaciones</span>
            </div>
            <div className="flex items-start gap-2">
              <BarChart3 size={10} className="text-accent-orange mt-0.5 shrink-0" />
              <span><strong className="text-gray-400">Datos:</strong> Trae funding rates, OI y L/S ratio de Binance Futures</span>
            </div>
          </div>
        </div>
      )}

      {/* Rankings */}
      {evolution.rankings.length > 0 && (
        <div className="bg-quant-card border border-quant-border rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-quant-border flex items-center justify-between">
            <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <Trophy size={12} className="text-accent-yellow" />
              Ranking (Gen {evolution.generation})
            </h3>
            <span className="text-[10px] text-gray-500">{evolution.rankings.length} prompts</span>
          </div>
          <div className="divide-y divide-quant-border">
            {evolution.rankings.map((r, i) => (
              <div key={r.promptId} className="flex items-center gap-2 px-3 py-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                  i === 0 ? 'bg-accent-yellow/20 text-accent-yellow' :
                  i === 1 ? 'bg-gray-400/20 text-gray-400' :
                  i === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-quant-surface text-gray-500'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-white truncate block">{r.promptName}</span>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{r.totalTrades} trades</span>
                    <span>WR {r.winRate?.toFixed(0)}%</span>
                    <span className={r.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}>
                      {r.pnl >= 0 ? '+' : ''}{r.pnl?.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-lg border text-xs font-bold font-mono ${r.bgColor || 'bg-gray-500/10 border-gray-500/30'}`}>
                  <span className={r.color || 'text-gray-400'}>{r.grade}</span>
                  <span className="text-gray-500 text-[10px] ml-1">{r.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Market Data Summary */}
      {evolution.marketData && (
        <div className="bg-quant-card border border-quant-border rounded-xl p-3">
          <h3 className="text-xs font-bold text-gray-300 flex items-center gap-1.5 mb-2">
            <BarChart3 size={12} className="text-accent-orange" />
            Datos de Mercado
            <span className="text-[10px] text-gray-500 font-normal ml-auto">
              {new Date(Object.values(evolution.marketData)[0]?.timestamp || 0).toLocaleTimeString()}
            </span>
          </h3>
          <div className="space-y-1">
            {Object.entries(evolution.marketData).map(([symbol, data]) => (
              <div key={symbol} className="flex items-center justify-between text-[10px]">
                <span className="text-gray-400 font-mono">{symbol}</span>
                <div className="flex items-center gap-3">
                  {data.funding && (
                    <span className={parseFloat(data.funding.fundingRatePercent) > 0 ? 'text-accent-green' : 'text-accent-red'}>
                      F: {data.funding.fundingRatePercent}%
                    </span>
                  )}
                  {data.openInterest && (
                    <span className="text-gray-500">
                      OI: {(data.openInterest.openInterest / 1000).toFixed(0)}K
                    </span>
                  )}
                  {data.longShort && (
                    <span className={data.longShort.longShortRatio > 1 ? 'text-accent-green' : 'text-accent-red'}>
                      L/S: {data.longShort.longShortRatio.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation History */}
      {evolution.history.length > 0 && (
        <div className="bg-quant-card border border-quant-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-gray-300 hover:bg-quant-surface transition-colors"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <Clock size={12} />
              Historial ({evolution.history.length} generaciones)
            </span>
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="divide-y divide-quant-border border-t border-quant-border">
                  {[...evolution.history].reverse().map((gen) => (
                    <div key={gen.generation} className="px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-accent-cyan">Gen {gen.generation}</span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(gen.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        {gen.rankings.slice(0, 3).map((r, i) => (
                          <span key={i} className="flex items-center gap-0.5">
                            <span className={r.color}>{r.grade}</span>
                            <span className="text-gray-600">{r.promptName?.slice(0, 12)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Live Log */}
      {evolution.log.length > 0 && (
        <div className="bg-quant-card border border-quant-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowLog(!showLog)}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-gray-300 hover:bg-quant-surface transition-colors"
          >
            <span className="flex items-center gap-1.5 font-bold">
              <Zap size={12} className="text-accent-cyan" />
              Log ({evolution.log.length})
            </span>
            <div className="flex items-center gap-2">
              {isRunning && <Loader2 size={12} className="animate-spin text-accent-cyan" />}
              {showLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>
          <AnimatePresence>
            {showLog && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-48 overflow-y-auto hide-scrollbar border-t border-quant-border">
                  {evolution.log.map((entry, i) => (
                    <div key={i} className="px-3 py-1 flex items-start gap-1.5 text-[10px]">
                      <span>{getLogIcon(entry.type)}</span>
                      <span className="text-gray-600 font-mono shrink-0">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={getLogColor(entry.type)}>{entry.message}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Reset Button */}
      {(evolution.rankings.length > 0 || evolution.history.length > 0) && !isRunning && (
        <button
          onClick={() => {
            if (window.confirm('Resetear rankings e historial de generaciones?')) {
              resetEvolution()
            }
          }}
          className="w-full py-2 text-xs text-gray-500 hover:text-accent-red transition-colors flex items-center justify-center gap-1"
        >
          <RefreshCw size={12} />
          Resetear Evolution
        </button>
      )}
    </div>
  )
}
