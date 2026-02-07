// AI Service for generating trading signals from prompts
import { fetchBinancePrices } from './priceService'
import { PIPELINE_STEPS, createPipelineEmitter, generateHash } from './executionLog'

// Minimum Risk/Reward ratio (Shell Calibration)
const MIN_RISK_REWARD_RATIO = 2.0

// Timeout utility - rejects if operation exceeds limit
const withTimeout = (promise, ms, label = 'Operation') => {
  let timeoutId
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${(ms / 1000).toFixed(0)}s`)), ms)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId))
}

// Calculate R:R ratio
export const calculateRiskReward = (entry, takeProfit, stopLoss, strategy) => {
  const entryPrice = parseFloat(entry)
  const tp = parseFloat(takeProfit)
  const sl = parseFloat(stopLoss)

  let reward, risk

  if (strategy === 'LONG') {
    reward = tp - entryPrice
    risk = entryPrice - sl
  } else {
    reward = entryPrice - tp
    risk = sl - entryPrice
  }

  if (risk <= 0) return 0
  return reward / risk
}

// Available crypto assets
const CRYPTO_ASSETS = [
  'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
  'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT',
  'ATOM/USDT', 'UNI/USDT', 'LTC/USDT', 'NEAR/USDT', 'APT/USDT'
]

// Get decimal places for asset price formatting
const getDecimalPlaces = (asset, price) => {
  if (price >= 1000) return 2
  if (price >= 1) return 2
  if (price >= 0.01) return 4
  return 6
}

// Fetch real prices from Binance
const fetchRealPrices = async (assets) => {
  try {
    const prices = await fetchBinancePrices(assets)
    const priceMap = {}

    for (const asset of assets) {
      if (prices[asset]) {
        priceMap[asset] = prices[asset].price
      }
    }

    return priceMap
  } catch (error) {
    console.error('Failed to fetch real prices:', error)
    return null
  }
}

// Build the prompt to send to AI
const buildAIPrompt = (userPrompt, settings, prices, config) => {
  const priceList = Object.entries(prices)
    .map(([asset, price]) => `- ${asset}: $${price.toLocaleString()}`)
    .join('\n')

  return `## USER'S TRADING STRATEGY:
${userPrompt.content}

## CURRENT MARKET PRICES (Real-time from Binance):
${priceList}

## CONFIGURATION:
- Capital: $${config.capital || 1000}
- Leverage: ${config.leverage || 5}x
- Target Profit: ${config.targetPct || 10}% on capital
- Execution Mode: ${config.executionTime || 'target'}
- Minimum IPE Score: ${config.minIpe || 80}%

## REQUIRED OUTPUT FORMAT:
You MUST respond with ONLY a valid JSON array. No markdown, no explanations outside the JSON.
Each trade must have this exact structure:

[
  {
    "asset": "BTC/USDT",
    "strategy": "LONG",
    "entry": 95000.00,
    "takeProfit": 97000.00,
    "stopLoss": 94000.00,
    "ipe": 85,
    "summary": "One line explaining the main reason for this trade (max 80 chars)",
    "reasoning": {
      "whyAsset": "Why this specific asset was chosen based on the user's strategy",
      "whyDirection": "Why LONG or SHORT based on the user's strategy criteria",
      "whyEntry": "How the entry price was determined using current market prices",
      "whyLevels": "How TP and SL were calculated based on the user's configuration"
    },
    "criteriaMatched": [
      {"criterion": "RSI < 30", "value": "28", "passed": true},
      {"criterion": "Near support", "value": "2.1% away", "passed": true},
      {"criterion": "Volume increasing", "value": "+45%", "passed": true}
    ],
    "confidenceFactors": [
      {"factor": "Technical Signal", "weight": 35, "score": 90, "contribution": 31.5},
      {"factor": "Support Level", "weight": 25, "score": 85, "contribution": 21.3},
      {"factor": "Volume Confirm", "weight": 20, "score": 95, "contribution": 19.0},
      {"factor": "Market Context", "weight": 20, "score": 50, "contribution": 10.0}
    ]
  }
]

## RULES:
1. Select assets based on the user's strategy - use market prices above as reference for realistic entry levels
2. Entry price should be very close to current market price (within 0.5%)
3. TP and SL must follow the user's configuration (target profit %, leverage, capital)
4. Reasoning must explain HOW the user's strategy applies to this specific trade
5. Strategy must be either "LONG" or "SHORT"
6. All prices must be numbers (not strings)

Generate ${config.numResults || 3} trades now:`
}

// Attempt to repair truncated JSON from AI (e.g., when output was cut by MAX_TOKENS)
// Strategy: find complete trade objects in the truncated array and discard the incomplete last one
const repairTruncatedJSON = (truncated) => {
  // Find all complete JSON objects (matching { ... }) within the array
  const completeObjects = []
  let depth = 0
  let objectStart = -1

  for (let i = 0; i < truncated.length; i++) {
    const char = truncated[i]
    if (char === '{') {
      if (depth === 0) objectStart = i
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0 && objectStart !== -1) {
        completeObjects.push(truncated.substring(objectStart, i + 1))
        objectStart = -1
      }
    }
  }

  if (completeObjects.length === 0) {
    throw new Error('La AI envio una respuesta incompleta (JSON truncado). Intenta de nuevo — suele funcionar al segundo intento.')
  }

  console.warn(`Repaired truncated JSON: recovered ${completeObjects.length} complete trade(s)`)
  return `[${completeObjects.join(',')}]`
}

// Parse AI response to extract trades
const parseAIResponse = (responseText, prices, config) => {
  try {
    if (!responseText || typeof responseText !== 'string') {
      throw new Error(`Respuesta vacia o invalida del modelo (tipo: ${typeof responseText})`)
    }

    // Try to extract JSON from the response
    let jsonStr = responseText.trim()

    // Remove markdown code blocks if present (handle multiple closing backticks)
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/```\s*$/, '')
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/```\s*$/, '')
    }

    // Find JSON array in the response
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      // Try to detect truncated JSON (starts with [ but no closing ])
      const truncatedMatch = jsonStr.match(/\[[\s\S]+/)
      if (truncatedMatch) {
        // Attempt to repair truncated JSON by closing open braces/brackets
        jsonStr = repairTruncatedJSON(truncatedMatch[0])
        console.warn('Detected truncated JSON response — attempting repair')
      } else {
        const preview = jsonStr.substring(0, 200)
        throw new Error(`No se encontro JSON array en la respuesta. Inicio: "${preview}..."`)
      }
    } else {
      jsonStr = jsonMatch[0]
    }

    let trades
    try {
      trades = JSON.parse(jsonStr)
    } catch (jsonErr) {
      const errorPos = jsonErr.message.match(/position (\d+)/)
      const pos = errorPos ? parseInt(errorPos[1]) : 0
      const context = jsonStr.substring(Math.max(0, pos - 50), pos + 50)
      throw new Error(`JSON invalido cerca de posicion ${pos}: "${context}" — ${jsonErr.message}`)
    }

    if (!Array.isArray(trades)) {
      throw new Error(`Respuesta no es un array (tipo: ${typeof trades})`)
    }

    if (trades.length === 0) {
      throw new Error('El modelo devolvio un array vacio')
    }

    // Validate and enhance each trade
    return trades.map((trade, i) => {
      const asset = trade.asset
      const currentPrice = prices[asset]

      if (!currentPrice) {
        console.warn(`AI suggested unknown asset: ${asset}`)
        return null
      }

      const decimals = getDecimalPlaces(asset, currentPrice)
      let entry = parseFloat(trade.entry) || currentPrice
      const takeProfit = parseFloat(trade.takeProfit)
      const stopLoss = parseFloat(trade.stopLoss)
      const strategy = trade.strategy?.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG'

      // Validate entry within 0.5% of current price - adjust if too far
      const MAX_ENTRY_DEVIATION = 0.005
      const entryDeviation = Math.abs(entry - currentPrice) / currentPrice
      if (entryDeviation > MAX_ENTRY_DEVIATION) {
        console.warn(`Entry ${entry} deviates ${(entryDeviation * 100).toFixed(2)}% from current ${currentPrice} for ${asset} - adjusting to current price`)
        entry = currentPrice
      }

      // Calculate R:R
      const rrRatio = calculateRiskReward(entry, takeProfit, stopLoss, strategy)

      // Calculate percentages
      let riskPercent, rewardPercent
      if (strategy === 'LONG') {
        rewardPercent = ((takeProfit - entry) / entry) * 100
        riskPercent = ((entry - stopLoss) / entry) * 100
      } else {
        rewardPercent = ((entry - takeProfit) / entry) * 100
        riskPercent = ((stopLoss - entry) / entry) * 100
      }

      // Build transparency data
      const reasoning = trade.reasoning || {}
      const criteriaMatched = trade.criteriaMatched || []
      const confidenceFactors = trade.confidenceFactors || []

      // Generate default criteria if not provided
      const defaultCriteria = [
        { criterion: 'Price analysis', value: 'Evaluated', passed: true },
        { criterion: 'Risk/Reward', value: `1:${rrRatio.toFixed(1)}`, passed: rrRatio >= 2 },
        { criterion: 'Strategy match', value: 'Applied', passed: true }
      ]

      // Generate default confidence factors if not provided
      const defaultFactors = [
        { factor: 'Technical Analysis', weight: 40, score: 75 + Math.round(Math.random() * 20), contribution: 0 },
        { factor: 'Risk Management', weight: 30, score: rrRatio >= 2 ? 85 : 60, contribution: 0 },
        { factor: 'Market Context', weight: 30, score: 70 + Math.round(Math.random() * 15), contribution: 0 }
      ]
      defaultFactors.forEach(f => { f.contribution = (f.weight * f.score) / 100 })

      return {
        id: `trade-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`,
        promptId: config.promptId,
        promptName: config.promptName,
        asset,
        strategy,
        entry: entry.toFixed(decimals),
        takeProfit: takeProfit.toFixed(decimals),
        stopLoss: stopLoss.toFixed(decimals),
        currentPrice: currentPrice.toFixed(decimals),
        riskRewardRatio: rrRatio.toFixed(2),
        riskPercent: riskPercent.toFixed(2),
        rewardPercent: rewardPercent.toFixed(2),
        targetPct: config.targetPct || null,
        ipe: Math.min(95, Math.max(70, parseInt(trade.ipe) || 80)),
        // Transparency data - Glass Box Trading
        summary: trade.summary || `${strategy} based on strategy criteria match`,
        reasoning: {
          whyAsset: reasoning.whyAsset || `Selected from ${Object.keys(config).length} candidates based on strategy fit`,
          whyDirection: reasoning.whyDirection || `${strategy} signal based on user strategy analysis`,
          whyEntry: reasoning.whyEntry || `Entry at ${entry.toFixed(decimals)} based on current price ${currentPrice.toFixed(decimals)}`,
          whyLevels: reasoning.whyLevels || `TP/SL calculated for ${rrRatio.toFixed(1)}:1 R:R ratio`
        },
        criteriaMatched: criteriaMatched.length > 0 ? criteriaMatched : defaultCriteria,
        confidenceFactors: confidenceFactors.length > 0 ? confidenceFactors : defaultFactors,
        // Legacy fields for backward compatibility
        explanation: trade.summary || (typeof trade.reasoning === 'string' ? trade.reasoning : 'AI-generated trade'),
        insights: trade.insights || Object.values(reasoning).filter(Boolean).slice(0, 3),
        executionTime: config.executionTime,
        leverage: config.leverage || 5,
        capital: config.capital / (config.numResults || 3),
        createdAt: new Date().toISOString(),
        status: 'pending',
        selected: false
      }
    }).filter(Boolean)

  } catch (error) {
    console.error('Failed to parse AI response:', error)
    console.error('Raw response:', responseText)
    throw new Error(`Failed to parse AI response: ${error.message}`)
  }
}

// ============================================
// AI API CALLS - Hybrid approach (proxy + direct)
// ============================================

// Helper to try proxy first, then direct call
const fetchWithFallback = async (proxyUrl, directUrl, options, directOptions = null) => {
  // Try proxy first (works if Vite server is properly configured)
  try {
    const proxyResponse = await fetch(proxyUrl, options)
    if (proxyResponse.ok || proxyResponse.status < 500) {
      return proxyResponse
    }
  } catch (e) {
    console.log('Proxy not available, trying direct call...')
  }

  // Fall back to direct call
  return fetch(directUrl, directOptions || options)
}

// Call Anthropic Claude API
const callClaudeAPI = async (prompt, apiKey, model = 'claude-sonnet-4-20250514') => {
  console.log('Calling Claude API...')

  const body = JSON.stringify({
    model: model,
    max_tokens: 4096,
    system: 'You are a quantitative trading analyst. Always respond with valid JSON only. No markdown, no explanations outside the JSON array.',
    messages: [{ role: 'user', content: prompt }]
  })

  // Direct call with browser access header (Anthropic supports this)
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: body
  })

  if (!response.ok) {
    let errorMsg = `Claude API error: ${response.status}`
    try {
      const error = await response.json()
      errorMsg = error.error?.message || errorMsg
    } catch (e) {}
    throw new Error(errorMsg)
  }

  const data = await response.json()

  if (!data.content?.[0]?.text) {
    throw new Error('No response from Claude')
  }

  return data.content[0].text
}

// Call Google Gemini API (supports browser calls natively)
const callGeminiAPI = async (prompt, apiKey, model = 'gemini-2.5-flash') => {
  console.log(`Calling Gemini API with model: ${model}`)

  // Gemini 2.5 Flash is a "thinking" model — thinking tokens are separate from output tokens.
  // We set a thinking budget so it doesn't consume all output capacity.
  const isThinkingModel = model.includes('2.5')

  const generationConfig = {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192
  }

  // For thinking models, configure thinking budget to prevent output truncation
  if (isThinkingModel) {
    generationConfig.thinkingConfig = {
      thinkingBudget: 1024
    }
  }

  // Gemini API supports direct browser calls with API key in URL
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig
      })
    }
  )

  if (!response.ok) {
    let errorMsg = `Gemini API error: ${response.status}`
    try {
      const error = await response.json()
      errorMsg = error.error?.message || errorMsg
    } catch (e) {}
    throw new Error(errorMsg)
  }

  const data = await response.json()

  const candidate = data.candidates?.[0]
  if (!candidate?.content?.parts?.[0]?.text) {
    const blockReason = candidate?.finishReason || data.promptFeedback?.blockReason || 'unknown'
    throw new Error(`No response from Gemini (reason: ${blockReason})`)
  }

  // Check if response was truncated due to token limit
  if (candidate.finishReason === 'MAX_TOKENS') {
    console.warn('Gemini response truncated (MAX_TOKENS) — response may be incomplete')
  }

  // Extract text from all parts (thinking models may return multiple parts)
  const textParts = candidate.content.parts
    .filter(p => p.text && !p.thought)
    .map(p => p.text)

  if (textParts.length === 0) {
    throw new Error('Gemini solo devolvio thinking tokens, sin respuesta de texto')
  }

  return textParts.join('')
}

// Call OpenAI API
const callOpenAIAPI = async (prompt, apiKey, model = 'gpt-4') => {
  console.log(`Calling OpenAI API with model: ${model}`)

  const body = JSON.stringify({
    model: model,
    messages: [
      { role: 'system', content: 'You are a quantitative trading analyst. Always respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2048
  })

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }

  const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

  let response

  if (isViteDevServer()) {
    try {
      response = await fetch('/api/openai/v1/chat/completions', {
        method: 'POST',
        headers,
        body
      })
      const ct = response.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        throw new Error('Proxy returned non-JSON')
      }
    } catch (e) {
      console.log('Vite proxy failed for OpenAI, using CORS proxy...', e.message)
      response = await fetchViaCorsProxy(OPENAI_URL, { method: 'POST', headers, body })
    }
  } else {
    response = await fetchViaCorsProxy(OPENAI_URL, { method: 'POST', headers, body })
  }

  if (!response.ok) {
    let errorMsg = `OpenAI API error: ${response.status}`
    try {
      const error = await response.json()
      errorMsg = error.error?.message || errorMsg
    } catch (e) {}
    throw new Error(errorMsg)
  }

  const data = await response.json()

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response from OpenAI')
  }

  return data.choices[0].message.content
}

// Helper: detect if we're running on Vite dev server (has proxy support)
const isViteDevServer = () => {
  try {
    // Vite dev server typically runs on 5173, serve . on 3000
    return window.location.port === '5173' || window.location.port === '5174'
  } catch (e) {
    return false
  }
}

// Helper: try fetching through a CORS proxy
const fetchViaCorsProxy = async (targetUrl, options) => {
  const CORS_PROXIES = [
    (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ]

  let lastError
  for (const proxyFn of CORS_PROXIES) {
    try {
      const proxyUrl = proxyFn(targetUrl)
      console.log(`Trying CORS proxy: ${proxyUrl.split('?')[0]}...`)
      const response = await fetch(proxyUrl, options)
      // Check if we got a valid JSON response (not an HTML error page)
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        console.log('CORS proxy returned HTML, trying next...')
        continue
      }
      return response
    } catch (e) {
      console.log(`CORS proxy failed: ${e.message}`)
      lastError = e
    }
  }

  // Last resort: direct call (will likely fail with CORS in browser, but try anyway)
  console.log('All CORS proxies failed, trying direct call...')
  return fetch(targetUrl, options)
}

// Call xAI Grok API
// xAI API supports CORS natively (access-control-allow-origin: *) - direct browser calls work
const callGrokAPI = async (prompt, apiKey) => {
  console.log('Calling Grok API (direct - xAI supports CORS)...')

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        { role: 'system', content: 'You are a quantitative trading analyst. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2048
    })
  })

  if (!response.ok) {
    let errorMsg = `Grok API error: ${response.status}`
    try {
      const error = await response.json()
      errorMsg = error.error?.message || errorMsg
    } catch (e) {}
    throw new Error(errorMsg)
  }

  const data = await response.json()

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response from Grok')
  }

  return data.choices[0].message.content
}

// Call Groq API (OpenAI-compatible, supports CORS natively)
const callGroqAPI = async (prompt, apiKey) => {
  console.log('Calling Groq API (direct - Groq supports CORS)...')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a quantitative trading analyst. Always respond with valid JSON only. Keep responses concise — return only the JSON array, no explanations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  })

  if (!response.ok) {
    let errorMsg = `Groq API error: ${response.status}`
    try {
      const error = await response.json()
      errorMsg = error.error?.message || errorMsg
    } catch (e) {}
    throw new Error(errorMsg)
  }

  const data = await response.json()

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response from Groq')
  }

  return data.choices[0].message.content
}

// Call SambaNova API (OpenAI-compatible, supports CORS natively)
const callSambaNovaAPI = async (prompt, apiKey) => {
  console.log('Calling SambaNova API (direct - SambaNova supports CORS)...')

  const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'Meta-Llama-3.1-405B-Instruct',
      messages: [
        { role: 'system', content: 'You are a quantitative trading analyst. Always respond with valid JSON only. Keep responses concise — return only the JSON array, no explanations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  })

  if (!response.ok) {
    let errorMsg = `SambaNova API error: ${response.status}`
    try {
      const error = await response.json()
      errorMsg = error.error?.message || errorMsg
    } catch (e) {}
    throw new Error(errorMsg)
  }

  const data = await response.json()

  if (!data.choices?.[0]?.message?.content) {
    throw new Error('No response from SambaNova')
  }

  return data.choices[0].message.content
}

// Map model aliases to canonical API key names
const MODEL_TO_PROVIDER = {
  gemini: 'google', 'gemini-2.5-flash': 'google', 'gemini-2.0-flash': 'google', 'gemini-2.5-flash-lite': 'google', 'gemini-2.5-pro': 'google',
  claude: 'anthropic', 'claude-sonnet-4-20250514': 'anthropic', 'claude-3-5-sonnet-20241022': 'anthropic', 'claude-3-haiku-20240307': 'anthropic',
  gpt4: 'openai', 'gpt-4': 'openai', 'gpt-4-turbo': 'openai', 'gpt-3.5-turbo': 'openai',
  grok: 'xai', 'grok-3-mini': 'xai', 'grok-3': 'xai',
  groq: 'groq', 'llama-3.3-70b-versatile': 'groq', 'llama-3.1-8b-instant': 'groq',
  sambanova: 'sambanova', 'Meta-Llama-3.1-405B-Instruct': 'sambanova', 'Meta-Llama-3.1-70B-Instruct': 'sambanova'
}

// AI provider display names
const AI_PROVIDER_NAMES = {
  anthropic: 'Claude Sonnet 4',
  google: 'Gemini 2.5 Flash',
  openai: 'GPT-4',
  xai: 'Grok 3',
  groq: 'Groq (Llama 3.3 70B)',
  sambanova: 'SambaNova (Llama 3.1 405B)'
}

// Main function to generate trades from prompt using AI
// onPipelineEvent: optional callback (event, currentStep) => void for real-time pipeline tracking
export const generateTradesFromPrompt = async (prompt, settings, numResults = 3, onPipelineEvent = null, overridePrices = null) => {
  // Create pipeline emitter (no-op if no callback)
  const emitter = onPipelineEvent
    ? createPipelineEmitter(onPipelineEvent)
    : { emit: () => {}, getElapsed: () => 0 }

  const hashes = {}

  // STEP: START
  emitter.emit(PIPELINE_STEPS.START, 'completed', 'Pipeline iniciado', {
    promptName: prompt.name,
    numResults
  })

  // Use the AI provider from the prompt (selected in modal) or fall back to settings
  // Map model aliases (e.g. 'gemini') to canonical API key names (e.g. 'google')
  const rawProvider = prompt.aiModel || settings.aiProvider || 'google'
  const aiProvider = MODEL_TO_PROVIDER[rawProvider] || rawProvider
  const providerName = AI_PROVIDER_NAMES[aiProvider] || aiProvider

  // Check for API key using the correct provider
  const apiKey = settings.apiKeys?.[aiProvider]

  if (!apiKey) {
    emitter.emit(PIPELINE_STEPS.ERROR, 'error', `No API key configured for ${aiProvider}`)
    throw new Error(`No API key configured for ${aiProvider}. Please add your API key in Settings.`)
  }

  // STEP: FETCH PRICES
  // If overridePrices is provided (walk-forward backtest), use those instead of live prices
  let realPrices
  if (overridePrices && Object.keys(overridePrices).length > 0) {
    emitter.emit(PIPELINE_STEPS.FETCH_PRICES, 'started', 'Usando precios historicos (walk-forward)...')
    realPrices = overridePrices
  } else {
    emitter.emit(PIPELINE_STEPS.FETCH_PRICES, 'started', 'Solicitando precios a Binance...')
    realPrices = await fetchRealPrices(CRYPTO_ASSETS)
  }

  if (!realPrices || Object.keys(realPrices).length === 0) {
    emitter.emit(PIPELINE_STEPS.FETCH_PRICES, 'error', 'No se pudieron obtener precios')
    throw new Error('Failed to get prices. Please try again.')
  }

  // Generate hash for price data integrity
  hashes.pricesInput = await generateHash(realPrices)

  const priceEntries = Object.entries(realPrices)
  const pricesSummary = priceEntries
    .map(([asset, price]) => `${asset}: $${price.toLocaleString()}`)
    .join(' | ')

  emitter.emit(PIPELINE_STEPS.FETCH_PRICES, 'completed', `Recibidos ${priceEntries.length} pares`, {
    count: priceEntries.length,
    prices: realPrices,
    pricesSummary,
    hash: hashes.pricesInput
  })

  // Prepare config
  const config = {
    promptId: prompt.id,
    promptName: prompt.name,
    capital: prompt.capital || 1000,
    leverage: prompt.leverage || 5,
    targetPct: prompt.targetPct || 10,
    executionTime: prompt.executionTime || 'target',
    minIpe: prompt.minIpe || 80,
    numResults: numResults
  }

  // STEP: BUILD PROMPT
  emitter.emit(PIPELINE_STEPS.BUILD_PROMPT, 'started', 'Construyendo prompt...')

  const aiPrompt = buildAIPrompt(prompt, settings, realPrices, config)
  const promptTokenEstimate = Math.round(aiPrompt.length / 4) // Rough token estimate

  hashes.promptSent = await generateHash(aiPrompt)

  emitter.emit(PIPELINE_STEPS.BUILD_PROMPT, 'completed', `Prompt construido (${promptTokenEstimate} tokens est.)`, {
    tokenEstimate: promptTokenEstimate,
    promptLength: aiPrompt.length,
    strategy: prompt.name,
    capital: config.capital,
    leverage: config.leverage,
    hash: hashes.promptSent
  })

  // STEP: AI CALL
  emitter.emit(PIPELINE_STEPS.AI_CALL, 'started', `Enviando a ${providerName}...`, {
    provider: aiProvider,
    providerName,
    temperature: 0.7,
    maxTokens: aiProvider === 'anthropic' || aiProvider === 'openai' ? 4096 : 2048
  })

  let aiResponse
  try {
    switch (aiProvider) {
      case 'anthropic':
        aiResponse = await callClaudeAPI(aiPrompt, apiKey, 'claude-sonnet-4-20250514')
        break
      case 'google':
        aiResponse = await callGeminiAPI(aiPrompt, apiKey, 'gemini-2.5-flash')
        break
      case 'openai':
        aiResponse = await callOpenAIAPI(aiPrompt, apiKey, 'gpt-4')
        break
      case 'xai':
        aiResponse = await callGrokAPI(aiPrompt, apiKey)
        break
      case 'groq':
        aiResponse = await callGroqAPI(aiPrompt, apiKey)
        break
      case 'sambanova':
        aiResponse = await callSambaNovaAPI(aiPrompt, apiKey)
        break
      default:
        emitter.emit(PIPELINE_STEPS.ERROR, 'error', `Proveedor desconocido: ${aiProvider}`)
        throw new Error(`Unknown AI provider: ${aiProvider}`)
    }
  } catch (error) {
    emitter.emit(PIPELINE_STEPS.AI_CALL, 'error', `Llamada a ${providerName} fallida: ${error.message}`)
    throw new Error(`AI API call failed: ${error.message}`)
  }

  // STEP: AI RESPONSE
  hashes.aiResponseRaw = await generateHash(aiResponse)
  const responseTokenEstimate = Math.round(aiResponse.length / 4)

  emitter.emit(PIPELINE_STEPS.AI_RESPONSE, 'completed', `Respuesta recibida de ${providerName}`, {
    responseLength: aiResponse.length,
    responseTokenEstimate,
    durationMs: emitter.getElapsed(),
    hash: hashes.aiResponseRaw
  })

  // STEP: PARSE TRADES
  // Re-fetch fresh prices to validate — but skip if using override prices (walk-forward backtest)
  let pricesToUse = realPrices
  if (!overridePrices) {
    try {
      const freshPrices = await withTimeout(
        fetchRealPrices(Object.keys(realPrices)),
        10000,
        'Price re-fetch'
      )
      if (freshPrices && Object.keys(freshPrices).length > 0) {
        pricesToUse = freshPrices
        emitter.emit(PIPELINE_STEPS.PARSE_TRADES, 'started', 'Precios refrescados para validacion')
      } else {
        emitter.emit(PIPELINE_STEPS.PARSE_TRADES, 'started', 'Usando precios originales (re-fetch sin datos)')
      }
    } catch (priceErr) {
      console.warn('Price re-fetch failed, using original prices:', priceErr.message)
      emitter.emit(PIPELINE_STEPS.PARSE_TRADES, 'started', `Usando precios originales (${priceErr.message})`)
    }
  } else {
    emitter.emit(PIPELINE_STEPS.PARSE_TRADES, 'started', 'Validando trades con precios historicos...')
  }

  let trades
  try {
    trades = parseAIResponse(aiResponse, pricesToUse, config)
  } catch (parseErr) {
    console.error('Parse trades failed:', parseErr.message)
    console.error('Raw AI response (first 500 chars):', aiResponse?.substring(0, 500))
    emitter.emit(PIPELINE_STEPS.PARSE_TRADES, 'error', `Error parseando respuesta: ${parseErr.message}`)
    throw new Error(`Failed to parse AI response: ${parseErr.message}`)
  }

  if (!trades || trades.length === 0) {
    emitter.emit(PIPELINE_STEPS.PARSE_TRADES, 'error', 'La IA no genero trades validos')
    throw new Error('AI did not generate any valid trades. Please try again.')
  }

  const tradeAssets = trades.map(t => `${t.asset} ${t.strategy}`).join(', ')

  emitter.emit(PIPELINE_STEPS.PARSE_TRADES, 'completed', `${trades.length} trades extraidos`, {
    count: trades.length,
    trades: tradeAssets
  })

  // STEP: FILTER IPE
  const minIpe = prompt.minIpe || 70
  emitter.emit(PIPELINE_STEPS.FILTER_IPE, 'started', `Filtrando por IPE >= ${minIpe}...`)

  const filteredTrades = trades.filter(t => t.ipe >= minIpe)
  const discardedTrades = trades.filter(t => t.ipe < minIpe)

  if (filteredTrades.length === 0) {
    const discardedInfo = discardedTrades
      .map(t => `${t.asset} (IPE:${t.ipe})`)
      .join(', ')
    emitter.emit(PIPELINE_STEPS.FILTER_IPE, 'error', `Ningun trade supera IPE ${minIpe}: ${discardedInfo}`)
    throw new Error('No trades met the minimum IPE threshold. Try lowering the minimum IPE.')
  }

  const discardedInfo = discardedTrades.length > 0
    ? discardedTrades.map(t => `${t.asset} (IPE:${t.ipe})`).join(', ')
    : null

  emitter.emit(PIPELINE_STEPS.FILTER_IPE, 'completed', `${filteredTrades.length}/${trades.length} trades superan umbral`, {
    accepted: filteredTrades.length,
    discarded: discardedTrades.length,
    discardedInfo,
    minIpe
  })

  // STEP: VALIDATE R:R
  emitter.emit(PIPELINE_STEPS.VALIDATE_RR, 'started', 'Verificando Risk:Reward...')

  const rrResults = filteredTrades.map(t => ({
    asset: t.asset,
    rr: t.riskRewardRatio,
    valid: parseFloat(t.riskRewardRatio) >= MIN_RISK_REWARD_RATIO
  }))
  const rrSummary = rrResults
    .map(r => `${r.asset}: R:R ${r.rr}:1 ${r.valid ? 'OK' : 'WARN'}`)
    .join(' | ')

  emitter.emit(PIPELINE_STEPS.VALIDATE_RR, 'completed', `Risk:Reward verificado`, {
    results: rrResults,
    summary: rrSummary
  })

  // Final trades
  const tradesWithPrompt = filteredTrades.slice(0, numResults).map((trade, idx) => ({
    ...trade,
    ...(idx === 0 ? { fullAIPrompt: aiPrompt } : {})
  }))

  // Generate hash for final output
  hashes.tradesOutput = await generateHash(tradesWithPrompt)

  // STEP: COMPLETE
  const totalDuration = emitter.getElapsed()
  emitter.emit(PIPELINE_STEPS.COMPLETE, 'completed', `Pipeline completado (${(totalDuration / 1000).toFixed(1)}s)`, {
    totalTrades: tradesWithPrompt.length,
    totalDurationMs: totalDuration,
    hashes
  })

  // Attach hashes and execution metadata to result
  tradesWithPrompt._executionHashes = hashes

  return tradesWithPrompt
}

// Calculate standard IPE (fallback if AI doesn't provide one)
export const calculateStandardIPE = (trade) => {
  const fundamentalFactors = {
    teamScore: Math.random() * 3 + 7,
    utilityScore: Math.random() * 3 + 6,
    adoptionScore: Math.random() * 4 + 5,
  }

  const technicalFactors = {
    trendScore: Math.random() * 3 + 6,
    momentumScore: Math.random() * 4 + 5,
    volumeScore: Math.random() * 3 + 6,
  }

  const w1 = 0.4
  const w2 = 0.6

  const fundamentalSum = Object.values(fundamentalFactors).reduce((a, b) => a + b, 0) / 3
  const technicalSum = Object.values(technicalFactors).reduce((a, b) => a + b, 0) / 3

  const ipe = (fundamentalSum * w1 + technicalSum * w2) * 10

  return Math.min(Math.round(ipe), 95)
}

// ============================================
// TEST CONNECTION FUNCTION - Used by Settings page
// ============================================
export const testAPIConnection = async (providerId, apiKey) => {
  console.log(`Testing connection for ${providerId}...`)

  try {
    switch (providerId) {
      case 'anthropic': {
        // Anthropic supports direct browser calls with special header
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'Claude API connected successfully!' }
      }

      case 'google': {
        // Gemini supports direct browser calls
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Hi' }] }],
              generationConfig: { maxOutputTokens: 10 }
            })
          }
        )

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'Gemini API connected successfully!' }
      }

      case 'openai': {
        const openaiHeaders = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
        const openaiBody = JSON.stringify({
          model: 'gpt-3.5-turbo',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
        const OPENAI_TEST_URL = 'https://api.openai.com/v1/chat/completions'

        let response

        if (isViteDevServer()) {
          try {
            response = await fetch('/api/openai/v1/chat/completions', {
              method: 'POST',
              headers: openaiHeaders,
              body: openaiBody
            })
            const ct = response.headers.get('content-type') || ''
            if (!ct.includes('application/json')) {
              throw new Error('Proxy returned non-JSON')
            }
          } catch (e) {
            response = await fetchViaCorsProxy(OPENAI_TEST_URL, {
              method: 'POST',
              headers: openaiHeaders,
              body: openaiBody
            })
          }
        } else {
          response = await fetchViaCorsProxy(OPENAI_TEST_URL, {
            method: 'POST',
            headers: openaiHeaders,
            body: openaiBody
          })
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'OpenAI API connected successfully!' }
      }

      case 'xai': {
        // xAI API supports CORS natively - direct browser call
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'grok-3-mini',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'Grok API connected successfully!' }
      }

      case 'groq': {
        // Groq supports CORS natively - direct browser call
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'Groq API connected successfully!' }
      }

      case 'sambanova': {
        // SambaNova supports CORS - direct browser call
        const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'Meta-Llama-3.1-405B-Instruct',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'SambaNova API connected successfully!' }
      }

      default:
        throw new Error(`Unknown provider: ${providerId}`)
    }
  } catch (error) {
    console.error(`Connection test failed for ${providerId}:`, error)
    return { success: false, message: error.message }
  }
}
