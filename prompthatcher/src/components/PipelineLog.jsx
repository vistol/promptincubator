import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, EyeOff, Lock, Copy, Check, ChevronDown, ChevronUp,
  Clock, Cpu, DollarSign, BarChart3, Filter, Shield,
  Zap, TrendingUp, TrendingDown, AlertTriangle, Terminal,
  Activity, ArrowRight, CheckCircle2, XCircle
} from 'lucide-react'
import { PIPELINE_STEPS } from '../lib/executionLog'

// AI Model labels
const AI_LABELS = {
  anthropic: { name: 'Claude Sonnet 4', icon: '🧠' },
  google: { name: 'Gemini 2.5 Flash', icon: '🔮' },
  openai: { name: 'GPT-4', icon: '🤖' },
  xai: { name: 'Grok 3', icon: '⚡' }
}

// Execution time labels
const EXEC_LABELS = {
  target: 'Target Based',
  scalping: 'Scalping',
  intraday: 'Intraday',
  swing: 'Swing'
}

// Format ms to human readable
const fmtDuration = (ms) => {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

// Format timestamp
const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

// Calculate step durations from events
function calcStepDurations(events) {
  const steps = {}
  events.forEach(e => {
    if (!steps[e.step]) steps[e.step] = {}
    if (e.status === 'started') steps[e.step].start = e.elapsed
    if (e.status === 'completed') steps[e.step].end = e.elapsed
    if (e.status === 'error') steps[e.step].error = true
    steps[e.step].data = e.data || steps[e.step].data
    steps[e.step].message = e.message || steps[e.step].message
  })

  const result = []
  const orderedSteps = [
    PIPELINE_STEPS.START,
    PIPELINE_STEPS.FETCH_PRICES,
    PIPELINE_STEPS.BUILD_PROMPT,
    PIPELINE_STEPS.AI_CALL,
    PIPELINE_STEPS.AI_RESPONSE,
    PIPELINE_STEPS.PARSE_TRADES,
    PIPELINE_STEPS.FILTER_IPE,
    PIPELINE_STEPS.VALIDATE_RR,
    PIPELINE_STEPS.COMPLETE
  ]

  const stepLabels = {
    [PIPELINE_STEPS.START]: { label: 'Inicio', icon: Zap },
    [PIPELINE_STEPS.FETCH_PRICES]: { label: 'Precios Binance', icon: DollarSign },
    [PIPELINE_STEPS.BUILD_PROMPT]: { label: 'Construir Prompt', icon: Terminal },
    [PIPELINE_STEPS.AI_CALL]: { label: 'Llamada a IA', icon: Cpu },
    [PIPELINE_STEPS.AI_RESPONSE]: { label: 'Respuesta IA', icon: Activity },
    [PIPELINE_STEPS.PARSE_TRADES]: { label: 'Parsear Trades', icon: BarChart3 },
    [PIPELINE_STEPS.FILTER_IPE]: { label: 'Filtro IPE', icon: Filter },
    [PIPELINE_STEPS.VALIDATE_RR]: { label: 'Risk:Reward', icon: Shield },
    [PIPELINE_STEPS.COMPLETE]: { label: 'Completado', icon: CheckCircle2 },
  }

  const totalDuration = events.length > 0 ? events[events.length - 1].elapsed : 0

  orderedSteps.forEach(step => {
    if (!steps[step]) return
    const s = steps[step]
    const dur = (s.end != null && s.start != null) ? s.end - s.start : null
    const label = stepLabels[step] || { label: step, icon: Activity }
    result.push({
      step,
      label: label.label,
      Icon: label.icon,
      duration: dur,
      pct: totalDuration > 0 && dur != null ? (dur / totalDuration) * 100 : 0,
      error: s.error || false,
      data: s.data,
      message: s.message
    })
  })

  return { steps: result, totalDuration }
}

// --- Sub-components ---

function SummaryCards({ executionLog, summary, config }) {
  const ai = config?.aiModel ? AI_LABELS[config.aiModel] || { name: config.aiModel, icon: '🤖' } : { name: 'N/A', icon: '?' }

  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Total Duration */}
      <div className="bg-quant-surface rounded-xl p-3 border border-quant-border">
        <div className="flex items-center gap-2 mb-1">
          <Clock size={12} className="text-accent-cyan" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Duracion Total</span>
        </div>
        <span className="text-lg font-mono font-bold text-white">{summary?.totalDurationStr || '-'}</span>
      </div>

      {/* AI Time */}
      <div className="bg-quant-surface rounded-xl p-3 border border-quant-border">
        <div className="flex items-center gap-2 mb-1">
          <Cpu size={12} className="text-accent-purple" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tiempo IA</span>
        </div>
        <span className="text-lg font-mono font-bold text-accent-purple">{summary?.aiDurationStr || '-'}</span>
      </div>

      {/* AI Model */}
      <div className="bg-quant-surface rounded-xl p-3 border border-quant-border">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">{ai.icon}</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Modelo IA</span>
        </div>
        <span className="text-sm font-medium text-white">{ai.name}</span>
      </div>

      {/* Trades Result */}
      <div className="bg-quant-surface rounded-xl p-3 border border-quant-border">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={12} className="text-accent-green" />
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Trades</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-mono font-bold text-accent-green">{summary?.tradesAfterFilter ?? '-'}</span>
          <span className="text-xs text-gray-500">/ {summary?.tradesGenerated ?? '-'} generados</span>
        </div>
      </div>
    </div>
  )
}

function ConfigSection({ config }) {
  if (!config) return null
  return (
    <div className="bg-quant-surface rounded-xl border border-quant-border overflow-hidden">
      <div className="px-3 py-2 border-b border-quant-border/50 flex items-center gap-2">
        <Terminal size={12} className="text-accent-cyan" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Configuracion de Ejecucion</span>
      </div>
      <div className="p-3 grid grid-cols-3 gap-2">
        <ConfigItem label="Capital" value={`$${config.capital?.toLocaleString()}`} />
        <ConfigItem label="Leverage" value={`${config.leverage}x`} />
        <ConfigItem label="Modo" value={EXEC_LABELS[config.executionTime] || config.executionTime} />
        <ConfigItem label="IPE Min" value={`${config.minIpe}%`} />
        <ConfigItem label="Resultados" value={config.numResults} />
        <ConfigItem label="Modelo" value={(AI_LABELS[config.aiModel]?.name || config.aiModel)?.split(' ')[0]} />
      </div>
    </div>
  )
}

function ConfigItem({ label, value }) {
  return (
    <div className="text-center">
      <span className="text-[9px] text-gray-600 uppercase block">{label}</span>
      <span className="text-xs font-mono text-white font-medium">{value}</span>
    </div>
  )
}

function StepTimeline({ stepDurations }) {
  const { steps, totalDuration } = stepDurations
  // Filter out START and COMPLETE for the visual bar
  const barSteps = steps.filter(s => s.step !== PIPELINE_STEPS.START && s.step !== PIPELINE_STEPS.COMPLETE && s.duration != null)

  const barColors = {
    [PIPELINE_STEPS.FETCH_PRICES]: 'bg-accent-yellow',
    [PIPELINE_STEPS.BUILD_PROMPT]: 'bg-accent-orange',
    [PIPELINE_STEPS.AI_CALL]: 'bg-accent-purple',
    [PIPELINE_STEPS.AI_RESPONSE]: 'bg-accent-purple',
    [PIPELINE_STEPS.PARSE_TRADES]: 'bg-accent-cyan',
    [PIPELINE_STEPS.FILTER_IPE]: 'bg-accent-green',
    [PIPELINE_STEPS.VALIDATE_RR]: 'bg-accent-green',
  }

  const textColors = {
    [PIPELINE_STEPS.FETCH_PRICES]: 'text-accent-yellow',
    [PIPELINE_STEPS.BUILD_PROMPT]: 'text-accent-orange',
    [PIPELINE_STEPS.AI_CALL]: 'text-accent-purple',
    [PIPELINE_STEPS.AI_RESPONSE]: 'text-accent-purple',
    [PIPELINE_STEPS.PARSE_TRADES]: 'text-accent-cyan',
    [PIPELINE_STEPS.FILTER_IPE]: 'text-accent-green',
    [PIPELINE_STEPS.VALIDATE_RR]: 'text-accent-green',
  }

  return (
    <div className="bg-quant-surface rounded-xl border border-quant-border overflow-hidden">
      <div className="px-3 py-2 border-b border-quant-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={12} className="text-accent-cyan" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Timeline del Pipeline</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">{fmtDuration(totalDuration)}</span>
      </div>

      {/* Duration bar */}
      <div className="px-3 pt-3 pb-1">
        <div className="h-3 rounded-full bg-quant-bg overflow-hidden flex">
          {barSteps.map((s, i) => (
            <div
              key={i}
              className={`h-full ${barColors[s.step] || 'bg-gray-600'} transition-all`}
              style={{ width: `${Math.max(s.pct, 2)}%` }}
              title={`${s.label}: ${fmtDuration(s.duration)}`}
            />
          ))}
        </div>
      </div>

      {/* Step rows */}
      <div className="p-3 space-y-1">
        {steps.filter(s => s.step !== PIPELINE_STEPS.START).map((s, i) => {
          const Icon = s.Icon
          const color = textColors[s.step] || 'text-gray-400'
          return (
            <div key={i} className="flex items-center gap-2 py-1">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                s.error ? 'bg-accent-red/15' : s.step === PIPELINE_STEPS.COMPLETE ? 'bg-accent-green/15' : 'bg-quant-bg'
              }`}>
                {s.error ? (
                  <XCircle size={12} className="text-accent-red" />
                ) : s.step === PIPELINE_STEPS.COMPLETE ? (
                  <CheckCircle2 size={12} className="text-accent-green" />
                ) : (
                  <Icon size={11} className={color} />
                )}
              </div>
              <span className={`text-[11px] flex-1 ${s.error ? 'text-accent-red' : 'text-gray-300'}`}>
                {s.label}
              </span>
              {s.duration != null && (
                <span className="text-[10px] font-mono text-gray-500 bg-quant-bg px-1.5 py-0.5 rounded">
                  {fmtDuration(s.duration)}
                </span>
              )}
              {s.pct > 0 && (
                <div className="w-12 h-1 rounded-full bg-quant-bg overflow-hidden">
                  <div className={`h-full ${barColors[s.step] || 'bg-gray-600'}`} style={{ width: `${s.pct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PricesTable({ events }) {
  const priceEvent = events.find(e => e.step === PIPELINE_STEPS.FETCH_PRICES && e.status === 'completed')
  if (!priceEvent?.data?.prices) return null

  const prices = Object.entries(priceEvent.data.prices)

  return (
    <div className="bg-quant-surface rounded-xl border border-quant-border overflow-hidden">
      <div className="px-3 py-2 border-b border-quant-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={12} className="text-accent-yellow" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Precios Consultados</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">{prices.length} pares</span>
      </div>
      <div className="p-2 grid grid-cols-2 gap-1">
        {prices.map(([asset, price]) => (
          <div key={asset} className="flex items-center justify-between px-2 py-1.5 bg-quant-bg rounded-lg">
            <span className="text-[11px] text-gray-300 font-mono font-medium">{asset.replace('/USDT', '')}</span>
            <span className="text-[11px] text-accent-green font-mono">${Number(price).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TradesTable({ events }) {
  const parseEvent = events.find(e => e.step === PIPELINE_STEPS.PARSE_TRADES && e.status === 'completed')
  const filterEvent = events.find(e => e.step === PIPELINE_STEPS.FILTER_IPE && e.status === 'completed')
  const rrEvent = events.find(e => e.step === PIPELINE_STEPS.VALIDATE_RR && e.status === 'completed')

  if (!parseEvent?.data) return null

  const trades = parseEvent.data.trades?.split(', ') || []
  const discardedInfo = filterEvent?.data?.discardedInfo
  const rrResults = rrEvent?.data?.results || []

  return (
    <div className="bg-quant-surface rounded-xl border border-quant-border overflow-hidden">
      <div className="px-3 py-2 border-b border-quant-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={12} className="text-accent-cyan" />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Trades Generados</span>
        </div>
        <div className="flex items-center gap-2">
          {filterEvent?.data && (
            <span className="text-[10px] font-mono">
              <span className="text-accent-green">{filterEvent.data.accepted}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-gray-400">{filterEvent.data.accepted + filterEvent.data.discarded}</span>
            </span>
          )}
        </div>
      </div>
      <div className="p-2 space-y-1">
        {trades.map((trade, i) => {
          const parts = trade.trim().split(' ')
          const asset = parts[0] || trade
          const direction = parts[1] || ''
          const isLong = direction === 'LONG'
          const rr = rrResults.find(r => r.asset === asset || r.asset === asset.replace('/USDT', ''))

          return (
            <div key={i} className="flex items-center gap-2 px-2 py-2 bg-quant-bg rounded-lg">
              {/* Direction badge */}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                isLong ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'
              }`}>
                {direction || '?'}
              </span>

              {/* Asset name */}
              <span className="text-[11px] text-white font-mono font-medium flex-1">{asset}</span>

              {/* R:R badge */}
              {rr && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-gray-400">R:R</span>
                  <span className={`text-[10px] font-mono font-bold ${rr.valid ? 'text-accent-green' : 'text-accent-yellow'}`}>
                    {rr.rr}:1
                  </span>
                  {rr.valid ? (
                    <CheckCircle2 size={10} className="text-accent-green" />
                  ) : (
                    <AlertTriangle size={10} className="text-accent-yellow" />
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Discarded trades */}
        {discardedInfo && (
          <div className="flex items-start gap-2 px-2 py-2 bg-accent-red/5 border border-accent-red/10 rounded-lg">
            <XCircle size={12} className="text-accent-red shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] text-accent-red font-medium">Descartados por IPE bajo</span>
              <p className="text-[10px] text-accent-red/70 mt-0.5">{discardedInfo}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function IntegrityHashes({ hashes }) {
  if (!hashes || !Object.values(hashes).some(h => h)) return null

  const items = [
    { label: 'Precios entrada', key: 'pricesInput', icon: DollarSign, color: 'text-accent-yellow' },
    { label: 'Prompt enviado', key: 'promptSent', icon: Terminal, color: 'text-accent-orange' },
    { label: 'Respuesta AI', key: 'aiResponseRaw', icon: Cpu, color: 'text-accent-purple' },
    { label: 'Trades salida', key: 'tradesOutput', icon: BarChart3, color: 'text-accent-green' },
  ].filter(item => hashes[item.key])

  return (
    <div className="bg-quant-surface rounded-xl border border-accent-purple/20 overflow-hidden">
      <div className="px-3 py-2 border-b border-quant-border/50 flex items-center gap-2">
        <Lock size={12} className="text-accent-purple" />
        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Verificacion de Integridad SHA-256</span>
      </div>
      <div className="p-2 space-y-1">
        {items.map(({ label, key, icon: Icon, color }) => (
          <div key={key} className="px-2 py-1.5 bg-quant-bg rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={10} className={color} />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
            <span className="text-[9px] font-mono text-accent-purple/80 break-all leading-relaxed">
              {hashes[key]}
            </span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-quant-border/50 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <CheckCircle2 size={10} className="text-accent-green" />
          <span className="text-[10px] text-gray-500">Datos verificados - no alterados entre generacion y presentacion</span>
        </div>
      </div>
    </div>
  )
}

function TerminalLog({ events, showAdvanced }) {
  return (
    <div className="bg-[#0a0a0f] rounded-xl border border-quant-border overflow-hidden">
      {/* Terminal Header Bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111118] border-b border-quant-border/50">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-accent-red/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent-yellow/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent-green/60" />
        </div>
        <span className="text-[9px] text-gray-600 font-mono ml-2">raw event log</span>
      </div>

      <div className="p-3 font-mono text-[9px] leading-[1.8] overflow-x-auto max-h-[300px] overflow-y-auto hide-scrollbar">
        {events.map((event, idx) => {
          const ts = fmtTime(event.timestamp)
          const isError = event.status === 'error'
          const isComplete = event.step === PIPELINE_STEPS.COMPLETE
          const stepColors = {
            [PIPELINE_STEPS.START]: 'text-accent-cyan',
            [PIPELINE_STEPS.FETCH_PRICES]: 'text-accent-yellow',
            [PIPELINE_STEPS.BUILD_PROMPT]: 'text-accent-orange',
            [PIPELINE_STEPS.AI_CALL]: 'text-accent-purple',
            [PIPELINE_STEPS.AI_RESPONSE]: 'text-accent-purple',
            [PIPELINE_STEPS.PARSE_TRADES]: 'text-accent-cyan',
            [PIPELINE_STEPS.FILTER_IPE]: 'text-accent-green',
            [PIPELINE_STEPS.VALIDATE_RR]: 'text-accent-green',
            [PIPELINE_STEPS.COMPLETE]: 'text-accent-green',
            [PIPELINE_STEPS.ERROR]: 'text-accent-red'
          }
          const stepLabels = {
            [PIPELINE_STEPS.START]: 'START',
            [PIPELINE_STEPS.FETCH_PRICES]: 'PRICES',
            [PIPELINE_STEPS.BUILD_PROMPT]: 'PROMPT',
            [PIPELINE_STEPS.AI_CALL]: 'AI_CALL',
            [PIPELINE_STEPS.AI_RESPONSE]: 'AI_RESP',
            [PIPELINE_STEPS.PARSE_TRADES]: 'PARSE',
            [PIPELINE_STEPS.FILTER_IPE]: 'FILTER',
            [PIPELINE_STEPS.VALIDATE_RR]: 'VALID8',
            [PIPELINE_STEPS.COMPLETE]: 'DONE',
            [PIPELINE_STEPS.ERROR]: 'ERROR'
          }

          const prefix = event.status === 'completed' ? '✓ ' : event.status === 'error' ? '✗ ' : '→ '

          return (
            <div key={idx} className={`flex gap-0 ${isError ? 'bg-accent-red/5' : isComplete ? 'bg-accent-green/5' : ''}`}>
              <span className="text-gray-600 shrink-0 w-[75px]">{ts}</span>
              <span className="text-gray-700 shrink-0 w-[15px]">|</span>
              <span className={`shrink-0 w-[55px] font-bold ${stepColors[event.step] || 'text-gray-500'}`}>
                {stepLabels[event.step] || event.step}
              </span>
              <span className="text-gray-700 shrink-0 w-[15px]">|</span>
              <span className={`flex-1 ${isError ? 'text-accent-red' : 'text-gray-400'}`}>
                {prefix}{event.message}
              </span>
              <span className="text-gray-700 shrink-0 ml-2">{event.elapsed != null ? `+${fmtDuration(event.elapsed)}` : ''}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Main Component ---

export default function PipelineLog({ executionLog }) {
  const [showRawLog, setShowRawLog] = useState(false)
  const [showHashes, setShowHashes] = useState(false)
  const [showPrices, setShowPrices] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!executionLog || !executionLog.events || executionLog.events.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-quant-surface flex items-center justify-center">
          <Terminal size={24} className="text-gray-600" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Pipeline log no disponible</p>
        <p className="text-xs text-gray-600 mt-1">Los nuevos eggs incluiran el log completo</p>
      </div>
    )
  }

  const { events, summary, hashes, config } = executionLog

  const stepDurations = useMemo(() => calcStepDurations(events), [events])

  // Copy raw log
  const handleCopy = () => {
    const lines = events.map(e => {
      const ts = fmtTime(e.timestamp)
      return `${ts} | ${e.step.padEnd(12)} | ${e.message}`
    }).join('\n')
    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Pipeline de Generacion</span>
          {executionLog.startedAt && (
            <span className="text-[10px] text-gray-600 ml-2">
              {new Date(executionLog.startedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' '}
              {fmtTime(executionLog.startedAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded text-[9px] font-medium ${
            executionLog.status === 'completed' ? 'bg-accent-green/15 text-accent-green' :
            executionLog.status === 'error' ? 'bg-accent-red/15 text-accent-red' :
            'bg-accent-yellow/15 text-accent-yellow'
          }`}>
            {executionLog.status === 'completed' ? 'COMPLETADO' : executionLog.status === 'error' ? 'ERROR' : 'EN CURSO'}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards executionLog={executionLog} summary={summary} config={config} />

      {/* Config */}
      <ConfigSection config={config} />

      {/* Timeline */}
      <StepTimeline stepDurations={stepDurations} />

      {/* Expandable: Prices */}
      <button
        onClick={() => setShowPrices(!showPrices)}
        className="w-full flex items-center justify-between px-3 py-2 bg-quant-surface rounded-xl border border-quant-border hover:border-gray-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          <DollarSign size={12} className="text-accent-yellow" />
          <span className="text-[11px] text-gray-300">Precios consultados de Binance</span>
        </div>
        {showPrices ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      <AnimatePresence>
        {showPrices && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <PricesTable events={events} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trades Table */}
      <TradesTable events={events} />

      {/* Expandable: Hashes */}
      <button
        onClick={() => setShowHashes(!showHashes)}
        className="w-full flex items-center justify-between px-3 py-2 bg-quant-surface rounded-xl border border-accent-purple/20 hover:border-accent-purple/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lock size={12} className="text-accent-purple" />
          <span className="text-[11px] text-gray-300">Verificacion de integridad SHA-256</span>
        </div>
        {showHashes ? <ChevronUp size={14} className="text-accent-purple/50" /> : <ChevronDown size={14} className="text-accent-purple/50" />}
      </button>
      <AnimatePresence>
        {showHashes && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <IntegrityHashes hashes={hashes} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable: Raw Terminal Log */}
      <button
        onClick={() => setShowRawLog(!showRawLog)}
        className="w-full flex items-center justify-between px-3 py-2 bg-quant-surface rounded-xl border border-quant-border hover:border-gray-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Terminal size={12} className="text-accent-cyan" />
          <span className="text-[11px] text-gray-300">Raw event log ({events.length} eventos)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCopy() }}
            className="text-[9px] text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            {copied ? <Check size={10} className="text-accent-green" /> : <Copy size={10} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          {showRawLog ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>
      <AnimatePresence>
        {showRawLog && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <TerminalLog events={events} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
