/**
 * @fileoverview Step 3: Generate AI prompt from context
 * @module trading/pipeline/steps/generatePrompt
 */

/**
 * Format price for display
 * @param {number} price - Price value
 * @returns {string} Formatted price
 */
function formatPrice(price) {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(8);
}

/**
 * Format large numbers with suffix
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatVolume(num) {
  if (!num) return 'N/A';
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

/**
 * Build the system prompt for the AI
 * @returns {string} System prompt
 */
function buildSystemPrompt() {
  return `You are an expert cryptocurrency trading analyst with deep knowledge of technical analysis, market dynamics, and risk management.

Your role is to analyze trading strategies and current market conditions to generate high-quality trade recommendations.

IMPORTANT GUIDELINES:
1. Always prioritize risk management - never suggest trades with risk/reward ratio below 2:1
2. Be specific with entry, take profit, and stop loss levels
3. Explain your reasoning clearly for transparency
4. Consider current market conditions and volatility
5. Only recommend trades with high conviction (IPE score 70+)

You must respond ONLY with valid JSON - no markdown, no explanations outside the JSON structure.`;
}

/**
 * Build the market data section
 * @param {Object[]} pricesSummary - Price summary array
 * @returns {string} Market data section
 */
function buildMarketDataSection(pricesSummary) {
  let section = '## CURRENT MARKET PRICES (Binance)\n\n';
  section += '| Asset | Price | 24h Change | 24h High | 24h Low | Volume |\n';
  section += '|-------|-------|------------|----------|---------|--------|\n';

  for (const asset of pricesSummary.slice(0, 15)) {
    const change = asset.change24h !== undefined
      ? `${asset.change24h >= 0 ? '+' : ''}${asset.change24h.toFixed(2)}%`
      : 'N/A';

    section += `| ${asset.symbol} | ${formatPrice(asset.price)} | ${change} | `;
    section += `${asset.high24h ? formatPrice(asset.high24h) : 'N/A'} | `;
    section += `${asset.low24h ? formatPrice(asset.low24h) : 'N/A'} | `;
    section += `${formatVolume(asset.volume24h)} |\n`;
  }

  return section;
}

/**
 * Build the market analysis section
 * @param {Object} marketAnalysis - Market analysis data
 * @returns {string} Analysis section
 */
function buildMarketAnalysisSection(marketAnalysis) {
  let section = '\n## MARKET ANALYSIS\n\n';

  section += `**Average 24h Change:** ${marketAnalysis.averageChange >= 0 ? '+' : ''}${marketAnalysis.averageChange.toFixed(2)}%\n\n`;

  if (marketAnalysis.topGainers.length > 0) {
    section += '**Top Gainers:**\n';
    marketAnalysis.topGainers.forEach(g => {
      section += `- ${g.symbol}: +${g.change.toFixed(2)}%\n`;
    });
  }

  if (marketAnalysis.topLosers.length > 0) {
    section += '\n**Top Losers:**\n';
    marketAnalysis.topLosers.forEach(l => {
      section += `- ${l.symbol}: ${l.change.toFixed(2)}%\n`;
    });
  }

  if (marketAnalysis.nearSupport.length > 0) {
    section += '\n**Near Support (potential long opportunities):**\n';
    marketAnalysis.nearSupport.forEach(s => {
      section += `- ${s.symbol}: ${s.distancePercent.toFixed(2)}% from 24h low\n`;
    });
  }

  if (marketAnalysis.nearResistance.length > 0) {
    section += '\n**Near Resistance (potential short opportunities):**\n';
    marketAnalysis.nearResistance.forEach(r => {
      section += `- ${r.symbol}: ${r.distancePercent.toFixed(2)}% from 24h high\n`;
    });
  }

  return section;
}

/**
 * Build the configuration section
 * @param {Object} positionSizing - Position sizing data
 * @param {Object} executionParams - Execution parameters
 * @returns {string} Configuration section
 */
function buildConfigSection(positionSizing, executionParams) {
  let section = '\n## TRADING CONFIGURATION\n\n';

  section += `- **Timeframe:** ${executionParams.timeframe} (${executionParams.description})\n`;
  section += `- **Total Capital:** $${positionSizing.totalCapital.toLocaleString()}\n`;
  section += `- **Capital per Trade:** $${positionSizing.capitalPerTrade.toLocaleString()}\n`;
  section += `- **Leverage:** ${positionSizing.leverage}x\n`;
  section += `- **Effective Position Size:** $${positionSizing.effectiveCapital.toLocaleString()}\n`;
  section += `- **Max Risk per Trade:** $${positionSizing.maxRiskPerTrade.toFixed(2)} (${positionSizing.maxRiskPercent}%)\n`;
  section += `- **Number of Trades Required:** ${positionSizing.numTrades}\n`;
  section += `- **Target Profit:** ${executionParams.targetPercent}%\n`;
  section += `- **Minimum Risk/Reward:** ${executionParams.minRiskReward}:1\n`;

  return section;
}

/**
 * Build the output format section
 * @param {number} numResults - Number of trades to generate
 * @returns {string} Output format section
 */
function buildOutputFormatSection(numResults) {
  return `
## REQUIRED OUTPUT FORMAT

You MUST respond with a JSON array containing exactly ${numResults} trade recommendation(s).
Each trade MUST follow this exact structure:

\`\`\`json
[
  {
    "asset": "BTC/USDT",
    "strategy": "LONG",
    "entry": 95000.00,
    "takeProfit": 100000.00,
    "stopLoss": 92000.00,
    "ipe": 85,
    "summary": "Brief one-line summary of the trade thesis",
    "reasoning": {
      "whyAsset": "Detailed explanation of why this asset was selected from all candidates",
      "whyDirection": "Detailed explanation of why LONG or SHORT based on technical/fundamental factors",
      "whyEntry": "Explanation of how the entry price was determined",
      "whyLevels": "Explanation of how TP and SL levels were calculated, including R:R ratio"
    },
    "criteriaMatched": [
      { "criterion": "RSI oversold", "value": "28", "threshold": "<30", "passed": true },
      { "criterion": "Volume spike", "value": "+45%", "threshold": ">20%", "passed": true },
      { "criterion": "Near support", "value": "2.1%", "threshold": "<5%", "passed": true }
    ],
    "confidenceFactors": [
      { "factor": "Technical Signal Strength", "weight": 40, "score": 85, "contribution": 34 },
      { "factor": "Risk Management Quality", "weight": 30, "score": 80, "contribution": 24 },
      { "factor": "Market Context", "weight": 20, "score": 75, "contribution": 15 },
      { "factor": "Volume Confirmation", "weight": 10, "score": 90, "contribution": 9 }
    ]
  }
]
\`\`\`

CRITICAL REQUIREMENTS:
1. IPE (Investment Potential Estimate) must be between 70-95
2. Risk/Reward ratio must be at least 2:1
3. Entry price must be within 5% of current market price
4. Include at least 3 criteria in criteriaMatched
5. Confidence factors weights must sum to 100
6. All prices must be realistic based on current market data
7. DO NOT include any text outside the JSON array
`;
}

/**
 * Generate prompt step definition
 */
export const generatePromptStep = {
  name: 'generatePrompt',
  description: 'Generates the AI prompt from trading context',

  inputSchema: {
    type: 'object',
    required: ['buildContext'],
    properties: {
      buildContext: { type: 'object' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      systemPrompt: { type: 'string' },
      userPrompt: { type: 'string' },
      fullPrompt: { type: 'string' }
    }
  },

  timeout: 5000,
  optional: false,

  /**
   * Execute the generate prompt step
   * @param {Object} context - Pipeline context
   * @returns {Promise<Object>} Generated prompts
   */
  async execute(context) {
    const { telemetry } = context;
    const { prompt } = context.input;
    const {
      marketAnalysis,
      positionSizing,
      executionParams,
      pricesSummary,
      config
    } = context.results.buildContext;

    telemetry?.debug('generatePrompt', 'Building AI prompt', {
      strategyName: prompt?.name,
      numResults: config.numResults
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt();

    // Build user prompt sections
    let userPrompt = `# TRADE GENERATION REQUEST\n\n`;

    // Strategy section
    userPrompt += `## USER'S TRADING STRATEGY: "${prompt?.name || 'Custom Strategy'}"\n\n`;
    userPrompt += `${prompt?.content || 'Generate trades based on technical analysis and current market conditions.'}\n\n`;

    // Market data
    userPrompt += buildMarketDataSection(pricesSummary);

    // Market analysis
    userPrompt += buildMarketAnalysisSection(marketAnalysis);

    // Configuration
    userPrompt += buildConfigSection(positionSizing, executionParams);

    // Output format
    userPrompt += buildOutputFormatSection(config.numResults);

    // Combine for full prompt (for providers that don't support system messages)
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;

    const promptLength = fullPrompt.length;
    const estimatedTokens = Math.ceil(promptLength / 4); // Rough estimate

    telemetry?.info('generatePrompt', 'Prompt generated', {
      promptLength,
      estimatedTokens,
      sections: ['strategy', 'marketData', 'analysis', 'config', 'outputFormat']
    });

    return {
      systemPrompt,
      userPrompt,
      fullPrompt,
      metadata: {
        promptLength,
        estimatedTokens,
        strategyName: prompt?.name,
        timestamp: Date.now()
      }
    };
  }
};

// Export utilities
export {
  buildSystemPrompt,
  buildMarketDataSection,
  buildMarketAnalysisSection,
  buildConfigSection,
  buildOutputFormatSection,
  formatPrice,
  formatVolume
};

export default generatePromptStep;
