import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, HeartPulse, Clock, DollarSign, Zap, Target, Check, Hash, FlaskConical, ArrowRight, ArrowLeft, Brain, Timer, Shield, Gauge, Layers, Sparkles } from 'lucide-react'
import useStore from '../store/useStore'

// Batch presets configuration
const batchPresets = [
  {
    id: 'leverage',
    name: 'Leverage Stress Test',
    icon: '⚡',
    eggs: 4,
    question: '¿Qué leverage es óptimo?',
    description: 'Prueba: 2x, 5x, 10x, 20x',
    color: 'accent-yellow',
    config: {
      variations: [
        { leverage: 2 },
        { leverage: 5 },
        { leverage: 10 },
        { leverage: 20 },
      ]
    }
  },
  {
    id: 'aimodel',
    name: 'AI Model Comparison',
    icon: '🧠',
    eggs: 4,
    question: '¿Qué AI entiende mejor mi prompt?',
    description: 'Prueba: Gemini, Claude, GPT, Grok',
    color: 'accent-purple',
    config: {
      variations: [
        { aiModel: 'google' },
        { aiModel: 'anthropic' },
        { aiModel: 'openai' },
        { aiModel: 'xai' },
      ]
    }
  },
  {
    id: 'timeframe',
    name: 'Timeframe Analysis',
    icon: '⏱️',
    eggs: 3,
    question: '¿Qué horizonte temporal funciona?',
    description: 'Prueba: Scalping, Intraday, Swing',
    color: 'accent-cyan',
    config: {
      variations: [
        { executionTime: 'scalping' },
        { executionTime: 'intraday' },
        { executionTime: 'swing' },
      ]
    }
  },
  {
    id: 'risk',
    name: 'Risk Tolerance Test',
    icon: '🛡️',
    eggs: 9,
    question: '¿Qué R:R es óptimo para mi prompt?',
    description: 'Prueba: TP[2%,5%,10%] × SL[1%,2%,5%]',
    color: 'accent-orange',
    config: {
      variations: [
        { targetPct: 2, stopLoss: 1 },
        { targetPct: 2, stopLoss: 2 },
        { targetPct: 2, stopLoss: 5 },
        { targetPct: 5, stopLoss: 1 },
        { targetPct: 5, stopLoss: 2 },
        { targetPct: 5, stopLoss: 5 },
        { targetPct: 10, stopLoss: 1 },
        { targetPct: 10, stopLoss: 2 },
        { targetPct: 10, stopLoss: 5 },
      ]
    }
  },
  {
    id: 'ipe',
    name: 'IPE Sensitivity',
    icon: '🎯',
    eggs: 3,
    question: '¿Cuán selectivo debo ser?',
    description: 'Prueba: minIPE 70, 80, 90',
    color: 'accent-green',
    config: {
      variations: [
        { minIpe: 70 },
        { minIpe: 80 },
        { minIpe: 90 },
      ]
    }
  },
  {
    id: 'scale',
    name: 'Scale Test',
    icon: '📈',
    eggs: 4,
    question: '¿Mi prompt escala bien?',
    description: 'Prueba: 1, 3, 5, 10 trades',
    color: 'accent-cyan',
    config: {
      variations: [
        { numResults: 1 },
        { numResults: 3 },
        { numResults: 5 },
        { numResults: 10 },
      ]
    }
  },
  {
    id: 'full',
    name: 'Full Diagnostic',
    icon: '🔬',
    eggs: 20,
    question: 'Evaluación completa del prompt',
    description: 'Leverage × Model × Timeframe + extras',
    color: 'accent-purple',
    config: {
      variations: [
        // Leverage x Model combinations
        { leverage: 5, aiModel: 'google' },
        { leverage: 5, aiModel: 'anthropic' },
        { leverage: 10, aiModel: 'google' },
        { leverage: 10, aiModel: 'anthropic' },
        // Timeframes
        { executionTime: 'scalping', leverage: 5 },
        { executionTime: 'intraday', leverage: 5 },
        { executionTime: 'swing', leverage: 5 },
        { executionTime: 'scalping', leverage: 10 },
        { executionTime: 'intraday', leverage: 10 },
        { executionTime: 'swing', leverage: 10 },
        // Risk variations
        { targetPct: 5, stopLoss: 2 },
        { targetPct: 10, stopLoss: 5 },
        { targetPct: 25, stopLoss: 10 },
        // IPE sensitivity
        { minIpe: 70 },
        { minIpe: 80 },
        { minIpe: 90 },
        // Scale
        { numResults: 1 },
        { numResults: 3 },
        { numResults: 5 },
        { numResults: 10 },
      ]
    }
  },
]

// Schedule frequency options
const frequencyOptions = [
  { id: 'hourly', label: 'Hourly', desc: 'Every X hours' },
  { id: 'daily', label: 'Daily', desc: 'Once per day' },
  { id: 'weekly', label: 'Weekly', desc: 'Select days' },
]

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function HealthCheckModal({ check, onClose }) {
  const prompts = useStore((state) => state.prompts) || []
  const addHealthCheck = useStore((state) => state.addHealthCheck)
  const updateHealthCheck = useStore((state) => state.updateHealthCheck)

  const isEditing = !!check

  // Step: 'preset' -> 'config'
  const [step, setStep] = useState(isEditing ? 'config' : 'preset')
  const [selectedPreset, setSelectedPreset] = useState(check?.preset || null)

  // Form state
  const [name, setName] = useState(check?.name || '')
  const [selectedPrompts, setSelectedPrompts] = useState(check?.prompts || [])
  const [frequency, setFrequency] = useState(check?.schedule?.frequency || 'daily')
  const [time, setTime] = useState(check?.schedule?.time || '09:00')
  const [interval, setInterval] = useState(check?.schedule?.interval || 4)
  const [selectedDays, setSelectedDays] = useState(check?.schedule?.days || ['Mon', 'Wed', 'Fri'])
  const [capital, setCapital] = useState(check?.capital || 1000)

  const togglePrompt = (prompt) => {
    setSelectedPrompts(prev => {
      const exists = prev.find(p => p.id === prompt.id)
      if (exists) {
        return prev.filter(p => p.id !== prompt.id)
      }
      return [...prev, { id: prompt.id, name: prompt.name }]
    })
  }

  const toggleDay = (day) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day)
      }
      return [...prev, day]
    })
  }

  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset)
    setName(`${preset.name} - ${new Date().toLocaleDateString()}`)
  }

  const handleProceedToConfig = () => {
    if (selectedPreset) {
      setStep('config')
    }
  }

  const canSave = name.trim() && selectedPrompts.length > 0 && selectedPreset

  const handleSave = () => {
    if (!canSave) return

    const newCheck = {
      id: check?.id || `hc-${Date.now()}`,
      name: name.trim(),
      preset: selectedPreset,
      prompts: selectedPrompts,
      schedule: {
        frequency,
        time: frequency !== 'hourly' ? time : null,
        interval: frequency === 'hourly' ? interval : null,
        days: frequency === 'weekly' ? selectedDays : null,
      },
      capital,
      eggs: selectedPreset.eggs,
      variations: selectedPreset.config.variations,
      isActive: check?.isActive ?? true,
      createdAt: check?.createdAt || new Date().toISOString(),
      lastRun: check?.lastRun || null,
    }

    if (isEditing) {
      updateHealthCheck(check.id, newCheck)
    } else {
      addHealthCheck(newCheck)
    }
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-quant-card rounded-t-3xl max-h-[85vh] flex flex-col mb-16"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-quant-border">
          <div className="flex items-center gap-3">
            {step === 'config' && !isEditing && (
              <button
                onClick={() => setStep('preset')}
                className="p-2.5 -ml-1 rounded-full hover:bg-quant-surface transition-colors active:scale-90"
              >
                <ArrowLeft size={20} className="text-gray-400" />
              </button>
            )}
            <div className="w-8 h-8 rounded-lg bg-accent-purple/20 flex items-center justify-center">
              <FlaskConical size={16} className="text-accent-purple" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {step === 'preset' ? 'Select Batch Preset' : 'Configure Health Check'}
              </h2>
              <p className="text-[10px] text-gray-500">
                {step === 'preset' ? 'Choose what to test' : `${selectedPreset?.eggs || 0} eggs will be created`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 -mr-1 rounded-full hover:bg-quant-surface transition-colors active:scale-90"
          >
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        {/* Step Progress */}
        {!isEditing && (
          <div className="shrink-0 px-4 py-2 flex gap-2">
            <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'preset' ? 'bg-accent-purple' : 'bg-accent-purple'}`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${step === 'config' ? 'bg-accent-purple' : 'bg-quant-surface'}`} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <AnimatePresence mode="wait">
            {/* STEP 1: Preset Selection */}
            {step === 'preset' && (
              <motion.div
                key="preset"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="px-4 py-3 space-y-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical size={14} className="text-accent-purple" />
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Batch Presets
                  </span>
                </div>

                {batchPresets.map((preset, index) => {
                  const isSelected = selectedPreset?.id === preset.id
                  return (
                    <motion.button
                      key={preset.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleSelectPreset(preset)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? `border-${preset.color}/50 bg-${preset.color}/10 shadow-lg`
                          : 'border-quant-border bg-quant-surface hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                          isSelected ? `bg-${preset.color}/20` : 'bg-quant-card'
                        }`}>
                          {preset.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                              {preset.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                                isSelected ? 'bg-accent-cyan/20 text-accent-cyan' : 'bg-quant-card text-gray-500'
                              }`}>
                                {preset.eggs} eggs
                              </span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-accent-purple bg-accent-purple' : 'border-gray-600'
                              }`}>
                                {isSelected && <Check size={12} className="text-white" />}
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{preset.description}</p>
                          <p className={`text-[11px] italic ${isSelected ? 'text-accent-cyan' : 'text-gray-600'}`}>
                            "{preset.question}"
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
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
                {/* Selected Preset Summary */}
                {selectedPreset && (
                  <div className="p-3 bg-accent-purple/10 border border-accent-purple/30 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{selectedPreset.icon}</span>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-white">{selectedPreset.name}</h3>
                        <p className="text-[10px] text-gray-400">{selectedPreset.description}</p>
                      </div>
                      <span className="text-xs font-mono text-accent-cyan bg-accent-cyan/20 px-2 py-1 rounded-lg">
                        {selectedPreset.eggs} eggs
                      </span>
                    </div>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Health Check Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Morning Market Scan"
                    className="w-full bg-quant-surface border border-quant-border rounded-xl px-3 py-3 text-sm text-white placeholder-gray-500 focus:border-accent-purple focus:outline-none"
                  />
                </div>

                {/* Select Prompts */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 block">
                    Select Prompt to Test ({selectedPrompts.length} selected)
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {prompts.length === 0 ? (
                      <div className="text-center py-4 text-sm text-gray-500">
                        No prompts available. Create prompts first.
                      </div>
                    ) : (
                      prompts.map((prompt) => {
                        const isSelected = selectedPrompts.find(p => p.id === prompt.id)
                        return (
                          <button
                            key={prompt.id}
                            onClick={() => togglePrompt(prompt)}
                            className={`w-full p-3 rounded-xl border text-left transition-all ${
                              isSelected
                                ? 'border-accent-purple bg-accent-purple/10'
                                : 'border-quant-border bg-quant-surface hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                                {prompt.name}
                              </span>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-accent-purple bg-accent-purple' : 'border-gray-600'
                              }`}>
                                {isSelected && <Check size={12} className="text-white" />}
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* Capital */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <DollarSign size={10} /> Base Capital (per egg)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                    <input
                      type="number"
                      value={capital}
                      onChange={(e) => setCapital(Number(e.target.value))}
                      className="w-full bg-quant-surface border border-quant-border rounded-xl pl-7 pr-3 py-2.5 text-sm text-white font-mono focus:border-accent-purple focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Total: ${capital * (selectedPreset?.eggs || 1)} across {selectedPreset?.eggs || 1} eggs
                  </p>
                </div>

                {/* Schedule */}
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Clock size={10} /> Schedule
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {frequencyOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setFrequency(opt.id)}
                        className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                          frequency === opt.id
                            ? 'border-accent-purple bg-accent-purple/10 text-white'
                            : 'border-quant-border bg-quant-surface text-gray-500 hover:border-gray-600'
                        }`}
                      >
                        <span className="block text-xs font-medium">{opt.label}</span>
                        <span className="text-[9px] opacity-60">{opt.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Hourly Interval */}
                  {frequency === 'hourly' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Every</span>
                      <input
                        type="number"
                        value={interval}
                        onChange={(e) => setInterval(Math.max(1, Math.min(24, Number(e.target.value))))}
                        min={1}
                        max={24}
                        className="w-16 bg-quant-surface border border-quant-border rounded-lg px-2 py-1.5 text-sm text-white text-center font-mono focus:border-accent-purple focus:outline-none"
                      />
                      <span className="text-xs text-gray-500">hour(s)</span>
                    </div>
                  )}

                  {/* Daily/Weekly Time */}
                  {(frequency === 'daily' || frequency === 'weekly') && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Run at</span>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => setTime(e.target.value)}
                          className="bg-quant-surface border border-quant-border rounded-lg px-2 py-1.5 text-sm text-white font-mono focus:border-accent-purple focus:outline-none"
                        />
                      </div>

                      {frequency === 'weekly' && (
                        <div className="flex gap-1">
                          {weekDays.map((day) => (
                            <button
                              key={day}
                              onClick={() => toggleDay(day)}
                              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                                selectedDays.includes(day)
                                  ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/30'
                                  : 'bg-quant-surface text-gray-500 border border-transparent'
                              }`}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Variations Preview */}
                {selectedPreset && (
                  <div className="p-3 bg-quant-surface rounded-xl border border-quant-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={12} className="text-accent-cyan" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">Test Variations</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPreset.config.variations.slice(0, 8).map((v, i) => (
                        <span key={i} className="text-[10px] px-2 py-1 rounded-lg bg-quant-card text-gray-400 font-mono">
                          {Object.entries(v).map(([k, val]) => `${k}:${val}`).join(' ')}
                        </span>
                      ))}
                      {selectedPreset.config.variations.length > 8 && (
                        <span className="text-[10px] px-2 py-1 rounded-lg bg-quant-card text-gray-500">
                          +{selectedPreset.config.variations.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 pb-6 border-t border-quant-border safe-area-bottom">
          {step === 'preset' ? (
            <motion.button
              onClick={handleProceedToConfig}
              disabled={!selectedPreset}
              whileTap={{ scale: 0.98 }}
              animate={selectedPreset ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.3 }}
              className={`w-full py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all ${
                selectedPreset
                  ? 'bg-gradient-to-r from-accent-purple to-accent-cyan pulse-glow'
                  : 'bg-quant-surface text-gray-500 border border-quant-border'
              }`}
            >
              {selectedPreset ? (
                <>
                  Continue to Configuration
                  <ArrowRight size={18} />
                </>
              ) : (
                'Select a preset above'
              )}
            </motion.button>
          ) : (
            <motion.button
              onClick={handleSave}
              disabled={!canSave}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-purple to-accent-cyan text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                boxShadow: canSave ? '0 0 20px rgba(139, 92, 246, 0.25)' : 'none'
              }}
            >
              <FlaskConical size={18} />
              Create Health Check ({selectedPreset?.eggs || 0} eggs)
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
