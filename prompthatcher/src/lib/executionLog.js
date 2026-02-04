// Execution Pipeline Log - Glass Box Pipeline
// Tracks every step from "Generate Trades" click to AI result delivery

// Pipeline step types
export const PIPELINE_STEPS = {
  START: 'start',
  FETCH_PRICES: 'fetch_prices',
  BUILD_PROMPT: 'build_prompt',
  AI_CALL: 'ai_call',
  AI_RESPONSE: 'ai_response',
  PARSE_TRADES: 'parse_trades',
  FILTER_IPE: 'filter_ipe',
  VALIDATE_RR: 'validate_rr',
  COMPLETE: 'complete',
  ERROR: 'error'
}

// Step labels for UI display
export const STEP_LABELS = {
  [PIPELINE_STEPS.START]: { label: 'Iniciando pipeline', activeLabel: 'Iniciando pipeline...' },
  [PIPELINE_STEPS.FETCH_PRICES]: { label: 'Precios de mercado', activeLabel: 'Obteniendo precios reales...' },
  [PIPELINE_STEPS.BUILD_PROMPT]: { label: 'Construir prompt', activeLabel: 'Construyendo prompt para IA...' },
  [PIPELINE_STEPS.AI_CALL]: { label: 'Llamada a IA', activeLabel: 'Enviando a IA...' },
  [PIPELINE_STEPS.AI_RESPONSE]: { label: 'Respuesta de IA', activeLabel: 'Procesando respuesta...' },
  [PIPELINE_STEPS.PARSE_TRADES]: { label: 'Parsear trades', activeLabel: 'Analizando trades generados...' },
  [PIPELINE_STEPS.FILTER_IPE]: { label: 'Filtro IPE', activeLabel: 'Filtrando por IPE minimo...' },
  [PIPELINE_STEPS.VALIDATE_RR]: { label: 'Validar Risk:Reward', activeLabel: 'Verificando coherencia...' },
  [PIPELINE_STEPS.COMPLETE]: { label: 'Pipeline completado', activeLabel: 'Completado' },
  [PIPELINE_STEPS.ERROR]: { label: 'Error', activeLabel: 'Error en pipeline' }
}

// Generate SHA-256 hash of data for integrity verification
export const generateHash = async (data) => {
  try {
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(text)
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

// Create a new execution log instance
export const createExecutionLog = (promptName, config) => ({
  id: `execlog-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  promptName,
  config: {
    capital: config.capital,
    leverage: config.leverage,
    executionTime: config.executionTime,
    aiModel: config.aiModel,
    minIpe: config.minIpe,
    numResults: config.numResults
  },
  startedAt: new Date().toISOString(),
  completedAt: null,
  totalDurationMs: null,
  status: 'running', // running | completed | error
  currentStep: PIPELINE_STEPS.START,
  events: [],
  // Integrity hashes
  hashes: {
    pricesInput: null,
    promptSent: null,
    aiResponseRaw: null,
    tradesOutput: null
  },
  // Summary data populated at completion
  summary: null
})

// Create a pipeline event
export const createEvent = (step, status, message, data = null) => ({
  id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  step,
  status, // 'started' | 'completed' | 'error'
  message,
  data,
  timestamp: new Date().toISOString(),
  elapsed: null // Will be calculated relative to pipeline start
})

// Pipeline event emitter factory
export const createPipelineEmitter = (onEvent) => {
  const log = { startTime: Date.now() }

  return {
    emit: (step, status, message, data = null) => {
      const event = createEvent(step, status, message, data)
      event.elapsed = Date.now() - log.startTime
      onEvent(event, step)
    },
    getElapsed: () => Date.now() - log.startTime
  }
}

// Calculate execution summary from completed log
export const calculateExecutionSummary = (executionLog) => {
  if (!executionLog || !executionLog.events) return null

  const events = executionLog.events
  const totalDuration = events.length > 0
    ? events[events.length - 1].elapsed
    : 0

  // Find key metrics from events
  const priceEvent = events.find(e => e.step === PIPELINE_STEPS.FETCH_PRICES && e.status === 'completed')
  const aiCallEvent = events.find(e => e.step === PIPELINE_STEPS.AI_CALL && e.status === 'started')
  const aiResponseEvent = events.find(e => e.step === PIPELINE_STEPS.AI_RESPONSE && e.status === 'completed')
  const parseEvent = events.find(e => e.step === PIPELINE_STEPS.PARSE_TRADES && e.status === 'completed')
  const filterEvent = events.find(e => e.step === PIPELINE_STEPS.FILTER_IPE && e.status === 'completed')

  const aiDuration = aiCallEvent && aiResponseEvent
    ? aiResponseEvent.elapsed - aiCallEvent.elapsed
    : null

  return {
    totalDurationMs: totalDuration,
    totalDurationStr: formatDuration(totalDuration),
    aiDurationMs: aiDuration,
    aiDurationStr: aiDuration ? formatDuration(aiDuration) : null,
    pricesCount: priceEvent?.data?.count || 0,
    tradesGenerated: parseEvent?.data?.count || 0,
    tradesAfterFilter: filterEvent?.data?.accepted || 0,
    tradesDiscarded: filterEvent?.data?.discarded || 0,
    totalEvents: events.length
  }
}

// Format duration in ms to human readable
const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}
