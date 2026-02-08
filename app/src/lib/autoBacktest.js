// Auto Backtest Pipeline — automated backtesting for Evolution System
// Extracts calculateBacktestGrade from BacktestTab for shared use

import { fetchMultiSymbolData, getPricesAtTime } from './historicalDataService'
import { generateTradesFromPrompt } from './aiService'
import { runBacktest } from './backtestEngine'

// ─── Scoring System (extracted from BacktestTab.jsx) ──────────────

/**
 * Generate a contextual verdict in Spanish
 */
const generateVerdict = (pnl, winRate, profitFactor, maxDD, sharpe, totalTrades, grade) => {
  const parts = []

  if (grade === 'A') parts.push('Estrategia excelente.')
  else if (grade === 'B') parts.push('Estrategia buena con potencial.')
  else if (grade === 'C') parts.push('Resultados medianos.')
  else if (grade === 'D') parts.push('Estrategia debil.')
  else parts.push('Estrategia no viable.')

  if (pnl > 20) parts.push(`+${pnl.toFixed(1)}% de retorno es fuerte.`)
  else if (pnl > 5) parts.push(`+${pnl.toFixed(1)}% positivo pero moderado.`)
  else if (pnl > 0) parts.push(`+${pnl.toFixed(1)}% apenas cubre costos.`)
  else if (pnl > -5) parts.push(`${pnl.toFixed(1)}% perdida menor.`)
  else parts.push(`${pnl.toFixed(1)}% perdida significativa.`)

  if (maxDD > 30) parts.push(`Drawdown de ${maxDD.toFixed(0)}% es muy riesgoso.`)
  else if (winRate < 40 && totalTrades >= 5) parts.push(`Win rate bajo (${winRate.toFixed(0)}%), muchos trades perdedores.`)
  else if (profitFactor < 1 && profitFactor > 0) parts.push(`PF < 1 significa que pierde mas de lo que gana.`)
  else if (profitFactor >= 2) parts.push(`PF de ${profitFactor.toFixed(1)} indica buena relacion riesgo/beneficio.`)

  if (totalTrades < 5) parts.push(`Solo ${totalTrades} trades — resultados poco confiables.`)

  return parts.join(' ')
}

/**
 * Calculate a grade (A-F) for a backtest based on key metrics
 * Returns { grade, color, bgColor, score, verdict }
 */
export const calculateBacktestGrade = (result) => {
  if (!result) return { grade: '?', color: 'text-gray-400', bgColor: 'bg-gray-500/10 border-gray-500/30', score: 0, verdict: 'Sin datos' }

  const pnl = result.totalPnlPercent || 0
  const winRate = result.winRate || 0
  const profitFactor = result.profitFactor === Infinity ? 10 : (result.profitFactor || 0)
  const maxDD = result.maxDrawdown || 0
  const sharpe = result.sharpeRatio || 0
  const totalTrades = result.totalTrades || 0

  // Score each metric (0-100)
  const pnlScore = Math.max(0, Math.min(100, ((pnl + 20) / 70) * 100))
  const wrScore = Math.max(0, Math.min(100, ((winRate - 30) / 45) * 100))
  const pfScore = Math.max(0, Math.min(100, (profitFactor / 2.5) * 100))
  const ddScore = Math.max(0, Math.min(100, ((50 - maxDD) / 45) * 100))
  const sharpeScore = Math.max(0, Math.min(100, ((sharpe + 1) / 3) * 100))

  // Trade count penalty
  const tradePenalty = totalTrades < 3 ? 0.5 : totalTrades < 5 ? 0.75 : totalTrades < 10 ? 0.9 : 1.0

  // Weighted composite score
  const rawScore = (
    pnlScore * 0.30 +
    wrScore * 0.20 +
    pfScore * 0.20 +
    ddScore * 0.15 +
    sharpeScore * 0.15
  ) * tradePenalty

  const score = Math.round(rawScore)

  let grade, color, bgColor
  if (score >= 80) { grade = 'A'; color = 'text-emerald-400'; bgColor = 'bg-emerald-500/10 border-emerald-500/40' }
  else if (score >= 65) { grade = 'B'; color = 'text-accent-cyan'; bgColor = 'bg-accent-cyan/10 border-accent-cyan/40' }
  else if (score >= 50) { grade = 'C'; color = 'text-yellow-400'; bgColor = 'bg-yellow-500/10 border-yellow-500/40' }
  else if (score >= 35) { grade = 'D'; color = 'text-orange-400'; bgColor = 'bg-orange-500/10 border-orange-500/40' }
  else { grade = 'F'; color = 'text-accent-red'; bgColor = 'bg-accent-red/10 border-accent-red/40' }

  const verdict = generateVerdict(pnl, winRate, profitFactor, maxDD, sharpe, totalTrades, grade)

  return { grade, color, bgColor, score, verdict }
}

// ─── Cancellable Sleep ───────────────────────────────────────────

/**
 * Sleep that can be interrupted instantly via shouldCancel callback.
 * Polls every 500ms instead of blocking for the full duration.
 * @param {number} ms - Total milliseconds to wait
 * @param {Function} shouldCancel - Returns true to abort sleep immediately
 * @returns {boolean} true if cancelled, false if completed normally
 */
export const cancellableSleep = async (ms, shouldCancel) => {
  const interval = 500 // Check every 500ms
  let elapsed = 0
  while (elapsed < ms) {
    if (shouldCancel?.()) return true
    const chunk = Math.min(interval, ms - elapsed)
    await new Promise(r => setTimeout(r, chunk))
    elapsed += chunk
  }
  return false
}

// ─── Auto Backtest Pipeline ──────────────────────────────────────

const DEFAULT_ASSETS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT']
const DEFAULT_INTERVAL = '1h'
const DEFAULT_RANGE_DAYS = 30
const DEFAULT_SAMPLE_POINTS = 5
const DEFAULT_SLIPPAGE = 0.001  // 0.1%
const DEFAULT_TAKER_FEE = 0.001 // 0.1%

/**
 * Auto-backtest a single prompt through the full pipeline
 * @param {Object} prompt - Prompt object from store
 * @param {Object} settings - App settings (with apiKeys)
 * @param {Function} onLog - Callback for log messages: (message, type) => void
 * @param {Object} options - Optional: { shouldCancel: () => boolean }
 * @returns {Object} { backtestData, grade } or null on failure
 */
export const autoBacktestPrompt = async (prompt, settings, onLog = () => {}, options = {}) => {
  try {
    onLog(`Backtesting: ${prompt.name}...`, 'info')

    // 1. Calculate time range
    const endTime = Date.now()
    const startTime = endTime - (DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)

    // 2. Fetch historical data
    onLog(`Descargando datos historicos (${DEFAULT_RANGE_DAYS}d, ${DEFAULT_ASSETS.length} activos)...`, 'info')
    const historicalData = await fetchMultiSymbolData(
      DEFAULT_ASSETS,
      DEFAULT_INTERVAL,
      startTime,
      endTime
    )

    if (!historicalData || Object.keys(historicalData).length === 0) {
      onLog(`Error: No se pudieron obtener datos historicos`, 'error')
      return null
    }

    // 3. Calculate sample points (walk-forward)
    const totalRange = endTime - startTime
    const sampleSpacing = totalRange / (DEFAULT_SAMPLE_POINTS + 1)
    const sampleTimes = []
    for (let i = 1; i <= DEFAULT_SAMPLE_POINTS; i++) {
      sampleTimes.push(startTime + (sampleSpacing * i))
    }

    // 4. Generate trades at each sample point
    const allTrades = []
    const sampleBoundaries = []
    let runsCompleted = 0
    let consecutiveErrors = 0
    const MAX_CONSECUTIVE_ERRORS = 3 // Abort prompt if 3 samples fail in a row

    for (let i = 0; i < sampleTimes.length; i++) {
      // Check for cancellation
      if (options.shouldCancel?.()) {
        onLog(`${prompt.name}: Cancelado`, 'warning')
        break
      }

      // Early abort if too many consecutive errors (likely quota/rate limit exhausted)
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        onLog(`${prompt.name}: ${consecutiveErrors} errores consecutivos — abortando (posible quota agotada)`, 'error')
        break
      }
      const sampleTime = sampleTimes[i]
      const sampleEnd = i < sampleTimes.length - 1 ? sampleTimes[i + 1] : endTime

      // Notify caller of sample-level progress
      options.onSampleProgress?.(i + 1, sampleTimes.length)

      try {
        onLog(`Muestra ${i + 1}/${sampleTimes.length}: generando trades...`, 'info')

        // Get prices at this point in time
        const pricesAtTime = getPricesAtTime(historicalData, sampleTime)

        if (!pricesAtTime || Object.keys(pricesAtTime).length === 0) {
          onLog(`Muestra ${i + 1}: sin precios disponibles, saltando`, 'warning')
          continue
        }

        // Generate trades using AI with historical prices (with rate limit/quota retry)
        let trades = null
        const MAX_SAMPLE_RETRIES = 2
        for (let attempt = 0; attempt <= MAX_SAMPLE_RETRIES; attempt++) {
          try {
            trades = await generateTradesFromPrompt(
              prompt,
              settings,
              3,
              null,
              pricesAtTime
            )
            consecutiveErrors = 0 // Reset on success
            break // Success
          } catch (apiErr) {
            const isRateLimit = /rate.?limit|429|too many|tokens per minute|TPM|RPM|quota.?exceed|quota.?has been|resource.?exhaust/i.test(apiErr.message)
            if (isRateLimit && attempt < MAX_SAMPLE_RETRIES) {
              const waitSec = 15 * (attempt + 1) // 15s, 30s
              onLog(`Muestra ${i + 1}: Rate limit/quota, esperando ${waitSec}s... (intento ${attempt + 1}/${MAX_SAMPLE_RETRIES + 1})`, 'warning')
              const wasCancelled = await cancellableSleep(waitSec * 1000, options.shouldCancel)
              if (wasCancelled) throw new Error('Cancelado por el usuario')
            } else {
              throw apiErr // Re-throw if not rate limit or exhausted retries
            }
          }
        }

        if (trades && trades.length > 0) {
          // Assign sample time to trades
          const tradesWithTime = trades.map(t => ({
            ...t,
            time: sampleTime,
            _sampleIndex: i
          }))

          allTrades.push(...tradesWithTime)
          sampleBoundaries.push({ start: sampleTime, end: sampleEnd })
          runsCompleted++
          onLog(`Muestra ${i + 1}: ${trades.length} trades generados`, 'success')
        } else {
          onLog(`Muestra ${i + 1}: AI no genero trades`, 'warning')
        }
      } catch (err) {
        consecutiveErrors++
        const isQuota = /quota|exceed|exhaust/i.test(err.message)
        onLog(`Muestra ${i + 1}: Error — ${err.message}${isQuota ? ' (quota agotada)' : ''}`, 'error')
        // If quota error, skip remaining samples for this prompt
        if (isQuota && consecutiveErrors >= 2) {
          onLog(`${prompt.name}: Quota agotada, saltando muestras restantes`, 'warning')
          break
        }
      }

      // Longer delay between samples to avoid rate limiting (8s for free tier Groq)
      if (i < sampleTimes.length - 1) {
        const delaySec = 8
        onLog(`Esperando ${delaySec}s antes de muestra ${i + 2}...`, 'info')
        const wasCancelled = await cancellableSleep(delaySec * 1000, options.shouldCancel)
        if (wasCancelled) {
          onLog(`${prompt.name}: Cancelado`, 'warning')
          break
        }
      }
    }

    if (allTrades.length === 0) {
      onLog(`No se generaron trades para ${prompt.name}`, 'error')
      return null
    }

    // 5. Run backtest
    onLog(`Ejecutando backtest con ${allTrades.length} trades...`, 'info')
    const result = runBacktest({
      trades: allTrades,
      historicalData,
      initialCapital: prompt.capital || 1000,
      leverage: prompt.leverage || 5,
      slippage: DEFAULT_SLIPPAGE,
      takerFee: DEFAULT_TAKER_FEE,
      sampleBoundaries: sampleBoundaries.length > 0 ? sampleBoundaries : undefined
    })

    // 6. Calculate grade
    const grade = calculateBacktestGrade(result)

    // Get BTC context
    const btcCandles = historicalData['BTC/USDT'] || []
    const btcStart = btcCandles[0]?.close || 0
    const btcEnd = btcCandles[btcCandles.length - 1]?.close || 0

    // 7. Build backtest data object
    const backtestData = {
      id: crypto.randomUUID(),
      promptId: prompt.id,
      promptName: prompt.name,
      assets: DEFAULT_ASSETS,
      interval: DEFAULT_INTERVAL,
      rangeDays: DEFAULT_RANGE_DAYS,
      startTime,
      endTime,
      slippage: DEFAULT_SLIPPAGE * 100,
      takerFee: DEFAULT_TAKER_FEE * 100,
      samplePoints: DEFAULT_SAMPLE_POINTS,
      runsCompleted,
      btcContext: {
        startPrice: btcStart,
        endPrice: btcEnd,
        changePercent: btcStart > 0 ? ((btcEnd - btcStart) / btcStart * 100) : 0
      },
      config: {
        capital: prompt.capital || 1000,
        leverage: prompt.leverage || 5,
        aiModel: prompt.aiModel || 'gemini'
      },
      result,
      status: 'completed',
      createdAt: new Date().toISOString(),
      source: 'evolution' // Mark as auto-generated
    }

    onLog(`${prompt.name}: Grade ${grade.grade} (${grade.score}/100) — ${grade.verdict}`, 'success')

    return { backtestData, grade }
  } catch (error) {
    onLog(`Error backtesting ${prompt.name}: ${error.message}`, 'error')
    return null
  }
}

/**
 * Rank prompt results by score (descending)
 * @param {Array} promptResults - [{prompt, backtestData, grade}]
 * @returns {Array} Sorted by grade.score descending
 */
export const tournamentRank = (promptResults) => {
  return [...promptResults]
    .filter(r => r && r.grade)
    .sort((a, b) => b.grade.score - a.grade.score)
    .map((r, index) => ({
      rank: index + 1,
      promptId: r.prompt.id,
      promptName: r.prompt.name,
      grade: r.grade.grade,
      score: r.grade.score,
      color: r.grade.color,
      bgColor: r.grade.bgColor,
      verdict: r.grade.verdict,
      backtestId: r.backtestData?.id,
      pnl: r.backtestData?.result?.totalPnlPercent || 0,
      winRate: r.backtestData?.result?.winRate || 0,
      totalTrades: r.backtestData?.result?.totalTrades || 0
    }))
}
