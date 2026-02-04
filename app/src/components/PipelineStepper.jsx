import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertCircle, ChevronDown, ChevronUp, DollarSign, Cpu, Brain, BarChart3, Filter, Shield, Sparkles, Clock } from 'lucide-react'
import { PIPELINE_STEPS, STEP_LABELS } from '../lib/executionLog'

// Step icons mapping
const STEP_ICONS = {
  [PIPELINE_STEPS.START]: Sparkles,
  [PIPELINE_STEPS.FETCH_PRICES]: DollarSign,
  [PIPELINE_STEPS.BUILD_PROMPT]: Cpu,
  [PIPELINE_STEPS.AI_CALL]: Brain,
  [PIPELINE_STEPS.AI_RESPONSE]: Brain,
  [PIPELINE_STEPS.PARSE_TRADES]: BarChart3,
  [PIPELINE_STEPS.FILTER_IPE]: Filter,
  [PIPELINE_STEPS.VALIDATE_RR]: Shield,
  [PIPELINE_STEPS.COMPLETE]: Check,
  [PIPELINE_STEPS.ERROR]: AlertCircle
}

// Ordered steps for the pipeline display
const PIPELINE_ORDER = [
  PIPELINE_STEPS.START,
  PIPELINE_STEPS.FETCH_PRICES,
  PIPELINE_STEPS.BUILD_PROMPT,
  PIPELINE_STEPS.AI_CALL,
  PIPELINE_STEPS.PARSE_TRADES,
  PIPELINE_STEPS.FILTER_IPE,
  PIPELINE_STEPS.VALIDATE_RR,
  PIPELINE_STEPS.COMPLETE
]

// Get the status of a step based on pipeline events
const getStepStatus = (step, events, currentStep) => {
  // Combine AI_CALL and AI_RESPONSE into one visual step
  const relevantSteps = step === PIPELINE_STEPS.AI_CALL
    ? [PIPELINE_STEPS.AI_CALL, PIPELINE_STEPS.AI_RESPONSE]
    : [step]

  const hasError = events.some(e => relevantSteps.includes(e.step) && e.status === 'error')
  const hasCompleted = events.some(e => relevantSteps.includes(e.step) && e.status === 'completed')
  const hasStarted = events.some(e => relevantSteps.includes(e.step) && e.status === 'started')

  if (hasError) return 'error'
  if (hasCompleted) return 'completed'
  if (hasStarted || relevantSteps.includes(currentStep)) return 'active'

  // Check if step is after current step
  const currentIdx = PIPELINE_ORDER.indexOf(currentStep)
  const stepIdx = PIPELINE_ORDER.indexOf(step)
  if (stepIdx > currentIdx) return 'pending'

  return 'pending'
}

// Get the detail data for a step
const getStepData = (step, events) => {
  const relevantSteps = step === PIPELINE_STEPS.AI_CALL
    ? [PIPELINE_STEPS.AI_CALL, PIPELINE_STEPS.AI_RESPONSE]
    : [step]

  const stepEvents = events.filter(e => relevantSteps.includes(e.step))
  const completedEvent = stepEvents.find(e => e.status === 'completed')
  const errorEvent = stepEvents.find(e => e.status === 'error')

  return {
    events: stepEvents,
    data: completedEvent?.data || errorEvent?.data || null,
    message: completedEvent?.message || errorEvent?.message || null,
    elapsed: completedEvent?.elapsed || errorEvent?.elapsed || null
  }
}

export default function PipelineStepper({ events = [], currentStep, isComplete, isError }) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="w-full">
      {/* Compact Pipeline View */}
      <div className="space-y-1">
        {PIPELINE_ORDER.map((step, idx) => {
          const status = getStepStatus(step, events, currentStep)
          const stepInfo = STEP_LABELS[step]
          const Icon = STEP_ICONS[step]
          const data = getStepData(step, events)

          // Skip if still pending and not yet relevant
          if (status === 'pending' && !isComplete && !isError) return null

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex items-start gap-3 px-3 py-2 rounded-lg transition-all ${
                status === 'active' ? 'bg-accent-cyan/5' :
                status === 'error' ? 'bg-accent-red/5' :
                status === 'completed' ? 'bg-transparent' :
                'bg-transparent opacity-40'
              }`}
            >
              {/* Status Icon */}
              <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                status === 'completed' ? 'bg-accent-green/20' :
                status === 'active' ? 'bg-accent-cyan/20' :
                status === 'error' ? 'bg-accent-red/20' :
                'bg-quant-surface'
              }`}>
                {status === 'completed' && <Check size={12} className="text-accent-green" />}
                {status === 'active' && <Loader2 size={12} className="text-accent-cyan animate-spin" />}
                {status === 'error' && <AlertCircle size={12} className="text-accent-red" />}
                {status === 'pending' && <div className="w-2 h-2 rounded-full bg-gray-600" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-medium ${
                    status === 'active' ? 'text-accent-cyan' :
                    status === 'error' ? 'text-accent-red' :
                    status === 'completed' ? 'text-gray-300' :
                    'text-gray-500'
                  }`}>
                    {status === 'active' ? stepInfo.activeLabel : stepInfo.label}
                  </span>
                  {data.elapsed !== null && status === 'completed' && (
                    <span className="text-[10px] text-gray-600 font-mono">
                      {data.elapsed < 1000 ? `${data.elapsed}ms` : `${(data.elapsed / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>

                {/* Inline detail for completed steps */}
                {status === 'completed' && data.message && (
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                    {data.message}
                  </p>
                )}

                {/* Error message */}
                {status === 'error' && data.message && (
                  <p className="text-[10px] text-accent-red mt-0.5">
                    {data.message}
                  </p>
                )}

                {/* Prices detail */}
                {step === PIPELINE_STEPS.FETCH_PRICES && status === 'completed' && data.data?.pricesSummary && showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-1 p-2 bg-quant-surface/50 rounded text-[10px] text-gray-400 font-mono"
                  >
                    {data.data.pricesSummary}
                  </motion.div>
                )}

                {/* AI call detail */}
                {step === PIPELINE_STEPS.AI_CALL && status === 'completed' && data.data && showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-1 p-2 bg-quant-surface/50 rounded text-[10px] text-gray-400 font-mono space-y-0.5"
                  >
                    <div>Tokens respuesta: ~{data.data.responseTokenEstimate}</div>
                  </motion.div>
                )}

                {/* Filter detail */}
                {step === PIPELINE_STEPS.FILTER_IPE && status === 'completed' && data.data?.discardedInfo && showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-1 p-2 bg-quant-surface/50 rounded text-[10px] text-gray-400 font-mono"
                  >
                    Descartados: {data.data.discardedInfo}
                  </motion.div>
                )}

                {/* R:R validation detail */}
                {step === PIPELINE_STEPS.VALIDATE_RR && status === 'completed' && data.data?.summary && showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-1 p-2 bg-quant-surface/50 rounded text-[10px] text-gray-400 font-mono"
                  >
                    {data.data.summary}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Toggle Details */}
      {(isComplete || isError) && events.length > 0 && (
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-gray-500 hover:text-accent-cyan transition-colors"
        >
          {showDetails ? 'Ocultar detalles' : 'Ver detalles completos'}
          {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}

      {/* Completion Summary */}
      {isComplete && events.length > 0 && (() => {
        const completeEvent = events.find(e => e.step === PIPELINE_STEPS.COMPLETE)
        if (!completeEvent) return null
        return (
          <div className="mt-2 p-2 bg-accent-green/5 border border-accent-green/20 rounded-lg text-center">
            <span className="text-[10px] text-accent-green font-medium">
              Pipeline completado en {completeEvent.data?.totalDurationMs
                ? `${(completeEvent.data.totalDurationMs / 1000).toFixed(1)}s`
                : 'N/A'}
            </span>
          </div>
        )
      })()}
    </div>
  )
}
