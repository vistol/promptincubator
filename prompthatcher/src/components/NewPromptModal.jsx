import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, PenTool, Clock, DollarSign, Cpu, Target, Hash, ArrowRight, ArrowLeft, BookOpen, AlertTriangle, Zap, AlertCircle, Check, Sparkles, FileText } from 'lucide-react'
import useStore from '../store/useStore'
import TradeSelectionModal from './TradeSelectionModal'

// Execution time options
const executionTimes = [
  { id: 'target', label: 'Target', desc: 'Until TP/SL', icon: '🎯' },
  { id: 'scalping', label: 'Scalp', desc: '15m-1h', icon: '⚡' },
  { id: 'intraday', label: 'Intraday', desc: '4-24h', icon: '☀️' },
  { id: 'swing', label: 'Swing', desc: '2-7d', icon: '🌊' },
]

// AI Providers config
const AI_PROVIDERS = [
  { id: 'anthropic', label: 'Claude', icon: '🧠' },
  { id: 'google', label: 'Gemini', icon: '🔮' },
  { id: 'openai', label: 'GPT-4', icon: '🤖' },
  { id: 'xai', label: 'Grok', icon: '⚡' },
]

// Target profit presets
const targetPresets = [
  { pct: 5, label: '5%' },
  { pct: 10, label: '10%' },
  { pct: 25, label: '25%' },
  { pct: 50, label: '50%' },
  { pct: 100, label: '2x' },
]

// Loss limit presets
const lossLimitPresets = [
  { pct: 2, label: '2%' },
  { pct: 5, label: '5%' },
  { pct: 10, label: '10%' },
  { pct: 15, label: '15%' },
  { pct: 25, label: '25%' },
]

// Calculate estimated time and risk
const calculateEstimate = (targetPct, leverage) => {
  const dailyVolatility = 3.5
  const effectiveMovement = targetPct / leverage
  const estimatedDays = effectiveMovement / dailyVolatility

  let risk = 'low'
  let riskColor = 'text-accent-green'
  if (leverage >= 20) {
    risk = 'extreme'
    riskColor = 'text-accent-red'
  } else if (leverage >= 10) {
    risk = 'high'
    riskColor = 'text-accent-orange'
  } else if (leverage >= 5) {
    risk = 'medium'
    riskColor = 'text-accent-yellow'
  }

  let timeStr = ''
  if (estimatedDays < 0.04) {
    timeStr = `~${Math.round(estimatedDays * 24 * 60)}min`
  } else if (estimatedDays < 1) {
    timeStr = `~${Math.round(estimatedDays * 24)}h`
  } else if (estimatedDays < 7) {
    timeStr = `~${estimatedDays.toFixed(1)}d`
  } else {
    timeStr = `~${Math.round(estimatedDays / 7)}w`
  }

  const liquidationMove = (100 / leverage).toFixed(1)
  return { timeStr, risk, riskColor, liquidationMove, estimatedDays }
}

// Loading messages
const LOADING_MESSAGES = [
  { text: 'Warming up the incubator...', icon: '🔥' },
  { text: 'Analyzing market DNA...', icon: '🧬' },
  { text: 'Consulting the trading oracle...', icon: '🔮' },
  { text: 'Hatching brilliant ideas...', icon: '💡' },
  { text: 'Scanning for golden opportunities...', icon: '✨' },
  { text: 'Cracking the market code...', icon: '🥚' },
  { text: 'Feeding the AI neurons...', icon: '🧠' },
  { text: 'Calibrating profit sensors...', icon: '📡' },
  { text: 'Preparing your nest egg...', icon: '🪺' },
  { text: 'Almost ready to hatch...', icon: '🐣' },
]

export default function NewPromptModal() {
  const { setNewPromptModalOpen, generateTrades, prompts, settings, isGeneratingTrades } = useStore()

  // Steps: 'strategy' -> 'config' -> 'selection'
  const [step, setStep] = useState('strategy')

  // Strategy selection
  const [mode, setMode] = useState('library') // 'library' or 'manual'
  const [selectedPromptId, setSelectedPromptId] = useState(null)
  const [manualName, setManualName] = useState('')
  const [manualContent, setManualContent] = useState('')

  // Execution config (step 2)
  const [executionTime, setExecutionTime] = useState('target')
  const [capital, setCapital] = useState(1000)
  const [leverage, setLeverage] = useState(5)
  const [targetPct, setTargetPct] = useState(10)
  const [lossLimitPct, setLossLimitPct] = useState(5)
  const [minIpe, setMinIpe] = useState(80)
  const [numResults, setNumResults] = useState(3)

  // Loading state
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0)
  const [currentPrompt, setCurrentPrompt] = useState(null)

  // Cycle loading messages
  useEffect(() => {
    if (isGeneratingTrades) {
      const interval = setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
      }, 2000)
      return () => clearInterval(interval)
    } else {
      setLoadingMsgIndex(0)
    }
  }, [isGeneratingTrades])

  // Get configured AI providers
  const configuredProviders = useMemo(() => {
    return AI_PROVIDERS.filter(provider => {
      const apiKey = settings?.apiKeys?.[provider.id]
      return apiKey && apiKey.length > 0
    })
  }, [settings?.apiKeys])

  // Default AI provider
  const [aiProvider, setAiProvider] = useState(() => {
    if (settings?.apiKeys?.[settings?.aiProvider]) {
      return settings.aiProvider
    }
    const firstConfigured = AI_PROVIDERS.find(p => settings?.apiKeys?.[p.id])
    return firstConfigured?.id || 'google'
  })

  const hasConfiguredProvider = configuredProviders.length > 0

  // Get saved prompts
  const savedPrompts = useMemo(() => {
    return [...prompts]
  }, [prompts])

  // Selected strategy info
  const selectedStrategy = useMemo(() => {
    if (mode === 'library' && selectedPromptId) {
      return prompts.find(p => p.id === selectedPromptId)
    }
    if (mode === 'manual' && manualName.trim()) {
      return { name: manualName.trim(), content: manualContent.trim() || manualName.trim() }
    }
    return null
  }, [mode, selectedPromptId, manualName, manualContent, prompts])

  // Estimate for target mode
  const estimate = useMemo(() => {
    if (executionTime === 'target') {
      return calculateEstimate(targetPct, leverage)
    }
    return null
  }, [targetPct, leverage, executionTime])

  // Live estimates of gains and losses based on capital
  const liveEstimates = useMemo(() => {
    if (executionTime === 'target') {
      const estimatedGain = capital * (targetPct / 100)
      const estimatedLoss = capital * (lossLimitPct / 100)
      return { estimatedGain, estimatedLoss }
    }
    return null
  }, [capital, targetPct, lossLimitPct, executionTime])

  // Can proceed to next step
  const canProceedToConfig = selectedStrategy !== null
  const canExecute = hasConfiguredProvider && selectedStrategy !== null

  // Handle strategy selection
  const handleSelectPrompt = (prompt) => {
    setSelectedPromptId(prompt.id)
  }

  // Go to config step
  const handleProceedToConfig = () => {
    if (canProceedToConfig) {
      setStep('config')
    }
  }

  // Execute and generate trades
  const handleExecute = async () => {
    if (!canExecute) return

    const promptToUse = {
      id: selectedStrategy.id || `prompt-${Date.now()}`,
      name: selectedStrategy.name,
      content: selectedStrategy.content,
      executionTime,
      capital,
      leverage,
      aiModel: aiProvider,
      minIpe,
      numResults,
      targetPct: executionTime === 'target' ? targetPct : null,
      lossLimitPct: executionTime === 'target' ? lossLimitPct : null
    }

    setCurrentPrompt(promptToUse)
    await generateTrades(promptToUse)
    setStep('selection')
  }

  // Navigation
  const handleBack = () => {
    if (step === 'config') {
      setStep('strategy')
    }
  }

  const handleClose = () => {
    setNewPromptModalOpen(false)
  }

  // Trade selection complete
  if (step === 'selection' && currentPrompt) {
    return (
      <TradeSelectionModal
        prompt={currentPrompt}
        onClose={() => setStep('config')}
        onComplete={handleClose}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-quant-card rounded-t-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-quant-border">
          <div className="flex items-center gap-3">
            {step === 'config' && (
              <button
                onClick={handleBack}
                className="p-2.5 -ml-1 rounded-full hover:bg-quant-surface transition-colors active:scale-90"
              >
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-white">
                {step === 'strategy' ? 'Select Strategy' : 'Configure Execution'}
              </h2>
              <p className="text-[10px] text-gray-500">
                {step === 'strategy' ? 'Step 1 of 2 • Choose what to analyze' : 'Step 2 of 2 • Set execution parameters'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-3 -mr-1 rounded-full hover:bg-quant-surface transition-colors active:scale-90"
          >
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        {/* Step Progress */}
        <div className="shrink-0 px-4 py-2 flex gap-2">
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'strategy' ? 'bg-accent-cyan' : 'bg-accent-cyan'}`} />
          <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'config' ? 'bg-accent-cyan' : 'bg-quant-surface'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <AnimatePresence mode="wait">
            {/* STEP 1: Strategy Selection */}
            {step === 'strategy' && (
              <motion.div
                key="strategy"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="px-4 py-3 space-y-4"
              >
                {/* Mode Toggle */}
                <div className="flex bg-quant-surface rounded-xl p-1">
                  <button
                    onClick={() => setMode('library')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                      mode === 'library' ? 'bg-quant-card text-accent-cyan shadow-lg' : 'text-gray-500'
                    }`}
                  >
                    <BookOpen size={16} />
                    <span className="text-sm font-medium">Library ({savedPrompts.length})</span>
                  </button>
                  <button
                    onClick={() => setMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
                      mode === 'manual' ? 'bg-quant-card text-accent-cyan shadow-lg' : 'text-gray-500'
                    }`}
                  >
                    <PenTool size={16} />
                    <span className="text-sm font-medium">Write New</span>
                  </button>
                </div>

                {/* Library Mode */}
                {mode === 'library' && (
                  <div className="space-y-2">
                    {savedPrompts.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-quant-surface flex items-center justify-center">
                          <FileText size={28} className="text-gray-600" />
                        </div>
                        <p className="text-sm text-gray-400 mb-1">No saved strategies</p>
                        <p className="text-xs text-gray-600">Write a new one or create strategies in Settings</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedPrompts.map((prompt) => {
                          const isSelected = selectedPromptId === prompt.id
                          return (
                            <button
                              key={prompt.id}
                              onClick={() => handleSelectPrompt(prompt)}
                              className={`w-full p-4 rounded-xl border text-left transition-all ${
                                isSelected
                                  ? 'border-accent-cyan bg-accent-cyan/5 shadow-lg shadow-accent-cyan/10'
                                  : 'border-quant-border bg-quant-surface hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                      {prompt.name}
                                    </span>
                                  </div>
                                  {prompt.content && (
                                    <p className="text-xs text-gray-500 line-clamp-2">{prompt.content}</p>
                                  )}
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                  isSelected ? 'border-accent-cyan bg-accent-cyan' : 'border-gray-600'
                                }`}>
                                  {isSelected && <Check size={12} className="text-quant-bg" />}
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Mode */}
                {mode === 'manual' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Strategy Name
                      </label>
                      <input
                        type="text"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="e.g., RSI Oversold Bounce"
                        className="w-full bg-quant-surface border border-quant-border rounded-xl px-3 py-3 text-sm text-white placeholder-gray-500 focus:border-accent-cyan focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
                        Strategy Description
                      </label>
                      <textarea
                        value={manualContent}
                        onChange={(e) => setManualContent(e.target.value)}
                        placeholder="Describe your trading strategy...

Example: Find cryptocurrencies with RSI below 30 on the 4H timeframe, near historical support levels, with increasing volume."
                        rows={6}
                        className="w-full bg-quant-surface border border-quant-border rounded-xl px-3 py-3 text-sm text-white placeholder-gray-500 resize-none focus:border-accent-cyan focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Selected Strategy Preview */}
                {selectedStrategy && (
                  <div className="p-3 bg-accent-cyan/5 border border-accent-cyan/20 rounded-xl">
                    <div className="flex items-center gap-2 text-accent-cyan text-xs mb-1">
                      <Sparkles size={12} />
                      <span className="uppercase tracking-wider font-medium">Selected Strategy</span>
                    </div>
                    <p className="text-sm text-white font-medium">{selectedStrategy.name}</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP 2: Configuration */}
            {step === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-4 py-3 space-y-4"
              >
                {/* Strategy Summary */}
                <div className="p-3 bg-quant-surface rounded-xl border border-quant-border">
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] uppercase tracking-wider mb-1">
                    <FileText size={10} />
                    Strategy
                  </div>
                  <p className="text-sm text-white font-medium">{selectedStrategy?.name}</p>
                  {selectedStrategy?.content && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{selectedStrategy.content}</p>
                  )}
                </div>

                {/* Execution Time */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock size={10} /> Execution Type
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {executionTimes.map((time) => (
                      <button
                        key={time.id}
                        onClick={() => setExecutionTime(time.id)}
                        className={`py-3 px-2 rounded-xl border text-center transition-all ${
                          executionTime === time.id
                            ? 'border-accent-cyan bg-accent-cyan/10 text-white'
                            : 'border-quant-border bg-quant-surface text-gray-500 hover:border-gray-600'
                        }`}
                      >
                        <span className="block text-lg mb-1">{time.icon}</span>
                        <span className="block text-xs font-medium">{time.label}</span>
                        <span className="text-[9px] opacity-60">{time.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Mode Options */}
                {executionTime === 'target' && (
                  <div className="bg-quant-surface rounded-xl p-3 border border-quant-border space-y-4">
                    {/* Take Profit Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <Target size={10} /> Take Profit
                        </label>
                        <span className="text-accent-green font-mono font-bold text-sm">+{targetPct}%</span>
                      </div>

                      <div className="flex gap-1.5 mb-2">
                        {targetPresets.map((preset) => (
                          <button
                            key={preset.pct}
                            onClick={() => setTargetPct(preset.pct)}
                            className={`flex-1 py-2 rounded-lg text-xs font-mono transition-all ${
                              targetPct === preset.pct
                                ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
                                : 'bg-quant-card text-gray-400 border border-transparent hover:border-gray-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <input
                        type="range"
                        min={1}
                        max={200}
                        value={targetPct}
                        onChange={(e) => setTargetPct(Number(e.target.value))}
                        className="w-full h-1"
                      />
                    </div>

                    {/* Loss Limit Section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                          <AlertTriangle size={10} /> Loss Limit
                        </label>
                        <span className="text-accent-red font-mono font-bold text-sm">-{lossLimitPct}%</span>
                      </div>

                      <div className="flex gap-1.5 mb-2">
                        {lossLimitPresets.map((preset) => (
                          <button
                            key={preset.pct}
                            onClick={() => setLossLimitPct(preset.pct)}
                            className={`flex-1 py-2 rounded-lg text-xs font-mono transition-all ${
                              lossLimitPct === preset.pct
                                ? 'bg-accent-red/20 text-accent-red border border-accent-red/30'
                                : 'bg-quant-card text-gray-400 border border-transparent hover:border-gray-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <input
                        type="range"
                        min={1}
                        max={50}
                        value={lossLimitPct}
                        onChange={(e) => setLossLimitPct(Number(e.target.value))}
                        className="w-full h-1"
                      />
                    </div>

                    {/* Live Estimates Based on Capital */}
                    {liveEstimates && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-accent-green/10 border border-accent-green/20 rounded-lg p-3 text-center">
                          <span className="text-[9px] text-gray-400 block mb-1">Potential Gain</span>
                          <span className="text-lg font-mono font-bold text-accent-green">
                            +${liveEstimates.estimatedGain.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-gray-500 block mt-0.5">
                            if TP hits at +{targetPct}%
                          </span>
                        </div>
                        <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg p-3 text-center">
                          <span className="text-[9px] text-gray-400 block mb-1">Max Loss</span>
                          <span className="text-lg font-mono font-bold text-accent-red">
                            -${liveEstimates.estimatedLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="text-[10px] text-gray-500 block mt-0.5">
                            if SL hits at -{lossLimitPct}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Risk/Reward Ratio */}
                    {liveEstimates && (
                      <div className="flex items-center justify-center gap-2 py-2 bg-quant-card rounded-lg">
                        <span className="text-[10px] text-gray-500">Risk/Reward Ratio</span>
                        <span className="text-sm font-mono font-bold text-white">
                          1:{(targetPct / lossLimitPct).toFixed(1)}
                        </span>
                        {targetPct / lossLimitPct >= 2 && (
                          <span className="text-[9px] text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">Good</span>
                        )}
                        {targetPct / lossLimitPct < 1 && (
                          <span className="text-[9px] text-accent-red bg-accent-red/10 px-1.5 py-0.5 rounded">Poor</span>
                        )}
                      </div>
                    )}

                    {estimate && estimate.risk !== 'low' && (
                      <div className={`flex items-center gap-1.5 p-2 rounded-lg text-[10px] ${
                        estimate.risk === 'extreme' ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-orange/10 text-accent-orange'
                      }`}>
                        <AlertTriangle size={12} />
                        Higher leverage = faster target but increased liquidation risk
                      </div>
                    )}
                  </div>
                )}

                {/* Capital & Leverage */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <DollarSign size={10} /> Capital
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        value={capital}
                        onChange={(e) => setCapital(Number(e.target.value))}
                        className="w-full bg-quant-surface border border-quant-border rounded-xl pl-7 pr-3 py-3 text-sm text-white font-mono focus:border-accent-cyan focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Zap size={10} /> Leverage
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={leverage}
                        onChange={(e) => setLeverage(Math.max(1, Math.min(125, Number(e.target.value))))}
                        min={1}
                        max={125}
                        className="w-full bg-quant-surface border border-quant-border rounded-xl px-3 py-3 text-sm text-white font-mono focus:border-accent-cyan focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">x</span>
                    </div>
                  </div>
                </div>

                {/* AI Provider Warning */}
                {!hasConfiguredProvider && (
                  <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-xl">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-accent-red shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-accent-red">No AI Provider Configured</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Go to Settings → AI Provider to add your API key
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Provider & Results */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Cpu size={10} /> AI Model
                    </label>
                    <div className="flex gap-1">
                      {AI_PROVIDERS.map((provider) => {
                        const isConfigured = settings?.apiKeys?.[provider.id]?.length > 0
                        const isSelected = aiProvider === provider.id
                        return (
                          <button
                            key={provider.id}
                            onClick={() => isConfigured && setAiProvider(provider.id)}
                            disabled={!isConfigured}
                            className={`flex-1 py-2.5 rounded-xl border text-center transition-all relative ${
                              isSelected && isConfigured
                                ? 'border-accent-cyan bg-accent-cyan/10'
                                : isConfigured
                                  ? 'border-quant-border bg-quant-surface hover:border-gray-600'
                                  : 'border-quant-border bg-quant-surface opacity-30 cursor-not-allowed'
                            }`}
                            title={isConfigured ? provider.label : `${provider.label} - No API key`}
                          >
                            <span className="text-lg">{provider.icon}</span>
                            {isConfigured && (
                              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-green" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Hash size={10} /> Results
                    </label>
                    <div className="flex gap-1">
                      {[1, 3, 5].map((num) => (
                        <button
                          key={num}
                          onClick={() => setNumResults(num)}
                          className={`flex-1 py-2.5 rounded-xl border font-mono text-sm transition-all ${
                            numResults === num
                              ? 'border-accent-cyan bg-accent-cyan/10 text-white'
                              : 'border-quant-border bg-quant-surface text-gray-500 hover:border-gray-600'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Min IPE */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <Target size={10} /> Min IPE (Success Probability)
                    </label>
                    <span className="text-accent-cyan font-mono text-sm font-bold">{minIpe}%</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={95}
                    value={minIpe}
                    onChange={(e) => setMinIpe(Number(e.target.value))}
                    className="w-full h-1.5"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-gray-600">More results</span>
                    <span className="text-[9px] text-gray-600">Higher quality</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-quant-border">
          {step === 'strategy' ? (
            <motion.button
              onClick={handleProceedToConfig}
              disabled={!canProceedToConfig}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                boxShadow: canProceedToConfig ? '0 0 20px rgba(0, 240, 255, 0.25)' : 'none'
              }}
            >
              Continue to Configuration
              <ArrowRight size={18} />
            </motion.button>
          ) : (
            <motion.button
              onClick={handleExecute}
              disabled={!canExecute || isGeneratingTrades}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-4 rounded-xl font-bold disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all duration-300 ${
                isGeneratingTrades
                  ? 'bg-gradient-to-r from-accent-purple via-accent-cyan to-accent-purple bg-[length:200%_100%] animate-gradient text-white'
                  : 'bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg disabled:opacity-50'
              }`}
              style={{
                boxShadow: isGeneratingTrades
                  ? '0 0 30px rgba(139, 92, 246, 0.4), 0 0 60px rgba(0, 240, 255, 0.2)'
                  : canExecute ? '0 0 20px rgba(0, 240, 255, 0.25)' : 'none'
              }}
            >
              {isGeneratingTrades ? (
                <motion.div className="flex items-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="text-lg"
                  >
                    {LOADING_MESSAGES[loadingMsgIndex].icon}
                  </motion.span>
                  <motion.span
                    key={loadingMsgIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm"
                  >
                    {LOADING_MESSAGES[loadingMsgIndex].text}
                  </motion.span>
                </motion.div>
              ) : (
                <>
                  <Sparkles size={18} />
                  Generate Trades
                </>
              )}
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
