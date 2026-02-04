// Health Check Utilities
// Error classification, run log creation, and helper functions

const MAX_RUN_LOGS = 20

const MODEL_DISPLAY_NAMES = {
  google: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  xai: 'xAI Grok'
}

export function getModelDisplayName(model) {
  return MODEL_DISPLAY_NAMES[model] || model || 'AI'
}

// Error classification patterns — maps raw error strings to types + actionable suggestions
const ERROR_PATTERNS = [
  {
    pattern: /no api key/i,
    errorType: 'missing_api_key',
    suggestion: (model) => `Add your ${getModelDisplayName(model)} API key in Settings > API Keys.`
  },
  {
    pattern: /429|rate.?limit|too many requests/i,
    errorType: 'rate_limit',
    suggestion: (model) => `${getModelDisplayName(model)} rate limit hit. Wait 2-3 minutes and retry, or switch to a different AI model.`
  },
  {
    pattern: /401|403|unauthorized|invalid.*key|authentication/i,
    errorType: 'invalid_api_key',
    suggestion: (model) => `Your ${getModelDisplayName(model)} API key appears invalid. Check it in Settings > API Keys.`
  },
  {
    pattern: /failed to parse|not an array|json|unexpected token/i,
    errorType: 'parse_error',
    suggestion: (model) => `${getModelDisplayName(model)} returned an unparseable response. Try again — AI responses vary. If persistent, try a different model.`
  },
  {
    pattern: /no.*valid trades|did not generate|no trades/i,
    errorType: 'no_trades',
    suggestion: () => `The AI generated trades that didn't pass validation (IPE or R:R filters). Try lowering the Min IPE threshold or adjusting your prompt.`
  },
  {
    pattern: /fetch.*failed|network|timeout|CORS|ERR_|failed to fetch/i,
    errorType: 'network',
    suggestion: () => `Network error. Check your internet connection and try again.`
  },
  {
    pattern: /binance|price/i,
    errorType: 'price_fetch',
    suggestion: () => `Could not fetch market prices from Binance. This is usually temporary — retry in a moment.`
  },
  {
    pattern: /unknown.*provider/i,
    errorType: 'unknown_provider',
    suggestion: () => `Unrecognized AI provider in this variation. Edit the health check and select a supported model.`
  },
  {
    pattern: /500|502|503|504|server error|internal error/i,
    errorType: 'server_error',
    suggestion: (model) => `${getModelDisplayName(model)} server error. This is temporary — retry in a few minutes.`
  }
]

export function classifyError(errorMessage, aiModel = null) {
  if (!errorMessage) {
    return {
      errorType: 'unknown',
      suggestion: 'An unexpected error occurred. Try again or use a different AI model.'
    }
  }

  for (const { pattern, errorType, suggestion } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        errorType,
        suggestion: suggestion(aiModel)
      }
    }
  }

  return {
    errorType: 'unknown',
    suggestion: 'An unexpected error occurred. Check the error details and try again. If persistent, try a different AI model or variation.'
  }
}

// Create a new run log entry (one per health check execution)
export function createRunLogEntry(totalVariations) {
  return {
    id: `run-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
    summary: {
      totalVariations: totalVariations || 0,
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      eggsCreated: 0,
      totalTradesGenerated: 0
    },
    events: []
  }
}

// Create a per-variation event within a run
export function createRunEvent(variationIndex, variation, status, details = {}) {
  const variationLabel = Object.entries(variation || {})
    .map(([k, v]) => `${k}:${v}`)
    .join(' ')

  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    variationIndex,
    variation: variation || {},
    variationLabel: variationLabel || 'default',
    status, // 'success' | 'failed' | 'skipped'
    timestamp: new Date().toISOString(),
    durationMs: details.durationMs || 0,
    eggId: details.eggId || null,
    tradesGenerated: details.tradesGenerated || 0,
    error: details.error || null,
    errorType: details.errorType || null,
    suggestion: details.suggestion || null,
    skipReason: details.skipReason || null
  }
}

// Trim run log to max entries (keeps most recent)
export function trimRunLog(runLog) {
  if (!runLog || runLog.length <= MAX_RUN_LOGS) return runLog || []
  return runLog.slice(0, MAX_RUN_LOGS)
}

// Format duration in ms to human readable
export function formatDuration(ms) {
  if (ms == null) return '--'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const mins = Math.floor(ms / 60000)
  const secs = Math.round((ms % 60000) / 1000)
  return `${mins}m ${secs}s`
}

// Get suggestion action type for UI buttons
export function getSuggestionAction(errorType) {
  switch (errorType) {
    case 'missing_api_key':
    case 'invalid_api_key':
      return { label: 'Go to Settings', action: 'settings' }
    case 'rate_limit':
    case 'network':
    case 'server_error':
    case 'price_fetch':
    case 'parse_error':
      return { label: 'Retry Now', action: 'retry' }
    case 'no_trades':
    case 'unknown_provider':
      return { label: 'Edit Health Check', action: 'edit' }
    default:
      return { label: 'Retry Now', action: 'retry' }
  }
}

// Status icon/color helpers for UI
export function getEventStatusConfig(status) {
  switch (status) {
    case 'success':
      return { color: 'accent-green', bgColor: 'accent-green/20', icon: 'check' }
    case 'failed':
      return { color: 'accent-red', bgColor: 'accent-red/20', icon: 'x' }
    case 'skipped':
      return { color: 'accent-orange', bgColor: 'accent-orange/20', icon: 'skip' }
    default:
      return { color: 'gray-500', bgColor: 'gray-500/20', icon: 'unknown' }
  }
}
