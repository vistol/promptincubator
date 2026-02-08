import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dna, Sprout, Trophy, GitBranch, BarChart3,
  Play, Loader2, Award, TrendingUp, TrendingDown,
  Download, Zap, RefreshCw, ChevronDown, ChevronUp,
  Info, Clock, Trash2
} from 'lucide-react'
import useStore from '../../store/useStore'
import { autoBacktestPrompt, tournamentRank, cancellableSleep } from '../../lib/autoBacktest'
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
  const [showTournamentConfig, setShowTournamentConfig] = useState(false)
  const [maxLossCutoff, setMaxLossCutoff] = useState(-10) // Exclude prompts with PnL worse than this
  const [isCancelling, setIsCancelling] = useState(false)
  const cancelRef = useRef(false) // For cancelling running operations
  const logEndRef = useRef(null)

  const activePrompts = prompts.filter(p => p.status === 'active')
  const isRunning = evolution.status !== 'idle'

  // ─── Tournament filtering: exclude already-ranked losers ─────
  // Build a map of promptId → worst PnL from previous rankings
  const rankedPnlMap = {}
  for (const r of evolution.rankings) {
    rankedPnlMap[r.promptId] = r.pnl
  }
  // Also check history for past rankings
  for (const gen of evolution.history) {
    for (const r of gen.rankings) {
      if (rankedPnlMap[r.promptId] === undefined || r.pnl < rankedPnlMap[r.promptId]) {
        rankedPnlMap[r.promptId] = r.pnl
      }
    }
  }

  // Split prompts into eligible and excluded
  const excludedPrompts = activePrompts.filter(p => {
    const prevPnl = rankedPnlMap[p.id]
    return prevPnl !== undefined && prevPnl < maxLossCutoff
  })
  const eligiblePrompts = activePrompts.filter(p => !excludedPrompts.includes(p))
  const hasExcluded = excludedPrompts.length > 0

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
    cancelRef.current = false
    log('Iniciando importacion de estrategias externas (Freqtrade + PineScript)...', 'info')

    const allNewPrompts = []

    try {
      try {
        // Source 1: Freqtrade (Python)
        log('─── Fuente 1: Freqtrade (Python) ───', 'info')
        const ftPrompts = await fetchFreqtradeStrategies(settings, log)
        allNewPrompts.push(...ftPrompts)
      } catch (err) {
        log(`Error Freqtrade: ${err.message}`, 'error')
      }

      if (cancelRef.current) { log('Importacion cancelada', 'warning'); return }

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
    } catch (err) {
      log(`Error fatal en importacion: ${err.message}`, 'error')
    } finally {
      setEvolutionStatus('idle')
      cancelRef.current = false
    }
  }

  // ─── Action: Cancel running operation ───────────────────────
  const handleCancel = () => {
    cancelRef.current = true
    setIsCancelling(true)
    log('Cancelando operacion...', 'warning')
  }

  // Reset cancelling state when operation finishes
  useEffect(() => {
    if (!isRunning && isCancelling) setIsCancelling(false)
  }, [isRunning, isCancelling])

  // ─── Action: Tournament ──────────────────────────────────────
  const handleTournament = async () => {
    if (isRunning) return
    if (eligiblePrompts.length === 0) {
      log('No hay prompts elegibles para el torneo', 'error')
      return
    }

    setEvolutionStatus('backtesting')
    clearEvolutionLog()
    cancelRef.current = false

    const results = []
    let consecutivePromptErrors = 0

    try {
      if (excludedPrompts.length > 0) {
        log(`Excluidos ${excludedPrompts.length} prompts con PnL < ${maxLossCutoff}%:`, 'warning')
        for (const ep of excludedPrompts) {
          const pnl = rankedPnlMap[ep.id]
          log(`  ✗ ${ep.name} (${pnl?.toFixed(1)}%)`, 'warning')
        }
      }

      log(`Iniciando torneo con ${eligiblePrompts.length} prompts...`, 'info')

      for (let i = 0; i < eligiblePrompts.length; i++) {
        // Check for cancellation
        if (cancelRef.current) {
          log('Torneo cancelado por el usuario', 'warning')
          break
        }

        const prompt = eligiblePrompts[i]
        log(`[${i + 1}/${eligiblePrompts.length}] ${prompt.name}...`, 'info')

        try {
          const result = await autoBacktestPrompt(prompt, settings, log, { shouldCancel: () => cancelRef.current })

          if (result) {
            // Save backtest to store (wrapped in try/catch so sync errors don't break the loop)
            try {
              addBacktest(result.backtestData)
            } catch (syncErr) {
              log(`Advertencia: Error guardando backtest — ${syncErr.message}`, 'warning')
            }
            results.push({ prompt, backtestData: result.backtestData, grade: result.grade })
            log(`${prompt.name}: Grade ${result.grade.grade} (${result.grade.score}/100)`, 'success')
            consecutivePromptErrors = 0 // Reset on success
          } else {
            consecutivePromptErrors++
            log(`${prompt.name}: Backtest fallido, saltando`, 'warning')
          }
        } catch (err) {
          consecutivePromptErrors++
          const isQuota = /quota|exceed|exhaust|429|rate.?limit/i.test(err.message)
          log(`${prompt.name}: Error — ${err.message}`, 'error')

          // Abort tournament if too many consecutive failures (likely quota exhausted)
          if (consecutivePromptErrors >= 2 && isQuota) {
            log(`Torneo abortado: ${consecutivePromptErrors} prompts consecutivos fallaron por quota/rate limit. Intenta mas tarde o cambia de proveedor AI.`, 'error')
            break
          }
        }

        // Check for cancellation before waiting
        if (cancelRef.current) {
          log('Torneo cancelado por el usuario', 'warning')
          break
        }

        // Longer delay between prompts to respect rate limits (Groq free: 12K TPM)
        if (i < eligiblePrompts.length - 1) {
          log('Esperando 15s antes del siguiente prompt (rate limit)...', 'info')
          const cancelled = await cancellableSleep(15000, () => cancelRef.current)
          if (cancelled) {
            log('Torneo cancelado por el usuario', 'warning')
            break
          }
        }
      }

      if (results.length > 0) {
        const rankings = tournamentRank(results)
        setEvolutionRankings(rankings)
        log(`Torneo completado! ${rankings[0]?.promptName || '?'} es el ganador con Grade ${rankings[0]?.grade || '?'} (${results.length}/${eligiblePrompts.length} backtests exitosos)`, 'success')
      } else {
        log('Torneo sin resultados — ningun backtest fue exitoso. Verifica tu API key y cuota disponible.', 'error')
      }
    } catch (err) {
      log(`Error fatal en torneo: ${err.message}`, 'error')
    } finally {
      // ALWAYS reset status, even on unhandled errors
      setEvolutionStatus('idle')
      cancelRef.current = false
    }
  }

  // ─── Action: Evolve ──────────────────────────────────────────
  const handleEvolve = async () => {
    if (isRunning) return
    if (evolution.rankings.length < 2) {
      log('Necesitas al menos 2 prompts rankeados. Ejecuta un torneo primero.', 'error')
      return
    }

    setEvolutionStatus('evolving')
    cancelRef.current = false
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

      if (cancelRef.current) { log('Evolucion cancelada', 'warning'); return }
      await cancellableSleep(2000, () => cancelRef.current)
      if (cancelRef.current) { log('Evolucion cancelada', 'warning'); return }

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

      if (cancelRef.current) { log('Evolucion cancelada', 'warning'); return }
      await cancellableSleep(2000, () => cancelRef.current)
      if (cancelRef.current) { log('Evolucion cancelada', 'warning'); return }

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
    } finally {
      setEvolutionStatus('idle')
      cancelRef.current = false
    }
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
    } finally {
      setEvolutionStatus('idle')
    }
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
          onClick={() => setShowTournamentConfig(!showTournamentConfig)}
          disabled={isRunning}
          className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
            isRunning
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
            <span className="text-[10px] text-gray-500">
              {eligiblePrompts.length} de {activePrompts.length}
              {hasExcluded && <span className="text-accent-red ml-1">({excludedPrompts.length} excl.)</span>}
            </span>
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

      {/* Cancel Button — shown when any operation is running */}
      {isRunning && (
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            isCancelling
              ? 'bg-quant-surface border border-quant-border text-gray-500 cursor-not-allowed'
              : 'bg-accent-red/10 border border-accent-red/40 text-accent-red hover:bg-accent-red/20 active:scale-[0.98]'
          }`}
        >
          {isCancelling ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Cancelando...
            </>
          ) : (
            <>
              <Trash2 size={14} />
              Cancelar {evolution.status === 'backtesting' ? 'Torneo' : evolution.status === 'importing' ? 'Importacion' : evolution.status === 'evolving' ? 'Evolucion' : 'Operacion'}
            </>
          )}
        </button>
      )}

      {/* Tournament Config Panel */}
      <AnimatePresence>
        {showTournamentConfig && !isRunning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-quant-card border border-accent-yellow/30 rounded-xl p-3 space-y-3">
              <h3 className="text-xs font-bold text-accent-yellow flex items-center gap-1.5">
                <Trophy size={12} />
                Configurar Torneo
              </h3>

              {/* Loss cutoff slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-gray-400">Excluir prompts con PnL peor que:</span>
                  <span className="text-xs font-bold font-mono text-accent-red">{maxLossCutoff}%</span>
                </div>
                <input
                  type="range"
                  min={-50}
                  max={0}
                  step={5}
                  value={maxLossCutoff}
                  onChange={(e) => setMaxLossCutoff(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none bg-quant-surface cursor-pointer accent-accent-yellow"
                />
                <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                  <span>-50%</span>
                  <span>-25%</span>
                  <span>0%</span>
                </div>
              </div>

              {/* Prompt list summary */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">Prompts activos</span>
                  <span className="text-white font-mono">{activePrompts.length}</span>
                </div>
                {hasExcluded && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-accent-red">Excluidos (PnL &lt; {maxLossCutoff}%)</span>
                    <span className="text-accent-red font-mono">-{excludedPrompts.length}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] border-t border-quant-border pt-1">
                  <span className="text-accent-yellow font-bold">Competiran en torneo</span>
                  <span className="text-accent-yellow font-bold font-mono">{eligiblePrompts.length}</span>
                </div>
              </div>

              {/* Excluded list */}
              {hasExcluded && (
                <div className="space-y-0.5">
                  {excludedPrompts.map(ep => (
                    <div key={ep.id} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                      <span className="text-accent-red">✗</span>
                      <span className="truncate flex-1">{ep.name}</span>
                      <span className="text-accent-red font-mono">{rankedPnlMap[ep.id]?.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Eligible list */}
              {eligiblePrompts.length > 0 && (
                <div className="space-y-0.5">
                  {eligiblePrompts.map(ep => {
                    const prevPnl = rankedPnlMap[ep.id]
                    const isNew = prevPnl === undefined
                    return (
                      <div key={ep.id} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                        <span className="text-accent-green">✓</span>
                        <span className="truncate flex-1">{ep.name}</span>
                        {isNew ? (
                          <span className="text-accent-cyan font-mono">nuevo</span>
                        ) : (
                          <span className={`font-mono ${prevPnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            {prevPnl >= 0 ? '+' : ''}{prevPnl?.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Launch button */}
              <button
                onClick={() => { setShowTournamentConfig(false); handleTournament() }}
                disabled={eligiblePrompts.length === 0}
                className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  eligiblePrompts.length === 0
                    ? 'bg-quant-surface text-gray-500 cursor-not-allowed'
                    : 'bg-accent-yellow/20 border border-accent-yellow/40 text-accent-yellow hover:bg-accent-yellow/30 active:scale-[0.98]'
                }`}
              >
                <Play size={14} />
                Iniciar Torneo ({eligiblePrompts.length} prompts)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
