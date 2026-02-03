/**
 * @fileoverview Glass Box Builder for trade transparency
 * @module trading/glassbox
 *
 * Glass Box Trading provides full transparency into how trades are generated,
 * including reasoning, criteria matched, confidence factors, and full audit trail.
 */

/**
 * GlassBoxBuilder - Builder pattern for creating transparent trade explanations
 *
 * @example
 * const glassBox = new GlassBoxBuilder(trade, context)
 *   .addReasoning()
 *   .addCriteriaMatched()
 *   .addConfidenceFactors()
 *   .addValidationResults()
 *   .addAuditTrail()
 *   .build();
 */
export class GlassBoxBuilder {
  /**
   * @param {Object} trade - Trade object
   * @param {Object} context - Pipeline context
   */
  constructor(trade, context) {
    this.trade = trade;
    this.context = context;
    this.sections = [];
  }

  /**
   * Add reasoning section explaining trade decisions
   * @returns {this} For chaining
   */
  addReasoning() {
    const reasoning = this.trade.reasoning || {};

    // Enhance reasoning with computed explanations if missing
    const enhancedReasoning = {
      whyAsset: reasoning.whyAsset || this._generateAssetExplanation(),
      whyDirection: reasoning.whyDirection || this._generateDirectionExplanation(),
      whyEntry: reasoning.whyEntry || this._generateEntryExplanation(),
      whyLevels: reasoning.whyLevels || this._generateLevelsExplanation()
    };

    this.sections.push({
      type: 'reasoning',
      data: enhancedReasoning
    });

    return this;
  }

  /**
   * Add criteria matched section
   * @returns {this} For chaining
   */
  addCriteriaMatched() {
    let criteria = this.trade.criteriaMatched || [];

    // Ensure criteria have all required fields
    criteria = criteria.map(c => ({
      criterion: c.criterion || 'Unknown',
      value: c.value || 'N/A',
      threshold: c.threshold || 'N/A',
      passed: c.passed !== undefined ? c.passed : true
    }));

    // Add computed criteria if none provided
    if (criteria.length === 0) {
      criteria = this._computeBasicCriteria();
    }

    this.sections.push({
      type: 'criteriaMatched',
      data: criteria
    });

    return this;
  }

  /**
   * Add confidence factors breakdown
   * @returns {this} For chaining
   */
  addConfidenceFactors() {
    let factors = this.trade.confidenceFactors || [];

    // Ensure factors have all required fields
    factors = factors.map(f => ({
      factor: f.factor || 'Unknown',
      weight: f.weight || 0,
      score: f.score || 0,
      contribution: f.contribution || (f.weight * f.score / 100)
    }));

    // Add computed factors if none provided
    if (factors.length === 0) {
      factors = this._computeDefaultFactors();
    }

    // Calculate totals
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);

    this.sections.push({
      type: 'confidenceFactors',
      data: {
        factors,
        totals: {
          weight: totalWeight,
          score: Math.round(totalScore),
          normalized: totalWeight > 0 ? Math.round(totalScore) : 0
        }
      }
    });

    return this;
  }

  /**
   * Add validation results section
   * @returns {this} For chaining
   */
  addValidationResults() {
    const validationResults = this.trade.validationResults ||
                             this.context.results?.validateTrades?.validationResults?.find(
                               v => v.tradeId === this.trade.id
                             )?.results ||
                             [];

    this.sections.push({
      type: 'validationResults',
      data: {
        results: validationResults,
        summary: {
          total: validationResults.length,
          passed: validationResults.filter(r => r.passed).length,
          failed: validationResults.filter(r => !r.passed).length,
          warnings: validationResults.filter(r => r.severity === 'warning' && !r.passed).length
        }
      }
    });

    return this;
  }

  /**
   * Add full audit trail
   * @returns {this} For chaining
   */
  addAuditTrail() {
    const aiMetadata = this.context.results?.callAI?.metadata || {};
    const pipelineLogs = this.context.logs || [];

    this.sections.push({
      type: 'auditTrail',
      data: {
        executionId: this.context.executionId,
        timestamp: Date.now(),
        pipeline: {
          steps: pipelineLogs.map(log => ({
            step: log.step,
            status: log.status,
            duration: log.duration
          })),
          totalDuration: this.context.duration || (Date.now() - this.context.startTime)
        },
        ai: {
          provider: aiMetadata.provider || 'unknown',
          model: aiMetadata.model || 'unknown',
          latency: aiMetadata.latency,
          tokensUsed: aiMetadata.tokensUsed
        },
        prompts: {
          systemPrompt: aiMetadata.promptUsed?.system?.substring(0, 200) + '...',
          userPromptLength: aiMetadata.promptUsed?.user?.length || 0
        }
      }
    });

    return this;
  }

  /**
   * Add market context section
   * @returns {this} For chaining
   */
  addMarketContext() {
    const marketAnalysis = this.context.results?.buildContext?.marketAnalysis || {};
    const prices = this.context.results?.fetchPrices?.prices || {};
    const assetPrice = prices[this.trade.asset];

    this.sections.push({
      type: 'marketContext',
      data: {
        asset: {
          symbol: this.trade.asset,
          currentPrice: assetPrice?.price,
          change24h: assetPrice?.priceChangePercent,
          high24h: assetPrice?.high24h,
          low24h: assetPrice?.low24h,
          volume24h: assetPrice?.quoteVolume24h
        },
        market: {
          averageChange: marketAnalysis.averageChange,
          topGainers: marketAnalysis.topGainers?.slice(0, 3),
          topLosers: marketAnalysis.topLosers?.slice(0, 3)
        }
      }
    });

    return this;
  }

  /**
   * Add risk analysis section
   * @returns {this} For chaining
   */
  addRiskAnalysis() {
    const { entry, takeProfit, stopLoss, strategy, leverage, capital } = this.trade;

    const isLong = strategy === 'LONG';
    const reward = isLong ? takeProfit - entry : entry - takeProfit;
    const risk = isLong ? entry - stopLoss : stopLoss - entry;
    const riskRewardRatio = risk > 0 ? reward / risk : 0;

    const riskPercent = (risk / entry) * 100;
    const rewardPercent = (reward / entry) * 100;

    // Calculate position details
    const positionSize = capital * leverage;
    const maxLoss = positionSize * (riskPercent / 100);
    const potentialProfit = positionSize * (rewardPercent / 100);

    this.sections.push({
      type: 'riskAnalysis',
      data: {
        levels: {
          entry,
          takeProfit,
          stopLoss,
          currentPrice: this.trade.currentPrice
        },
        ratios: {
          riskReward: parseFloat(riskRewardRatio.toFixed(2)),
          riskPercent: parseFloat(riskPercent.toFixed(2)),
          rewardPercent: parseFloat(rewardPercent.toFixed(2))
        },
        position: {
          capital,
          leverage,
          positionSize,
          maxLoss: parseFloat(maxLoss.toFixed(2)),
          potentialProfit: parseFloat(potentialProfit.toFixed(2))
        },
        assessment: this._assessRisk(riskRewardRatio, leverage, riskPercent)
      }
    });

    return this;
  }

  /**
   * Build the final Glass Box object
   * @returns {Object} Complete Glass Box
   */
  build() {
    const glassBox = {
      tradeId: this.trade.id,
      asset: this.trade.asset,
      strategy: this.trade.strategy,
      generatedAt: new Date().toISOString()
    };

    // Merge all sections
    for (const section of this.sections) {
      glassBox[section.type] = section.data;
    }

    return glassBox;
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Generate asset selection explanation
   * @private
   */
  _generateAssetExplanation() {
    const { asset } = this.trade;
    const prices = this.context.results?.fetchPrices?.prices || {};
    const assetData = prices[asset];

    if (!assetData) {
      return `${asset} selected based on strategy criteria`;
    }

    const change = assetData.priceChangePercent;
    const changeText = change !== undefined
      ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}% in 24h`
      : '';

    return `${asset} selected. Current price: $${assetData.price?.toLocaleString()}${changeText ? `, ${changeText}` : ''}`;
  }

  /**
   * Generate direction explanation
   * @private
   */
  _generateDirectionExplanation() {
    const { strategy, ipe } = this.trade;
    return `${strategy} position recommended with ${ipe}% confidence based on technical analysis`;
  }

  /**
   * Generate entry explanation
   * @private
   */
  _generateEntryExplanation() {
    const { entry, currentPrice } = this.trade;
    const deviation = currentPrice ? ((entry - currentPrice) / currentPrice * 100) : 0;

    return `Entry at $${entry.toLocaleString()}, ${Math.abs(deviation).toFixed(2)}% ${deviation >= 0 ? 'above' : 'below'} current price`;
  }

  /**
   * Generate levels explanation
   * @private
   */
  _generateLevelsExplanation() {
    const { entry, takeProfit, stopLoss, riskRewardRatio } = this.trade;

    const tpPercent = ((takeProfit - entry) / entry * 100).toFixed(2);
    const slPercent = ((stopLoss - entry) / entry * 100).toFixed(2);

    return `TP at $${takeProfit.toLocaleString()} (${tpPercent >= 0 ? '+' : ''}${tpPercent}%), SL at $${stopLoss.toLocaleString()} (${slPercent}%). R:R ratio: ${riskRewardRatio || 'N/A'}:1`;
  }

  /**
   * Compute basic criteria from trade data
   * @private
   */
  _computeBasicCriteria() {
    const { riskRewardRatio, ipe, leverage } = this.trade;
    const config = this.context.results?.buildContext?.config || {};

    return [
      {
        criterion: 'Risk/Reward Ratio',
        value: `${riskRewardRatio}:1`,
        threshold: `>= ${config.minRiskReward || 2}:1`,
        passed: riskRewardRatio >= (config.minRiskReward || 2)
      },
      {
        criterion: 'IPE Score',
        value: `${ipe}%`,
        threshold: `>= ${config.minIpe || 70}%`,
        passed: ipe >= (config.minIpe || 70)
      },
      {
        criterion: 'Leverage',
        value: `${leverage}x`,
        threshold: '<= 50x',
        passed: leverage <= 50
      }
    ];
  }

  /**
   * Compute default confidence factors
   * @private
   */
  _computeDefaultFactors() {
    const { ipe, riskRewardRatio } = this.trade;

    // Derive scores from available data
    const technicalScore = Math.min(95, ipe + 5);
    const riskScore = Math.min(95, 70 + (riskRewardRatio * 5));
    const marketScore = 75; // Default moderate confidence

    return [
      {
        factor: 'Technical Signal Strength',
        weight: 40,
        score: technicalScore,
        contribution: Math.round(40 * technicalScore / 100)
      },
      {
        factor: 'Risk Management Quality',
        weight: 35,
        score: riskScore,
        contribution: Math.round(35 * riskScore / 100)
      },
      {
        factor: 'Market Context',
        weight: 25,
        score: marketScore,
        contribution: Math.round(25 * marketScore / 100)
      }
    ];
  }

  /**
   * Assess overall risk level
   * @private
   */
  _assessRisk(riskRewardRatio, leverage, riskPercent) {
    let level = 'moderate';
    const warnings = [];

    if (riskRewardRatio < 1.5) {
      level = 'high';
      warnings.push('Low risk/reward ratio');
    }

    if (leverage > 20) {
      level = 'high';
      warnings.push('High leverage');
    } else if (leverage > 10) {
      if (level !== 'high') level = 'moderate';
      warnings.push('Elevated leverage');
    }

    if (riskPercent > 5) {
      level = 'high';
      warnings.push('Large stop loss distance');
    }

    if (warnings.length === 0) {
      level = 'low';
    }

    return {
      level,
      warnings,
      recommendation: level === 'high'
        ? 'Consider reducing position size or leverage'
        : level === 'moderate'
          ? 'Risk is acceptable, ensure proper position sizing'
          : 'Risk parameters are well-balanced'
    };
  }
}

/**
 * Create a Glass Box with all sections
 * @param {Object} trade - Trade object
 * @param {Object} context - Pipeline context
 * @returns {Object} Complete Glass Box
 */
export function createFullGlassBox(trade, context) {
  return new GlassBoxBuilder(trade, context)
    .addReasoning()
    .addCriteriaMatched()
    .addConfidenceFactors()
    .addValidationResults()
    .addMarketContext()
    .addRiskAnalysis()
    .addAuditTrail()
    .build();
}

/**
 * Create a minimal Glass Box (for performance)
 * @param {Object} trade - Trade object
 * @param {Object} context - Pipeline context
 * @returns {Object} Minimal Glass Box
 */
export function createMinimalGlassBox(trade, context) {
  return new GlassBoxBuilder(trade, context)
    .addReasoning()
    .addCriteriaMatched()
    .addConfidenceFactors()
    .build();
}

export default GlassBoxBuilder;
