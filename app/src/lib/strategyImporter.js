// Strategy Importer — fetches external trading strategies and market data
// Sources: GitHub (Freqtrade + PineScript), Binance Futures (funding, OI, long/short)
//
// Expert improvements:
// 1. Few-shot prompt with PASOS format (Lara Volkov)
// 2. Python/PineScript pre-parser with regex (Rajesh Patel / Jamie O'Brien)
// 3. 8000 char code limit (Jamie O'Brien)
// 4. Output validation with retry (Jamie O'Brien)
// 5. PineScript/TradingView source (Rajesh Patel)
// 6. 2-phase conversion: structured extraction → prompt rendering (Marcus Chen)

import { callLLMForText } from './aiService'

// ─── Constants ───────────────────────────────────────────────────

const GITHUB_API = 'https://api.github.com'
const GITHUB_RAW = 'https://raw.githubusercontent.com'
const CODE_CHAR_LIMIT = 8000

// ─── Pre-Parser: Extract structured data from code BEFORE LLM ───

/**
 * Extract indicators, parameters, and trading conditions from Python/Freqtrade code
 * using regex patterns. This gives the LLM structured data instead of raw code.
 * @param {string} code - Python source code
 * @returns {Object} Extracted strategy components
 */
export const preParseFreqtradeCode = (code) => {
  const extracted = {
    indicators: [],
    buyConditions: [],
    sellConditions: [],
    riskParams: {},
    timeframes: [],
    pairs: [],
    rawParams: []
  }

  // ─── Indicators ───
  // RSI: ta.RSI(dataframe, timeperiod=14) or rsi(close, 14)
  const rsiMatches = code.matchAll(/(?:ta\.RSI|rsi)\s*\([^,]*,\s*(?:timeperiod\s*=\s*)?(\d+)/gi)
  for (const m of rsiMatches) extracted.indicators.push({ type: 'RSI', period: parseInt(m[1]) })

  // EMA: ta.EMA(dataframe, timeperiod=21) or ema(close, 21)
  const emaMatches = code.matchAll(/(?:ta\.EMA|ema)\s*\([^,]*,\s*(?:timeperiod\s*=\s*)?(\d+)/gi)
  for (const m of emaMatches) extracted.indicators.push({ type: 'EMA', period: parseInt(m[1]) })

  // SMA: ta.SMA(dataframe, timeperiod=50)
  const smaMatches = code.matchAll(/(?:ta\.SMA|sma)\s*\([^,]*,\s*(?:timeperiod\s*=\s*)?(\d+)/gi)
  for (const m of smaMatches) extracted.indicators.push({ type: 'SMA', period: parseInt(m[1]) })

  // MACD: ta.MACD(dataframe, fastperiod=12, slowperiod=26, signalperiod=9)
  const macdMatch = code.match(/(?:ta\.MACD|macd)\s*\([^)]*?(?:fast(?:period)?\s*=\s*(\d+))?[^)]*?(?:slow(?:period)?\s*=\s*(\d+))?[^)]*?(?:signal(?:period)?\s*=\s*(\d+))?/i)
  if (macdMatch) extracted.indicators.push({ type: 'MACD', fast: parseInt(macdMatch[1]) || 12, slow: parseInt(macdMatch[2]) || 26, signal: parseInt(macdMatch[3]) || 9 })

  // Bollinger Bands: ta.BBANDS(dataframe, timeperiod=20, nbdevup=2, nbdevdn=2)
  const bbMatch = code.match(/(?:ta\.BBANDS|bb(?:ands)?)\s*\([^)]*?(?:timeperiod\s*=\s*(\d+))?[^)]*?(?:nbdev(?:up)?\s*=\s*(\d+\.?\d*))?/i)
  if (bbMatch) extracted.indicators.push({ type: 'Bollinger Bands', period: parseInt(bbMatch[1]) || 20, stdDev: parseFloat(bbMatch[2]) || 2 })

  // Stochastic: ta.STOCH or stoch
  const stochMatch = code.match(/(?:ta\.STOCH|stoch)\s*\([^)]*?(?:fastk_period\s*=\s*(\d+))?/i)
  if (stochMatch) extracted.indicators.push({ type: 'Stochastic', kPeriod: parseInt(stochMatch[1]) || 14 })

  // ADX: ta.ADX(dataframe, timeperiod=14)
  const adxMatch = code.match(/(?:ta\.ADX|adx)\s*\([^,]*,\s*(?:timeperiod\s*=\s*)?(\d+)/i)
  if (adxMatch) extracted.indicators.push({ type: 'ADX', period: parseInt(adxMatch[1]) })

  // ATR: ta.ATR(dataframe, timeperiod=14)
  const atrMatch = code.match(/(?:ta\.ATR|atr)\s*\([^,]*,\s*(?:timeperiod\s*=\s*)?(\d+)/i)
  if (atrMatch) extracted.indicators.push({ type: 'ATR', period: parseInt(atrMatch[1]) })

  // Volume SMA/EMA
  const volMatch = code.match(/volume.*(?:sma|ema|rolling).*?(\d+)/i)
  if (volMatch) extracted.indicators.push({ type: 'Volume MA', period: parseInt(volMatch[1]) })

  // CCI
  const cciMatch = code.match(/(?:ta\.CCI|cci)\s*\([^,]*,\s*(?:timeperiod\s*=\s*)?(\d+)/i)
  if (cciMatch) extracted.indicators.push({ type: 'CCI', period: parseInt(cciMatch[1]) })

  // MFI
  const mfiMatch = code.match(/(?:ta\.MFI|mfi)\s*\([^)]*?(?:timeperiod\s*=\s*)?(\d+)/i)
  if (mfiMatch) extracted.indicators.push({ type: 'MFI', period: parseInt(mfiMatch[1]) })

  // Deduplicate indicators
  const seen = new Set()
  extracted.indicators = extracted.indicators.filter(ind => {
    const key = `${ind.type}-${ind.period || ''}-${ind.fast || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // ─── Buy/Sell Conditions ───
  // Look for condition blocks in populate_buy_trend / populate_entry_trend
  const buyBlock = code.match(/(?:populate_(?:buy|entry)_trend|buy_condition|entry_condition)[^{]*\{?([\s\S]*?)(?:return|def\s|class\s)/i)
  if (buyBlock) {
    // Extract comparisons like: dataframe['rsi'] < 30, qtpylib.crossed_above
    const conditions = buyBlock[1].matchAll(/(?:dataframe\[['"](\w+)['"]\]|(\w+))\s*(<=?|>=?|==|!=|<|>)\s*(\d+\.?\d*)/g)
    for (const c of conditions) {
      extracted.buyConditions.push(`${c[1] || c[2]} ${c[3]} ${c[4]}`)
    }
    // crossed_above / crossed_below
    const crosses = buyBlock[1].matchAll(/crossed_(?:above|below)\s*\(\s*dataframe\[['"](\w+)['"]\]\s*,\s*(?:dataframe\[['"](\w+)['"]\]|(\d+\.?\d*))/g)
    for (const c of crosses) {
      const direction = buyBlock[1].includes('crossed_above') ? 'cruza por encima de' : 'cruza por debajo de'
      extracted.buyConditions.push(`${c[1]} ${direction} ${c[2] || c[3]}`)
    }
  }

  const sellBlock = code.match(/(?:populate_(?:sell|exit)_trend|sell_condition|exit_condition)[^{]*\{?([\s\S]*?)(?:return|def\s|class\s)/i)
  if (sellBlock) {
    const conditions = sellBlock[1].matchAll(/(?:dataframe\[['"](\w+)['"]\]|(\w+))\s*(<=?|>=?|==|!=|<|>)\s*(\d+\.?\d*)/g)
    for (const c of conditions) {
      extracted.sellConditions.push(`${c[1] || c[2]} ${c[3]} ${c[4]}`)
    }
  }

  // ─── Risk Parameters ───
  // Stop loss: stoploss = -0.10
  const slMatch = code.match(/stoploss\s*=\s*(-?\d+\.?\d*)/i)
  if (slMatch) extracted.riskParams.stopLossPercent = Math.abs(parseFloat(slMatch[1]) * 100)

  // Trailing stop
  const tsMatch = code.match(/trailing_stop\s*=\s*(True|true)/i)
  if (tsMatch) extracted.riskParams.trailingStop = true
  const tsOffsetMatch = code.match(/trailing_stop_positive_offset\s*=\s*(\d+\.?\d*)/i)
  if (tsOffsetMatch) extracted.riskParams.trailingStopOffset = parseFloat(tsOffsetMatch[1]) * 100
  const tsPosMatch = code.match(/trailing_stop_positive\s*=\s*(\d+\.?\d*)/i)
  if (tsPosMatch) extracted.riskParams.trailingStopPositive = parseFloat(tsPosMatch[1]) * 100

  // ROI table: minimal_roi = {"0": 0.10, "30": 0.05, "60": 0.02}
  const roiMatch = code.match(/minimal_roi\s*=\s*\{([^}]+)\}/i)
  if (roiMatch) {
    const roiEntries = roiMatch[1].matchAll(/["']?(\d+)["']?\s*:\s*(\d+\.?\d*)/g)
    extracted.riskParams.roi = []
    for (const r of roiEntries) {
      extracted.riskParams.roi.push({ minutes: parseInt(r[1]), profit: parseFloat(r[2]) * 100 })
    }
  }

  // ─── Timeframe ───
  const tfMatch = code.match(/timeframe\s*=\s*['"](\w+)['"]/i)
  if (tfMatch) extracted.timeframes.push(tfMatch[1])

  // ─── Pairs ───
  const pairMatches = code.matchAll(/['"](\w+\/\w+)['"]/g)
  for (const p of pairMatches) {
    if (!extracted.pairs.includes(p[1])) extracted.pairs.push(p[1])
  }

  // ─── Raw numeric parameters (catch-all) ───
  // Things like: buy_rsi = IntParameter(20, 40, default=30)
  const paramMatches = code.matchAll(/(buy_|sell_|)(\w+)\s*=\s*(?:Int|Decimal|Real)Parameter\s*\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)\s*(?:,\s*default\s*=\s*(\d+\.?\d*))?/g)
  for (const p of paramMatches) {
    extracted.rawParams.push({
      name: `${p[1]}${p[2]}`,
      min: parseFloat(p[3]),
      max: parseFloat(p[4]),
      default: p[5] ? parseFloat(p[5]) : null
    })
  }

  return extracted
}

/**
 * Extract indicators and conditions from PineScript/TradingView code
 * @param {string} code - PineScript source code
 * @returns {Object} Extracted strategy components
 */
export const preParsePineScript = (code) => {
  const extracted = {
    indicators: [],
    buyConditions: [],
    sellConditions: [],
    riskParams: {},
    timeframes: [],
    pairs: [],
    rawParams: []
  }

  // RSI: ta.rsi(close, 14) or rsi(close, 14)
  const rsiMatches = code.matchAll(/(?:ta\.)?rsi\s*\(\s*\w+\s*,\s*(\d+)/gi)
  for (const m of rsiMatches) extracted.indicators.push({ type: 'RSI', period: parseInt(m[1]) })

  // EMA: ta.ema(close, 21)
  const emaMatches = code.matchAll(/(?:ta\.)?ema\s*\(\s*\w+\s*,\s*(\d+)/gi)
  for (const m of emaMatches) extracted.indicators.push({ type: 'EMA', period: parseInt(m[1]) })

  // SMA: ta.sma(close, 50)
  const smaMatches = code.matchAll(/(?:ta\.)?sma\s*\(\s*\w+\s*,\s*(\d+)/gi)
  for (const m of smaMatches) extracted.indicators.push({ type: 'SMA', period: parseInt(m[1]) })

  // MACD: ta.macd(close, 12, 26, 9)
  const macdMatch = code.match(/(?:ta\.)?macd\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (macdMatch) extracted.indicators.push({ type: 'MACD', fast: parseInt(macdMatch[1]), slow: parseInt(macdMatch[2]), signal: parseInt(macdMatch[3]) })

  // Bollinger Bands: ta.bb(close, 20, 2)
  const bbMatch = code.match(/(?:ta\.)?bb\s*\(\s*\w+\s*,\s*(\d+)\s*,\s*(\d+\.?\d*)/i)
  if (bbMatch) extracted.indicators.push({ type: 'Bollinger Bands', period: parseInt(bbMatch[1]), stdDev: parseFloat(bbMatch[2]) })

  // ATR: ta.atr(14)
  const atrMatch = code.match(/(?:ta\.)?atr\s*\(\s*(\d+)/i)
  if (atrMatch) extracted.indicators.push({ type: 'ATR', period: parseInt(atrMatch[1]) })

  // Stochastic: ta.stoch(close, high, low, 14, 3, 3)
  const stochMatch = code.match(/(?:ta\.)?stoch\s*\([^)]*?(\d+)/i)
  if (stochMatch) extracted.indicators.push({ type: 'Stochastic', kPeriod: parseInt(stochMatch[1]) })

  // Volume
  const volMatch = code.match(/volume\s*[><=]+\s*(?:ta\.)?(?:sma|ema)\s*\(\s*volume\s*,\s*(\d+)/i)
  if (volMatch) extracted.indicators.push({ type: 'Volume MA', period: parseInt(volMatch[1]) })

  // Deduplicate
  const seen = new Set()
  extracted.indicators = extracted.indicators.filter(ind => {
    const key = `${ind.type}-${ind.period || ''}-${ind.fast || ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // ─── Entry/Exit conditions ───
  // strategy.entry("Long", ..., when=...) or longCondition
  const longBlock = code.match(/(?:longCondition|strategy\.entry\s*\(\s*["'](?:Long|Buy)[^)]*)|(?:if\s+.*(?:long|buy).*\n(?:[\s\S]*?(?=\nif|\nelse|\n\w|$)))/i)
  if (longBlock) {
    const conditions = longBlock[0].matchAll(/(\w+)\s*(<=?|>=?|==|!=|crossover|crossunder)\s*(\w+|\d+\.?\d*)/g)
    for (const c of conditions) extracted.buyConditions.push(`${c[1]} ${c[2]} ${c[3]}`)
  }

  const shortBlock = code.match(/(?:shortCondition|strategy\.entry\s*\(\s*["'](?:Short|Sell)[^)]*)|(?:if\s+.*(?:short|sell).*\n(?:[\s\S]*?(?=\nif|\nelse|\n\w|$)))/i)
  if (shortBlock) {
    const conditions = shortBlock[0].matchAll(/(\w+)\s*(<=?|>=?|==|!=|crossover|crossunder)\s*(\w+|\d+\.?\d*)/g)
    for (const c of conditions) extracted.sellConditions.push(`${c[1]} ${c[2]} ${c[3]}`)
  }

  // ─── Risk params ───
  // strategy.exit with profit/loss
  const exitMatch = code.match(/strategy\.exit\s*\([^)]*(?:profit\s*=\s*(\d+\.?\d*))?[^)]*(?:loss\s*=\s*(\d+\.?\d*))?/i)
  if (exitMatch) {
    if (exitMatch[1]) extracted.riskParams.takeProfitTicks = parseFloat(exitMatch[1])
    if (exitMatch[2]) extracted.riskParams.stopLossTicks = parseFloat(exitMatch[2])
  }

  // Percentage-based SL/TP
  const slPctMatch = code.match(/(?:stop_?loss|sl).*?(\d+\.?\d*)\s*%/i)
  if (slPctMatch) extracted.riskParams.stopLossPercent = parseFloat(slPctMatch[1])
  const tpPctMatch = code.match(/(?:take_?profit|tp).*?(\d+\.?\d*)\s*%/i)
  if (tpPctMatch) extracted.riskParams.takeProfitPercent = parseFloat(tpPctMatch[1])

  // input() parameters
  const inputMatches = code.matchAll(/(\w+)\s*=\s*input(?:\.(?:int|float))?\s*\(\s*(?:defval\s*=\s*)?(\d+\.?\d*)\s*(?:,\s*["']([^"']+)["'])?/g)
  for (const m of inputMatches) {
    extracted.rawParams.push({
      name: m[3] || m[1],
      default: parseFloat(m[2])
    })
  }

  return extracted
}

/**
 * Format pre-parsed data into a structured text block for the LLM
 * @param {Object} parsed - Output from preParseFreqtradeCode or preParsePineScript
 * @returns {string} Formatted extraction summary
 */
const formatParsedData = (parsed) => {
  const lines = []

  if (parsed.indicators.length > 0) {
    lines.push('INDICADORES DETECTADOS:')
    for (const ind of parsed.indicators) {
      const params = Object.entries(ind).filter(([k]) => k !== 'type').map(([k, v]) => `${k}=${v}`).join(', ')
      lines.push(`  - ${ind.type}(${params})`)
    }
  }

  if (parsed.buyConditions.length > 0) {
    lines.push('CONDICIONES DE COMPRA/LONG:')
    for (const c of parsed.buyConditions) lines.push(`  - ${c}`)
  }

  if (parsed.sellConditions.length > 0) {
    lines.push('CONDICIONES DE VENTA/SHORT:')
    for (const c of parsed.sellConditions) lines.push(`  - ${c}`)
  }

  if (Object.keys(parsed.riskParams).length > 0) {
    lines.push('PARAMETROS DE RIESGO:')
    const rp = parsed.riskParams
    if (rp.stopLossPercent) lines.push(`  - Stop Loss: ${rp.stopLossPercent}%`)
    if (rp.takeProfitPercent) lines.push(`  - Take Profit: ${rp.takeProfitPercent}%`)
    if (rp.trailingStop) lines.push(`  - Trailing Stop: activo (offset ${rp.trailingStopOffset || '?'}%, positivo ${rp.trailingStopPositive || '?'}%)`)
    if (rp.roi && rp.roi.length > 0) {
      lines.push('  - ROI escalonado:')
      for (const r of rp.roi) lines.push(`    ${r.minutes}min → ${r.profit}%`)
    }
    if (rp.stopLossTicks) lines.push(`  - Stop Loss: ${rp.stopLossTicks} ticks`)
    if (rp.takeProfitTicks) lines.push(`  - Take Profit: ${rp.takeProfitTicks} ticks`)
  }

  if (parsed.timeframes.length > 0) {
    lines.push(`TIMEFRAME: ${parsed.timeframes.join(', ')}`)
  }

  if (parsed.rawParams.length > 0) {
    lines.push('PARAMETROS CONFIGURABLES:')
    for (const p of parsed.rawParams) {
      lines.push(`  - ${p.name}: ${p.default !== null && p.default !== undefined ? p.default : `rango ${p.min}-${p.max}`}`)
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No se pudieron extraer datos estructurados del codigo.'
}

// ─── 2-Phase Conversion: Structured Extraction → Prompt Rendering ───

/**
 * PHASE 1: Extract structured JSON from strategy code using LLM
 * Gets the LLM to decompose the strategy into mechanical rules
 * @param {string} code - Strategy source code
 * @param {string} preParsedSummary - Output from formatParsedData
 * @param {string} codeType - 'python' or 'pinescript'
 * @param {Object} settings - App settings
 * @returns {Object|null} Structured strategy data
 */
const extractStructuredStrategy = async (code, preParsedSummary, codeType, settings) => {
  const extractionPrompt = `You are a trading strategy reverse-engineer. Your job is to DECOMPOSE code into exact mechanical rules.

## SOURCE CODE (${codeType}):
\`\`\`
${code}
\`\`\`

## PRE-EXTRACTED DATA (from regex parsing — may be incomplete):
${preParsedSummary}

## YOUR TASK:
Analyze the code and extract ALL trading rules into this EXACT JSON format. Be specific with numbers — do NOT generalize.

\`\`\`json
{
  "indicators": [
    {"name": "RSI", "period": 14, "source": "close"},
    {"name": "EMA", "period": 9, "source": "close"},
    {"name": "EMA", "period": 21, "source": "close"}
  ],
  "entryLong": [
    "RSI(14) < 30",
    "EMA(9) cruza por encima de EMA(21)",
    "Volumen > SMA(volumen, 20)"
  ],
  "entryShort": [
    "RSI(14) > 70",
    "EMA(9) cruza por debajo de EMA(21)"
  ],
  "exitRules": [
    "Take Profit: 3.5% desde entry",
    "Stop Loss: 1.5% desde entry",
    "Trailing stop: activar a +2%, trailing 1%"
  ],
  "filters": [
    "Solo operar si ADX(14) > 25",
    "No operar si spread > 0.1%"
  ],
  "riskManagement": {
    "stopLossPercent": 1.5,
    "takeProfitPercent": 3.5,
    "riskRewardRatio": 2.3,
    "maxOpenTrades": 3,
    "trailingStop": false
  },
  "timeframe": "1h",
  "strategyType": "momentum"
}
\`\`\`

RULES:
- Extract EXACT numbers from the code (periods, thresholds, percentages)
- If a value is not in the code, use the pre-extracted data
- If a value cannot be determined, use reasonable defaults and mark with "(estimated)"
- entryLong/entryShort must be specific conditions with numbers, NOT generic descriptions
- Respond with ONLY valid JSON, no markdown or explanations`

  try {
    const response = await callLLMForText(extractionPrompt, settings)

    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    return JSON.parse(jsonMatch[0])
  } catch (error) {
    console.error('Phase 1 extraction failed:', error)
    return null
  }
}

/**
 * PHASE 2: Render structured strategy data into a precise trading prompt
 * Uses few-shot example from "Calculadora Mecanica" as template
 * @param {Object} structured - Output from extractStructuredStrategy
 * @param {string} strategyName - Name of the strategy
 * @param {Object} settings - App settings
 * @returns {string|null} Final prompt content
 */
const renderStructuredToPrompt = async (structured, strategyName, settings) => {
  const structuredJSON = JSON.stringify(structured, null, 2)

  const renderPrompt = `Eres un experto en convertir reglas de trading estructuradas en prompts de estrategia PRECISOS y TECNICOS.

## DATOS DE LA ESTRATEGIA:
\`\`\`json
${structuredJSON}
\`\`\`

## EJEMPLO DE PROMPT BIEN ESCRITO (formato a seguir):
"""
Eres un sistema MECANICO. No interpretes, solo calcula.

PASO 1 - FILTRAR:
Para cada asset, calcula: distancia_redondo = abs(precio - redondo_mas_cercano) / precio * 100
Solo considerar assets donde distancia_redondo esta entre 1% y 4%.
Descartar el resto.

PASO 2 - DIRECCION:
Si precio < redondo -> LONG (comprar debajo de resistencia)
Si precio > redondo -> SHORT (vender encima de soporte)

PASO 3 - NIVELES (formulas exactas):
Para LONG:
  entry = precio_actual
  stopLoss = entry * 0.985 (1.5% debajo)
  takeProfit = entry * 1.035 (3.5% arriba)
Para SHORT:
  entry = precio_actual
  stopLoss = entry * 1.015 (1.5% arriba)
  takeProfit = entry * 0.965 (3.5% abajo)

PASO 4 - RANKING:
Si hay mas de 3 candidatos, elegir los 3 con MENOR distancia_redondo.

PASO 5 - VALIDAR:
Verificar que R:R > 2.0 para cada trade. Si no cumple, NO incluirlo.
"""

## INSTRUCCIONES:
Convierte los datos de la estrategia en un prompt con EXACTAMENTE este formato:
1. Empieza con una linea describiendo el enfoque mecanico de la estrategia
2. Usa PASO 1, PASO 2, PASO 3, etc. (minimo 4 pasos, maximo 7)
3. Cada PASO debe tener un titulo corto despues del guion
4. Incluye NUMEROS EXACTOS: periodos de indicadores, umbrales, porcentajes
5. Incluye FORMULAS para entry, stopLoss y takeProfit (con multiplicadores exactos)
6. Incluye condiciones de filtrado y ranking si hay multiples candidatos
7. El ultimo PASO siempre debe ser VALIDAR con R:R minimo
8. Escribe en ESPAÑOL
9. NO incluyas titulos ni headers, empieza directamente
10. NO incluyas bloques de codigo
11. Maximo 500 palabras pero sé tan detallado como necesites con los numeros

ESCRIBE EL PROMPT AHORA:`

  try {
    const result = await callLLMForText(renderPrompt, settings)
    return result.trim()
  } catch (error) {
    console.error('Phase 2 rendering failed:', error)
    return null
  }
}

// ─── Output Validation ──────────────────────────────────────────

/**
 * Validate that a converted prompt contains required technical elements
 * @param {string} promptContent - The generated prompt text
 * @returns {Object} {valid: boolean, missing: string[], score: number}
 */
export const validatePromptQuality = (promptContent) => {
  if (!promptContent || typeof promptContent !== 'string') {
    return { valid: false, missing: ['empty content'], score: 0 }
  }

  const checks = [
    { name: 'Has PASO/step structure', test: /PASO\s*\d|STEP\s*\d/i },
    { name: 'Contains percentage values', test: /\d+\.?\d*\s*%/ },
    { name: 'References Stop Loss', test: /stop\s*loss|SL|stopLoss/i },
    { name: 'References Take Profit', test: /take\s*profit|TP|takeProfit/i },
    { name: 'Contains numeric thresholds', test: /[<>=!]+\s*\d+/ },
    { name: 'References specific indicator', test: /RSI|EMA|SMA|MACD|Bollinger|ADX|ATR|Stoch|CCI|MFI|volumen|volume/i },
    { name: 'Contains entry formula', test: /entry\s*=|entrada\s*=|precio_actual|precio actual/i },
    { name: 'Has R:R or risk:reward', test: /R:R|R\/R|risk.*reward|riesgo.*beneficio|ratio/i },
    { name: 'Minimum length (200+ chars)', test: promptContent.length >= 200 ? /./ : /IMPOSSIBLE_MATCH/ },
    { name: 'Contains multiplier/formula', test: /\*\s*\d|\d\.\d+\s*\)|entry\s*\*/i },
  ]

  const missing = []
  let passed = 0

  for (const check of checks) {
    if (check.test.test(promptContent)) {
      passed++
    } else {
      missing.push(check.name)
    }
  }

  const score = Math.round((passed / checks.length) * 100)

  return {
    valid: score >= 60, // At least 6/10 checks pass
    missing,
    score,
    passed,
    total: checks.length
  }
}

// ─── Main Conversion Pipeline ───────────────────────────────────

/**
 * Convert strategy code to a trading prompt using 2-phase approach
 * Phase 1: LLM extracts structured JSON from code + pre-parsed data
 * Phase 2: LLM renders structured data into precise prompt with PASOS format
 * Includes validation and retry logic
 *
 * @param {string} code - Strategy source code
 * @param {string} strategyName - Strategy file name
 * @param {string} repoName - Repository name
 * @param {Object} settings - App settings
 * @param {string} codeType - 'python' or 'pinescript'
 * @param {Function} onLog - Log callback
 * @returns {string|null} Prompt content for the app
 */
const convertStrategyToPrompt = async (code, strategyName, repoName, settings, codeType = 'python', onLog = () => {}) => {
  const MAX_RETRIES = 2

  // Step 1: Pre-parse with regex
  onLog(`Pre-parsing ${strategyName} (${codeType})...`, 'info')
  const parsed = codeType === 'pinescript'
    ? preParsePineScript(code)
    : preParseFreqtradeCode(code)
  const preParsedSummary = formatParsedData(parsed)

  const indicatorCount = parsed.indicators.length
  const conditionCount = parsed.buyConditions.length + parsed.sellConditions.length
  onLog(`Pre-parser: ${indicatorCount} indicadores, ${conditionCount} condiciones, ${Object.keys(parsed.riskParams).length} params de riesgo`, 'info')

  // Step 2: Phase 1 — Structured extraction via LLM
  onLog(`Fase 1: Extrayendo reglas estructuradas...`, 'info')
  const structured = await extractStructuredStrategy(code, preParsedSummary, codeType, settings)

  if (!structured) {
    onLog(`Fase 1 fallida, intentando conversion directa...`, 'warning')
    // Fallback: direct conversion with the pre-parsed data
    return await directConversion(code, preParsedSummary, strategyName, settings, codeType)
  }

  onLog(`Fase 1 OK: ${structured.indicators?.length || 0} indicadores, ${structured.entryLong?.length || 0} condiciones long, ${structured.entryShort?.length || 0} condiciones short`, 'success')

  // Step 3: Phase 2 — Render to prompt with retry
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    onLog(`Fase 2: Renderizando prompt${attempt > 0 ? ` (intento ${attempt + 1})` : ''}...`, 'info')
    const promptContent = await renderStructuredToPrompt(structured, strategyName, settings)

    if (!promptContent) {
      onLog(`Fase 2 intento ${attempt + 1}: sin respuesta`, 'warning')
      continue
    }

    // Step 4: Validate output quality
    const validation = validatePromptQuality(promptContent)
    onLog(`Validacion: ${validation.passed}/${validation.total} checks (${validation.score}%)`, validation.valid ? 'success' : 'warning')

    if (validation.valid) {
      return promptContent
    }

    if (attempt < MAX_RETRIES) {
      onLog(`Falta: ${validation.missing.slice(0, 3).join(', ')}. Reintentando...`, 'warning')
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  // Last resort: return best effort even if validation didn't fully pass
  onLog(`Usando resultado best-effort despues de ${MAX_RETRIES + 1} intentos`, 'warning')
  const lastAttempt = await renderStructuredToPrompt(structured, strategyName, settings)
  return lastAttempt
}

/**
 * Fallback direct conversion when 2-phase fails
 * Uses pre-parsed data + few-shot example for direct conversion
 */
const directConversion = async (code, preParsedSummary, strategyName, settings, codeType) => {
  const prompt = `Convierte este codigo de estrategia de trading en un prompt PRECISO con formato PASOS.

CODIGO (${codeType}):
\`\`\`
${code.slice(0, 6000)}
\`\`\`

DATOS PRE-EXTRAIDOS:
${preParsedSummary}

EJEMPLO DE FORMATO CORRECTO:
"""
Estrategia basada en RSI y cruces de medias moviles.

PASO 1 - INDICADORES:
Calcular RSI(14), EMA(9), EMA(21) para cada asset.

PASO 2 - FILTRAR:
Solo considerar assets donde RSI(14) < 35 (sobreventa) O RSI(14) > 65 (sobrecompra).

PASO 3 - DIRECCION:
Si RSI < 35 Y EMA(9) > EMA(21) -> LONG
Si RSI > 65 Y EMA(9) < EMA(21) -> SHORT

PASO 4 - NIVELES:
Para LONG: entry = precio_actual, stopLoss = entry * 0.985, takeProfit = entry * 1.04
Para SHORT: entry = precio_actual, stopLoss = entry * 1.015, takeProfit = entry * 0.96

PASO 5 - VALIDAR:
R:R minimo 2:1. Si no cumple, NO incluir.
"""

ESCRIBE el prompt en ESPAÑOL con PASOS, NUMEROS EXACTOS, y FORMULAS. Sin titulos. Empieza directamente.`

  try {
    return (await callLLMForText(prompt, settings)).trim()
  } catch {
    return null
  }
}

// ─── GitHub: Freqtrade Strategy Scraper ──────────────────────────

/**
 * Search GitHub for Freqtrade strategy repositories
 * @param {number} maxRepos - Max repos to fetch (default 3)
 * @returns {Array} [{name, fullName, description, stars, url, defaultBranch}]
 */
export const searchFreqtradeRepos = async (maxRepos = 3) => {
  try {
    const response = await fetch(
      `${GITHUB_API}/search/repositories?q=freqtrade+strategy+language:python&sort=stars&order=desc&per_page=${maxRepos}`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    )

    if (!response.ok) {
      if (response.status === 403) throw new Error('GitHub API rate limit exceeded. Wait a few minutes.')
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    return (data.items || []).map(repo => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || 'No description',
      stars: repo.stargazers_count,
      url: repo.html_url,
      defaultBranch: repo.default_branch || 'main'
    }))
  } catch (error) {
    console.error('GitHub search failed:', error)
    throw error
  }
}

// ─── GitHub: PineScript Strategy Scraper ─────────────────────────

/**
 * Search GitHub for TradingView PineScript strategy repositories
 * @param {number} maxRepos - Max repos (default 3)
 * @returns {Array} [{name, fullName, description, stars, url, defaultBranch}]
 */
export const searchPineScriptRepos = async (maxRepos = 3) => {
  try {
    const response = await fetch(
      `${GITHUB_API}/search/repositories?q=pinescript+strategy+trading&sort=stars&order=desc&per_page=${maxRepos}`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    )

    if (!response.ok) {
      if (response.status === 403) throw new Error('GitHub API rate limit exceeded. Wait a few minutes.')
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data = await response.json()
    return (data.items || []).map(repo => ({
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || 'No description',
      stars: repo.stargazers_count,
      url: repo.html_url,
      defaultBranch: repo.default_branch || 'main'
    }))
  } catch (error) {
    console.error('PineScript GitHub search failed:', error)
    throw error
  }
}

/**
 * Get PineScript files from a repo
 * @param {Object} repo - {fullName, defaultBranch}
 * @returns {Array} [{name, path, downloadUrl}]
 */
export const getPineScriptFiles = async (repo) => {
  const searchPaths = ['', 'scripts', 'strategies', 'pine', 'src', 'pinescript']

  for (const path of searchPaths) {
    try {
      const url = `${GITHUB_API}/repos/${repo.fullName}/contents/${path}`
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      })

      if (!response.ok) continue

      const files = await response.json()
      if (!Array.isArray(files)) continue

      const pineFiles = files
        .filter(f => (f.name.endsWith('.pine') || f.name.endsWith('.txt') || f.name.endsWith('.pinescript')) &&
          f.name !== 'README.txt' && f.name !== 'LICENSE.txt')
        .slice(0, 3)
        .map(f => ({
          name: f.name.replace(/\.(pine|txt|pinescript)$/, ''),
          path: f.path,
          downloadUrl: f.download_url || `${GITHUB_RAW}/${repo.fullName}/${repo.defaultBranch}/${f.path}`
        }))

      if (pineFiles.length > 0) return pineFiles
    } catch {
      continue
    }
  }

  return []
}

// ─── Shared File Functions ──────────────────────────────────────

/**
 * Get Python strategy files from a Freqtrade repo
 */
export const getStrategyFiles = async (repo) => {
  const searchPaths = [
    '', 'user_data/strategies', 'strategies', 'freqtrade/strategies',
  ]

  for (const path of searchPaths) {
    try {
      const url = `${GITHUB_API}/repos/${repo.fullName}/contents/${path}`
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      })

      if (!response.ok) continue

      const files = await response.json()
      if (!Array.isArray(files)) continue

      const strategyFiles = files
        .filter(f => f.name.endsWith('.py') && f.name !== '__init__.py' && f.name !== 'setup.py')
        .slice(0, 3)
        .map(f => ({
          name: f.name.replace('.py', ''),
          path: f.path,
          downloadUrl: f.download_url || `${GITHUB_RAW}/${repo.fullName}/${repo.defaultBranch}/${f.path}`
        }))

      if (strategyFiles.length > 0) return strategyFiles
    } catch {
      continue
    }
  }

  return []
}

/**
 * Download raw strategy file content (8000 char limit)
 * @param {string} url - Raw file URL
 * @returns {string} File content
 */
export const downloadStrategyFile = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`)
  const text = await response.text()
  return text.slice(0, CODE_CHAR_LIMIT)
}

// ─── Main Import Pipelines ──────────────────────────────────────

/**
 * Full pipeline: search Freqtrade repos → get files → download → pre-parse → 2-phase convert → validate
 * @param {Object} settings - App settings with apiKeys
 * @param {Function} onLog - Log callback
 * @returns {Array} Array of new prompt objects ready to add to store
 */
export const fetchFreqtradeStrategies = async (settings, onLog = () => {}) => {
  const newPrompts = []

  onLog('Buscando estrategias Freqtrade en GitHub...', 'info')
  const repos = await searchFreqtradeRepos(3)

  if (repos.length === 0) {
    onLog('No se encontraron repos de Freqtrade', 'warning')
    return []
  }

  onLog(`Encontrados ${repos.length} repos: ${repos.map(r => `${r.name} (${r.stars}★)`).join(', ')}`, 'success')

  for (const repo of repos) {
    try {
      onLog(`Explorando ${repo.fullName}...`, 'info')
      const files = await getStrategyFiles(repo)

      if (files.length === 0) {
        onLog(`${repo.name}: sin archivos de estrategia`, 'warning')
        continue
      }

      const file = files[0]
      onLog(`Descargando ${file.name} de ${repo.name} (max ${CODE_CHAR_LIMIT} chars)...`, 'info')

      const code = await downloadStrategyFile(file.downloadUrl)

      // Full 2-phase conversion with pre-parsing and validation
      onLog(`Convirtiendo ${file.name} (2 fases + validacion)...`, 'info')
      const promptContent = await convertStrategyToPrompt(code, file.name, repo.name, settings, 'python', onLog)

      if (promptContent) {
        const validation = validatePromptQuality(promptContent)
        newPrompts.push({
          id: crypto.randomUUID(),
          name: `${file.name} (${repo.name})`,
          content: promptContent,
          status: 'active',
          capital: 1000,
          leverage: 5,
          targetPct: 10,
          executionTime: 'target',
          minIpe: 70,
          aiModel: 'groq',
          numResults: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'github-freqtrade',
          sourceRepo: repo.fullName,
          qualityScore: validation.score
        })
        onLog(`Importada: ${file.name} — calidad ${validation.score}%`, 'success')
      }

      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      onLog(`Error en ${repo.name}: ${err.message}`, 'error')
    }
  }

  return newPrompts
}

/**
 * Full pipeline for PineScript/TradingView strategies
 * @param {Object} settings - App settings with apiKeys
 * @param {Function} onLog - Log callback
 * @returns {Array} Array of new prompt objects
 */
export const fetchPineScriptStrategies = async (settings, onLog = () => {}) => {
  const newPrompts = []

  onLog('Buscando estrategias PineScript en GitHub...', 'info')
  const repos = await searchPineScriptRepos(3)

  if (repos.length === 0) {
    onLog('No se encontraron repos de PineScript', 'warning')
    return []
  }

  onLog(`Encontrados ${repos.length} repos PineScript: ${repos.map(r => `${r.name} (${r.stars}★)`).join(', ')}`, 'success')

  for (const repo of repos) {
    try {
      onLog(`Explorando ${repo.fullName}...`, 'info')
      const files = await getPineScriptFiles(repo)

      if (files.length === 0) {
        onLog(`${repo.name}: sin archivos PineScript`, 'warning')
        continue
      }

      const file = files[0]
      onLog(`Descargando ${file.name} de ${repo.name}...`, 'info')

      const code = await downloadStrategyFile(file.downloadUrl)

      onLog(`Convirtiendo ${file.name} (PineScript, 2 fases)...`, 'info')
      const promptContent = await convertStrategyToPrompt(code, file.name, repo.name, settings, 'pinescript', onLog)

      if (promptContent) {
        const validation = validatePromptQuality(promptContent)
        newPrompts.push({
          id: crypto.randomUUID(),
          name: `${file.name} (${repo.name}) [Pine]`,
          content: promptContent,
          status: 'active',
          capital: 1000,
          leverage: 5,
          targetPct: 10,
          executionTime: 'target',
          minIpe: 70,
          aiModel: 'groq',
          numResults: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          source: 'github-pinescript',
          sourceRepo: repo.fullName,
          qualityScore: validation.score
        })
        onLog(`Importada: ${file.name} [Pine] — calidad ${validation.score}%`, 'success')
      }

      await new Promise(r => setTimeout(r, 2000))
    } catch (err) {
      onLog(`Error en ${repo.name}: ${err.message}`, 'error')
    }
  }

  return newPrompts
}

// ─── Binance Futures: Market Data ────────────────────────────────

const BINANCE_FAPI = 'https://fapi.binance.com'
const BINANCE_FUTURES_DATA = 'https://fapi.binance.com/futures/data'

/**
 * Fetch funding rate for a symbol
 */
export const fetchFundingRate = async (symbol = 'BTCUSDT') => {
  try {
    const response = await fetch(`${BINANCE_FAPI}/fapi/v1/fundingRate?symbol=${symbol}&limit=1`)
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`)
    const data = await response.json()
    if (!data || data.length === 0) return null

    return {
      symbol,
      fundingRate: parseFloat(data[0].fundingRate),
      fundingRatePercent: (parseFloat(data[0].fundingRate) * 100).toFixed(4),
      fundingTime: data[0].fundingTime
    }
  } catch (error) {
    console.error(`Funding rate fetch failed for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch open interest
 */
export const fetchOpenInterest = async (symbol = 'BTCUSDT') => {
  try {
    const response = await fetch(`${BINANCE_FAPI}/fapi/v1/openInterest?symbol=${symbol}`)
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`)
    const data = await response.json()

    return {
      symbol,
      openInterest: parseFloat(data.openInterest),
      notionalValue: parseFloat(data.openInterest)
    }
  } catch (error) {
    console.error(`Open interest fetch failed for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch top trader long/short ratio
 */
export const fetchLongShortRatio = async (symbol = 'BTCUSDT') => {
  try {
    const response = await fetch(
      `${BINANCE_FUTURES_DATA}/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=1`
    )
    if (!response.ok) throw new Error(`Binance API error: ${response.status}`)
    const data = await response.json()
    if (!data || data.length === 0) return null

    return {
      symbol,
      longShortRatio: parseFloat(data[0].longShortRatio),
      longAccount: parseFloat(data[0].longAccount),
      shortAccount: parseFloat(data[0].shortAccount),
      timestamp: data[0].timestamp
    }
  } catch (error) {
    console.error(`Long/short ratio fetch failed for ${symbol}:`, error)
    return null
  }
}

/**
 * Fetch all Binance Futures data for a symbol
 */
export const fetchBinanceFuturesData = async (symbol = 'BTCUSDT') => {
  const [funding, oi, longShort] = await Promise.all([
    fetchFundingRate(symbol),
    fetchOpenInterest(symbol),
    fetchLongShortRatio(symbol)
  ])

  return {
    symbol,
    funding,
    openInterest: oi,
    longShort,
    timestamp: Date.now()
  }
}

/**
 * Fetch market data for multiple symbols
 */
export const fetchAllFuturesData = async (symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], onLog = () => {}) => {
  onLog(`Obteniendo datos de Binance Futures (${symbols.join(', ')})...`, 'info')

  const results = {}
  for (const symbol of symbols) {
    try {
      results[symbol] = await fetchBinanceFuturesData(symbol)
      onLog(`${symbol}: funding ${results[symbol].funding?.fundingRatePercent || '?'}%, OI: ${results[symbol].openInterest?.openInterest?.toFixed(0) || '?'}, L/S: ${results[symbol].longShort?.longShortRatio?.toFixed(2) || '?'}`, 'success')
    } catch (err) {
      onLog(`${symbol}: Error — ${err.message}`, 'error')
    }
  }

  return results
}

/**
 * Format market data into a text summary for LLM consumption
 */
export const formatMarketDataForLLM = (futuresData) => {
  if (!futuresData || Object.keys(futuresData).length === 0) return 'No market data available.'

  const lines = ['Current Binance Futures Market Data:']

  for (const [symbol, data] of Object.entries(futuresData)) {
    const parts = [`${symbol}:`]

    if (data.funding) {
      const rate = data.funding.fundingRatePercent
      parts.push(`Funding Rate ${rate}%`)
      if (parseFloat(rate) > 0.05) parts.push('(longs paying shorts, bullish crowding)')
      else if (parseFloat(rate) < -0.01) parts.push('(shorts paying longs, bearish crowding)')
    }

    if (data.openInterest) {
      parts.push(`Open Interest: ${data.openInterest.openInterest.toLocaleString()} contracts`)
    }

    if (data.longShort) {
      const ratio = data.longShort.longShortRatio
      parts.push(`L/S Ratio: ${ratio.toFixed(2)}`)
      if (ratio > 2.5) parts.push('(extremely bullish sentiment)')
      else if (ratio > 1.5) parts.push('(bullish sentiment)')
      else if (ratio < 0.7) parts.push('(bearish sentiment)')
    }

    lines.push(parts.join(' | '))
  }

  return lines.join('\n')
}
