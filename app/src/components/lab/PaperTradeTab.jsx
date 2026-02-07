import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, TrendingUp, TrendingDown, Wallet, DollarSign, Activity,
  ArrowUpRight, ArrowDownRight, RefreshCw, Trash2, Info, Zap,
  Clock, Target, Shield, ChevronDown, ChevronUp, Loader2
} from 'lucide-react'
import useStore from '../../store/useStore'
import {
  createPortfolio, openPosition, updatePositions, closePosition, getPortfolioStats
} from '../../lib/paperTradingEngine'
import { generateTradesFromPrompt } from '../../lib/aiService'
import EquityCurve from './EquityCurve'

const BALANCE_PRESETS = [1000, 5000, 10000]

const HOW_IT_WORKS_STEPS = [
  { icon: Wallet, title: 'Crea un portfolio', desc: 'Defines cuanto dinero virtual quieres usar. No es dinero real.' },
  { icon: Zap, title: 'La AI genera trades', desc: 'Tu prompt analiza precios REALES de Binance y propone operaciones.' },
  { icon: Target, title: 'Se abren posiciones', desc: 'Los trades se abren con precios de mercado reales y se monitorean en vivo.' },
  { icon: Activity, title: 'Cierre automatico', desc: 'Cuando el precio toca Take Profit o Stop Loss, la posicion se cierra sola.' },
]

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `hace ${days}d`
}

const formatCloseReason = (reason) => {
  switch (reason) {
    case 'TP_HIT': return { label: 'Take Profit', color: 'text-accent-green', icon: '✓' }
    case 'SL_HIT': return { label: 'Stop Loss', color: 'text-accent-red', icon: '✗' }
    case 'MANUAL': return { label: 'Cierre manual', color: 'text-gray-400', icon: '•' }
    default: return { label: reason || 'Cerrado', color: 'text-gray-400', icon: '•' }
  }
}

export default function PaperTradeTab() {
  const paperPortfolio = useStore((s) => s.paperPortfolio)
  const updatePaperPortfolio = useStore((s) => s.updatePaperPortfolio)
  const prompts = useStore((s) => s.prompts) || []
  const prices = useStore((s) => s.prices) || {}
  const settings = useStore((s) => s.settings)

  const [showInit, setShowInit] = useState(false)
  const [initBalance, setInitBalance] = useState(10000)
  const [showNewTrade, setShowNewTrade] = useState(false)
  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [allocation, setAllocation] = useState(500)
  const [isGenerating, setIsGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState(null)
  const [genResult, setGenResult] = useState(null)
  const [subTab, setSubTab] = useState('positions')
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [expandedPosId, setExpandedPosId] = useState(null)

  const labWizardOpen = useStore((s) => s.labWizardOpen)
  const setLabWizardOpen = useStore((s) => s.setLabWizardOpen)

  const activePrompts = prompts.filter(p => p.status === 'active')

  // Listen for FAB trigger
  useEffect(() => {
    if (labWizardOpen) {
      if (paperPortfolio) {
        setShowNewTrade(true)
        setGenResult(null)
        setGenProgress(null)
      } else {
        setShowInit(true)
      }
      setLabWizardOpen(false)
    }
  }, [labWizardOpen])

  // Update positions with live prices
  useEffect(() => {
    if (!paperPortfolio) return

    const priceMap = {}
    for (const [symbol, data] of Object.entries(prices)) {
      priceMap[symbol] = data.price || data
    }

    if (Object.keys(priceMap).length > 0) {
      const updated = updatePositions(paperPortfolio, priceMap)
      const hasChanges = JSON.stringify(updated.positions) !== JSON.stringify(paperPortfolio.positions)
      if (hasChanges) {
        updatePaperPortfolio(updated)
      }
    }
  }, [prices])

  const stats = paperPortfolio ? getPortfolioStats(paperPortfolio) : null
  const openPositions = paperPortfolio?.positions?.filter(p => p.status === 'open') || []
  const history = paperPortfolio?.history || []

  const initializePortfolio = () => {
    updatePaperPortfolio(createPortfolio(initBalance))
    setShowInit(false)
  }

  const handleGenerateAndTrade = async () => {
    const prompt = prompts.find(p => p.id === selectedPromptId)
    if (!prompt || !paperPortfolio) return

    setIsGenerating(true)
    setGenProgress('Consultando precios de Binance...')
    setGenResult(null)

    try {
      setGenProgress('AI analizando mercado con tu estrategia...')
      let trades
      // Retry once on parse errors (Groq/Llama sometimes truncates JSON)
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          trades = await generateTradesFromPrompt(prompt, settings, 3, (event, step) => {
            if (event?.message) setGenProgress(event.message)
          })
          break // success
        } catch (retryErr) {
          if (attempt === 0 && retryErr.message?.includes('truncad')) {
            setGenProgress('Respuesta truncada, reintentando...')
            await new Promise(r => setTimeout(r, 1000))
            continue
          }
          throw retryErr
        }
      }
      if (!trades || trades.length === 0) {
        throw new Error('La AI no genero trades validos. Intenta de nuevo.')
      }

      setGenProgress('Abriendo posiciones virtuales...')

      let portfolio = { ...paperPortfolio }
      const opened = []
      for (const trade of trades) {
        const result = openPosition(portfolio, {
          ...trade,
          promptId: prompt.id,
          promptName: prompt.name
        }, {
          allocation,
          leverage: prompt.leverage || 5,
          takerFee: 0.001
        })

        if (!result.error) {
          portfolio = result.portfolio
          opened.push(result.position)
        }
      }

      updatePaperPortfolio(portfolio)
      setGenResult({ success: true, count: opened.length, trades: opened })
      setGenProgress(null)
    } catch (err) {
      console.error('Paper trade generation failed:', err)
      setGenResult({ success: false, error: err.message })
      setGenProgress(null)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleClosePosition = (posId) => {
    if (!paperPortfolio) return
    const pos = paperPortfolio.positions.find(p => p.id === posId)
    if (!pos) return

    const priceData = prices[pos.asset]
    const currentPrice = priceData?.price || priceData || pos.currentPrice

    const updated = closePosition(paperPortfolio, posId, currentPrice)
    updatePaperPortfolio(updated)
  }

  const handleReset = () => {
    updatePaperPortfolio(createPortfolio(paperPortfolio?.initialBalance || 10000))
    setShowConfirmReset(false)
  }

  // =============================================
  // NO PORTFOLIO — ONBOARDING
  // =============================================
  if (!paperPortfolio) {
    return (
      <div className="space-y-4">
        {/* How it works */}
        <div className="text-center pt-4 pb-2">
          <div className="w-12 h-12 rounded-2xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center mx-auto mb-3">
            <Wallet size={24} className="text-accent-cyan" />
          </div>
          <h2 className="text-base font-bold text-white mb-1">Paper Trading</h2>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Prueba tus estrategias con dinero virtual y precios reales de mercado
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-2 px-1">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-3 bg-quant-surface rounded-xl p-3">
              <div className="w-8 h-8 rounded-lg bg-quant-card border border-quant-border flex items-center justify-center shrink-0 mt-0.5">
                <step.icon size={14} className="text-accent-cyan" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">{step.title}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Create Portfolio */}
        {showInit ? (
          <div className="bg-quant-card border border-quant-border rounded-xl p-4 space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Balance inicial (virtual)</label>
              <div className="flex gap-2 mt-2">
                {BALANCE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setInitBalance(preset)}
                    className={`flex-1 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                      initBalance === preset
                        ? 'bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan'
                        : 'bg-quant-surface border border-quant-border text-gray-400'
                    }`}
                  >
                    ${preset.toLocaleString()}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={initBalance}
                onChange={(e) => setInitBalance(parseInt(e.target.value) || 1000)}
                className="w-full mt-2 bg-quant-surface border border-quant-border rounded-lg px-3 py-2 text-sm text-white font-mono text-center"
              />
            </div>
            <button
              onClick={initializePortfolio}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-sm"
            >
              Crear Portfolio Virtual
            </button>
            <p className="text-[9px] text-gray-600 text-center">
              Este dinero es 100% ficticio. No se usa dinero real.
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowInit(true)}
            className="w-full py-3 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-sm font-medium"
          >
            <Plus size={14} className="inline mr-1" />
            Comenzar Paper Trading
          </button>
        )}
      </div>
    )
  }

  // =============================================
  // HAS PORTFOLIO — MAIN VIEW
  // =============================================
  return (
    <div className="space-y-3">
      {/* Portfolio Summary Card */}
      <div className="bg-quant-card border border-quant-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-cyan/10 text-accent-cyan font-bold uppercase tracking-wider">
              Dinero Virtual
            </span>
          </div>
          <button
            onClick={() => setShowConfirmReset(true)}
            className="text-[9px] text-gray-600 hover:text-accent-red transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-2">
          <div>
            <div className="text-xl font-mono font-bold text-white">
              ${stats?.equity?.toFixed(0) || '0'}
            </div>
            <div className="text-[10px] text-gray-500">Equity</div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-mono font-bold ${(stats?.allTimePnlPercent || 0) >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
              {(stats?.allTimePnlPercent || 0) >= 0 ? '+' : ''}{(stats?.allTimePnlPercent || 0).toFixed(2)}%
            </div>
            <div className="text-[10px] text-gray-500">
              {(stats?.allTimePnl || 0) >= 0 ? '+' : ''}${(stats?.allTimePnl || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Abiertas', value: stats?.openPositions || 0, color: 'text-accent-cyan' },
            { label: 'Win Rate', value: `${(stats?.winRate || 0).toFixed(0)}%`, color: 'text-white' },
            { label: 'PF', value: (stats?.profitFactor || 0) === Infinity ? '∞' : (stats?.profitFactor || 0).toFixed(2), color: 'text-white' },
            { label: 'Trades', value: stats?.totalTrades || 0, color: 'text-white' },
          ].map((s) => (
            <div key={s.label} className="bg-quant-surface rounded-lg p-1.5 text-center">
              <div className={`text-[10px] font-mono font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[8px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-quant-surface rounded-lg p-0.5">
        {[
          { id: 'positions', label: `Posiciones (${openPositions.length})` },
          { id: 'history', label: `Historial (${history.length})` },
          { id: 'info', label: 'Info' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-medium transition-all ${
              subTab === tab.id ? 'bg-quant-card text-white shadow' : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ POSITIONS TAB ============ */}
      {subTab === 'positions' && (
        <div className="space-y-2">
          {openPositions.length > 0 && (
            <p className="text-[9px] text-gray-600 px-1">
              Se actualizan con precios de Binance en vivo. Se cierran al tocar TP o SL.
            </p>
          )}

          {openPositions.length === 0 ? (
            <div className="text-center py-6">
              <Activity size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-1">Sin posiciones abiertas</p>
              <p className="text-[10px] text-gray-600">Genera trades con tu prompt para abrir posiciones</p>
            </div>
          ) : (
            openPositions.map((pos) => {
              const isProfitable = (pos.unrealizedPnlPercent || 0) >= 0
              const entry = pos.entry
              const tp = pos.takeProfit
              const sl = pos.stopLoss
              const current = pos.currentPrice || entry
              const isExpanded = expandedPosId === pos.id

              // Progress towards TP or SL
              let progressPct = 50
              if (pos.strategy === 'LONG') {
                const totalRange = tp - sl
                progressPct = totalRange > 0 ? ((current - sl) / totalRange) * 100 : 50
              } else {
                const totalRange = sl - tp
                progressPct = totalRange > 0 ? ((sl - current) / totalRange) * 100 : 50
              }
              progressPct = Math.max(0, Math.min(100, progressPct))

              // PnL in dollars
              const pnlDollar = pos.unrealizedPnl || 0

              return (
                <div key={pos.id} className="bg-quant-card border border-quant-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedPosId(isExpanded ? null : pos.id)}
                    className="w-full p-3 text-left"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 ${
                          pos.strategy === 'LONG'
                            ? 'bg-accent-green/10 text-accent-green'
                            : 'bg-accent-red/10 text-accent-red'
                        }`}>
                          {pos.strategy === 'LONG' ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                          {pos.strategy}
                        </span>
                        <span className="text-sm font-medium text-white">{pos.asset}</span>
                        <span className="text-[9px] text-gray-600">{formatTimeAgo(pos.openedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className={`text-sm font-mono font-bold ${isProfitable ? 'text-accent-green' : 'text-accent-red'}`}>
                            {isProfitable ? '+' : ''}{(pos.unrealizedPnlPercent || 0).toFixed(2)}%
                          </span>
                          <div className={`text-[9px] font-mono ${isProfitable ? 'text-accent-green/70' : 'text-accent-red/70'}`}>
                            {pnlDollar >= 0 ? '+' : ''}${pnlDollar.toFixed(2)}
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={12} className="text-gray-500" /> : <ChevronDown size={12} className="text-gray-500" />}
                      </div>
                    </div>

                    {/* TP/SL progress bar */}
                    <div className="relative">
                      <div className="h-2 bg-quant-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isProfitable ? 'bg-accent-green' : 'bg-accent-red'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      {/* Price marker */}
                      <div
                        className="absolute top-0 w-0.5 h-2 bg-white rounded-full"
                        style={{ left: `${progressPct}%`, transform: 'translateX(-50%)' }}
                      />
                      <div className="flex justify-between mt-1">
                        <span className="text-[8px] text-accent-red font-mono">SL ${sl.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                        <span className="text-[8px] text-gray-500 font-mono">${current.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                        <span className="text-[8px] text-accent-green font-mono">TP ${tp.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-quant-border"
                      >
                        <div className="p-3 space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div className="bg-quant-surface rounded-lg p-2 text-center">
                              <div className="text-gray-500">Entrada</div>
                              <div className="text-white font-mono">${entry.toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                            </div>
                            <div className="bg-quant-surface rounded-lg p-2 text-center">
                              <div className="text-gray-500">Margen</div>
                              <div className="text-white font-mono">${pos.margin.toFixed(0)}</div>
                            </div>
                            <div className="bg-quant-surface rounded-lg p-2 text-center">
                              <div className="text-gray-500">Leverage</div>
                              <div className="text-white font-mono">{pos.leverage}x</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-gray-600">via {pos.promptName}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleClosePosition(pos.id) }}
                              className="px-3 py-1.5 rounded-lg text-[10px] text-gray-400 hover:text-accent-red hover:bg-accent-red/10 transition-all border border-quant-border"
                            >
                              Cerrar posicion
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })
          )}

          <button
            onClick={() => { setShowNewTrade(true); setGenResult(null); setGenProgress(null) }}
            className="w-full p-3 rounded-xl border border-dashed border-quant-border text-gray-400 text-xs hover:border-accent-cyan hover:text-accent-cyan transition-all"
          >
            <Plus size={14} className="inline mr-1" />
            Generar nuevos trades
          </button>
        </div>
      )}

      {/* ============ HISTORY TAB ============ */}
      {subTab === 'history' && (
        <div className="space-y-1.5">
          {history.length === 0 ? (
            <div className="text-center py-6">
              <Clock size={24} className="text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500 mb-1">Sin historial</p>
              <p className="text-[10px] text-gray-600">Los trades cerrados apareceran aqui</p>
            </div>
          ) : (
            history.slice().reverse().map((h, i) => {
              const reason = formatCloseReason(h.closeReason)
              const isProfitable = (h.realizedPnl || 0) >= 0
              return (
                <div key={i} className="bg-quant-surface rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                        h.strategy === 'LONG' ? 'text-accent-green' : 'text-accent-red'
                      }`}>
                        {h.strategy}
                      </span>
                      <span className="text-xs text-white font-medium">{h.asset}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-mono font-bold ${isProfitable ? 'text-accent-green' : 'text-accent-red'}`}>
                        {isProfitable ? '+' : ''}${(h.realizedPnl || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-2 text-gray-500">
                      <span className={reason.color}>
                        {reason.icon} {reason.label}
                      </span>
                      <span>via {h.promptName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className={`font-mono ${isProfitable ? 'text-accent-green/60' : 'text-accent-red/60'}`}>
                        {(h.realizedPnlPercent || 0) >= 0 ? '+' : ''}{(h.realizedPnlPercent || 0).toFixed(1)}%
                      </span>
                      {h.closedAt && (
                        <span>{new Date(h.closedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ============ INFO TAB ============ */}
      {subTab === 'info' && (
        <div className="space-y-3">
          {/* How it works */}
          <div className="bg-quant-card border border-quant-border rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Info size={10} />
              Como funciona Paper Trade
            </p>
            <div className="space-y-2">
              {HOW_IT_WORKS_STEPS.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-md bg-accent-cyan/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-accent-cyan">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-white">{step.title}</p>
                    <p className="text-[9px] text-gray-500">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategy stats */}
          <div className="bg-quant-card border border-quant-border rounded-xl p-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
              Rendimiento por estrategia
            </p>
            {Object.entries(paperPortfolio.strategies || {}).length === 0 ? (
              <p className="text-[10px] text-gray-600 text-center py-3">Las estadisticas aparecen cuando se cierran trades</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(paperPortfolio.strategies).map(([name, s]) => (
                  <div key={name} className="bg-quant-surface rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white">{name}</span>
                      <span className={`text-xs font-mono font-bold ${s.pnl >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                        {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-gray-500">
                      <span>{s.trades} trades</span>
                      <span>{s.wins}W / {s.losses}L</span>
                      <span>{s.trades > 0 ? ((s.wins / s.trades) * 100).toFixed(0) : 0}% win</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Portfolio info */}
          <div className="bg-quant-surface rounded-xl p-3 text-[10px] text-gray-500 space-y-1">
            <div className="flex justify-between"><span>Balance inicial</span><span className="text-white font-mono">${paperPortfolio.initialBalance.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Balance actual</span><span className="text-white font-mono">${stats?.balance?.toFixed(0)}</span></div>
            <div className="flex justify-between"><span>Margen en uso</span><span className="text-white font-mono">${stats?.totalMarginUsed?.toFixed(0)}</span></div>
            <div className="flex justify-between"><span>Disponible</span><span className="text-accent-cyan font-mono">${stats?.availableMargin?.toFixed(0)}</span></div>
            <div className="flex justify-between"><span>Fees totales</span><span className="text-gray-400 font-mono">${paperPortfolio.totalFees?.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Creado</span><span className="text-gray-400">{new Date(paperPortfolio.createdAt).toLocaleDateString('es-ES')}</span></div>
          </div>
        </div>
      )}

      {/* ============ GENERATE TRADE MODAL ============ */}
      <AnimatePresence>
        {showNewTrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !isGenerating && setShowNewTrade(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-quant-card rounded-t-3xl max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 flex items-center justify-between border-b border-quant-border shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white">Generar Trades</h2>
                  <p className="text-[10px] text-gray-500">La AI analiza precios reales y abre posiciones virtuales</p>
                </div>
                {!isGenerating && (
                  <button onClick={() => setShowNewTrade(false)} className="p-2 rounded-full hover:bg-quant-surface">
                    <X size={18} className="text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Generation result */}
                {genResult && (
                  <div className={`rounded-xl p-3 border ${genResult.success ? 'bg-accent-green/5 border-accent-green/20' : 'bg-accent-red/5 border-accent-red/20'}`}>
                    {genResult.success ? (
                      <>
                        <p className="text-xs text-accent-green font-medium mb-2">
                          ✓ {genResult.count} posiciones abiertas
                        </p>
                        <div className="space-y-1">
                          {genResult.trades?.map((t, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px]">
                              <span className="text-gray-300">
                                <span className={t.strategy === 'LONG' ? 'text-accent-green' : 'text-accent-red'}>
                                  {t.strategy}
                                </span> {t.asset}
                              </span>
                              <span className="text-gray-400 font-mono">${t.margin.toFixed(0)} margin</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-accent-red">{genResult.error}</p>
                    )}
                  </div>
                )}

                {/* Progress */}
                {isGenerating && (
                  <div className="text-center py-4">
                    <Loader2 size={28} className="text-accent-cyan animate-spin mx-auto mb-3" />
                    <p className="text-xs text-gray-400">{genProgress || 'Procesando...'}</p>
                  </div>
                )}

                {/* Form (hide when generating or showing result) */}
                {!isGenerating && !genResult && (
                  <>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Elige un prompt</label>
                      <p className="text-[9px] text-gray-600 mb-1.5">La AI usara esta estrategia para encontrar trades</p>
                      <div className="space-y-1.5">
                        {activePrompts.length === 0 ? (
                          <p className="text-[10px] text-gray-500 text-center py-4">No hay prompts activos. Crea uno primero.</p>
                        ) : (
                          activePrompts.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => setSelectedPromptId(p.id)}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all ${
                                selectedPromptId === p.id
                                  ? 'bg-accent-cyan/10 border-accent-cyan/30'
                                  : 'bg-quant-surface border-quant-border'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full border-2 ${selectedPromptId === p.id ? 'border-accent-cyan bg-accent-cyan' : 'border-gray-500'}`} />
                                <span className="text-xs font-medium text-white">{p.name}</span>
                              </div>
                              <p className="text-[9px] text-gray-500 mt-0.5 ml-5">
                                {p.aiModel || 'google'} · ${p.capital || 1000} · {p.leverage || 5}x
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider">Margen por trade</label>
                      <p className="text-[9px] text-gray-600 mb-1">Cuanto capital virtual asignar a cada posicion</p>
                      <input
                        type="number"
                        value={allocation}
                        onChange={(e) => setAllocation(parseInt(e.target.value) || 100)}
                        className="w-full bg-quant-surface border border-quant-border rounded-lg px-3 py-2 text-sm text-white font-mono"
                      />
                      <p className="text-[9px] text-gray-600 mt-1">
                        Disponible: <span className="text-accent-cyan font-mono">${(stats?.availableMargin || 0).toFixed(0)}</span>
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="px-4 pb-6 pt-2 border-t border-quant-border shrink-0 safe-area-bottom">
                {genResult ? (
                  <button
                    onClick={() => setShowNewTrade(false)}
                    className="w-full py-3 rounded-xl bg-quant-surface border border-quant-border text-sm text-gray-300 font-medium"
                  >
                    Cerrar
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateAndTrade}
                    disabled={!selectedPromptId || isGenerating}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-sm disabled:opacity-40"
                  >
                    {isGenerating ? (
                      <><Loader2 size={14} className="inline mr-1 animate-spin" /> Generando...</>
                    ) : (
                      <>
                        <Zap size={14} className="inline mr-1" />
                        Generar y Abrir Posiciones
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ RESET CONFIRMATION ============ */}
      <AnimatePresence>
        {showConfirmReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirmReset(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-72 bg-quant-card border border-quant-border rounded-2xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-bold text-white mb-2">Reiniciar Portfolio?</h3>
              <p className="text-[10px] text-gray-400 mb-4">
                Se borraran todas las posiciones, historial y el balance volvera a ${paperPortfolio?.initialBalance?.toLocaleString()}.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowConfirmReset(false)} className="flex-1 py-2 rounded-xl bg-quant-surface text-xs text-gray-400">Cancelar</button>
                <button onClick={handleReset} className="flex-1 py-2 rounded-xl bg-accent-red/20 text-xs text-accent-red font-medium">Reiniciar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
