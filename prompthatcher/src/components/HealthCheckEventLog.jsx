import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Settings, RotateCcw, Pencil, Lightbulb, Zap, ScrollText } from 'lucide-react'
import { formatDuration, getSuggestionAction, getModelDisplayName } from '../lib/healthCheckUtils'

export default function HealthCheckEventLog({
  runLog = [],
  liveRunLog = null,
  isRunning = false,
  onNavigateToEgg,
  onGoToSettings,
  onRetryFailed,    // (variationsToRetry) => void — targeted retry
  onRetryAll,       // () => void — full re-run (fallback)
  onEditCheck
}) {
  const [expandedRun, setExpandedRun] = useState(null)

  // Combine live run with persisted runs for display
  const allRuns = liveRunLog && isRunning
    ? [{ ...liveRunLog, isLive: true }, ...runLog]
    : runLog

  if (allRuns.length === 0) {
    return (
      <div className="text-center py-6">
        <ScrollText size={28} className="text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No event log yet</p>
        <p className="text-xs text-gray-500 mt-1">Run the health check to see detailed execution events</p>
      </div>
    )
  }

  // Handle suggestion action with optional targeted retry
  const handleSuggestionAction = (actionType, variation = null) => {
    switch (actionType) {
      case 'settings':
        onGoToSettings?.()
        break
      case 'retry':
        // Targeted retry: only this specific variation
        if (variation && onRetryFailed) {
          onRetryFailed([variation])
        } else {
          onRetryAll?.()
        }
        break
      case 'edit':
        onEditCheck?.()
        break
    }
  }

  // Retry all failed/skipped from a specific run
  const handleRetryAllFailed = (run) => {
    const failedVariations = (run.events || [])
      .filter(e => e.status === 'failed' || e.status === 'skipped')
      .map(e => e.variation)
      .filter(v => v && Object.keys(v).length > 0)

    if (failedVariations.length > 0 && onRetryFailed) {
      onRetryFailed(failedVariations)
    }
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto hide-scrollbar">
      {allRuns.map((run, runIdx) => {
        const isExpanded = expandedRun === (run.id || runIdx)
        const isLive = run.isLive
        const summary = run.summary || {}
        const hasFailures = (summary.failed || 0) + (summary.skipped || 0) > 0

        return (
          <div
            key={run.id || runIdx}
            className={`rounded-xl border overflow-hidden ${
              isLive ? 'border-accent-cyan/30 bg-accent-cyan/5' : 'border-quant-border bg-quant-card'
            }`}
          >
            {/* Run header */}
            <button
              onClick={() => setExpandedRun(isExpanded ? null : (run.id || runIdx))}
              className="w-full p-3 text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {isLive ? (
                    <Zap size={14} className="text-accent-cyan animate-pulse shrink-0" />
                  ) : (
                    <Clock size={14} className="text-gray-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {isLive ? 'Running...' : `Run #${allRuns.length - runIdx}`}
                      </span>
                      {run.startedAt && (
                        <span className="text-[9px] text-gray-500">
                          {new Date(run.startedAt).toLocaleDateString()}{' '}
                          {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {summary.succeeded > 0 && (
                        <span className="text-[9px] text-accent-green flex items-center gap-0.5">
                          <CheckCircle size={8} /> {summary.succeeded}
                        </span>
                      )}
                      {summary.failed > 0 && (
                        <span className="text-[9px] text-accent-red flex items-center gap-0.5">
                          <XCircle size={8} /> {summary.failed}
                        </span>
                      )}
                      {summary.skipped > 0 && (
                        <span className="text-[9px] text-accent-orange flex items-center gap-0.5">
                          <AlertTriangle size={8} /> {summary.skipped}
                        </span>
                      )}
                      {run.durationMs != null && (
                        <span className="text-[9px] text-gray-500 font-mono">
                          {formatDuration(run.durationMs)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 ml-2 flex items-center gap-1.5">
                  {/* Retry Failed button at run level — only for completed runs with failures */}
                  {!isLive && hasFailures && !isRunning && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRetryAllFailed(run)
                      }}
                      className="text-[9px] px-2 py-1 rounded-lg bg-accent-orange/10 border border-accent-orange/20 text-accent-orange hover:bg-accent-orange/20 transition-colors flex items-center gap-1"
                      title={`Retry ${(summary.failed || 0) + (summary.skipped || 0)} failed variation(s) only`}
                    >
                      <RotateCcw size={9} />
                      Retry {(summary.failed || 0) + (summary.skipped || 0)} Failed
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp size={14} className="text-gray-500" />
                  ) : (
                    <ChevronDown size={14} className="text-gray-500" />
                  )}
                </div>
              </div>
            </button>

            {/* Expanded: event timeline */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 border-t border-quant-border/50">
                    <div className="pt-2 space-y-0">
                      {(run.events || []).map((event, eventIdx) => (
                        <EventTimelineItem
                          key={event.id || eventIdx}
                          event={event}
                          isLast={eventIdx === (run.events || []).length - 1}
                          isRunning={isRunning}
                          onNavigateToEgg={onNavigateToEgg}
                          onSuggestionAction={handleSuggestionAction}
                        />
                      ))}
                      {(run.events || []).length === 0 && (
                        <p className="text-xs text-gray-500 py-2 text-center">No events recorded</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

function EventTimelineItem({ event, isLast, isRunning, onNavigateToEgg, onSuggestionAction }) {
  const statusConfig = {
    success: { color: 'text-accent-green', bg: 'bg-accent-green', lineColor: 'bg-accent-green/30', Icon: CheckCircle },
    failed: { color: 'text-accent-red', bg: 'bg-accent-red', lineColor: 'bg-accent-red/30', Icon: XCircle },
    skipped: { color: 'text-accent-orange', bg: 'bg-accent-orange', lineColor: 'bg-accent-orange/30', Icon: AlertTriangle }
  }

  const config = statusConfig[event.status] || statusConfig.failed
  const { Icon } = config
  const suggestionAction = event.errorType ? getSuggestionAction(event.errorType) : null

  return (
    <div className="flex gap-2.5">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center shrink-0 pt-1">
        <div className={`w-5 h-5 rounded-full flex items-center justify-center ${config.bg}/20`}>
          <Icon size={11} className={config.color} />
        </div>
        {!isLast && (
          <div className={`w-0.5 flex-1 mt-1 rounded-full ${config.lineColor}`} />
        )}
      </div>

      {/* Event content */}
      <div className={`flex-1 min-w-0 pb-3`}>
        {/* Header line */}
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-mono text-gray-300 truncate" title={event.variationLabel}>
            {event.variationLabel}
          </span>
          {event.durationMs > 0 && (
            <span className="text-[9px] text-gray-500 font-mono shrink-0">
              {formatDuration(event.durationMs)}
            </span>
          )}
          {event.timestamp && (
            <span className="text-[9px] text-gray-600 shrink-0">
              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>

        {/* Success details */}
        {event.status === 'success' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-accent-green">
              {event.tradesGenerated} trade{event.tradesGenerated !== 1 ? 's' : ''} generated
            </span>
            {event.eggId && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onNavigateToEgg?.(event.eggId, e)
                }}
                className="text-[9px] text-accent-cyan flex items-center gap-0.5 hover:underline"
              >
                View egg <ExternalLink size={8} />
              </button>
            )}
          </div>
        )}

        {/* Failure details */}
        {event.status === 'failed' && (
          <div className="space-y-1">
            <p className="text-[10px] text-accent-red/80 break-words">
              {event.error || 'Unknown error'}
            </p>
            {event.suggestion && (
              <div className="flex items-start gap-1.5 p-1.5 bg-accent-yellow/5 border border-accent-yellow/10 rounded-lg">
                <Lightbulb size={10} className="text-accent-yellow shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300">{event.suggestion}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {/* Targeted retry button for this specific variation */}
                    {!isRunning && event.variation && Object.keys(event.variation).length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSuggestionAction('retry', event.variation)
                        }}
                        className="text-[9px] px-2 py-0.5 rounded-md bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-colors flex items-center gap-1"
                      >
                        <RotateCcw size={8} />
                        Retry This
                      </button>
                    )}
                    {/* Additional action (Go to Settings / Edit) */}
                    {suggestionAction && suggestionAction.action !== 'retry' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSuggestionAction(suggestionAction.action)
                        }}
                        className="text-[9px] px-2 py-0.5 rounded-md bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/20 transition-colors flex items-center gap-1"
                      >
                        {suggestionAction.action === 'settings' && <Settings size={8} />}
                        {suggestionAction.action === 'edit' && <Pencil size={8} />}
                        {suggestionAction.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Skip details */}
        {event.status === 'skipped' && (
          <div className="space-y-1">
            <p className="text-[10px] text-accent-orange/80">
              {event.skipReason || 'Skipped'}
            </p>
            {event.suggestion && (
              <div className="flex items-start gap-1.5 p-1.5 bg-accent-yellow/5 border border-accent-yellow/10 rounded-lg">
                <Lightbulb size={10} className="text-accent-yellow shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-300">{event.suggestion}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {/* Targeted retry for this skipped variation */}
                    {!isRunning && event.variation && Object.keys(event.variation).length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSuggestionAction('retry', event.variation)
                        }}
                        className="text-[9px] px-2 py-0.5 rounded-md bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20 transition-colors flex items-center gap-1"
                      >
                        <RotateCcw size={8} />
                        Retry This
                      </button>
                    )}
                    {suggestionAction && suggestionAction.action !== 'retry' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSuggestionAction(suggestionAction.action)
                        }}
                        className="text-[9px] px-2 py-0.5 rounded-md bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/20 transition-colors flex items-center gap-1"
                      >
                        {suggestionAction.action === 'settings' && <Settings size={8} />}
                        {suggestionAction.action === 'edit' && <Pencil size={8} />}
                        {suggestionAction.label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
