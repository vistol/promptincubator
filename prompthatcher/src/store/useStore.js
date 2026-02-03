import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getSupabaseClient,
  syncPrompts,
  syncSignals,
  syncEggs,
  syncSettings,
  syncHealthChecks,
  loadPrompts,
  loadSignals,
  loadEggs,
  loadSettings,
  loadHealthChecks,
  deletePromptFromCloud,
  deleteEggFromCloud,
  deleteHealthCheckFromCloud,
  repairEggsData
} from '../lib/supabase'
import { generateTradesFromPrompt } from '../lib/aiService'
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
    name: 'Alpha Momentum',
    content: 'Analyze momentum indicators and volume patterns to identify high-probability breakout opportunities in crypto markets.',
    mode: 'auto',
    executionTime: 'intraday',
    capital: 1000,
    leverage: 5,
    aiModel: 'gemini',
    minIpe: 80,
    status: 'active',
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-20T14:00:00Z',
    trades: 24,
    winRate: 68,
    profitFactor: 2.1,
    totalPnl: 1250.50,
    maxDrawdown: 8.5
  },
  {
    id: 'prompt-2',
    name: 'Mean Reversion Pro',
    content: 'Identify oversold conditions using RSI, Bollinger Bands, and order flow to execute mean reversion trades.',
    mode: 'manual',
    executionTime: 'swing',
    capital: 2500,
    leverage: 3,
    aiModel: 'gemini',
    minIpe: 85,
    status: 'active',
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-22T16:30:00Z',
    trades: 12,
    winRate: 75,
    profitFactor: 2.8,
    totalPnl: 890.25,
    maxDrawdown: 5.2
  },
  {
    id: 'prompt-3',
    name: 'Scalp Hunter',
    content: 'Execute quick scalping trades based on order book imbalances and micro-structure analysis.',
    mode: 'auto',
    executionTime: 'scalping',
    capital: 500,
    leverage: 10,
    aiModel: 'openai',
    minIpe: 75,
    status: 'archived',
    createdAt: '2024-01-05T12:00:00Z',
    updatedAt: '2024-01-18T09:15:00Z',
    trades: 156,
    winRate: 52,
    profitFactor: 1.3,
    totalPnl: -120.75,
    maxDrawdown: 15.3
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
            maxDrawdown: 0
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

      // Generate trades from prompt using AI
      generateTrades: async (prompt) => {
        set({ isGeneratingTrades: true, generationError: null, pendingTrades: [] })

        const numResults = prompt.numResults || 3
        get().addLog('ai', `Generating ${numResults} trades using "${prompt.name}"...`)

        try {
          const trades = await generateTradesFromPrompt(prompt, get().settings, numResults)

          // Log each generated trade
          trades.forEach(trade => {
            get().addLog('ai', `Generated: ${trade.asset} ${trade.strategy} | Entry: $${trade.entry} | TP: $${trade.takeProfit} | SL: $${trade.stopLoss}`, trade)
          })

          get().addLog('ai', `AI generated ${trades.length} trade signals`)

          set({
            pendingTrades: trades,
            isGeneratingTrades: false
          })

          return { success: true, trades }
        } catch (error) {
          get().addLog('error', `AI generation failed: ${error.message}`)
          set({
            isGeneratingTrades: false,
            generationError: error.message
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

        // Create the egg with all prompt configuration
        const egg = {
          id: `egg-${Date.now()}`,
          promptId: prompt.id || `prompt-${Date.now()}`,
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
          results: null
        }

        set((state) => ({
          signals: [...newSignals, ...state.signals],
          eggs: [egg, ...state.eggs],
          pendingTrades: []
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
      resetSelectiveData: (options = {}) => {
        const {
          deletePrompts = false,
          deleteEggs = false,
          deleteSignals = false,
          deleteLogs = false,
          resetOnboarding = false,
          keepLinkedData = true // If true, keeps signals linked to eggs when deleting only prompts
        } = options

        const state = get()
        let newPrompts = state.prompts
        let newEggs = state.eggs
        let newSignals = state.signals
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
          activityLogs: newLogs,
          onboardingCompleted: newOnboarding
        })

        // Trigger sync if connected
        get().triggerSync()

        return {
          deletedPrompts: deletePrompts ? state.prompts.length : 0,
          deletedEggs: deleteEggs ? state.eggs.length : 0,
          deletedSignals: deleteSignals ? state.signals.length : 0,
          deletedLogs: deleteLogs ? state.activityLogs.length : 0
        }
      },

      // Get data counts for UI
      getDataCounts: () => {
        const state = get()
        const incubatingEggs = state.eggs.filter(e => e.status === 'incubating')
        const hatchedEggs = state.eggs.filter(e => e.status === 'hatched')
        const activeSignals = state.signals.filter(s => s.status === 'active')
        const closedSignals = state.signals.filter(s => s.status === 'closed')

        return {
          prompts: state.prompts.length,
          eggs: state.eggs.length,
          incubatingEggs: incubatingEggs.length,
          hatchedEggs: hatchedEggs.length,
          signals: state.signals.length,
          activeSignals: activeSignals.length,
          closedSignals: closedSignals.length,
          activityLogs: state.activityLogs.length
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
        aiModel: 'gemini-1.5-flash',
        apiKeys: {
          anthropic: '',
          google: '',
          openai: '',
          xai: ''
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
      updateApiKey: (provider, key) => set((state) => ({
        settings: {
          ...state.settings,
          apiKeys: { ...state.settings.apiKeys, [provider]: key }
        }
      })),
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

      // Fetch prices for all active trades
      fetchAllPrices: async () => {
        const state = get()
        const { primary, secondary } = state.settings.tradingPlatform

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

          // First price update - activate the trade but don't close it yet
          if (!signal.priceActivated) {
            activatedTrades.push({
              asset: signal.asset,
              strategy: signal.strategy,
              price: currentPrice,
              entry,
              tp,
              sl
            })
            return {
              ...signal,
              priceActivated: true,
              activatedPrice: currentPrice,
              currentPrice,
              unrealizedPnl: tradeStatus.pnlPercent
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
      showHealthCheckModal: false,
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
        const state = get()
        const { url, anonKey } = state.settings.supabase
        if (url && anonKey) {
          return getSupabaseClient(url, anonKey)
        }
        return null
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
          // Sync all data in parallel
          const [promptsResult, signalsResult, eggsResult, settingsResult, healthChecksResult] = await Promise.all([
            syncPrompts(client, state.prompts),
            syncSignals(client, state.signals),
            syncEggs(client, state.eggs),
            syncSettings(client, state.settings),
            syncHealthChecks(client, state.healthChecks)
          ])

          const hasError = !promptsResult.success || !signalsResult.success || !eggsResult.success || !settingsResult.success || !healthChecksResult.success
          const errorMsg = promptsResult.error || signalsResult.error || eggsResult.error || settingsResult.error || healthChecksResult.error

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
            get().addLog('sync', `Sync complete: ${state.prompts.length} prompts, ${state.signals.length} signals, ${state.eggs.length} eggs, ${state.healthChecks.length} health checks`)
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
          const [promptsResult, signalsResult, eggsResult, settingsResult, healthChecksResult] = await Promise.all([
            loadPrompts(client),
            loadSignals(client),
            loadEggs(client),
            loadSettings(client),
            loadHealthChecks(client)
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
            set((s) => ({
              settings: {
                ...s.settings,
                aiProvider: settingsResult.data.aiProvider || s.settings.aiProvider,
                aiModel: settingsResult.data.aiModel || s.settings.aiModel,
                systemPrompt: settingsResult.data.systemPrompt || s.settings.systemPrompt
              }
            }))
          }

          if (healthChecksResult.success) {
            get().addLog('sync', `Loaded ${healthChecksResult.data.length} health checks from cloud`)
            set({ healthChecks: healthChecksResult.data })
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

      // Auto-sync helper (debounced in real usage)
      triggerSync: () => {
        const state = get()
        if (state.settings.supabase.connected && !state.syncStatus.syncing) {
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
          aiProvider: state.settings.aiProvider
        }
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
        }
      })
    }
  )
)

export default useStore
