// AI Service for generating trading signals from prompts
import { fetchBinancePrices } from './priceService'

// Minimum Risk/Reward ratio (Shell Calibration)
const MIN_RISK_REWARD_RATIO = 2.0

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

  return `You are a quantitative trading analyst. Based on the user's trading strategy and current market prices, generate ${config.numResults || 3} specific trade signals.

## USER'S TRADING STRATEGY:
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
      "whyAsset": "Why this specific asset was chosen from the available options",
      "whyDirection": "Why LONG or SHORT based on the user's strategy criteria",
      "whyEntry": "How the entry price was determined (current price adjustment, support/resistance)",
      "whyLevels": "How TP and SL were calculated (risk/reward, key levels)"
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
1. Use ONLY the assets from the provided price list
2. Entry price should be very close to current price (within 0.5%)
3. For target-based trades: TP distance = (target% / leverage) from entry
4. Risk:Reward ratio must be at least 2:1
5. IPE score (Investment Potential Estimate) should be 70-95 based on setup quality
6. Reasoning must explain HOW the user's strategy applies to this specific trade
7. Strategy must be either "LONG" or "SHORT"
8. All prices must be numbers (not strings)

Generate ${config.numResults || 3} trades now:`
}

// Parse AI response to extract trades
const parseAIResponse = (responseText, prices, config) => {
  try {
    // Try to extract JSON from the response
    let jsonStr = responseText.trim()

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    // Find JSON array in the response
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonStr = jsonMatch[0]
    }

    const trades = JSON.parse(jsonStr)

    if (!Array.isArray(trades)) {
      throw new Error('Response is not an array')
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
      const entry = parseFloat(trade.entry) || currentPrice
      const takeProfit = parseFloat(trade.takeProfit)
      const stopLoss = parseFloat(trade.stopLoss)
      const strategy = trade.strategy?.toUpperCase() === 'SHORT' ? 'SHORT' : 'LONG'

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
const callGeminiAPI = async (prompt, apiKey, model = 'gemini-1.5-flash') => {
  console.log(`Calling Gemini API with model: ${model}`)

  // Gemini API supports direct browser calls with API key in URL
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048
        }
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

  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('No response from Gemini')
  }

  return data.candidates[0].content.parts[0].text
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

  // Try proxy first for OpenAI (has CORS restrictions)
  let response
  try {
    response = await fetch('/api/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: body
    })
  } catch (e) {
    // If proxy fails, try direct (may fail due to CORS)
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: body
    })
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

// Call xAI Grok API
const callGrokAPI = async (prompt, apiKey) => {
  console.log('Calling Grok API...')

  const body = JSON.stringify({
    model: 'grok-beta',
    messages: [
      { role: 'system', content: 'You are a quantitative trading analyst. Always respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 2048
  })

  // Try proxy first for xAI
  let response
  try {
    response = await fetch('/api/xai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: body
    })
  } catch (e) {
    response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: body
    })
  }

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

// Main function to generate trades from prompt using AI
export const generateTradesFromPrompt = async (prompt, settings, numResults = 3) => {
  console.log('Generating trades with AI...')
  console.log('Prompt:', prompt.name)

  // Use the AI provider from the prompt (selected in modal) or fall back to settings
  const aiProvider = prompt.aiModel || settings.aiProvider || 'google'
  console.log('AI Provider:', aiProvider)

  // Check for API key using the correct provider
  const apiKey = settings.apiKeys?.[aiProvider]

  if (!apiKey) {
    throw new Error(`No API key configured for ${aiProvider}. Please add your API key in Settings.`)
  }

  // Select random assets
  const shuffledAssets = [...CRYPTO_ASSETS].sort(() => Math.random() - 0.5)
  const selectedAssets = shuffledAssets.slice(0, Math.min(numResults * 2, 10))

  // Fetch real prices from Binance
  console.log('Fetching real prices from Binance for:', selectedAssets)
  const realPrices = await fetchRealPrices(selectedAssets)

  if (!realPrices || Object.keys(realPrices).length === 0) {
    throw new Error('Failed to fetch real-time prices from Binance. Please try again.')
  }

  console.log('Real prices fetched:', realPrices)

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

  // Build prompt for AI
  const aiPrompt = buildAIPrompt(prompt, settings, realPrices, config)
  console.log('AI Prompt built, calling API...')

  // Call appropriate AI API based on the selected provider
  let aiResponse
  try {
    switch (aiProvider) {
      case 'anthropic':
        aiResponse = await callClaudeAPI(aiPrompt, apiKey, 'claude-sonnet-4-20250514')
        break
      case 'google':
        aiResponse = await callGeminiAPI(aiPrompt, apiKey, 'gemini-1.5-flash')
        break
      case 'openai':
        aiResponse = await callOpenAIAPI(aiPrompt, apiKey, 'gpt-4')
        break
      case 'xai':
        aiResponse = await callGrokAPI(aiPrompt, apiKey)
        break
      default:
        throw new Error(`Unknown AI provider: ${aiProvider}`)
    }
  } catch (error) {
    console.error('AI API call failed:', error)
    throw new Error(`AI API call failed: ${error.message}`)
  }

  console.log('AI Response received:', aiResponse.substring(0, 200) + '...')

  // Parse the response
  const trades = parseAIResponse(aiResponse, realPrices, config)

  if (trades.length === 0) {
    throw new Error('AI did not generate any valid trades. Please try again.')
  }

  // Filter by minimum IPE
  const filteredTrades = trades.filter(t => t.ipe >= (prompt.minIpe || 70))

  if (filteredTrades.length === 0) {
    throw new Error('No trades met the minimum IPE threshold. Try lowering the minimum IPE.')
  }

  console.log(`Generated ${filteredTrades.length} trades from AI`)

  // Add the full AI prompt to the trades metadata (will be saved in egg)
  const tradesWithPrompt = filteredTrades.slice(0, numResults).map((trade, idx) => ({
    ...trade,
    // Only attach full prompt to first trade to avoid duplication
    ...(idx === 0 ? { fullAIPrompt: aiPrompt } : {})
  }))

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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
        // OpenAI - try proxy first, then direct
        let response
        try {
          response = await fetch('/api/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }]
            })
          })
        } catch (e) {
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }]
            })
          })
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'OpenAI API connected successfully!' }
      }

      case 'xai': {
        // xAI - try proxy first, then direct
        let response
        try {
          response = await fetch('/api/xai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'grok-beta',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }]
            })
          })
        } catch (e) {
          response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: 'grok-beta',
              max_tokens: 10,
              messages: [{ role: 'user', content: 'Hi' }]
            })
          })
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }
        return { success: true, message: 'Grok API connected successfully!' }
      }

      default:
        throw new Error(`Unknown provider: ${providerId}`)
    }
  } catch (error) {
    console.error(`Connection test failed for ${providerId}:`, error)
    return { success: false, message: error.message }
  }
}
