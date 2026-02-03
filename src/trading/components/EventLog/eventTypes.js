/**
 * @fileoverview Event type definitions and formatters for the Event Log
 * @module trading/components/EventLog/eventTypes
 */

/**
 * Step icons mapping
 */
export const STEP_ICONS = {
  fetchPrices: '📊',
  buildContext: '🔧',
  generatePrompt: '📝',
  callAI: '🤖',
  parseResponse: '⚙️',
  validateTrades: '✅',
  enrichGlassBox: '🔍',
  pipeline: '🔄'
};

/**
 * Step friendly names
 */
export const STEP_NAMES = {
  fetchPrices: 'Precios',
  buildContext: 'Contexto',
  generatePrompt: 'Prompt',
  callAI: 'IA',
  parseResponse: 'Parseo',
  validateTrades: 'Validación',
  enrichGlassBox: 'Glass Box',
  pipeline: 'Pipeline'
};

/**
 * Level colors mapping
 */
export const LEVEL_COLORS = {
  info: '#3b82f6',      // blue
  success: '#22c55e',   // green
  warning: '#f59e0b',   // amber
  error: '#ef4444',     // red
  debug: '#6b7280'      // gray
};

/**
 * Level icons mapping
 */
export const LEVEL_ICONS = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
  debug: '🔍'
};

/**
 * Format a number as currency
 */
function formatCurrency(value) {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toLocaleString()}`;
}

/**
 * Format duration in ms
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Event type configurations and formatters
 */
export const EVENT_TYPES = {
  // ═══════════════════════════════════════════════════════════════
  // LIFECYCLE EVENTS
  // ═══════════════════════════════════════════════════════════════

  EXECUTION_STARTED: {
    icon: '▶',
    level: 'info',
    format: (data) => ({
      title: 'Iniciando generación',
      subtitle: data.promptName ? `Estrategia: ${data.promptName}` : null,
      details: data.config ? [
        `Capital: ${formatCurrency(data.config.capital || 0)}`,
        `Leverage: ${data.config.leverage || 1}x`,
        `Trades: ${data.config.numResults || 3}`
      ] : null
    })
  },

  EXECUTION_COMPLETED: {
    icon: '🏁',
    level: 'success',
    format: (data) => ({
      title: 'Ejecución completada',
      subtitle: `${data.tradesCount || 0} trades en ${formatDuration(data.duration || 0)}`,
      details: [
        `✅ ${data.tradesCount || 0} trades generados`,
        `⏱ Duración: ${formatDuration(data.duration || 0)}`,
        `📊 ${data.eventCount || 0} eventos`
      ]
    })
  },

  EXECUTION_FAILED: {
    icon: '❌',
    level: 'error',
    format: (data) => ({
      title: 'Ejecución fallida',
      subtitle: data.error?.message || 'Error desconocido',
      details: [
        `Paso: ${data.step || 'desconocido'}`,
        data.error?.message
      ].filter(Boolean)
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // STEP EVENTS
  // ═══════════════════════════════════════════════════════════════

  STEP_STARTED: {
    icon: (data) => STEP_ICONS[data.step] || '⚙️',
    level: 'info',
    format: (data) => ({
      title: `Iniciando ${STEP_NAMES[data.step] || data.step}...`,
      subtitle: null
    })
  },

  STEP_COMPLETED: {
    icon: '✅',
    level: 'success',
    format: (data) => ({
      title: `${STEP_NAMES[data.step] || data.step} completado`,
      subtitle: data.duration ? formatDuration(data.duration) : null,
      duration: data.duration
    })
  },

  STEP_ERROR: {
    icon: '❌',
    level: 'error',
    format: (data) => ({
      title: `Error en ${STEP_NAMES[data.step] || data.step}`,
      subtitle: data.error?.message || 'Error desconocido',
      details: data.error?.stack ? [data.error.stack.split('\n')[0]] : null
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // PRICES EVENTS
  // ═══════════════════════════════════════════════════════════════

  PRICES_FETCHING: {
    icon: '📊',
    level: 'info',
    format: (data) => ({
      title: 'Conectando con Binance...',
      subtitle: data.assetsCount ? `Solicitando ${data.assetsCount} activos` : null
    })
  },

  PRICES_FETCHED: {
    icon: '📊',
    level: 'success',
    format: (data) => {
      const prices = data.prices || {};
      const priceEntries = Object.entries(prices);
      const top3 = priceEntries
        .slice(0, 3)
        .map(([k, v]) => {
          const symbol = k.replace('/USDT', '');
          const price = typeof v === 'object' ? v.price : v;
          return `${symbol}: $${Number(price).toLocaleString()}`;
        })
        .join(' | ');

      return {
        title: `${priceEntries.length} precios obtenidos`,
        subtitle: top3 || null,
        expandable: priceEntries.length > 3 ? {
          label: `+${priceEntries.length - 3} más`,
          data: prices
        } : null
      };
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CONTEXT EVENTS
  // ═══════════════════════════════════════════════════════════════

  CONTEXT_BUILDING: {
    icon: '🔧',
    level: 'info',
    format: () => ({
      title: 'Analizando mercado...',
      subtitle: null
    })
  },

  CONTEXT_BUILT: {
    icon: '🔧',
    level: 'success',
    format: (data) => ({
      title: 'Análisis completado',
      subtitle: data.trend ? `Tendencia: ${data.trend}` : null,
      details: [
        data.trend && `Tendencia: ${data.trend} ${data.trend === 'Alcista' ? '📈' : '📉'}`,
        data.volatility && `Volatilidad: ${data.volatility}`,
        data.topAssets && `Top: ${data.topAssets.join(', ')}`
      ].filter(Boolean)
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // PROMPT EVENTS
  // ═══════════════════════════════════════════════════════════════

  PROMPT_GENERATING: {
    icon: '📝',
    level: 'info',
    format: () => ({
      title: 'Generando prompt...',
      subtitle: null
    })
  },

  PROMPT_GENERATED: {
    icon: '📝',
    level: 'success',
    format: (data) => ({
      title: 'Prompt listo',
      subtitle: data.tokens ? `${data.tokens.toLocaleString()} tokens` : null,
      expandable: data.preview ? {
        label: 'Ver preview',
        data: data.preview
      } : null
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // AI EVENTS
  // ═══════════════════════════════════════════════════════════════

  AI_CALLING: {
    icon: '🤖',
    level: 'info',
    format: (data) => ({
      title: `Enviando a ${data.provider || 'IA'}...`,
      subtitle: data.model ? `Modelo: ${data.model}` : null
    })
  },

  AI_STREAMING: {
    icon: '💭',
    level: 'info',
    format: (data) => ({
      title: `Recibiendo... ${data.tokens || 0} tokens`,
      subtitle: data.preview ? `"${data.preview.substring(0, 50)}..."` : null,
      progress: data.progress
    })
  },

  AI_COMPLETED: {
    icon: '✅',
    level: 'success',
    format: (data) => ({
      title: 'Respuesta completa',
      subtitle: `${data.outputTokens || 0} tokens en ${formatDuration(data.duration || 0)}`,
      details: [
        `Provider: ${data.provider || 'N/A'}`,
        `Modelo: ${data.model || 'N/A'}`,
        `Tokens: ${data.inputTokens || 0} → ${data.outputTokens || 0}`,
        `Latencia: ${formatDuration(data.duration || 0)}`
      ],
      expandable: data.response ? {
        label: 'Ver respuesta',
        data: data.response
      } : null
    })
  },

  AI_ERROR: {
    icon: '❌',
    level: 'error',
    format: (data) => ({
      title: 'Error de IA',
      subtitle: data.error?.message || 'Error desconocido',
      details: [
        `Provider: ${data.provider || 'N/A'}`,
        data.error?.message
      ].filter(Boolean)
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // PARSE EVENTS
  // ═══════════════════════════════════════════════════════════════

  PARSE_STARTED: {
    icon: '⚙️',
    level: 'info',
    format: () => ({
      title: 'Extrayendo trades...',
      subtitle: null
    })
  },

  PARSE_COMPLETED: {
    icon: '⚙️',
    level: 'success',
    format: (data) => ({
      title: `${data.tradesCount || 0} trades encontrados`,
      subtitle: data.duration ? formatDuration(data.duration) : null
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // TRADE EVENTS
  // ═══════════════════════════════════════════════════════════════

  TRADE_PARSED: {
    icon: '📈',
    level: 'info',
    isHighlighted: true,
    format: (data) => ({
      title: `Trade #${data.index || 1}: ${data.asset || 'N/A'} ${data.direction || ''}`,
      subtitle: null,
      trade: {
        asset: data.asset,
        direction: data.direction,
        entry: data.entry,
        takeProfit: data.takeProfit,
        stopLoss: data.stopLoss,
        ipe: data.ipe,
        riskReward: data.riskReward
      }
    })
  },

  TRADE_VALIDATED: {
    icon: (data) => data.valid ? '✅' : '⚠️',
    level: (data) => data.valid ? 'success' : 'warning',
    format: (data) => ({
      title: `Trade #${data.index || 1} ${data.valid ? 'válido' : 'con advertencias'}`,
      subtitle: `${data.passed || 0}/${data.total || 0} validaciones`,
      details: (data.results || []).map(r =>
        `${r.passed ? '✓' : '⚠'} ${r.name}: ${r.message}`
      )
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // GLASSBOX EVENTS
  // ═══════════════════════════════════════════════════════════════

  GLASSBOX_GENERATING: {
    icon: '🔍',
    level: 'info',
    format: () => ({
      title: 'Generando transparencia...',
      subtitle: null
    })
  },

  GLASSBOX_COMPLETED: {
    icon: '🔍',
    level: 'success',
    format: (data) => ({
      title: 'Glass Box completo',
      subtitle: data.duration ? formatDuration(data.duration) : null
    })
  },

  // ═══════════════════════════════════════════════════════════════
  // GENERIC EVENTS
  // ═══════════════════════════════════════════════════════════════

  GENERIC: {
    icon: 'ℹ️',
    level: 'info',
    format: (data) => ({
      title: data.message || 'Evento',
      subtitle: null
    })
  }
};

/**
 * Format an event for display
 * @param {Object} rawEvent - Raw event from pipeline
 * @returns {Object} Formatted event for UI
 */
export function formatEvent(rawEvent) {
  const type = rawEvent.type || 'GENERIC';
  const config = EVENT_TYPES[type] || EVENT_TYPES.GENERIC;
  const data = rawEvent.data || rawEvent;

  const formatted = config.format(data);

  // Determine level
  let level = config.level;
  if (typeof level === 'function') {
    level = level(data);
  }

  // Determine icon
  let icon = config.icon;
  if (typeof icon === 'function') {
    icon = icon(data);
  }

  return {
    id: rawEvent.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sequence: rawEvent.sequence,
    timestamp: rawEvent.timestamp || Date.now(),
    type,
    level,
    icon,
    isHighlighted: config.isHighlighted || false,
    ...formatted,
    raw: rawEvent
  };
}

/**
 * Get event level color
 * @param {string} level - Event level
 * @returns {string} CSS color
 */
export function getLevelColor(level) {
  return LEVEL_COLORS[level] || LEVEL_COLORS.info;
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time string
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

export default EVENT_TYPES;
