import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, Loader2, AlertCircle, ChevronDown, ChevronUp,
  DollarSign, Brain, BarChart3, Filter, Shield, Clock,
  Lock, Wifi, Zap
} from 'lucide-react'
import { PIPELINE_STEPS } from '../lib/executionLog'
import useStore from '../store/useStore'

// AI provider display names
const AI_NAMES = {
  anthropic: 'Claude Sonnet 4',
  google: 'Gemini 2.5 Flash',
  openai: 'GPT-4',
  xai: 'Grok 3'
}

// Steps visible to the user (only AI-related, no internal program steps)
const CONSOLE_STEPS = [
  {
    id: 'prices',
    pipelineStep: PIPELINE_STEPS.FETCH_PRICES,
    icon: DollarSign,
    label: 'Precios de Mercado',
    activeLabel: 'Obteniendo precios reales de Binance...',
    expandable: true
  },
  {
    id: 'model',
    pipelineStep: PIPELINE_STEPS.AI_CALL,
    icon: Wifi,
    label: 'Conexion al Modelo',
    activeLabel: 'Conectando con modelo de IA...',
    expandable: true
  },
  {
    id: 'generating',
    pipelineStep: PIPELINE_STEPS.AI_RESPONSE,
    icon: Brain,
    label: 'Generacion de Trades',
    activeLabel: 'Analizando mercado y generando trades...',
    expandable: true
  },
  {
    id: 'trades',
    pipelineStep: PIPELINE_STEPS.PARSE_TRADES,
    icon: BarChart3,
    label: 'Trades Generados',
    activeLabel: 'Procesando trades del modelo...',
    expandable: true
  },
  {
    id: 'filter',
    pipelineStep: PIPELINE_STEPS.FILTER_IPE,
    icon: Filter,
    label: 'Filtro de Calidad',
    activeLabel: 'Filtrando por probabilidad minima...',
    expandable: true
  },
  {
    id: 'rr',
    pipelineStep: PIPELINE_STEPS.VALIDATE_RR,
    icon: Shield,
    label: 'Verificacion Risk:Reward',
    activeLabel: 'Verificando ratios de riesgo...',
    expandable: true
  },
]

// Map pipeline steps to console steps (some pipeline steps map to same console step)
const PIPELINE_TO_CONSOLE = {
  [PIPELINE_STEPS.START]: null,
  [PIPELINE_STEPS.FETCH_PRICES]: 'prices',
  [PIPELINE_STEPS.BUILD_PROMPT]: 'model', // internal, mapped to model connection
  [PIPELINE_STEPS.AI_CALL]: 'model',
  [PIPELINE_STEPS.AI_RESPONSE]: 'generating',
  [PIPELINE_STEPS.PARSE_TRADES]: 'trades',
  [PIPELINE_STEPS.FILTER_IPE]: 'filter',
  [PIPELINE_STEPS.VALIDATE_RR]: 'rr',
  [PIPELINE_STEPS.COMPLETE]: null,
  [PIPELINE_STEPS.ERROR]: null,
}

// Get step status from pipeline events
function getConsoleStepStatus(consoleStep, events, currentPipelineStep) {
  // Map which pipeline steps correspond to this console step
  const relevantPipelineSteps = Object.entries(PIPELINE_TO_CONSOLE)
    .filter(([, consoleId]) => consoleId === consoleStep.id)
    .map(([pipelineStep]) => pipelineStep)

  const hasError = events.some(e => relevantPipelineSteps.includes(e.step) && e.status === 'error')
  const hasCompleted = events.some(e => relevantPipelineSteps.includes(e.step) && e.status === 'completed')
  const hasStarted = events.some(e => relevantPipelineSteps.includes(e.step) && e.status === 'started')

  if (hasError) return 'error'
  if (hasCompleted) return 'completed'
  if (hasStarted || relevantPipelineSteps.includes(currentPipelineStep)) return 'active'
  return 'pending'
}

// Get data for a console step
function getConsoleStepData(consoleStep, events) {
  const relevantPipelineSteps = Object.entries(PIPELINE_TO_CONSOLE)
    .filter(([, consoleId]) => consoleId === consoleStep.id)
    .map(([pipelineStep]) => pipelineStep)

  const stepEvents = events.filter(e => relevantPipelineSteps.includes(e.step))
  const completedEvent = stepEvents.find(e => e.status === 'completed')
  const startedEvent = stepEvents.find(e => e.status === 'started')
  const errorEvent = stepEvents.find(e => e.status === 'error')

  const elapsed = completedEvent && startedEvent
    ? completedEvent.elapsed - startedEvent.elapsed
    : null

  return {
    events: stepEvents,
    data: completedEvent?.data || startedEvent?.data || errorEvent?.data || null,
    message: completedEvent?.message || errorEvent?.message || null,
    elapsed,
    startedAt: startedEvent?.elapsed || null,
    completedAt: completedEvent?.elapsed || null,
    error: errorEvent?.message || null,
  }
}

// Format user-facing summary for each step
function getStepSummary(consoleStep, data, aiProvider) {
  const providerName = AI_NAMES[aiProvider] || aiProvider

  switch (consoleStep.id) {
    case 'prices': {
      if (!data.data) return null
      const prices = data.data.prices || {}
      const entries = Object.entries(prices)
      if (entries.length === 0) return data.message
      const preview = entries.slice(0, 3)
        .map(([asset, price]) => `${asset.replace('/USDT', '')}: $${Number(price).toLocaleString()}`)
        .join(' - ')
      const more = entries.length > 3 ? ` (+${entries.length - 3} mas)` : ''
      return `${preview}${more}`
    }
    case 'model': {
      if (!data.data) return `Conectando con ${providerName}...`
      return `${providerName} conectado`
    }
    case 'generating': {
      if (!data.data) return `${providerName} analizando mercado...`
      const duration = data.elapsed != null ? ` en ${(data.elapsed / 1000).toFixed(1)}s` : ''
      return `${providerName} respondio${duration}`
    }
    case 'trades': {
      if (!data.data) return null
      const trades = data.data.trades || ''
      return `${data.data.count || '?'} trades generados: ${trades}`
    }
    case 'filter': {
      if (!data.data) return null
      const { accepted, discarded, minIpe, discardedInfo } = data.data
      let text = `${accepted}/${accepted + discarded} superan IPE ${minIpe}%`
      if (discardedInfo) text += ` -- Descartados: ${discardedInfo}`
      return text
    }
    case 'rr': {
      if (!data.data) return null
      return data.data.summary || 'Verificacion completada'
    }
    default:
      return data.message
  }
}

// Expanded detail for each step
function getStepDetails(consoleStep, data, aiProvider) {
  const providerName = AI_NAMES[aiProvider] || aiProvider

  switch (consoleStep.id) {
    case 'prices': {
      if (!data.data?.prices) return null
      const prices = Object.entries(data.data.prices)
      return (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Precios consultados ({prices.length} pares)
          </div>
          <div className="grid grid-cols-2 gap-1">
            {prices.map(([asset, price]) => (
              <div key={asset} className="flex items-center justify-between px-2 py-1 bg-black/30 rounded">
                <span className="text-[11px] text-gray-300 font-mono">{asset.replace('/USDT', '')}</span>
                <span className="text-[11px] text-accent-green font-mono">${Number(price).toLocaleString()}</span>
              </div>
            ))}
          </div>
          {data.data.hash && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-gray-600">
              <Lock size={10} />
              <span className="font-mono truncate">SHA-256: {data.data.hash.slice(0, 16)}...{data.data.hash.slice(-8)}</span>
            </div>
          )}
        </div>
      )
    }
    case 'model': {
      if (!data.data) return null
      return (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Detalles de conexion
          </div>
          <div className="space-y-1">
            <DetailRow label="Modelo" value={providerName} />
            <DetailRow label="Proveedor" value={data.data.provider || aiProvider} />
            <DetailRow label="Temperatura" value={data.data.temperature || '0.7'} />
            <DetailRow label="Max tokens" value={data.data.maxTokens || 'default'} />
          </div>
        </div>
      )
    }
    case 'generating': {
      if (!data.data) return null
      return (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Detalles de respuesta
          </div>
          <div className="space-y-1">
            <DetailRow label="Modelo" value={providerName} />
            <DetailRow label="Tiempo de respuesta" value={data.elapsed != null ? `${(data.elapsed / 1000).toFixed(1)}s` : 'N/A'} />
            <DetailRow label="Longitud respuesta" value={data.data.responseLength ? `${data.data.responseLength} chars` : 'N/A'} />
            {data.data.hash && (
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-600">
                <Lock size={10} />
                <span className="font-mono truncate">SHA-256: {data.data.hash.slice(0, 16)}...{data.data.hash.slice(-8)}</span>
              </div>
            )}
          </div>
        </div>
      )
    }
    case 'trades': {
      if (!data.data) return null
      const trades = data.data.trades?.split(', ') || []
      return (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Trades extraidos del AI
          </div>
          <div className="space-y-1">
            {trades.map((trade, i) => {
              const parts = trade.split(' ')
              const asset = parts[0] || trade
              const direction = parts[1] || ''
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-black/30 rounded">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    direction === 'LONG' ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-red/20 text-accent-red'
                  }`}>
                    {direction || '?'}
                  </span>
                  <span className="text-[11px] text-gray-300 font-mono">{asset}</span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    case 'filter': {
      if (!data.data) return null
      return (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Resultado del filtro IPE
          </div>
          <div className="space-y-1">
            <DetailRow label="Umbral minimo" value={`IPE >= ${data.data.minIpe}%`} />
            <DetailRow label="Aceptados" value={`${data.data.accepted} trades`} valueColor="text-accent-green" />
            <DetailRow label="Descartados" value={`${data.data.discarded} trades`} valueColor={data.data.discarded > 0 ? 'text-accent-red' : 'text-gray-400'} />
            {data.data.discardedInfo && (
              <div className="mt-1 px-2 py-1.5 bg-accent-red/5 border border-accent-red/10 rounded text-[11px] text-accent-red/80">
                Descartados: {data.data.discardedInfo}
              </div>
            )}
          </div>
        </div>
      )
    }
    case 'rr': {
      if (!data.data?.results) return null
      return (
        <div className="space-y-1.5">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Risk:Reward por trade
          </div>
          <div className="space-y-1">
            {data.data.results.map((r, i) => (
              <div key={i} className="flex items-center justify-between px-2 py-1.5 bg-black/30 rounded">
                <span className="text-[11px] text-gray-300 font-mono">{r.asset}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-white">R:R {r.rr}:1</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    r.valid ? 'bg-accent-green/20 text-accent-green' : 'bg-accent-yellow/20 text-accent-yellow'
                  }`}>
                    {r.valid ? 'OK' : 'WARN'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }
    default:
      return null
  }
}

// Simple key-value detail row
function DetailRow({ label, value, valueColor = 'text-gray-300' }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 bg-black/30 rounded">
      <span className="text-[10px] text-gray-500">{label}</span>
      <span className={`text-[11px] font-mono ${valueColor}`}>{value}</span>
    </div>
  )
}

// Live elapsed timer
function LiveTimer({ startMs }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const start = Date.now() - (startMs || 0)
    const interval = setInterval(() => {
      setElapsed(Date.now() - start)
    }, 100)
    return () => clearInterval(interval)
  }, [startMs])

  const seconds = (elapsed / 1000).toFixed(1)
  return (
    <span className="text-accent-cyan font-mono text-xs tabular-nums">
      {seconds}s
    </span>
  )
}

export default function GenerationConsole({ prompt, onCancel, onSelectTrades }) {
  const { pipelineEvents, pipelineCurrentStep, isGeneratingTrades, pendingTrades } = useStore()
  const [toggledSteps, setToggledSteps] = useState({})
  const scrollRef = useRef(null)
  const aiProvider = prompt?.aiModel || 'google'
  const providerName = AI_NAMES[aiProvider] || aiProvider

  const toggleStep = (stepId) => {
    setToggledSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }))
  }

  // Auto-scroll to latest step
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [pipelineEvents.length])

  // Check if pipeline errored
  const isError = pipelineEvents.some(e => e.status === 'error')
  const isComplete = pipelineEvents.some(e => e.step === PIPELINE_STEPS.COMPLETE)

  // Get total elapsed from last event
  const lastEvent = pipelineEvents[pipelineEvents.length - 1]
  const pipelineStartEvent = pipelineEvents.find(e => e.step === PIPELINE_STEPS.START)

  // Calculate average IPE from filter step
  const filterEvent = pipelineEvents.find(e => e.step === PIPELINE_STEPS.FILTER_IPE && e.status === 'completed')

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#06060c] flex flex-col"
    >
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-quant-border/50 bg-[#0a0a14]">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Brain size={24} className="text-accent-cyan" />
              {!isComplete && !isError && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-cyan opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-cyan"></span>
                </span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {isComplete ? 'Generacion Completada' : isError ? 'Error en Generacion' : 'Generando Trades'}
              </h2>
              <p className="text-[10px] text-gray-500">
                {prompt?.name} &middot; {providerName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live Timer */}
            {!isComplete && !isError && pipelineStartEvent && (
              <LiveTimer startMs={pipelineStartEvent.elapsed} />
            )}
            {(isComplete || isError) && lastEvent && (
              <span className="text-xs text-gray-500 font-mono">
                {(lastEvent.elapsed / 1000).toFixed(1)}s
              </span>
            )}
            <button
              onClick={onCancel}
              className="p-2 rounded-full hover:bg-quant-surface transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Console Body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-2">
          {CONSOLE_STEPS.map((consoleStep) => {
            const status = getConsoleStepStatus(consoleStep, pipelineEvents, pipelineCurrentStep)
            const data = getConsoleStepData(consoleStep, pipelineEvents)
            const summary = getStepSummary(consoleStep, data, aiProvider)
            const Icon = consoleStep.icon

            // Get raw events for this step
            const relevantPipelineSteps = Object.entries(PIPELINE_TO_CONSOLE)
              .filter(([, consoleId]) => consoleId === consoleStep.id)
              .map(([pipelineStep]) => pipelineStep)
            const rawEvents = pipelineEvents.filter(e => relevantPipelineSteps.includes(e.step))

            // Don't render pending steps unless pipeline is done
            if (status === 'pending' && !isComplete && !isError) return null

            // Accordion logic: open while generating, closed after complete (user can toggle)
            const isStepExpanded = isComplete
              ? (toggledSteps[consoleStep.id] === true)   // after complete: closed by default, open if toggled
              : true                                       // while generating: always open
            const canToggle = isComplete && status === 'completed' && consoleStep.expandable

            return (
              <motion.div
                key={consoleStep.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`rounded-xl border overflow-hidden transition-all ${
                  status === 'active' ? 'border-accent-cyan/30 bg-accent-cyan/5' :
                  status === 'error' ? 'border-accent-red/30 bg-accent-red/5' :
                  status === 'completed' ? 'border-quant-border/50 bg-[#0d0d18]' :
                  'border-quant-border/30 bg-[#0a0a12] opacity-40'
                }`}
              >
                {/* Step Header - clickable when complete to toggle accordion */}
                <button
                  onClick={() => canToggle && toggleStep(consoleStep.id)}
                  disabled={!canToggle}
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                >
                  {/* Status indicator */}
                  <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    status === 'completed' ? 'bg-accent-green/15' :
                    status === 'active' ? 'bg-accent-cyan/15' :
                    status === 'error' ? 'bg-accent-red/15' :
                    'bg-gray-800'
                  }`}>
                    {status === 'completed' && <Check size={14} className="text-accent-green" />}
                    {status === 'active' && <Loader2 size={14} className="text-accent-cyan animate-spin" />}
                    {status === 'error' && <AlertCircle size={14} className="text-accent-red" />}
                    {status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-600" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={
                          status === 'active' ? 'text-accent-cyan' :
                          status === 'error' ? 'text-accent-red' :
                          status === 'completed' ? 'text-gray-400' :
                          'text-gray-600'
                        } />
                        <span className={`text-sm font-medium ${
                          status === 'active' ? 'text-accent-cyan' :
                          status === 'error' ? 'text-accent-red' :
                          status === 'completed' ? 'text-gray-200' :
                          'text-gray-600'
                        }`}>
                          {status === 'active' ? consoleStep.activeLabel : consoleStep.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Duration badge */}
                        {status === 'completed' && data.elapsed != null && (
                          <span className="text-[10px] text-gray-500 font-mono bg-gray-800/50 px-1.5 py-0.5 rounded">
                            {data.elapsed < 1000 ? `${data.elapsed}ms` : `${(data.elapsed / 1000).toFixed(1)}s`}
                          </span>
                        )}
                        {/* Live timer for active step */}
                        {status === 'active' && data.startedAt != null && (
                          <LiveTimer startMs={data.startedAt} />
                        )}
                        {/* Accordion chevron - only when complete */}
                        {canToggle && (
                          isStepExpanded
                            ? <ChevronUp size={14} className="text-gray-500" />
                            : <ChevronDown size={14} className="text-gray-500" />
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    {summary && status !== 'active' && (
                      <p className={`text-xs mt-1 ${
                        status === 'error' ? 'text-accent-red/80' : 'text-gray-500'
                      }`}>
                        {summary}
                      </p>
                    )}

                    {/* Error message */}
                    {status === 'error' && data.error && (
                      <p className="text-xs text-accent-red mt-1">{data.error}</p>
                    )}
                  </div>
                </button>

                {/* Accordion body: details + raw events */}
                <AnimatePresence initial={false}>
                  {isStepExpanded && (status === 'completed' || status === 'active' || status === 'error') && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {/* Details */}
                      {status === 'completed' && consoleStep.expandable && (
                        <div className="px-4 pb-2 pl-[52px]">
                          {getStepDetails(consoleStep, data, aiProvider)}
                        </div>
                      )}

                      {/* Raw events for this step */}
                      {rawEvents.length > 0 && (
                        <div className="mx-4 mb-3 ml-[52px] bg-black/40 rounded-lg overflow-hidden">
                          <div className="px-2 py-1 font-mono text-[9px] leading-[1.7] overflow-x-auto">
                            {rawEvents.map((evt, i) => {
                              const ts = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''
                              const prefix = evt.status === 'completed' ? '✓' : evt.status === 'error' ? '✗' : '→'
                              const statusColor = evt.status === 'completed' ? 'text-accent-green' : evt.status === 'error' ? 'text-accent-red' : 'text-accent-cyan'
                              return (
                                <div key={i} className="flex gap-1">
                                  <span className="text-gray-600 shrink-0">{ts}</span>
                                  <span className={`shrink-0 ${statusColor}`}>{prefix}</span>
                                  <span className="text-gray-400 flex-1">{evt.message}</span>
                                  {evt.elapsed != null && (
                                    <span className="text-gray-600 shrink-0">+{evt.elapsed < 1000 ? `${evt.elapsed}ms` : `${(evt.elapsed / 1000).toFixed(1)}s`}</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}

          {/* Completion Summary */}
          {isComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 p-4 bg-accent-green/5 border border-accent-green/20 rounded-xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-accent-green/20 flex items-center justify-center">
                  <Check size={18} className="text-accent-green" />
                </div>
                <div>
                  <p className="text-sm font-bold text-accent-green">Trades listos para revision</p>
                  <p className="text-[10px] text-gray-500">
                    Pipeline completado en {lastEvent ? `${(lastEvent.elapsed / 1000).toFixed(1)}s` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {filterEvent?.data && (
                  <>
                    <div className="bg-black/30 rounded-lg p-2 text-center">
                      <span className="text-lg font-bold text-white font-mono">{filterEvent.data.accepted}</span>
                      <span className="text-[10px] text-gray-500 block">Trades aprobados</span>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2 text-center">
                      <span className="text-lg font-bold text-accent-cyan font-mono">{filterEvent.data.minIpe}%</span>
                      <span className="text-[10px] text-gray-500 block">IPE minimo</span>
                    </div>
                  </>
                )}
                <div className="bg-black/30 rounded-lg p-2 text-center">
                  <span className="text-lg font-bold text-accent-green font-mono">
                    {lastEvent ? `${(lastEvent.elapsed / 1000).toFixed(1)}s` : '-'}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Duracion total</span>
                </div>
              </div>

              {/* Integrity verification */}
              <div className="flex items-center gap-2 px-3 py-2 bg-accent-green/10 rounded-lg">
                <Lock size={14} className="text-accent-green" />
                <span className="text-[11px] text-accent-green font-medium">
                  Integridad verificada con SHA-256
                </span>
              </div>
            </motion.div>
          )}

          {/* Error Summary */}
          {isError && !isComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 bg-accent-red/5 border border-accent-red/20 rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-red/20 flex items-center justify-center">
                  <AlertCircle size={18} className="text-accent-red" />
                </div>
                <div>
                  <p className="text-sm font-bold text-accent-red">Error en la generacion</p>
                  <p className="text-xs text-gray-500 mt-0.5">Puedes intentar de nuevo o cancelar</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-quant-border/50 bg-[#0a0a14]">
        <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
          {/* Select Trades button - always visible */}
          <button
            onClick={onSelectTrades}
            disabled={!isComplete || isError}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              isComplete && !isError
                ? 'bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg active:scale-[0.98]'
                : 'bg-quant-surface/50 text-gray-600 cursor-not-allowed'
            }`}
            style={{
              boxShadow: isComplete && !isError ? '0 0 20px rgba(0, 240, 255, 0.25)' : 'none'
            }}
          >
            {isComplete && !isError ? (
              <>
                <BarChart3 size={16} />
                Select Trades ({pendingTrades?.length || 0})
              </>
            ) : isError ? (
              <>
                <AlertCircle size={16} />
                Select Trades
              </>
            ) : (
              <>
                <Loader2 size={16} className="animate-spin" />
                Select Trades
              </>
            )}
          </button>

          {/* Cancel/Back link */}
          {(isError || (!isComplete && !isError)) && (
            <button
              onClick={onCancel}
              className="w-full py-2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
            >
              {isError ? 'Volver a configuracion' : 'Cancelar'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
