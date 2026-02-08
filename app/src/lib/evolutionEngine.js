// Evolution Engine — genetic operations for prompt evolution
// Uses LLM to crossover, mutate, and innovate trading prompts

import { callLLMForText } from './aiService'
import { formatMarketDataForLLM } from './strategyImporter'

/**
 * Crossover: Combine two top-ranked prompts into a new hybrid
 * Takes the best elements from each parent strategy
 *
 * @param {Object} promptA - First parent prompt (higher ranked)
 * @param {Object} promptB - Second parent prompt
 * @param {Object} gradeA - Grade result for promptA
 * @param {Object} gradeB - Grade result for promptB
 * @param {Object} settings - App settings with apiKeys
 * @returns {Object} New prompt object ready to add to store
 */
export const crossover = async (promptA, promptB, gradeA, gradeB, settings) => {
  const crossoverPrompt = `Eres un experto en estrategias de trading de criptomonedas. Tu tarea es combinar dos estrategias de trading existentes en una nueva estrategia hibrida que tome lo mejor de cada una.

ESTRATEGIA PADRE A (Score: ${gradeA?.score || '?'}/100, Grade: ${gradeA?.grade || '?'}):
"${promptA.content}"

ESTRATEGIA PADRE B (Score: ${gradeB?.score || '?'}/100, Grade: ${gradeB?.grade || '?'}):
"${promptB.content}"

INSTRUCCIONES:
- Combina los elementos mas fuertes de ambas estrategias
- Si A tiene mejor win rate, prioriza sus criterios de entrada
- Si B tiene menor drawdown, prioriza su gestion de riesgo
- Crea una estrategia coherente que no sea simplemente copiar/pegar
- Mantén el formato como un prompt de estrategia de trading en español
- 200-400 palabras maximo
- NO incluyas titulos, solo el contenido de la estrategia
- Empieza directamente con la descripcion de la estrategia`

  const content = await callLLMForText(crossoverPrompt, settings)

  return {
    id: crypto.randomUUID(),
    name: `Crossover: ${promptA.name.slice(0, 15)} x ${promptB.name.slice(0, 15)}`,
    content: content.trim(),
    status: 'active',
    capital: Math.round((promptA.capital + promptB.capital) / 2),
    leverage: Math.min(promptA.leverage, promptB.leverage), // Conservative
    targetPct: Math.round((promptA.targetPct + promptB.targetPct) / 2),
    executionTime: promptA.executionTime || 'target',
    minIpe: Math.max(promptA.minIpe || 70, promptB.minIpe || 70), // Higher standard
    aiModel: promptA.aiModel || 'groq',
    numResults: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'evolution-crossover',
    parents: [promptA.id, promptB.id],
    generation: (Math.max(promptA.generation || 0, promptB.generation || 0)) + 1,
    provenance: {
      type: 'evolution-crossover',
      source: `Crossover: "${promptA.name}" x "${promptB.name}"`,
      chapter: '',
      url: '',
      importedAt: new Date().toISOString(),
      method: 'LLM genetic crossover de los 2 mejores prompts del torneo',
      qualityScore: Math.round(((gradeA?.score || 0) + (gradeB?.score || 0)) / 2),
      notes: `Padre A: ${promptA.name} (${gradeA?.grade || '?'}, ${gradeA?.score || '?'}/100). Padre B: ${promptB.name} (${gradeB?.grade || '?'}, ${gradeB?.score || '?'}/100).`
    }
  }
}

/**
 * Mutate: Modify a prompt based on its backtest results
 * Targets weak areas identified in the backtest
 *
 * @param {Object} prompt - Original prompt to mutate
 * @param {Object} backtestResult - Full backtest result
 * @param {Object} grade - Grade result
 * @param {Object} settings - App settings
 * @returns {Object} New mutated prompt object
 */
export const mutate = async (prompt, backtestResult, grade, settings) => {
  const result = backtestResult?.result || backtestResult || {}

  // Identify weaknesses
  const weaknesses = []
  if ((result.maxDrawdown || 0) > 20) weaknesses.push(`Drawdown alto de ${result.maxDrawdown?.toFixed(1)}% — necesita mejor gestion de riesgo y stop loss mas ajustados`)
  if ((result.winRate || 0) < 50) weaknesses.push(`Win rate bajo de ${result.winRate?.toFixed(0)}% — necesita criterios de entrada mas selectivos`)
  if ((result.profitFactor || 0) < 1.2) weaknesses.push(`Profit factor de ${result.profitFactor?.toFixed(2)} — las ganancias no superan suficientemente las perdidas`)
  if ((result.totalTrades || 0) < 5) weaknesses.push(`Solo ${result.totalTrades} trades — la estrategia es demasiado restrictiva`)
  if ((result.sharpeRatio || 0) < 0.5) weaknesses.push(`Sharpe ratio bajo de ${result.sharpeRatio?.toFixed(2)} — retornos inconsistentes`)

  if (weaknesses.length === 0) weaknesses.push('La estrategia es buena pero puede mejorarse en consistencia y precision')

  const mutationPrompt = `Eres un experto en optimizacion de estrategias de trading. Tu tarea es MEJORAR esta estrategia basandote en los resultados de su backtest.

ESTRATEGIA ORIGINAL (Grade: ${grade?.grade || '?'}, Score: ${grade?.score || '?'}/100):
"${prompt.content}"

RESULTADOS DEL BACKTEST:
- PnL Total: ${result.totalPnlPercent?.toFixed(1) || 0}%
- Win Rate: ${result.winRate?.toFixed(0) || 0}%
- Profit Factor: ${result.profitFactor === Infinity ? '10+' : result.profitFactor?.toFixed(2) || 0}
- Max Drawdown: ${result.maxDrawdown?.toFixed(1) || 0}%
- Sharpe Ratio: ${result.sharpeRatio?.toFixed(2) || 0}
- Total Trades: ${result.totalTrades || 0}

DEBILIDADES IDENTIFICADAS:
${weaknesses.map(w => `- ${w}`).join('\n')}

INSTRUCCIONES:
- Modifica la estrategia para corregir las debilidades identificadas
- Mantén los aspectos que funcionan bien
- Sé especifico en los cambios: menciona indicadores, niveles, condiciones
- NO cambies completamente la estrategia, solo MEJORA los puntos debiles
- Formato: prompt de estrategia de trading en español, 200-400 palabras
- NO incluyas titulos ni headers, solo el contenido
- Empieza directamente con la descripcion`

  const content = await callLLMForText(mutationPrompt, settings)

  return {
    id: crypto.randomUUID(),
    name: `${prompt.name} (Mutado)`,
    content: content.trim(),
    status: 'active',
    capital: prompt.capital,
    leverage: prompt.leverage,
    targetPct: prompt.targetPct,
    executionTime: prompt.executionTime || 'target',
    minIpe: prompt.minIpe || 70,
    aiModel: prompt.aiModel || 'groq',
    numResults: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'evolution-mutation',
    parents: [prompt.id],
    generation: (prompt.generation || 0) + 1,
    provenance: {
      type: 'evolution-mutation',
      source: `Mutacion de "${prompt.name}"`,
      chapter: '',
      url: '',
      importedAt: new Date().toISOString(),
      method: 'LLM mutation targeting debilidades del backtest',
      qualityScore: grade?.score || 0,
      notes: `Original: ${grade?.grade || '?'} (${grade?.score || '?'}/100). Debilidades: ${weaknesses.join('; ')}`
    }
  }
}

/**
 * Innovate: Generate a completely new prompt inspired by top performers + market data
 * Creates something novel rather than just remixing existing strategies
 *
 * @param {Array} topPrompts - Top ranked prompts [{prompt, grade}]
 * @param {Object} marketData - Binance Futures data from fetchAllFuturesData
 * @param {Object} settings - App settings
 * @returns {Object} New innovative prompt object
 */
export const innovate = async (topPrompts = [], marketData = null, settings) => {
  const topStrategySummary = topPrompts
    .slice(0, 3)
    .map((p, i) => `${i + 1}. "${p.prompt.name}" (Grade ${p.grade?.grade || '?'}): "${p.prompt.content.slice(0, 200)}..."`)
    .join('\n')

  const marketContext = marketData ? formatMarketDataForLLM(marketData) : 'No hay datos de mercado disponibles.'

  const innovationPrompt = `Eres un quant trader experto que diseña estrategias de trading de criptomonedas novedosas e innovadoras. Tu tarea es crear una estrategia COMPLETAMENTE NUEVA que sea diferente a las existentes pero inspirada en lo que funciona.

ESTRATEGIAS TOP EXISTENTES (para inspiracion, NO copiar):
${topStrategySummary || 'Ninguna disponible aun.'}

DATOS ACTUALES DEL MERCADO:
${marketContext}

INSTRUCCIONES:
- Crea una estrategia de trading NUEVA y ORIGINAL para criptomonedas
- Puede usar cualquier enfoque: accion del precio, indicadores tecnicos, analisis on-chain, correlaciones, patrones de volumen, divergencias, etc.
- Debe ser especifica y accionable (no generica)
- Incluye: criterios de entrada, salida, take profit, stop loss, y gestion de riesgo
- Debe ser diferente a las estrategias existentes listadas arriba
- Si hay datos de mercado, adapta la estrategia al contexto actual
- Formato: prompt de trading en español, 200-400 palabras
- NO incluyas titulos ni headers, solo el contenido de la estrategia
- Empieza directamente con la descripcion
- Sé creativo pero realista`

  const content = await callLLMForText(innovationPrompt, settings)

  // Pick creative name
  const namePrompt = `Dame un nombre corto y creativo (2-3 palabras maximo) para esta estrategia de trading. Solo responde con el nombre, nada mas:\n\n"${content.slice(0, 300)}"`
  let name = 'Nueva Estrategia'
  try {
    const nameResult = await callLLMForText(namePrompt, settings)
    name = nameResult.replace(/["']/g, '').trim().slice(0, 40) || 'Nueva Estrategia'
  } catch {
    // Use default name
  }

  return {
    id: crypto.randomUUID(),
    name: `${name} (Gen ${(topPrompts[0]?.prompt?.generation || 0) + 1})`,
    content: content.trim(),
    status: 'active',
    capital: 1000,
    leverage: 5,
    targetPct: 10,
    executionTime: 'target',
    minIpe: 75,
    aiModel: 'groq',
    numResults: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: 'evolution-innovation',
    parents: topPrompts.slice(0, 3).map(p => p.prompt.id),
    generation: (topPrompts[0]?.prompt?.generation || 0) + 1,
    provenance: {
      type: 'evolution-innovation',
      source: `Innovacion inspirada en top ${topPrompts.length} estrategias`,
      chapter: '',
      url: '',
      importedAt: new Date().toISOString(),
      method: 'LLM novel strategy generation con datos de mercado',
      qualityScore: 0,
      notes: `Mercado: ${marketData ? 'Datos disponibles' : 'Sin datos'}. Inspiracion: ${topPrompts.map(p => p.prompt.name).join(', ')}`
    }
  }
}
