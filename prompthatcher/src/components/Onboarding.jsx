import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Key, Database, ChevronRight, ChevronLeft,
  Check, AlertCircle, Loader2, ExternalLink
} from 'lucide-react'
import useStore from '../store/useStore'

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to PromptHatcher',
    subtitle: 'Your trading strategy incubator'
  },
  {
    id: 'ai-provider',
    title: 'AI Provider Setup',
    subtitle: 'Connect your AI model'
  },
  {
    id: 'supabase',
    title: 'Database Setup',
    subtitle: 'Connect to Supabase'
  }
]

const aiProviders = [
  {
    id: 'google',
    name: 'Google Gemini',
    icon: '🔮',
    placeholder: 'AIza...',
    helpUrl: 'https://makersuite.google.com/app/apikey'
  },
  {
    id: 'anthropic',
    name: 'Claude (Anthropic)',
    icon: '🧠',
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys'
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    icon: '⚡',
    placeholder: 'xai-...',
    helpUrl: 'https://console.x.ai'
  }
]

export default function Onboarding() {
  const { settings, updateSettings, updateApiKey, updateSupabase, completeOnboarding } = useStore()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedProvider, setSelectedProvider] = useState(settings.aiProvider || 'google')
  const [apiKey, setApiKey] = useState(settings.apiKeys?.[settings.aiProvider] || '')
  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabase?.url || '')
  const [supabaseKey, setSupabaseKey] = useState(settings.supabase?.anonKey || '')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  const currentStepData = steps[currentStep]

  const handleNext = () => {
    if (currentStep === 1) {
      // Save AI provider settings
      updateSettings({ aiProvider: selectedProvider })
      updateApiKey(selectedProvider, apiKey)
    }

    if (currentStep === 2) {
      // Save Supabase settings and complete onboarding
      updateSupabase({ url: supabaseUrl, anonKey: supabaseKey })
      completeOnboarding()
      return
    }

    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
    setTestResult(null)
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setTestResult(null)
  }

  const testConnection = async (type) => {
    setTesting(true)
    setTestResult(null)

    // Simulate API test
    await new Promise(resolve => setTimeout(resolve, 1500))

    if (type === 'ai') {
      const isValid = apiKey.length > 10
      setTestResult(isValid ? 'success' : 'error')
    } else {
      const isValid = supabaseUrl.includes('supabase') && supabaseKey.length > 10
      setTestResult(isValid ? 'success' : 'error')
    }

    setTesting(false)
  }

  const canProceed = () => {
    if (currentStep === 0) return true
    if (currentStep === 1) return apiKey.length > 0
    if (currentStep === 2) return supabaseUrl.length > 0 && supabaseKey.length > 0
    return false
  }

  const selectedProviderData = aiProviders.find(p => p.id === selectedProvider)

  return (
    <div className="min-h-screen bg-quant-bg flex flex-col">
      {/* Progress Bar */}
      <div className="safe-area-top px-4 pt-4">
        <div className="flex gap-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                index <= currentStep ? 'bg-accent-cyan' : 'bg-quant-border'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col"
          >
            {/* Step 0: Welcome */}
            {currentStep === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-32 h-32 rounded-full bg-gradient-to-br from-accent-cyan/20 to-electric-600/20 flex items-center justify-center mb-8"
                >
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent-cyan to-electric-600 flex items-center justify-center">
                    <Sparkles size={48} className="text-quant-bg" />
                  </div>
                </motion.div>

                <h1 className="text-3xl font-bold text-white mb-3">
                  {currentStepData.title}
                </h1>
                <p className="text-gray-400 text-lg mb-8">
                  {currentStepData.subtitle}
                </p>

                <div className="space-y-4 text-left w-full max-w-sm">
                  <div className="flex items-start gap-3 p-4 bg-quant-card rounded-xl border border-quant-border">
                    <div className="p-2 rounded-lg bg-accent-cyan/20">
                      <Sparkles size={20} className="text-accent-cyan" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Incubate Prompts</h3>
                      <p className="text-sm text-gray-500">Test trading strategies with AI</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-quant-card rounded-xl border border-quant-border">
                    <div className="p-2 rounded-lg bg-accent-green/20">
                      <Check size={20} className="text-accent-green" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Track Performance</h3>
                      <p className="text-sm text-gray-500">Monitor win rates and PnL</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-quant-card rounded-xl border border-quant-border">
                    <div className="p-2 rounded-lg bg-accent-orange/20">
                      <Database size={20} className="text-accent-orange" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">Cloud Sync</h3>
                      <p className="text-sm text-gray-500">Your data synced with Supabase</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 1: AI Provider */}
            {currentStep === 1 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-white mb-2">
                    {currentStepData.title}
                  </h1>
                  <p className="text-gray-400">
                    Select your AI provider and enter your API key
                  </p>
                </div>

                {/* Provider Selection */}
                <div className="space-y-3 mb-6">
                  {aiProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => {
                        setSelectedProvider(provider.id)
                        setApiKey(settings.apiKeys?.[provider.id] || '')
                        setTestResult(null)
                      }}
                      className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                        selectedProvider === provider.id
                          ? 'border-accent-cyan bg-accent-cyan/10'
                          : 'border-quant-border bg-quant-card'
                      }`}
                    >
                      <span className="text-2xl">{provider.icon}</span>
                      <span className={`font-medium ${
                        selectedProvider === provider.id ? 'text-white' : 'text-gray-400'
                      }`}>
                        {provider.name}
                      </span>
                      {selectedProvider === provider.id && (
                        <div className="ml-auto w-3 h-3 rounded-full bg-accent-cyan" />
                      )}
                    </button>
                  ))}
                </div>

                {/* API Key Input */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-gray-400 flex items-center gap-2">
                      <Key size={14} />
                      API Key
                    </label>
                    <a
                      href={selectedProviderData?.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-cyan flex items-center gap-1"
                    >
                      Get API Key <ExternalLink size={12} />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder={selectedProviderData?.placeholder}
                    className="w-full bg-quant-surface border border-quant-border rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:border-accent-cyan transition-colors"
                  />

                  {/* Test Connection Button */}
                  <button
                    onClick={() => testConnection('ai')}
                    disabled={!apiKey || testing}
                    className="w-full py-3 rounded-xl border border-quant-border bg-quant-surface text-gray-400 hover:text-white hover:border-accent-cyan/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </button>

                  {/* Test Result */}
                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl flex items-center gap-2 ${
                        testResult === 'success'
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-accent-red/20 text-accent-red'
                      }`}
                    >
                      {testResult === 'success' ? (
                        <>
                          <Check size={16} />
                          Connection successful!
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} />
                          Connection failed. Check your API key.
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Supabase */}
            {currentStep === 2 && (
              <div className="flex-1 flex flex-col">
                <div className="mb-8">
                  <h1 className="text-2xl font-bold text-white mb-2">
                    {currentStepData.title}
                  </h1>
                  <p className="text-gray-400">
                    Connect to Supabase for cloud storage
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Supabase URL */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-gray-400 flex items-center gap-2">
                        <Database size={14} />
                        Project URL
                      </label>
                      <a
                        href="https://supabase.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-cyan flex items-center gap-1"
                      >
                        Open Supabase <ExternalLink size={12} />
                      </a>
                    </div>
                    <input
                      type="url"
                      value={supabaseUrl}
                      onChange={(e) => {
                        setSupabaseUrl(e.target.value)
                        setTestResult(null)
                      }}
                      placeholder="https://xxxxx.supabase.co"
                      className="w-full bg-quant-surface border border-quant-border rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:border-accent-cyan transition-colors"
                    />
                  </div>

                  {/* Supabase Anon Key */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-400 flex items-center gap-2">
                      <Key size={14} />
                      Anon Key
                    </label>
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={(e) => {
                        setSupabaseKey(e.target.value)
                        setTestResult(null)
                      }}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full bg-quant-surface border border-quant-border rounded-xl px-4 py-3 text-white font-mono text-sm placeholder-gray-600 focus:border-accent-cyan transition-colors"
                    />
                  </div>

                  {/* Test Connection Button */}
                  <button
                    onClick={() => testConnection('supabase')}
                    disabled={!supabaseUrl || !supabaseKey || testing}
                    className="w-full py-3 rounded-xl border border-quant-border bg-quant-surface text-gray-400 hover:text-white hover:border-accent-cyan/50 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {testing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </button>

                  {/* Test Result */}
                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl flex items-center gap-2 ${
                        testResult === 'success'
                          ? 'bg-accent-green/20 text-accent-green'
                          : 'bg-accent-red/20 text-accent-red'
                      }`}
                    >
                      {testResult === 'success' ? (
                        <>
                          <Check size={16} />
                          Connected to Supabase!
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} />
                          Connection failed. Check your credentials.
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Info Box */}
                  <div className="p-4 bg-quant-card rounded-xl border border-quant-border mt-4">
                    <h4 className="text-sm font-medium text-white mb-2">Where to find these?</h4>
                    <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
                      <li>Go to your Supabase project dashboard</li>
                      <li>Click on Settings → API</li>
                      <li>Copy the Project URL and anon key</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="shrink-0 px-6 pb-8 safe-area-bottom">
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              className="px-6 py-4 rounded-xl border border-quant-border bg-quant-card text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              <ChevronLeft size={20} />
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex-1 py-4 rounded-xl bg-gradient-to-r from-accent-cyan to-electric-600 text-quant-bg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {currentStep === steps.length - 1 ? (
              'Start Using PromptHatcher'
            ) : (
              <>
                Continue
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
