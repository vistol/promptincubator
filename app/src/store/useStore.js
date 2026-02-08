import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  supabase,
  getSupabaseClient,
  syncPrompts,
  syncSignals,
  syncEggs,
  syncSettings,
  syncHealthChecks,
  syncBacktests,
  syncPaperPortfolio,
  syncBenchmarks,
  loadPrompts,
  loadSignals,
  loadEggs,
  loadSettings,
  loadHealthChecks,
  loadBacktests,
  loadPaperPortfolio,
  loadBenchmarks,
  deletePromptFromCloud,
  deleteEggFromCloud,
  deleteHealthCheckFromCloud,
  deleteBacktestFromCloud,
  deleteBenchmarkFromCloud,
  repairEggsData,
  signOut
} from '../lib/supabase'
import { generateTradesFromPrompt } from '../lib/aiService'
import { createExecutionLog, calculateExecutionSummary } from '../lib/executionLog'
import { classifyError, createRunLogEntry, createRunEvent, trimRunLog, getModelDisplayName } from '../lib/healthCheckUtils'
import {
  fetchPrices,
  fetchBinance24hStats,
  calculateTradeStatus,
  calculatePnL,
  SUPPORTED_PAIRS
} from '../lib/priceService'

// Price refresh interval (1 minute for active monitoring)
const PRICE_REFRESH_INTERVAL = 1 * 60 * 1000

// Max number of activity logs to keep
const MAX_ACTIVITY_LOGS = 100

// Log types for activity monitoring
const LOG_TYPES = {
  PRICE: 'price',
  SYNC: 'sync',
  TRADE: 'trade',
  EGG: 'egg',
  SYSTEM: 'system',
  ERROR: 'error',
  AI: 'ai'
}

// Execution time limits in milliseconds
const EXECUTION_LIMITS = {
  target: null, // No time limit, only SL/TP
  scalping: 60 * 60 * 1000, // 1 hour max
  intraday: 24 * 60 * 60 * 1000, // 24 hours max
  swing: 7 * 24 * 60 * 60 * 1000 // 7 days max
}

// ─── localStorage slim helpers ──────────────────────────────
// localStorage has a ~5MB limit. These strip heavy fields (trades, equityCurve)
// so only summary metrics are persisted. Full data stays in RAM + Supabase.

const slimBacktestForStorage = (bt) => {
  if (!bt?.result) return bt
  const { trades, equityCurve, ...slimResult } = bt.result
  return { ...bt, result: { ...slimResult, _slim: true } }
}

const slimBenchmarkForStorage = (bm) => {
  if (!bm?.result?.results) return bm
  return {
    ...bm,
    result: {
      ...bm.result,
      results: bm.result.results.map(r => {
        const { trades, equityCurve, ...slim } = r
        return { ...slim, _slim: true }
      })
    }
  }
}

const slimEvolutionForStorage = (evo) => {
  if (!evo) return evo
  const { marketData, log, ...rest } = evo
  return rest // marketData = transient cache, log = session-only
}

// Eggs start empty - user creates them via prompts
const initialEggs = []

// Sample data generators
const generateSignal = (promptId, promptName) => ({
  id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  promptId,
  promptName,
  asset: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'][Math.floor(Math.random() * 5)],
  strategy: Math.random() > 0.5 ? 'LONG' : 'SHORT',
  entry: (Math.random() * 50000 + 1000).toFixed(2),
  takeProfit: (Math.random() * 60000 + 5000).toFixed(2),
  stopLoss: (Math.random() * 45000 + 500).toFixed(2),
  ipe: Math.floor(Math.random() * 20 + 75),
  explanation: 'Based on technical analysis including RSI divergence, MACD crossover, and volume profile analysis. The current market structure suggests a high probability setup.',
  insights: [
    'Strong support level identified at current entry',
    'Volume increasing on recent candles',
    'RSI showing bullish divergence on 4H timeframe'
  ],
  createdAt: new Date().toISOString(),
  status: 'active'
})

const initialPrompts = [
  {
    id: 'prompt-1',
    name: 'Niveles Psicologicos',
    content: `Analiza cada precio y su distancia al numero redondo mas cercano:
- BTC: multiplos de $5,000 ($90K, $95K, $100K, $105K)
- ETH: multiplos de $500 ($2,500, $3,000, $3,500, $4,000)
- SOL: multiplos de $25 ($150, $175, $200, $225)
- BNB: multiplos de $50 ($550, $600, $650, $700)
- Otros: multiplos de $1 o $10 segun el precio

REGLAS DE ENTRADA:
- LONG solo si el precio esta 1-3% POR DEBAJO del numero redondo (comprando en soporte psicologico)
- SHORT solo si el precio esta 1-3% POR ENCIMA del numero redondo (vendiendo en resistencia psicologica)
- IGNORAR si la distancia es menor a 0.5% (zona de indecision)
- IGNORAR si la distancia es mayor a 5% (sin referencia cercana)

RISK MANAGEMENT:
- Stop Loss: 1.5% desde entry
- Take Profit: 3.5% desde entry (R:R minimo 2:1)
- Maximo 2 trades, siempre en assets DIFERENTES
- Si no hay setups claros, genera solo 1 trade

PRIORIDAD: BTC > ETH > SOL > BNB > el resto`,
    mode: 'auto',
    executionTime: 'intraday',
    capital: 1000,
    leverage: 3,
    numResults: 2,
    aiModel: 'groq',
    minIpe: 80,
    status: 'active',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
    trades: 0,
    winRate: 0,
    profitFactor: 0,
    totalPnl: 0,
    maxDrawdown: 0,
    provenance: { type: 'manual', source: 'Seed prompt — PromptHatcher', chapter: '', url: '', importedAt: '2025-01-15T10:30:00Z', method: 'Prompt semilla incluido con la aplicacion', qualityScore: 80, notes: 'Estrategia original de niveles psicologicos en numeros redondos.' }
  },
  {
    id: 'prompt-2',
    name: 'Calculadora Mecanica',
    content: `Eres un sistema MECANICO. No interpretes, solo calcula.

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
Si hay mas de 3 candidatos, elegir los 3 con MENOR distancia_redondo (mas cerca del nivel psicologico = mayor probabilidad).

PASO 5 - VALIDAR:
Verificar que R:R > 2.0 para cada trade. Si no cumple, NO incluirlo.
Responde SOLO con los trades que pasen todos los pasos.`,
    mode: 'auto',
    executionTime: 'intraday',
    capital: 1000,
    leverage: 3,
    numResults: 3,
    aiModel: 'groq',
    minIpe: 80,
    status: 'active',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
    trades: 0,
    winRate: 0,
    profitFactor: 0,
    totalPnl: 0,
    maxDrawdown: 0,
    provenance: { type: 'manual', source: 'Seed prompt — PromptHatcher', chapter: '', url: '', importedAt: '2025-01-15T10:30:00Z', method: 'Prompt semilla incluido con la aplicacion', qualityScore: 85, notes: 'Sistema mecanico puro de calculo por formulas exactas.' }
  },
  {
    id: 'prompt-3',
    name: 'Divergencia Cross-Asset',
    content: `Compara todos los assets y busca DIVERGENCIAS entre ellos.

PASO 1 - CONTEXTO BTC:
- Si BTC esta cerca de un soporte (1-3% debajo de redondo) = sesgo ALCISTA general
- Si BTC esta cerca de resistencia (1-3% encima de redondo) = sesgo BAJISTA general
- Si BTC esta lejos de niveles = NEUTRAL

PASO 2 - BUSCAR DIVERGENCIAS:
Busca assets que se muevan CONTRA el sesgo de BTC:
- Si sesgo BTC = ALCISTA, busca altcoins cerca de RESISTENCIA -> SHORT (divergencia)
- Si sesgo BTC = BAJISTA, busca altcoins cerca de SOPORTE -> LONG (divergencia)
- Si BTC NEUTRAL, busca el asset mas cerca de cualquier nivel redondo

PASO 3 - FILTROS:
- Solo operar assets con precio > $1
- Distancia al nivel redondo entre 0.5% y 3%
- NO operar BTC directamente (es la referencia)
- Maximo 2 trades en assets diferentes

PASO 4 - NIVELES:
- SL: 2% desde entry
- TP: 4% desde entry (R:R = 2:1)

PASO 5 - Si BTC esta a menos de 0.5% de un nivel redondo, NO operar nada (incertidumbre maxima).`,
    mode: 'auto',
    executionTime: 'intraday',
    capital: 1000,
    leverage: 3,
    numResults: 2,
    aiModel: 'groq',
    minIpe: 80,
    status: 'active',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
    trades: 0,
    winRate: 0,
    profitFactor: 0,
    totalPnl: 0,
    maxDrawdown: 0,
    provenance: { type: 'manual', source: 'Seed prompt — PromptHatcher', chapter: '', url: '', importedAt: '2025-01-15T10:30:00Z', method: 'Prompt semilla incluido con la aplicacion', qualityScore: 82, notes: 'Estrategia de divergencias entre BTC y altcoins usando niveles psicologicos.' }
  }
]

// Signals start empty - created via trade generation
const initialSignals = []

const useStore = create(
  persist(
    (set, get) => ({
      // Prompts
      prompts: initialPrompts,
      addPrompt: (prompt) => {
        set((state) => ({
          prompts: [...state.prompts, {
            ...prompt,
            id: `prompt-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            trades: 0,
            winRate: 0,
            profitFactor: 0,
            totalPnl: 0,
            maxDrawdown: 0,
            provenance: prompt.provenance || {
              type: 'manual',
              source: 'manual',
              chapter: '',
              url: '',
              importedAt: new Date().toISOString(),
              method: 'Creacion manual via editor',
              qualityScore: 0,
              notes: ''
            }
          }]
        }))
        get().triggerSync()
      },
      updatePrompt: (id, updates) => {
        set((state) => ({
          prompts: state.prompts.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          )
        }))
        get().triggerSync()
      },
      archivePrompt: (id) => {
        set((state) => ({
          prompts: state.prompts.map(p =>
            p.id === id ? { ...p, status: 'archived', updatedAt: new Date().toISOString() } : p
          )
        }))
        get().triggerSync()
      },
      deletePrompt: async (id) => {
        const client = get().getClient()
        if (client) {
          await deletePromptFromCloud(client, id)
        }
        set((state) => ({
          prompts: state.prompts.filter(p => p.id !== id),
          signals: state.signals.filter(s => s.promptId !== id)
        }))
        get().triggerSync()
      },

      // Signals
      signals: initialSignals,
      addSignal: (promptId) => {
        const prompt = get().prompts.find(p => p.id === promptId)
        if (prompt) {
          const signal = generateSignal(promptId, prompt.name)
          set((state) => ({ signals: [signal, ...state.signals] }))
          get().triggerSync()
          return signal
        }
      },
      updateSignal: (id, updates) => {
        set((state) => ({
          signals: state.signals.map(s => s.id === id ? { ...s, ...updates } : s)
        }))
        get().triggerSync()
      },

      // Eggs (incubating trade groups)
      eggs: initialEggs,

      // Pending trades (generated but not yet selected for incubation)
      pendingTrades: [],
      isGeneratingTrades: false,
      generationError: null,

      // Execution pipeline log (real-time tracking)
      currentExecutionLog: null,
      pipelineEvents: [],
      pipelineCurrentStep: null,

      // Generate trades from prompt using AI
      generateTrades: async (prompt) => {
        const numResults = prompt.numResults || 3

        // Create execution log
        const executionLog = createExecutionLog(prompt.name, {
          capital: prompt.capital || 1000,
          leverage: prompt.leverage || 5,
          executionTime: prompt.executionTime || 'target',
          aiModel: prompt.aiModel || 'google',
          minIpe: prompt.minIpe || 80,
          numResults
        })

        set({
          isGeneratingTrades: true,
          generationError: null,
          pendingTrades: [],
          currentExecutionLog: executionLog,
          pipelineEvents: [],
          pipelineCurrentStep: 'start'
        })

        get().addLog('ai', `Generating ${numResults} trades using "${prompt.name}"...`)

        // Pipeline event handler - updates state in real-time
        const onPipelineEvent = (event, currentStep) => {
          set((state) => ({
            pipelineEvents: [...state.pipelineEvents, event],
            pipelineCurrentStep: currentStep,
            currentExecutionLog: state.currentExecutionLog
              ? { ...state.currentExecutionLog, currentStep, events: [...state.currentExecutionLog.events, event] }
              : null
          }))
        }

        try {
          // Global timeout: 120s max for entire pipeline
          const PIPELINE_TIMEOUT = 120000
          let pipelineTimeoutId
          const timeoutPromise = new Promise((_, reject) => {
            pipelineTimeoutId = setTimeout(() => {
              reject(new Error('Pipeline timeout: la generacion tardo mas de 120s. Revisa la consola del navegador para mas detalles.'))
            }, PIPELINE_TIMEOUT)
          })

          const trades = await Promise.race([
            generateTradesFromPrompt(prompt, get().settings, numResults, onPipelineEvent),
            timeoutPromise
          ]).finally(() => clearTimeout(pipelineTimeoutId))

          // Log each generated trade
          trades.forEach(trade => {
            get().addLog('ai', `Generated: ${trade.asset} ${trade.strategy} | Entry: $${trade.entry} | TP: $${trade.takeProfit} | SL: $${trade.stopLoss}`, trade)
          })

          get().addLog('ai', `AI generated ${trades.length} trade signals`)

          // Finalize execution log
          const finalLog = {
            ...get().currentExecutionLog,
            status: 'completed',
            completedAt: new Date().toISOString(),
            hashes: trades._executionHashes || {}
          }
          finalLog.summary = calculateExecutionSummary(finalLog)

          set({
            pendingTrades: trades,
            isGeneratingTrades: false,
            currentExecutionLog: finalLog
          })

          return { success: true, trades }
        } catch (error) {
          get().addLog('error', `AI generation failed: ${error.message}`)

          // Mark execution log as error
          const errorLog = get().currentExecutionLog
            ? { ...get().currentExecutionLog, status: 'error', completedAt: new Date().toISOString() }
            : null
          if (errorLog) errorLog.summary = calculateExecutionSummary(errorLog)

          set({
            isGeneratingTrades: false,
            generationError: error.message,
            currentExecutionLog: errorLog
          })
          return { success: false, error: error.message }
        }
      },

      // Toggle trade selection
      toggleTradeSelection: (tradeId) => {
        set((state) => ({
          pendingTrades: state.pendingTrades.map(t =>
            t.id === tradeId ? { ...t, selected: !t.selected } : t
          )
        }))
      },

      // Select all trades
      selectAllTrades: () => {
        set((state) => ({
          pendingTrades: state.pendingTrades.map(t => ({ ...t, selected: true }))
        }))
      },

      // Clear pending trades
      clearPendingTrades: () => {
        set({ pendingTrades: [], generationError: null })
      },

      // Create egg from selected trades (start incubation)
      createEgg: (prompt) => {
        const state = get()
        const selectedTrades = state.pendingTrades.filter(t => t.selected)

        if (selectedTrades.length === 0) return null

        // Extract the full AI prompt from the first trade (if available)
        // VALIDATION: Ensure fullAIPrompt is never empty - build fallback if needed
        let fullAIPrompt = selectedTrades[0]?.fullAIPrompt || null
        if (!fullAIPrompt || fullAIPrompt.trim() === '') {
          // Build a fallback AI prompt from available data
          const assets = selectedTrades.map(t => t.asset).join(', ')
          fullAIPrompt = `[AI Prompt Not Captured]\n\nStrategy: ${prompt.name || 'Unknown'}\nContent: ${prompt.content || 'No content'}\nAssets: ${assets}\nCapital: $${prompt.capital || 1000}\nLeverage: ${prompt.leverage || 5}x\nTarget: ${prompt.targetPct || 10}%\nMin IPE: ${prompt.minIpe || 80}%\nExecution: ${prompt.executionTime || 'target'}\nAI Model: ${prompt.aiModel || 'gemini'}\n\nNote: The original AI prompt was not captured. This is a reconstruction from the prompt configuration.`
        }

        // Add trades to signals with 'active' status
        const newSignals = selectedTrades.map(t => {
          const { fullAIPrompt: _, ...tradeWithoutPrompt } = t
          return {
            ...tradeWithoutPrompt,
            status: 'active',
            selected: undefined // Remove selection flag
          }
        })

        // VALIDATION: Build comprehensive prompt content for display
        // Ensure promptContent is NEVER empty - always provide meaningful content
        const promptName = prompt.name || 'Unnamed Strategy'
        const promptMode = prompt.mode || 'auto'
        const promptExecution = prompt.executionTime || 'target'
        const promptCapital = prompt.capital || 1000
        const promptLeverage = prompt.leverage || 5
        const promptTarget = prompt.targetPct || 10
        const promptMinIpe = prompt.minIpe || 80

        let promptContentDisplay = prompt.content
        if (!promptContentDisplay || promptContentDisplay.trim() === '') {
          // Fallback: build comprehensive content from configuration
          promptContentDisplay = `Estrategia: ${promptName}\n\nConfiguración:\n- Modo: ${promptMode}\n- Ejecución: ${promptExecution}\n- Capital: $${promptCapital}\n- Apalancamiento: ${promptLeverage}x\n- Objetivo: +${promptTarget}%\n- IPE Mínimo: ${promptMinIpe}%`
        }

        // VALIDATION: Ensure config object is always complete with all required fields
        const validatedConfig = {
          capital: prompt.capital || 1000,
          leverage: prompt.leverage || 5,
          executionTime: prompt.executionTime || 'target',
          aiModel: prompt.aiModel || 'gemini',
          aiProvider: prompt.aiModel || 'google',
          minIpe: prompt.minIpe || 80,
          numResults: prompt.numResults || 3,
          mode: prompt.mode || 'auto',
          targetPct: prompt.targetPct || 10 // Default to 10% instead of null
        }

        // Attach the execution log from the generation pipeline
        const executionLog = get().currentExecutionLog || null

        // Create the egg with all prompt configuration
        const egg = {
          id: `egg-${Date.now()}`,
          promptId: prompt.id || `prompt-${Date.now()}`,
          healthCheckId: prompt.healthCheckId || (() => {
            // Auto-detect: find health check that contains this prompt
            const hc = state.healthChecks?.find(hc =>
              hc.prompts?.some(p => p.id === (prompt.id || ''))
            )
            return hc?.id || null
          })(),
          promptName: promptName,
          promptContent: promptContentDisplay,
          fullAIPrompt: fullAIPrompt, // Store the complete prompt sent to AI (validated)
          status: 'incubating',
          trades: newSignals.map(s => s.id),
          totalCapital: selectedTrades.reduce((sum, t) => sum + (t.capital || 0), 0),
          // Store all prompt configuration (validated)
          config: validatedConfig,
          executionTime: promptExecution,
          expiresAt: EXECUTION_LIMITS[prompt.executionTime]
            ? new Date(Date.now() + EXECUTION_LIMITS[prompt.executionTime]).toISOString()
            : null,
          createdAt: new Date().toISOString(),
          hatchedAt: null,
          results: null,
          // Glass Box Pipeline - execution log for transparency
          executionLog: executionLog
        }

        set((state) => ({
          signals: [...newSignals, ...state.signals],
          eggs: [egg, ...state.eggs],
          pendingTrades: [],
          // Navigate to incubator and expand the new egg
          activeTab: 'incubator',
          navigateToEggId: egg.id
        }))

        // Log egg creation
        const assets = newSignals.map(s => s.asset).join(', ')
        get().addLog('egg', `New egg incubating: "${prompt.name}" with ${newSignals.length} trades`, {
          eggId: egg.id,
          trades: newSignals.length,
          assets,
          capital: egg.totalCapital
        })

        get().triggerSync()

        return egg
      },

      // Update egg status
      updateEgg: (eggId, updates) => {
        set((state) => ({
          eggs: state.eggs.map(e =>
            e.id === eggId ? { ...e, ...updates } : e
          )
        }))
        get().triggerSync()
      },

      // Check if egg should hatch (all trades executed)
      checkEggHatch: (eggId) => {
        const state = get()
        const egg = state.eggs.find(e => e.id === eggId)

        if (!egg || egg.status === 'hatched') return false

        const eggSignals = state.signals.filter(s => egg.trades.includes(s.id))
        const allClosed = eggSignals.every(s => s.status === 'closed')

        if (allClosed) {
          // Calculate results
          const wins = eggSignals.filter(s => s.result === 'win').length
          const losses = eggSignals.filter(s => s.result === 'loss').length

          // pnl is now percentage, calculate average PnL%
          const totalPnlPercent = eggSignals.reduce((sum, s) => sum + (s.pnl || 0), 0)
          const avgPnl = eggSignals.length > 0 ? totalPnlPercent / eggSignals.length : 0
          const winRate = eggSignals.length > 0 ? (wins / eggSignals.length) * 100 : 0

          // Calculate dollar PnL for logging
          const totalPnlDollar = eggSignals.reduce((sum, s) => sum + (s.pnlDollar || 0), 0)

          // Profit factor using percentage PnL
          const grossProfit = eggSignals.filter(s => (s.pnl || 0) > 0).reduce((sum, s) => sum + s.pnl, 0)
          const grossLoss = Math.abs(eggSignals.filter(s => (s.pnl || 0) < 0).reduce((sum, s) => sum + s.pnl, 0))

          // Calculate avg IPE
          const avgIpe = eggSignals.reduce((sum, s) => sum + (s.ipe || 0), 0) / eggSignals.length

          const results = {
            totalTrades: eggSignals.length,
            closedTrades: eggSignals.length,
            wins,
            losses,
            winRate: Math.round(winRate),
            totalPnl: avgPnl, // Average PnL percentage
            totalPnlDollar, // Total dollar PnL for reference
            profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
            avgIpe: Math.round(avgIpe)
          }

          set((state) => ({
            eggs: state.eggs.map(e =>
              e.id === eggId ? {
                ...e,
                status: 'hatched',
                hatchedAt: new Date().toISOString(),
                results
              } : e
            )
          }))

          // Log egg hatching
          const pnlStr = avgPnl >= 0 ? `+${avgPnl.toFixed(2)}%` : `${avgPnl.toFixed(2)}%`
          get().addLog('egg', `Egg hatched: "${egg.promptName}" - ${wins}W/${losses}L (${pnlStr})`, {
            eggId,
            promptName: egg.promptName,
            results
          })

          get().triggerSync()
          return true
        }

        return false
      },

      // Get incubating eggs
      getIncubatingEggs: () => {
        return get().eggs.filter(e => e.status === 'incubating')
      },

      // Get hatched eggs
      getHatchedEggs: () => {
        return get().eggs.filter(e => e.status === 'hatched')
      },

      // Onboarding
      onboardingCompleted: false,
      completeOnboarding: () => set({ onboardingCompleted: true }),
      resetOnboarding: () => set({ onboardingCompleted: false }),

      // Reset all data (for fresh start)
      resetAllData: async () => {
        const client = get().getClient()

        // Clear cloud data first if connected
        if (client) {
          try {
            // Delete all data from Supabase tables
            await Promise.all([
              client.from('prompts').delete().neq('id', ''),
              client.from('signals').delete().neq('id', ''),
              client.from('eggs').delete().neq('id', ''),
              client.from('settings').delete().neq('id', '')
            ])
          } catch (err) {
            console.error('Failed to clear cloud data:', err)
          }
        }

        // Clear localStorage
        localStorage.removeItem('prompthatcher-storage')

        // Set a reset flag to prevent cloud reload
        localStorage.setItem('prompthatcher-reset-pending', 'true')

        // Reset all state to initial values
        set({
          prompts: [],
          signals: [],
          eggs: [],
          pendingTrades: [],
          activityLogs: [],
          onboardingCompleted: false,
          prices: {},
          priceStatus: {
            isFetching: false,
            lastUpdated: null,
            error: null,
            source: null,
            fallbackUsed: false
          },
          syncStatus: {
            syncing: false,
            lastSynced: null,
            error: null,
            loading: false
          },
          isCloudInitialized: false
        })

        // Force page reload for clean state
        window.location.reload()
      },

      // Selective data reset with dependency handling
      // Now async - deletes from cloud FIRST, then clears local state
      resetSelectiveData: async (options = {}) => {
        const {
          deletePrompts = false,
          deleteEggs = false,
          deleteSignals = false,
          deleteHealthChecks = false,
          deleteLogs = false,
          resetOnboarding = false,
          keepLinkedData = true // If true, keeps signals linked to eggs when deleting only prompts
        } = options

        const state = get()
        const client = state.getClient()

        // Track what we're deleting for return value
        const counts = {
          deletedPrompts: deletePrompts ? state.prompts.length : 0,
          deletedEggs: deleteEggs ? state.eggs.length : 0,
          deletedSignals: deleteSignals ? state.signals.length : 0,
          deletedHealthChecks: deleteHealthChecks ? state.healthChecks.length : 0,
          deletedLogs: deleteLogs ? state.activityLogs.length : 0,
          cloudDeleteSuccess: false,
          error: null
        }

        // STEP 1: Delete from cloud FIRST (this was the bug - we only cleared local state)
        if (client) {
          try {
            const cloudDeletes = []

            if (deleteSignals) {
              cloudDeletes.push(client.from('signals').delete().neq('id', ''))
            }

            if (deleteEggs) {
              cloudDeletes.push(client.from('eggs').delete().neq('id', ''))
              // If cascade delete, also delete signals linked to eggs
              if (!keepLinkedData) {
                cloudDeletes.push(client.from('signals').delete().neq('id', ''))
              }
            }

            if (deletePrompts) {
              cloudDeletes.push(client.from('prompts').delete().neq('id', ''))
              // If cascade delete, also delete linked eggs and their signals
              if (!keepLinkedData) {
                cloudDeletes.push(client.from('eggs').delete().neq('id', ''))
                cloudDeletes.push(client.from('signals').delete().neq('id', ''))
              }
            }

            if (deleteHealthChecks) {
              cloudDeletes.push(client.from('health_checks').delete().neq('id', ''))
              // Cascade: delete eggs created by health checks
              const healthCheckEggIds = state.eggs
                .filter(e => e.healthCheckId)
                .map(e => e.id)
              if (healthCheckEggIds.length > 0) {
                // Delete health check eggs
                cloudDeletes.push(
                  client.from('eggs').delete().in('id', healthCheckEggIds)
                )
                // Delete signals from those eggs
                const healthCheckSignalIds = state.eggs
                  .filter(e => e.healthCheckId)
                  .flatMap(e => e.trades)
                if (healthCheckSignalIds.length > 0) {
                  cloudDeletes.push(
                    client.from('signals').delete().in('id', healthCheckSignalIds)
                  )
                }
              }
              // Update counts to include cascaded items
              counts.deletedEggs += healthCheckEggIds.length
              counts.deletedSignals += state.eggs
                .filter(e => e.healthCheckId)
                .flatMap(e => e.trades).length
            }

            // Execute all cloud deletes
            if (cloudDeletes.length > 0) {
              await Promise.all(cloudDeletes)
              counts.cloudDeleteSuccess = true
              get().addLog('sync', `Cloud data deleted: ${cloudDeletes.length} operations`)
            }
          } catch (err) {
            console.error('Failed to delete from cloud:', err)
            counts.error = err.message
            get().addLog('error', `Cloud delete failed: ${err.message}`)
            // Continue with local delete anyway
          }
        }

        // STEP 2: Set reset flag to prevent cloud reload race condition
        localStorage.setItem('prompthatcher-selective-reset', 'true')

        // STEP 3: Clear local state
        let newPrompts = state.prompts
        let newEggs = state.eggs
        let newSignals = state.signals
        let newHealthChecks = state.healthChecks
        let newLogs = state.activityLogs
        let newOnboarding = state.onboardingCompleted

        // Delete signals first (no dependencies on it)
        if (deleteSignals) {
          newSignals = []
          // If deleting signals, eggs lose their trade references
          newEggs = newEggs.map(egg => ({
            ...egg,
            trades: [],
            status: egg.status === 'incubating' ? 'orphaned' : egg.status
          }))
        }

        // Delete eggs
        if (deleteEggs) {
          // Get all signal IDs that belong to eggs
          const eggSignalIds = newEggs.flatMap(egg => egg.trades)

          if (!keepLinkedData) {
            // Also delete signals that belonged to these eggs
            newSignals = newSignals.filter(s => !eggSignalIds.includes(s.id))
          }
          newEggs = []
        }

        // Delete prompts
        if (deletePrompts) {
          if (!keepLinkedData) {
            // Delete eggs that belonged to these prompts
            const promptIds = newPrompts.map(p => p.id)
            const eggsToDelete = newEggs.filter(e => promptIds.includes(e.promptId))
            const eggSignalIds = eggsToDelete.flatMap(egg => egg.trades)

            // Delete signals from those eggs
            newSignals = newSignals.filter(s => !eggSignalIds.includes(s.id))
            // Delete the eggs
            newEggs = newEggs.filter(e => !promptIds.includes(e.promptId))
          } else {
            // Mark eggs as orphaned (prompt deleted)
            newEggs = newEggs.map(egg => ({
              ...egg,
              promptName: egg.promptName + ' (deleted)',
              promptId: null
            }))
          }
          newPrompts = []
        }

        // Delete health checks (with cascade to their eggs)
        if (deleteHealthChecks) {
          // Get eggs created by health checks
          const healthCheckEggIds = newEggs
            .filter(e => e.healthCheckId)
            .map(e => e.id)

          // Get signals from those eggs
          const healthCheckSignalIds = newEggs
            .filter(e => e.healthCheckId)
            .flatMap(e => e.trades)

          // Remove health check eggs
          newEggs = newEggs.filter(e => !e.healthCheckId)

          // Remove signals from health check eggs
          newSignals = newSignals.filter(s => !healthCheckSignalIds.includes(s.id))

          // Clear all health checks
          newHealthChecks = []
        }

        // Delete activity logs
        if (deleteLogs) {
          newLogs = []
        }

        // Reset onboarding
        if (resetOnboarding) {
          newOnboarding = false
        }

        set({
          prompts: newPrompts,
          eggs: newEggs,
          signals: newSignals,
          healthChecks: newHealthChecks,
          activityLogs: newLogs,
          onboardingCompleted: newOnboarding
        })

        get().addLog('system', `Selective reset complete: ${counts.deletedPrompts} prompts, ${counts.deletedEggs} eggs, ${counts.deletedSignals} signals, ${counts.deletedHealthChecks} health checks, ${counts.deletedLogs} logs`)

        // STEP 4: Force page reload for guaranteed clean state
        window.location.reload()

        return counts
      },

      // Get data counts for UI
      getDataCounts: () => {
        const state = get()
        const incubatingEggs = state.eggs.filter(e => e.status === 'incubating')
        const hatchedEggs = state.eggs.filter(e => e.status === 'hatched')
        const activeSignals = state.signals.filter(s => s.status === 'active')
        const closedSignals = state.signals.filter(s => s.status === 'closed')
        const activeHealthChecks = state.healthChecks?.filter(hc => hc.isActive) || []
        const healthCheckEggs = state.eggs.filter(e => e.healthCheckId)

        return {
          prompts: state.prompts.length,
          eggs: state.eggs.length,
          incubatingEggs: incubatingEggs.length,
          hatchedEggs: hatchedEggs.length,
          signals: state.signals.length,
          activeSignals: activeSignals.length,
          closedSignals: closedSignals.length,
          activityLogs: state.activityLogs.length,
          healthChecks: state.healthChecks?.length || 0,
          activeHealthChecks: activeHealthChecks.length,
          healthCheckEggs: healthCheckEggs.length
        }
      },
      isConfigured: () => {
        const state = get()
        const hasAiKey = Object.values(state.settings.apiKeys).some(key => key && key.length > 0)
        const hasSupabase = state.settings.supabase.url && state.settings.supabase.anonKey
        return hasAiKey && hasSupabase
      },

      // Settings
      settings: {
        aiProvider: 'google',
        aiModel: 'gemini-2.5-flash',
        gracePeriodEnabled: true, // Toggle grace period on/off
        gracePeriodMinutes: 5, // Warmup before TP/SL can close trades
        apiKeys: {
          anthropic: '',
          google: '',
          openai: '',
          xai: '',
          groq: '',
          sambanova: ''
        },
        supabase: {
          url: '',
          anonKey: '',
          connected: false
        },
        tradingPlatform: {
          primary: 'binance',
          secondary: 'tradingview'
        },
        systemPrompt: `You are an autonomous quantitative research agent specialized in cryptocurrency markets.

Your task is to generate ONE completely new trading strategy every time you are invoked.

This strategy MUST be original and must NOT reuse the same combination of:
- Market hypothesis
- Indicators
- Timeframes
- Entry/exit logic
- Risk model
- Market regime assumption
as any previous strategy generated in this session or application lifecycle.

If there is any risk of similarity, you must deliberately explore a different conceptual space.

---

## SCIENTIFIC METHOD (MANDATORY)

You MUST follow the scientific method explicitly and structure the output accordingly:

1. OBSERVATION
   - Describe a specific, non-trivial market behavior observed in crypto markets.
   - The observation must be measurable and not opinion-based.

2. QUESTION
   - Formulate a precise research question derived from the observation.

3. HYPOTHESIS
   - Propose a falsifiable hypothesis.
   - The hypothesis must predict a measurable outcome.

4. EXPERIMENT DESIGN
   - Define:
     - Market type (spot, futures, perpetuals)
     - Timeframe(s)
     - Assets selection logic
     - Indicators or raw data used (can be non-standard)
     - Entry conditions
     - Exit conditions
     - Risk management rules
   - All rules must be explicit and unambiguous.

5. VARIABLES
   - Independent variables
   - Dependent variables
   - Control variables

6. METRICS & EVALUATION
   - Define objective performance metrics:
     - e.g. expectancy, Sharpe, max drawdown, win rate, profit factor
   - Define failure conditions (when the hypothesis is rejected).

7. RANDOMIZATION CONSTRAINT
   - Introduce controlled randomness in ONE of the following:
     - Indicator parameters
     - Asset universe
     - Time segmentation
     - Position sizing
   - Randomness must be bounded and justifiable.

8. BIAS & LIMITATIONS
   - Explicitly state possible biases and limitations of the strategy.

---

## CONSTRAINTS

- The strategy must be implementable programmatically.
- No vague language (e.g. "strong trend", "significant move").
- No price prediction or discretionary judgment.
- No reuse of common retail strategies unless fundamentally transformed.
- Do NOT mention news sentiment unless it is quantifiable.
- Do NOT optimize parameters; assume default values unless randomized.

---

## OUTPUT FORMAT (STRICT)

Return the strategy using this exact structure:

- Strategy Name
- Observation
- Research Question
- Hypothesis
- Experiment Design
- Variables
- Entry Rules
- Exit Rules
- Risk Management
- Randomized Component
- Evaluation Metrics
- Failure Criteria
- Biases & Limitations

---

## FINAL REQUIREMENT

Each strategy must explore a different market inefficiency or behavioral pattern.
If no truly new strategy can be generated, you must invent a new angle rather than repeating prior logic.`
      },
      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates }
        }))
        get().triggerSync()
      },
      updateSystemPrompt: (prompt) => {
        set((state) => ({
          settings: { ...state.settings, systemPrompt: prompt }
        }))
        get().triggerSync()
      },
      updateApiKey: (provider, key) => {
        set((state) => ({
          settings: {
            ...state.settings,
            apiKeys: { ...state.settings.apiKeys, [provider]: key }
          }
        }))
        // Trigger sync to save encrypted API keys to Supabase
        get().triggerSync()
      },
      updateSupabase: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          supabase: { ...state.settings.supabase, ...updates }
        }
      })),
      updateTradingPlatform: (updates) => set((state) => ({
        settings: {
          ...state.settings,
          tradingPlatform: { ...state.settings.tradingPlatform, ...updates }
        }
      })),

      // Auth State
      user: null,
      session: null,
      isAuthenticated: false,
      authLoading: true,
      authError: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setSession: (session) => set({ session }),
      setAuthLoading: (loading) => set({ authLoading: loading }),
      setAuthError: (error) => set({ authError: error }),

      logout: async () => {
        await signOut()
        set({ user: null, session: null, isAuthenticated: false, authError: null })
      },

      // Price State
      prices: {},
      priceStatus: {
        isFetching: false,
        lastUpdated: null,
        error: null,
        source: null,
        fallbackUsed: false
      },
      priceRefreshInterval: null,

      // Fetch prices for all active trades (with 30s cache)
      fetchAllPrices: async (forceRefresh = false) => {
        const state = get()
        const { primary, secondary } = state.settings.tradingPlatform

        // SHORT-TERM CACHE: Skip fetch if prices are < 30 seconds old
        const PRICE_CACHE_TTL = 30 * 1000 // 30 seconds
        if (!forceRefresh && state.priceStatus.lastUpdated) {
          const lastFetch = new Date(state.priceStatus.lastUpdated).getTime()
          if (Date.now() - lastFetch < PRICE_CACHE_TTL && Object.keys(state.prices).length > 0) {
            return { success: true, prices: state.prices, cached: true }
          }
        }

        // Get unique assets from active signals and eggs
        const activeSignals = state.signals.filter(s => s.status === 'active')
        const incubatingEggs = state.eggs.filter(e => e.status === 'incubating')
        const eggTradeIds = incubatingEggs.flatMap(e => e.trades)
        const eggSignals = state.signals.filter(s => eggTradeIds.includes(s.id) && s.status === 'active')

        const allActiveSignals = [...activeSignals, ...eggSignals]
        const uniqueAssets = [...new Set(allActiveSignals.map(s => s.asset))]

        if (uniqueAssets.length === 0) {
          // If no active trades, still fetch main pairs for display
          uniqueAssets.push('BTC/USDT', 'ETH/USDT')
        }

        get().addLog('price', `Fetching prices from ${primary.toUpperCase()}...`, { assets: uniqueAssets })

        set({
          priceStatus: { ...state.priceStatus, isFetching: true, error: null }
        })

        try {
          const result = await fetchPrices(uniqueAssets, primary, secondary)

          if (result.error) {
            get().addLog('error', `Price fetch failed: ${result.error}`)
            set({
              priceStatus: {
                isFetching: false,
                lastUpdated: state.priceStatus.lastUpdated,
                error: result.error,
                source: null,
                fallbackUsed: false
              }
            })
            return { success: false, error: result.error }
          }

          // Log each price update
          Object.entries(result.prices).forEach(([asset, data]) => {
            get().addLog('price', `${asset}: $${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, {
              asset,
              price: data.price,
              change24h: data.change24h
            })
          })

          get().addLog('system', `Prices updated from ${result.source}${result.fallbackUsed ? ' (fallback)' : ''}`, {
            source: result.source,
            assetsCount: Object.keys(result.prices).length
          })

          set({
            prices: { ...state.prices, ...result.prices },
            priceStatus: {
              isFetching: false,
              lastUpdated: new Date().toISOString(),
              error: null,
              source: result.source,
              fallbackUsed: result.fallbackUsed || false
            }
          })

          // After fetching prices, update trade statuses
          get().updateTradeStatuses()

          return { success: true, prices: result.prices }
        } catch (error) {
          get().addLog('error', `Price fetch error: ${error.message}`)
          set({
            priceStatus: {
              ...state.priceStatus,
              isFetching: false,
              error: error.message
            }
          })
          return { success: false, error: error.message }
        }
      },

      // Update trade statuses based on current prices
      updateTradeStatuses: () => {
        const state = get()
        const { prices, signals, eggs } = state

        // Get active trades that need checking
        const activeTrades = signals.filter(s => s.status === 'active')
        const incubatingEggs = eggs.filter(e => e.status === 'incubating')

        if (activeTrades.length === 0) {
          get().addLog('system', `No active trades to check`)
          return
        }

        let signalsUpdated = false
        let closedTrades = []
        let activatedTrades = []
        let checkedTrades = []

        const updatedSignals = signals.map(signal => {
          if (signal.status !== 'active') return signal

          const priceData = prices[signal.asset]
          if (!priceData) {
            get().addLog('trade', `⚠ No price data for ${signal.asset}`, { asset: signal.asset })
            return signal
          }

          const currentPrice = priceData.price
          const tradeStatus = calculateTradeStatus(signal, currentPrice)
          const entry = parseFloat(signal.entry)
          const tp = parseFloat(signal.takeProfit)
          const sl = parseFloat(signal.stopLoss)

          // Log detailed check info
          checkedTrades.push({
            asset: signal.asset,
            strategy: signal.strategy,
            currentPrice,
            entry,
            tp,
            sl,
            distanceToTP: signal.strategy === 'LONG' ? tp - currentPrice : currentPrice - tp,
            distanceToSL: signal.strategy === 'LONG' ? currentPrice - sl : sl - currentPrice,
            pnlPercent: tradeStatus.pnlPercent
          })

          // Grace period: protect trades from closing too early after egg creation
          // Use the EGG's createdAt (when incubation started), not the signal's createdAt
          // (which is set during AI generation, potentially minutes before the egg is created)
          const gracePeriodEnabled = state.settings.gracePeriodEnabled !== false
          const gracePeriodMs = (state.settings.gracePeriodMinutes ?? 5) * 60 * 1000
          const parentEgg = eggs.find(e => e.trades && e.trades.includes(signal.id))
          const eggCreatedAt = parentEgg?.createdAt ? new Date(parentEgg.createdAt).getTime() : 0
          const eggAge = eggCreatedAt ? Date.now() - eggCreatedAt : Infinity
          const inGracePeriod = gracePeriodEnabled && eggCreatedAt > 0 && eggAge < gracePeriodMs

          if (inGracePeriod) {
            const gracePeriodEndsAt = new Date(eggCreatedAt + gracePeriodMs).toISOString()
            if (!signal.priceActivated) {
              activatedTrades.push({
                asset: signal.asset,
                strategy: signal.strategy,
                price: currentPrice,
                entry,
                tp,
                sl,
                gracePeriodEndsAt
              })
            }
            return {
              ...signal,
              priceActivated: true,
              activatedPrice: signal.activatedPrice || currentPrice,
              currentPrice,
              unrealizedPnl: tradeStatus.pnlPercent,
              gracePeriodEndsAt
            }
          }

          // Trade is activated - check for TP/SL hits
          if (tradeStatus.status === 'win' || tradeStatus.status === 'loss') {
            signalsUpdated = true
            const egg = eggs.find(e => e.trades.includes(signal.id))
            const capital = egg ? (egg.totalCapital / egg.trades.length) : 100
            const pnlDollar = (tradeStatus.pnlPercent / 100) * capital

            closedTrades.push({
              asset: signal.asset,
              strategy: signal.strategy,
              result: tradeStatus.status,
              pnl: tradeStatus.pnlPercent, // percentage for display
              pnlDollar,
              exitPrice: tradeStatus.exitPrice,
              eggName: egg?.promptName
            })

            return {
              ...signal,
              status: 'closed',
              result: tradeStatus.status,
              exitPrice: tradeStatus.exitPrice,
              pnl: tradeStatus.pnlPercent, // Store percentage
              pnlDollar, // Store dollar amount
              closedAt: new Date().toISOString()
            }
          }

          return {
            ...signal,
            currentPrice,
            unrealizedPnl: tradeStatus.pnlPercent
          }
        })

        // Log trade check summary
        if (checkedTrades.length > 0) {
          checkedTrades.forEach(trade => {
            const direction = trade.strategy === 'LONG' ? '↑' : '↓'
            const tpDist = Math.abs(trade.distanceToTP).toFixed(2)
            const slDist = Math.abs(trade.distanceToSL).toFixed(2)
            const pnlColor = trade.pnlPercent >= 0 ? '+' : ''
            get().addLog('trade', `${direction} ${trade.asset}: $${trade.currentPrice.toFixed(2)} | TP: $${tpDist} away | SL: $${slDist} away | PnL: ${pnlColor}${trade.pnlPercent.toFixed(2)}%`, trade)
          })
        }

        // Log activated trades
        activatedTrades.forEach(trade => {
          get().addLog('trade', `★ Trade monitoring started: ${trade.asset} ${trade.strategy} | Entry: $${trade.entry} | TP: $${trade.tp} | SL: $${trade.sl}`, trade)
        })

        // Log closed trades
        closedTrades.forEach(trade => {
          const resultEmoji = trade.result === 'win' ? '✓ TP HIT' : '✗ SL HIT'
          const pnlStr = trade.pnl >= 0 ? `+$${trade.pnl.toFixed(2)}` : `-$${Math.abs(trade.pnl).toFixed(2)}`
          get().addLog('trade', `${resultEmoji}: ${trade.asset} ${trade.strategy} closed @ $${trade.exitPrice.toFixed(2)} (${pnlStr})`, trade)

          // If trade belongs to an egg, log egg progress
          if (trade.eggName) {
            const egg = incubatingEggs.find(e => e.promptName === trade.eggName)
            if (egg) {
              const eggSignals = updatedSignals.filter(s => egg.trades.includes(s.id))
              const closed = eggSignals.filter(s => s.status === 'closed').length
              const total = eggSignals.length
              get().addLog('egg', `Egg "${trade.eggName}": ${closed}/${total} trades executed`, { eggName: trade.eggName, closed, total })
            }
          }
        })

        // Grace period log
        const inGracePeriodCount = updatedSignals.filter(s =>
          s.status === 'active' && s.gracePeriodEndsAt && new Date(s.gracePeriodEndsAt) > new Date()
        ).length
        if (inGracePeriodCount > 0) {
          get().addLog('trade', `${inGracePeriodCount} trade(s) en warmup (grace period)`)
        }

        // Summary log
        const stillActive = updatedSignals.filter(s => s.status === 'active').length
        if (closedTrades.length > 0 || activatedTrades.length > 0) {
          get().addLog('system', `Trade check: ${closedTrades.length} closed, ${activatedTrades.length} activated, ${stillActive} still active`)
        }

        if (signalsUpdated) {
          set({ signals: updatedSignals })

          // Check if any eggs should hatch
          incubatingEggs.forEach(egg => {
            get().checkEggHatch(egg.id)
          })

          get().triggerSync()
        } else {
          set({ signals: updatedSignals })
        }
      },

      // Start auto-refresh interval
      startPriceRefresh: () => {
        const state = get()

        // Clear existing interval if any
        if (state.priceRefreshInterval) {
          clearInterval(state.priceRefreshInterval)
        }

        // Initial fetch
        get().fetchAllPrices()

        // Set up interval
        const intervalId = setInterval(() => {
          get().fetchAllPrices()
        }, PRICE_REFRESH_INTERVAL)

        set({ priceRefreshInterval: intervalId })
      },

      // Stop auto-refresh interval
      stopPriceRefresh: () => {
        const state = get()
        if (state.priceRefreshInterval) {
          clearInterval(state.priceRefreshInterval)
          set({ priceRefreshInterval: null })
        }
      },

      // Manual price refresh (sync button)
      refreshPrices: async () => {
        return await get().fetchAllPrices()
      },

      // Get price for a specific asset
      getPrice: (asset) => {
        const state = get()
        return state.prices[asset]?.price || null
      },

      // Get 24h stats for an asset
      fetch24hStats: async (asset) => {
        try {
          const stats = await fetchBinance24hStats(asset)
          return stats
        } catch (error) {
          console.error('Failed to fetch 24h stats:', error)
          return null
        }
      },

      // Activity Logs for real-time monitoring
      activityLogs: [],
      addLog: (type, message, data = null) => {
        set((state) => ({
          activityLogs: [
            {
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              type,
              message,
              data,
              timestamp: new Date().toISOString()
            },
            ...state.activityLogs
          ].slice(0, MAX_ACTIVITY_LOGS)
        }))
      },
      clearLogs: () => set({ activityLogs: [] }),

      // UI State
      activeTab: 'prompts',
      setActiveTab: (tab) => set({ activeTab: tab }),
      settingsActiveTab: 0,
      setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),

      // Modal states
      isPromptActionModalOpen: false,
      setPromptActionModalOpen: (open) => set({ isPromptActionModalOpen: open }),

      isNewPromptModalOpen: false,
      setNewPromptModalOpen: (open) => set({ isNewPromptModalOpen: open }),

      isSignalDetailOpen: false,
      selectedSignal: null,
      openSignalDetail: (signal) => set({ isSignalDetailOpen: true, selectedSignal: signal }),
      closeSignalDetail: () => set({ isSignalDetailOpen: false, selectedSignal: null }),

      // Prompt detail
      selectedPromptId: null,
      setSelectedPromptId: (id) => set({ selectedPromptId: id }),

      // Prompts page state
      promptsActiveTab: 'reports',
      promptActionMode: null, // 'edit' or 'execute'

      // Health Checks (batch presets)
      healthChecks: [],
      activeHealthCheckId: null, // tracks which health check is currently being executed
      showHealthCheckModal: false,
      healthCheckRunning: null,        // ID of health check currently executing
      healthCheckProgress: null,       // {current, total, currentVariation, errors}
      healthCheckError: null,          // Error message if run fails
      addHealthCheck: (healthCheck) => {
        set((state) => ({
          healthChecks: [...state.healthChecks, healthCheck]
        }))
        get().triggerSync()
      },
      updateHealthCheck: (id, updates) => {
        set((state) => ({
          healthChecks: state.healthChecks.map(hc =>
            hc.id === id ? { ...hc, ...updates } : hc
          )
        }))
        get().triggerSync()
      },
      deleteHealthCheck: async (id) => {
        const client = get().getClient()
        if (client) {
          await deleteHealthCheckFromCloud(client, id)
        }
        set((state) => ({
          healthChecks: state.healthChecks.filter(hc => hc.id !== id)
        }))
        get().triggerSync()
      },
      setHealthChecks: (healthChecks) => {
        set({ healthChecks })
        get().triggerSync()
      },

      // Create egg directly from trades (used by runHealthCheck, bypasses pendingTrades)
      // healthCheckMeta: { presetName } — optional metadata from the health check for formatting
      createEggDirect: (prompt, trades, healthCheckId, variation = null, healthCheckMeta = null) => {
        if (!trades || trades.length === 0) return null

        let fullAIPrompt = trades[0]?.fullAIPrompt || null
        if (!fullAIPrompt || fullAIPrompt.trim() === '') {
          const assets = trades.map(t => t.asset).join(', ')
          fullAIPrompt = `[Health Check Auto-Run]\n\nStrategy: ${prompt.name || 'Unknown'}\nAssets: ${assets}\nCapital: $${prompt.capital || 1000}\nLeverage: ${prompt.leverage || 5}x`
        }

        const newSignals = trades.map(t => {
          const { fullAIPrompt: _, ...tradeWithoutPrompt } = t
          return { ...tradeWithoutPrompt, status: 'active', selected: undefined }
        })

        const basePromptName = prompt.name || 'Unnamed Strategy'
        const promptExecution = prompt.executionTime || 'target'

        // Format egg title: PROMPT + BATCH PRESET NAME + DATE/TIME
        const now = new Date()
        const dateStr = now.toLocaleDateString()
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const presetName = healthCheckMeta?.presetName || null
        const promptName = presetName
          ? `${basePromptName} | ${presetName} | ${dateStr} ${timeStr}`
          : basePromptName

        const validatedConfig = {
          capital: prompt.capital || 1000,
          leverage: prompt.leverage || 5,
          executionTime: promptExecution,
          aiModel: prompt.aiModel || 'gemini',
          aiProvider: prompt.aiModel || 'google',
          minIpe: prompt.minIpe || 80,
          numResults: prompt.numResults || 3,
          mode: prompt.mode || 'auto',
          targetPct: prompt.targetPct || 10
        }

        const egg = {
          id: `egg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          promptId: prompt.id || `prompt-${Date.now()}`,
          healthCheckId: healthCheckId,
          promptName: promptName,
          promptContent: prompt.content || `Health Check: ${basePromptName}`,
          fullAIPrompt: fullAIPrompt,
          status: 'incubating',
          isHealthCheck: true, // Flag for health-themed egg icon
          trades: newSignals.map(s => s.id),
          totalCapital: trades.reduce((sum, t) => sum + (t.capital || 0), 0),
          config: validatedConfig,
          variation: variation || null, // Store the variation that produced this egg
          executionTime: promptExecution,
          expiresAt: EXECUTION_LIMITS[prompt.executionTime]
            ? new Date(Date.now() + EXECUTION_LIMITS[prompt.executionTime]).toISOString()
            : null,
          createdAt: new Date().toISOString(),
          hatchedAt: null,
          results: null,
          executionLog: null
        }

        set((state) => ({
          signals: [...newSignals, ...state.signals],
          eggs: [egg, ...state.eggs]
        }))

        const assets = newSignals.map(s => s.asset).join(', ')
        get().addLog('egg', `Health check egg: "${promptName}" with ${newSignals.length} trades`, {
          eggId: egg.id, trades: newSignals.length, assets, capital: egg.totalCapital
        })

        get().triggerSync()
        return egg
      },

      // Run health check: iterate variations, generate trades, create eggs
      runHealthCheck: async (checkId) => {
        const state = get()
        const check = state.healthChecks.find(hc => hc.id === checkId)
        if (!check) return { success: false, error: 'Health check not found' }
        if (!check.variations?.length) return { success: false, error: 'No variations configured' }
        if (!check.prompts?.length) return { success: false, error: 'No prompts selected' }
        if (state.healthCheckRunning) return { success: false, error: 'Another health check is running' }

        const basePrompt = state.prompts.find(p => p.id === check.prompts[0].id)
        if (!basePrompt) return { success: false, error: 'Prompt not found in library' }

        // Pre-filter variations: skip those requiring an AI model without an API key
        const defaultAiModel = basePrompt.aiModel || state.settings.aiProvider || 'google'
        const availableKeys = state.settings.apiKeys || {}
        const skippedVariations = []

        const runnableVariations = check.variations.filter((variation) => {
          const aiModel = variation.aiModel || defaultAiModel
          if (!availableKeys[aiModel]) {
            const label = Object.entries(variation).map(([k, v]) => `${k}:${v}`).join(' ')
            skippedVariations.push({ label, aiModel, variation })
            return false
          }
          return true
        })

        // Initialize persistent run log entry
        const runLogEntry = createRunLogEntry(check.variations.length)
        runLogEntry.summary.attempted = runnableVariations.length
        runLogEntry.summary.skipped = skippedVariations.length

        // Record skipped variations as events
        skippedVariations.forEach((sv) => {
          const classified = classifyError(`No API key configured for ${sv.aiModel}`, sv.aiModel)
          runLogEntry.events.push(createRunEvent(-1, sv.variation, 'skipped', {
            skipReason: `No API key for ${getModelDisplayName(sv.aiModel)}`,
            errorType: classified.errorType,
            suggestion: classified.suggestion
          }))
        })

        if (runnableVariations.length === 0) {
          const missingModels = [...new Set(skippedVariations.map(s => s.aiModel))].join(', ')

          // Finalize and persist the run log even on abort
          runLogEntry.completedAt = new Date().toISOString()
          runLogEntry.durationMs = 0
          const existingRunLog = check.runLog || []
          const updatedRunLog = trimRunLog([runLogEntry, ...existingRunLog])
          get().updateHealthCheck(checkId, { runLog: updatedRunLog })

          set({ healthCheckError: `No API keys configured for: ${missingModels}` })
          get().addLog('error', `Health check "${check.name}" aborted: no API keys for ${missingModels}`)
          return { success: false, error: `No API keys configured for: ${missingModels}` }
        }

        const total = runnableVariations.length
        const skippedCount = skippedVariations.length
        set({
          healthCheckRunning: checkId,
          healthCheckProgress: { current: 0, total, currentVariation: null, errors: [], skipped: skippedCount, liveRunLog: runLogEntry },
          healthCheckError: null
        })

        if (skippedCount > 0) {
          const missingModels = [...new Set(skippedVariations.map(s => s.aiModel))].join(', ')
          get().addLog('system', `Health check "${check.name}": skipping ${skippedCount} variation(s) — no API key for: ${missingModels}`)
        }
        get().addLog('system', `Running health check "${check.name}" with ${total} variation(s)${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}...`)

        let successCount = 0
        let firstEggId = null
        const errors = []

        for (let i = 0; i < runnableVariations.length; i++) {
          const variation = runnableVariations[i]
          const variationLabel = Object.entries(variation).map(([k, v]) => `${k}:${v}`).join(' ')
          const variationStart = Date.now()

          set({
            healthCheckProgress: { current: i, total, currentVariation: variationLabel, errors, skipped: skippedCount, liveRunLog: runLogEntry }
          })

          // Merge base prompt with variation overrides
          const mergedPrompt = {
            ...basePrompt,
            capital: check.capital || basePrompt.capital || 1000,
            ...variation,
            healthCheckId: checkId
          }

          // Determine AI provider from variation or base
          const aiModel = variation.aiModel || defaultAiModel
          const mergedSettings = { ...state.settings, aiProvider: aiModel }
          const numResults = variation.numResults || basePrompt.numResults || 3

          try {
            get().addLog('ai', `[HC ${i + 1}/${total}] Generating: ${variationLabel}`)

            const trades = await generateTradesFromPrompt(mergedPrompt, mergedSettings, numResults, () => {})

            if (trades && trades.length > 0) {
              const egg = get().createEggDirect(mergedPrompt, trades, checkId, variation, {
                presetName: check.preset?.name || check.name || 'Health Check'
              })
              successCount++
              if (!firstEggId && egg?.id) firstEggId = egg.id

              // Record success event in run log
              runLogEntry.events.push(createRunEvent(i, variation, 'success', {
                durationMs: Date.now() - variationStart,
                eggId: egg?.id || null,
                tradesGenerated: trades.length
              }))
              runLogEntry.summary.succeeded++
              runLogEntry.summary.eggsCreated++
              runLogEntry.summary.totalTradesGenerated += trades.length

              get().addLog('ai', `[HC ${i + 1}/${total}] Created egg with ${trades.length} trades`)
            } else {
              const errMsg = `No valid trades generated for ${variationLabel}`
              errors.push(errMsg)

              // Record failure event in run log
              const classified = classifyError(errMsg, aiModel)
              runLogEntry.events.push(createRunEvent(i, variation, 'failed', {
                durationMs: Date.now() - variationStart,
                error: errMsg,
                errorType: classified.errorType,
                suggestion: classified.suggestion
              }))
              runLogEntry.summary.failed++

              get().addLog('error', `[HC ${i + 1}/${total}] ${errMsg}`)
            }
          } catch (err) {
            const errMsg = `${variationLabel}: ${err.message}`
            errors.push(errMsg)

            // Record failure event in run log with classification
            const classified = classifyError(err.message, aiModel)
            runLogEntry.events.push(createRunEvent(i, variation, 'failed', {
              durationMs: Date.now() - variationStart,
              error: err.message,
              errorType: classified.errorType,
              suggestion: classified.suggestion
            }))
            runLogEntry.summary.failed++

            get().addLog('error', `[HC ${i + 1}/${total}] Failed: ${err.message}`)
          }

          // Update live progress with current run log state
          set({
            healthCheckProgress: { current: i + 1, total, currentVariation: variationLabel, errors, skipped: skippedCount, liveRunLog: { ...runLogEntry } }
          })

          // Small delay between variations to avoid rate limiting
          if (i < runnableVariations.length - 1) {
            await new Promise(r => setTimeout(r, 1000))
          }
        }

        // Finalize run log entry
        runLogEntry.completedAt = new Date().toISOString()
        runLogEntry.durationMs = new Date(runLogEntry.completedAt).getTime() - new Date(runLogEntry.startedAt).getTime()

        // Persist run log on the health check (trimmed to 20 entries)
        const existingRunLog = check.runLog || []
        const updatedRunLog = trimRunLog([runLogEntry, ...existingRunLog])

        get().updateHealthCheck(checkId, {
          lastRun: new Date().toISOString(),
          runLog: updatedRunLog
        })

        const errorSummary = []
        if (errors.length > 0) errorSummary.push(`${errors.length} failed`)
        if (skippedCount > 0) errorSummary.push(`${skippedCount} skipped (no API key)`)

        set({
          healthCheckRunning: null,
          healthCheckProgress: null,
          healthCheckError: errorSummary.length > 0 ? errorSummary.join(', ') : null
        })

        get().addLog('system', `Health check "${check.name}" complete: ${successCount}/${total} eggs created${errorSummary.length > 0 ? ` — ${errorSummary.join(', ')}` : ''}`)
        get().triggerSync()

        // Navigate to the first created egg after all variations complete
        if (firstEggId) {
          set({ activeTab: 'incubator', navigateToEggId: firstEggId })
        }

        return { success: true, created: successCount, errors }
      },

      // Retry only failed/skipped variations from the last run (or specific ones)
      // variationsToRetry: array of variation objects, or null to auto-detect from latest runLog
      retryFailedVariations: async (checkId, variationsToRetry = null) => {
        const state = get()
        const check = state.healthChecks.find(hc => hc.id === checkId)
        if (!check) return { success: false, error: 'Health check not found' }
        if (state.healthCheckRunning) return { success: false, error: 'Another health check is running' }

        const basePrompt = state.prompts.find(p => p.id === check.prompts?.[0]?.id)
        if (!basePrompt) return { success: false, error: 'Prompt not found in library' }

        // Determine which variations to retry
        let targetVariations = variationsToRetry
        if (!targetVariations || targetVariations.length === 0) {
          // Auto-detect from latest run log
          const latestRun = (check.runLog || [])[0]
          if (!latestRun) {
            // No previous run — fall back to full run
            return get().runHealthCheck(checkId)
          }
          targetVariations = latestRun.events
            .filter(e => e.status === 'failed' || e.status === 'skipped')
            .map(e => e.variation)
            .filter(v => v && Object.keys(v).length > 0)
        }

        if (targetVariations.length === 0) {
          return { success: false, error: 'No failed variations to retry' }
        }

        // Pre-filter by API key availability
        const defaultAiModel = basePrompt.aiModel || state.settings.aiProvider || 'google'
        const availableKeys = state.settings.apiKeys || {}
        const skippedVariations = []

        const runnableVariations = targetVariations.filter((variation) => {
          const aiModel = variation.aiModel || defaultAiModel
          if (!availableKeys[aiModel]) {
            skippedVariations.push({ label: Object.entries(variation).map(([k, v]) => `${k}:${v}`).join(' '), aiModel, variation })
            return false
          }
          return true
        })

        // Initialize run log entry for this retry
        const runLogEntry = createRunLogEntry(targetVariations.length)
        runLogEntry.summary.attempted = runnableVariations.length
        runLogEntry.summary.skipped = skippedVariations.length

        // Record still-skipped variations
        skippedVariations.forEach((sv) => {
          const classified = classifyError(`No API key configured for ${sv.aiModel}`, sv.aiModel)
          runLogEntry.events.push(createRunEvent(-1, sv.variation, 'skipped', {
            skipReason: `No API key for ${getModelDisplayName(sv.aiModel)}`,
            errorType: classified.errorType,
            suggestion: classified.suggestion
          }))
        })

        if (runnableVariations.length === 0) {
          const missingModels = [...new Set(skippedVariations.map(s => s.aiModel))].join(', ')
          runLogEntry.completedAt = new Date().toISOString()
          runLogEntry.durationMs = 0
          const existingRunLog = check.runLog || []
          const updatedRunLog = trimRunLog([runLogEntry, ...existingRunLog])
          get().updateHealthCheck(checkId, { runLog: updatedRunLog })

          set({ healthCheckError: `No API keys configured for: ${missingModels}` })
          get().addLog('error', `Retry "${check.name}" aborted: no API keys for ${missingModels}`)
          return { success: false, error: `No API keys configured for: ${missingModels}` }
        }

        const total = runnableVariations.length
        const skippedCount = skippedVariations.length
        set({
          healthCheckRunning: checkId,
          healthCheckProgress: { current: 0, total, currentVariation: null, errors: [], skipped: skippedCount, liveRunLog: runLogEntry },
          healthCheckError: null
        })

        get().addLog('system', `Retrying ${total} failed variation(s) for "${check.name}"${skippedCount > 0 ? ` (${skippedCount} still skipped)` : ''}...`)

        let successCount = 0
        let firstEggId = null
        const errors = []

        for (let i = 0; i < runnableVariations.length; i++) {
          const variation = runnableVariations[i]
          const variationLabel = Object.entries(variation).map(([k, v]) => `${k}:${v}`).join(' ')
          const variationStart = Date.now()

          set({
            healthCheckProgress: { current: i, total, currentVariation: variationLabel, errors, skipped: skippedCount, liveRunLog: runLogEntry }
          })

          const mergedPrompt = {
            ...basePrompt,
            capital: check.capital || basePrompt.capital || 1000,
            ...variation,
            healthCheckId: checkId
          }

          const aiModel = variation.aiModel || defaultAiModel
          const mergedSettings = { ...state.settings, aiProvider: aiModel }
          const numResults = variation.numResults || basePrompt.numResults || 3

          try {
            get().addLog('ai', `[Retry ${i + 1}/${total}] Generating: ${variationLabel}`)
            const trades = await generateTradesFromPrompt(mergedPrompt, mergedSettings, numResults, () => {})

            if (trades && trades.length > 0) {
              const egg = get().createEggDirect(mergedPrompt, trades, checkId, variation, {
                presetName: check.preset?.name || check.name || 'Health Check'
              })
              successCount++
              if (!firstEggId && egg?.id) firstEggId = egg.id

              runLogEntry.events.push(createRunEvent(i, variation, 'success', {
                durationMs: Date.now() - variationStart,
                eggId: egg?.id || null,
                tradesGenerated: trades.length
              }))
              runLogEntry.summary.succeeded++
              runLogEntry.summary.eggsCreated++
              runLogEntry.summary.totalTradesGenerated += trades.length

              get().addLog('ai', `[Retry ${i + 1}/${total}] Created egg with ${trades.length} trades`)
            } else {
              const errMsg = `No valid trades generated for ${variationLabel}`
              errors.push(errMsg)

              const classified = classifyError(errMsg, aiModel)
              runLogEntry.events.push(createRunEvent(i, variation, 'failed', {
                durationMs: Date.now() - variationStart,
                error: errMsg,
                errorType: classified.errorType,
                suggestion: classified.suggestion
              }))
              runLogEntry.summary.failed++

              get().addLog('error', `[Retry ${i + 1}/${total}] ${errMsg}`)
            }
          } catch (err) {
            const errMsg = `${variationLabel}: ${err.message}`
            errors.push(errMsg)

            const classified = classifyError(err.message, aiModel)
            runLogEntry.events.push(createRunEvent(i, variation, 'failed', {
              durationMs: Date.now() - variationStart,
              error: err.message,
              errorType: classified.errorType,
              suggestion: classified.suggestion
            }))
            runLogEntry.summary.failed++

            get().addLog('error', `[Retry ${i + 1}/${total}] Failed: ${err.message}`)
          }

          set({
            healthCheckProgress: { current: i + 1, total, currentVariation: variationLabel, errors, skipped: skippedCount, liveRunLog: { ...runLogEntry } }
          })

          if (i < runnableVariations.length - 1) {
            await new Promise(r => setTimeout(r, 1000))
          }
        }

        // Finalize
        runLogEntry.completedAt = new Date().toISOString()
        runLogEntry.durationMs = new Date(runLogEntry.completedAt).getTime() - new Date(runLogEntry.startedAt).getTime()

        const existingRunLog = check.runLog || []
        const updatedRunLog = trimRunLog([runLogEntry, ...existingRunLog])
        get().updateHealthCheck(checkId, {
          lastRun: new Date().toISOString(),
          runLog: updatedRunLog
        })

        const errorSummary = []
        if (errors.length > 0) errorSummary.push(`${errors.length} failed`)
        if (skippedCount > 0) errorSummary.push(`${skippedCount} skipped (no API key)`)

        set({
          healthCheckRunning: null,
          healthCheckProgress: null,
          healthCheckError: errorSummary.length > 0 ? errorSummary.join(', ') : null
        })

        get().addLog('system', `Retry "${check.name}" complete: ${successCount}/${total} eggs created${errorSummary.length > 0 ? ` — ${errorSummary.join(', ')}` : ''}`)
        get().triggerSync()

        // Navigate to the first created egg after all retries complete
        if (firstEggId) {
          set({ activeTab: 'incubator', navigateToEggId: firstEggId })
        }

        return { success: true, created: successCount, errors }
      },

      // Cross-page egg navigation (from Prompts to Incubator)
      navigateToEggId: null,
      setNavigateToEggId: (eggId) => set({ navigateToEggId: eggId }),
      clearNavigateToEggId: () => set({ navigateToEggId: null }),

      // Cloud Sync State
      syncStatus: {
        syncing: false,
        lastSynced: null,
        error: null,
        loading: false
      },

      // Get Supabase client if configured
      getClient: () => {
        // Always return the hardcoded supabase client (auth handles access control)
        return supabase
      },

      // Cloud initialization state
      isCloudInitialized: false,
      isInitializing: false,

      // Initialize app data from cloud (called on app start)
      initializeFromCloud: async () => {
        const state = get()
        const client = state.getClient()

        // Check if a reset was just performed - skip cloud load
        const resetPending = localStorage.getItem('prompthatcher-reset-pending')
        if (resetPending) {
          localStorage.removeItem('prompthatcher-reset-pending')
          set({ isCloudInitialized: true })
          get().addLog('system', 'Fresh start - skipping cloud data load')
          return { success: true, freshStart: true }
        }

        // Check if a selective reset was just performed - still load from cloud
        // but log it (we need to load remaining data like prompts that weren't deleted)
        const selectiveResetPending = localStorage.getItem('prompthatcher-selective-reset')
        if (selectiveResetPending) {
          localStorage.removeItem('prompthatcher-selective-reset')
          get().addLog('system', 'Selective reset complete - loading remaining data from cloud')
          // Continue to load from cloud (don't return early)
        }

        if (!client) {
          // No Supabase configured, use empty state
          set({ isCloudInitialized: true })
          get().addLog('system', 'App started in offline mode (no Supabase config)')
          return { success: false, error: 'Supabase not configured' }
        }

        if (state.isInitializing) {
          return { success: false, error: 'Already initializing' }
        }

        get().addLog('sync', 'Initializing from Supabase cloud...')
        set({ isInitializing: true })

        try {
          const result = await get().loadFromCloud()
          set({
            isCloudInitialized: true,
            isInitializing: false
          })
          if (result.success) {
            get().addLog('sync', 'Cloud initialization complete')
          }
          return result
        } catch (err) {
          get().addLog('error', `Cloud initialization failed: ${err.message}`)
          set({
            isCloudInitialized: true,
            isInitializing: false
          })
          return { success: false, error: err.message }
        }
      },

      // Sync all data to cloud
      syncToCloud: async () => {
        const state = get()
        const client = state.getClient()

        if (!client) {
          return { success: false, error: 'Supabase not configured' }
        }

        get().addLog('sync', 'Syncing data to Supabase...')
        set({ syncStatus: { ...state.syncStatus, syncing: true, error: null } })

        try {
          // Sync all data in parallel (including Lab data)
          const [promptsResult, signalsResult, eggsResult, settingsResult, healthChecksResult, backtestsResult, paperResult, benchmarksResult] = await Promise.all([
            syncPrompts(client, state.prompts),
            syncSignals(client, state.signals),
            syncEggs(client, state.eggs),
            syncSettings(client, state.settings),
            syncHealthChecks(client, state.healthChecks),
            syncBacktests(client, state.backtests),
            syncPaperPortfolio(client, state.paperPortfolio, state.paperTradeStrategies),
            syncBenchmarks(client, state.benchmarks)
          ])

          const hasError = !promptsResult.success || !signalsResult.success || !eggsResult.success || !settingsResult.success || !healthChecksResult.success || !backtestsResult.success || !paperResult.success || !benchmarksResult.success
          const errorMsg = promptsResult.error || signalsResult.error || eggsResult.error || settingsResult.error || healthChecksResult.error || backtestsResult.error || paperResult.error || benchmarksResult.error

          set({
            syncStatus: {
              syncing: false,
              lastSynced: hasError ? state.syncStatus.lastSynced : new Date().toISOString(),
              error: hasError ? errorMsg : null,
              loading: false
            }
          })

          // Update Supabase connected status
          if (!hasError) {
            get().addLog('sync', `Sync complete: ${state.prompts.length} prompts, ${state.signals.length} signals, ${state.eggs.length} eggs, ${state.healthChecks.length} health checks, ${state.backtests.length} backtests, ${state.benchmarks.length} benchmarks${state.paperPortfolio ? ', paper portfolio' : ''}`)
            set((s) => ({
              settings: {
                ...s.settings,
                supabase: { ...s.settings.supabase, connected: true }
              }
            }))
          } else {
            get().addLog('error', `Sync failed: ${errorMsg}`)
          }

          return { success: !hasError, error: errorMsg }
        } catch (err) {
          get().addLog('error', `Sync error: ${err.message}`)
          set({
            syncStatus: {
              ...state.syncStatus,
              syncing: false,
              error: err.message,
              loading: false
            }
          })
          return { success: false, error: err.message }
        }
      },

      // Load all data from cloud
      loadFromCloud: async () => {
        const state = get()
        const client = state.getClient()

        if (!client) {
          return { success: false, error: 'Supabase not configured' }
        }

        get().addLog('sync', 'Loading data from Supabase...')
        set({ syncStatus: { ...state.syncStatus, loading: true, error: null } })

        try {
          const [promptsResult, signalsResult, eggsResult, settingsResult, healthChecksResult, backtestsResult, paperResult, benchmarksResult] = await Promise.all([
            loadPrompts(client),
            loadSignals(client),
            loadEggs(client),
            loadSettings(client),
            loadHealthChecks(client),
            loadBacktests(client),
            loadPaperPortfolio(client),
            loadBenchmarks(client)
          ])

          // Cloud data replaces local data completely
          if (promptsResult.success) {
            get().addLog('sync', `Loaded ${promptsResult.data.length} prompts from cloud`)
            set({ prompts: promptsResult.data })
          }

          if (signalsResult.success) {
            get().addLog('sync', `Loaded ${signalsResult.data.length} signals from cloud`)
            set({ signals: signalsResult.data })
          }

          if (eggsResult.success) {
            const incubating = eggsResult.data.filter(e => e.status === 'incubating').length
            const hatched = eggsResult.data.filter(e => e.status === 'hatched').length
            get().addLog('sync', `Loaded ${eggsResult.data.length} eggs (${incubating} incubating, ${hatched} hatched)`)
            set({ eggs: eggsResult.data })
          }

          if (settingsResult.success && settingsResult.data) {
            get().addLog('sync', 'Loaded settings from cloud')

            // Check if cloud has API keys - use them if local keys are empty
            const cloudApiKeys = settingsResult.data.apiKeys
            const localApiKeys = get().settings.apiKeys

            // Merge API keys: prefer cloud keys if local are empty
            const mergedApiKeys = {
              anthropic: localApiKeys.anthropic || cloudApiKeys?.anthropic || '',
              google: localApiKeys.google || cloudApiKeys?.google || '',
              openai: localApiKeys.openai || cloudApiKeys?.openai || '',
              xai: localApiKeys.xai || cloudApiKeys?.xai || '',
              groq: localApiKeys.groq || cloudApiKeys?.groq || '',
              sambanova: localApiKeys.sambanova || cloudApiKeys?.sambanova || ''
            }

            const hasCloudKeys = cloudApiKeys && Object.values(cloudApiKeys).some(k => k && k.length > 0)
            if (hasCloudKeys) {
              get().addLog('sync', 'Loaded encrypted API keys from cloud')
            }

            set((s) => ({
              settings: {
                ...s.settings,
                aiProvider: settingsResult.data.aiProvider || s.settings.aiProvider,
                aiModel: settingsResult.data.aiModel || s.settings.aiModel,
                systemPrompt: settingsResult.data.systemPrompt || s.settings.systemPrompt,
                gracePeriodMinutes: settingsResult.data.gracePeriodMinutes ?? s.settings.gracePeriodMinutes,
                apiKeys: mergedApiKeys
              }
            }))
          }

          if (healthChecksResult.success) {
            get().addLog('sync', `Loaded ${healthChecksResult.data.length} health checks from cloud`)
            set({ healthChecks: healthChecksResult.data })
          }

          // Load Lab data from cloud (replaces localStorage data)
          if (backtestsResult.success && backtestsResult.data.length > 0) {
            get().addLog('sync', `Loaded ${backtestsResult.data.length} backtests from cloud`)
            set({ backtests: backtestsResult.data })
          }

          if (benchmarksResult.success && benchmarksResult.data.length > 0) {
            get().addLog('sync', `Loaded ${benchmarksResult.data.length} benchmarks from cloud`)
            set({ benchmarks: benchmarksResult.data })
          }

          if (paperResult.success && paperResult.data) {
            get().addLog('sync', 'Loaded paper portfolio from cloud')
            set({
              paperPortfolio: paperResult.data,
              paperTradeStrategies: paperResult.strategies || {},
              paperTradeActive: true
            })
          }

          set({
            syncStatus: {
              syncing: false,
              lastSynced: new Date().toISOString(),
              error: null,
              loading: false
            },
            settings: {
              ...get().settings,
              supabase: { ...get().settings.supabase, connected: true }
            }
          })

          get().addLog('system', 'Cloud data loaded successfully')
          return { success: true }
        } catch (err) {
          get().addLog('error', `Failed to load from cloud: ${err.message}`)
          set({
            syncStatus: {
              ...state.syncStatus,
              loading: false,
              error: err.message
            }
          })
          return { success: false, error: err.message }
        }
      },

      // Repair eggs with empty prompt_content, full_ai_prompt, or config in Supabase
      repairEggsInCloud: async () => {
        const client = get().getClient()

        if (!client) {
          get().addLog('error', 'Cannot repair eggs: Supabase not configured')
          return { success: false, error: 'Supabase not configured' }
        }

        get().addLog('sync', 'Starting repair of eggs with empty fields...')

        try {
          const result = await repairEggsData(client)

          if (result.success) {
            if (result.repaired > 0) {
              get().addLog('sync', `Repaired ${result.repaired}/${result.total} eggs with empty fields`)
              // Reload eggs to get the updated data
              await get().loadFromCloud()
            } else {
              get().addLog('sync', `All ${result.total} eggs have valid data, no repair needed`)
            }
          } else {
            get().addLog('error', `Failed to repair eggs: ${result.error}`)
          }

          return result
        } catch (err) {
          get().addLog('error', `Repair eggs error: ${err.message}`)
          return { success: false, error: err.message }
        }
      },

      // ===== LAB STATE (Backtest, Paper Trading, Benchmark) =====
      labActiveTab: 'backtest', // 'backtest' | 'paperTrade' | 'benchmark'
      labWizardOpen: false, // Triggers the wizard/create flow in the active Lab tab
      setLabActiveTab: (tab) => set({ labActiveTab: tab }),
      setLabWizardOpen: (open) => set({ labWizardOpen: open }),

      // Backtests
      backtests: [],
      activeBacktestId: null,
      isRunningBacktest: false,
      backtestProgress: null,

      addBacktest: (backtest) => {
        set((state) => ({
          backtests: [{ ...backtest, id: `bt-${Date.now()}`, createdAt: new Date().toISOString() }, ...state.backtests]
        }))
        get().triggerSync()
      },
      updateBacktest: (id, updates) => {
        set((state) => ({
          backtests: state.backtests.map(b => b.id === id ? { ...b, ...updates } : b)
        }))
        get().triggerSync()
      },
      deleteBacktest: (id) => {
        const client = get().getClient()
        if (client) deleteBacktestFromCloud(client, id).catch(err => console.error('Delete backtest from cloud error:', err))
        set((state) => ({
          backtests: state.backtests.filter(b => b.id !== id),
          activeBacktestId: state.activeBacktestId === id ? null : state.activeBacktestId
        }))
      },
      setActiveBacktest: (id) => set({ activeBacktestId: id }),

      // Paper Trading
      paperPortfolio: null,
      paperTradeActive: false,
      paperTradeStrategies: {}, // { promptId: { active, interval, lastRun } }

      initPaperPortfolio: (portfolio) => {
        set({ paperPortfolio: portfolio, paperTradeActive: true })
        get().triggerSync()
      },
      updatePaperPortfolio: (portfolio) => {
        set({ paperPortfolio: portfolio })
        get().triggerSync()
      },
      resetPaperPortfolio: (portfolio) => {
        set({
          paperPortfolio: portfolio,
          paperTradeStrategies: {}
        })
        get().triggerSync()
      },
      togglePaperStrategy: (promptId, config = {}) => {
        set((state) => {
          const current = state.paperTradeStrategies[promptId]
          return {
            paperTradeStrategies: {
              ...state.paperTradeStrategies,
              [promptId]: current?.active
                ? { ...current, active: false }
                : { active: true, interval: config.interval || '4h', allocation: config.allocation || 1000, lastRun: null }
            }
          }
        })
        get().triggerSync()
      },

      // Benchmarks
      benchmarks: [],
      activeBenchmarkId: null,
      isRunningBenchmark: false,
      benchmarkProgress: null,

      addBenchmark: (benchmark) => {
        set((state) => ({
          benchmarks: [{ ...benchmark, id: `bm-${Date.now()}`, createdAt: new Date().toISOString() }, ...state.benchmarks]
        }))
        get().triggerSync()
      },
      updateBenchmark: (id, updates) => {
        set((state) => ({
          benchmarks: state.benchmarks.map(b => b.id === id ? { ...b, ...updates } : b)
        }))
        get().triggerSync()
      },
      deleteBenchmark: (id) => {
        const client = get().getClient()
        if (client) deleteBenchmarkFromCloud(client, id).catch(err => console.error('Delete benchmark from cloud error:', err))
        set((state) => ({
          benchmarks: state.benchmarks.filter(b => b.id !== id),
          activeBenchmarkId: state.activeBenchmarkId === id ? null : state.activeBenchmarkId
        }))
      },
      setActiveBenchmark: (id) => set({ activeBenchmarkId: id }),

      // ─── Evolution System ────────────────────────────────────
      evolution: {
        generation: 0,
        rankings: [],           // [{rank, promptId, promptName, grade, score, backtestId, pnl, winRate}]
        history: [],            // [{generation, rankings, timestamp}]
        importedStrategies: [], // [{source, name, content}]
        importedLibraryIds: [], // IDs de estrategias de la biblioteca ya importadas (dedup)
        marketData: null,       // Binance Futures data cache
        status: 'idle',         // idle|importing|backtesting|evolving|feeding
        log: []                 // [{timestamp, message, type}]
      },

      setEvolutionStatus: (status) => set((state) => ({
        evolution: { ...state.evolution, status }
      })),

      addEvolutionLog: (message, type = 'info') => set((state) => ({
        evolution: {
          ...state.evolution,
          log: [...state.evolution.log, {
            timestamp: new Date().toISOString(),
            message,
            type // 'info' | 'success' | 'warning' | 'error'
          }].slice(-100) // Keep last 100 entries
        }
      })),

      clearEvolutionLog: () => set((state) => ({
        evolution: { ...state.evolution, log: [] }
      })),

      setEvolutionRankings: (rankings) => set((state) => ({
        evolution: { ...state.evolution, rankings }
      })),

      // Save tournament results to history WITHOUT incrementing generation
      // This preserves every tournament run so results are never lost
      saveTournamentToHistory: (rankings) => set((state) => ({
        evolution: {
          ...state.evolution,
          rankings,
          history: [...state.evolution.history, {
            generation: state.evolution.generation,
            rankings,
            timestamp: new Date().toISOString(),
            type: 'tournament'
          }].slice(-30) // Keep last 30 entries
        }
      })),

      // Increment generation + save to history (used after evolution creates new prompts)
      addEvolutionGeneration: (rankings) => set((state) => ({
        evolution: {
          ...state.evolution,
          generation: state.evolution.generation + 1,
          rankings,
          history: [...state.evolution.history, {
            generation: state.evolution.generation + 1,
            rankings,
            timestamp: new Date().toISOString(),
            type: 'evolution'
          }].slice(-30) // Keep last 30 entries
        }
      })),

      addImportedStrategy: (strategy) => set((state) => ({
        evolution: {
          ...state.evolution,
          importedStrategies: [...state.evolution.importedStrategies, strategy].slice(-50)
        }
      })),

      addImportedLibraryId: (id) => set((state) => ({
        evolution: {
          ...state.evolution,
          importedLibraryIds: [...new Set([...state.evolution.importedLibraryIds, id])]
        }
      })),

      setEvolutionMarketData: (data) => set((state) => ({
        evolution: { ...state.evolution, marketData: data }
      })),

      resetEvolution: () => set((state) => ({
        evolution: {
          generation: 0,
          rankings: [],
          history: [],
          importedStrategies: state.evolution.importedStrategies, // Keep imported
          importedLibraryIds: state.evolution.importedLibraryIds, // Keep library dedup
          marketData: state.evolution.marketData, // Keep market data
          status: 'idle',
          log: []
        }
      })),

      // Auto-sync helper (debounced in real usage)
      triggerSync: () => {
        const state = get()
        // Always sync if authenticated (we use hardcoded Supabase now)
        const client = state.getClient()
        if (client && state.isAuthenticated && !state.syncStatus.syncing) {
          // Debounce sync to avoid too many requests
          setTimeout(() => {
            get().syncToCloud()
          }, 1000)
        }
      },
    }),
    {
      name: 'prompthatcher-storage',
      // Persist settings locally including API keys
      partialize: (state) => ({
        onboardingCompleted: state.onboardingCompleted,
        settings: {
          supabase: state.settings.supabase,
          tradingPlatform: state.settings.tradingPlatform,
          apiKeys: state.settings.apiKeys,
          aiProvider: state.settings.aiProvider,
          gracePeriodEnabled: state.settings.gracePeriodEnabled,
          gracePeriodMinutes: state.settings.gracePeriodMinutes
        },
        // Lab data: slim + capped for localStorage safety (~5MB limit)
        // Full data stays in Zustand RAM + Supabase cloud
        backtests: state.backtests.slice(0, 10).map(slimBacktestForStorage),
        benchmarks: state.benchmarks.slice(0, 5).map(slimBenchmarkForStorage),
        paperPortfolio: state.paperPortfolio ? {
          ...state.paperPortfolio,
          history: (state.paperPortfolio.history || []).slice(-200)
        } : null,
        paperTradeStrategies: state.paperTradeStrategies,
        paperTradeActive: state.paperTradeActive,
        // Evolution: persist rankings + history but NOT marketData cache or session log
        evolution: slimEvolutionForStorage(state.evolution)
      }),
      // Deep merge settings to preserve default values for non-persisted properties
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...persistedState,
        settings: {
          ...currentState.settings,
          ...(persistedState?.settings || {}),
          // Ensure nested objects are properly merged
          supabase: {
            ...currentState.settings.supabase,
            ...(persistedState?.settings?.supabase || {})
          },
          tradingPlatform: {
            ...currentState.settings.tradingPlatform,
            ...(persistedState?.settings?.tradingPlatform || {})
          },
          // Restore persisted API keys, falling back to defaults if not set
          apiKeys: {
            ...currentState.settings.apiKeys,
            ...(persistedState?.settings?.apiKeys || {})
          }
        },
        // Lab data merge
        backtests: persistedState?.backtests || currentState.backtests,
        benchmarks: persistedState?.benchmarks || currentState.benchmarks,
        paperPortfolio: persistedState?.paperPortfolio || currentState.paperPortfolio,
        paperTradeStrategies: persistedState?.paperTradeStrategies || currentState.paperTradeStrategies,
        paperTradeActive: persistedState?.paperTradeActive || currentState.paperTradeActive,
        // Evolution merge — normalize old history entries + restore transient fields
        evolution: {
          ...currentState.evolution,
          ...(persistedState?.evolution || {}),
          // Transient fields not persisted — always reset on load
          marketData: null,
          status: 'idle',
          log: [],
          // Migrate old history entries: backfill type, rank, score, pnl, color
          history: (persistedState?.evolution?.history || []).map(entry => ({
            ...entry,
            type: entry.type || 'tournament',
            rankings: (entry.rankings || []).map((r, i) => ({
              ...r,
              rank: r.rank || i + 1,
              score: r.score ?? 0,
              pnl: r.pnl ?? 0,
              color: r.color || 'text-gray-400'
            }))
          }))
        }
      })
    }
  )
)

export default useStore
