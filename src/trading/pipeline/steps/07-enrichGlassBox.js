/**
 * @fileoverview Step 7: Enrich trades with Glass Box transparency data
 * @module trading/pipeline/steps/enrichGlassBox
 */

import { GlassBoxBuilder } from '../../glassbox/index.js';

/**
 * Enrich Glass Box step definition
 */
export const enrichGlassBoxStep = {
  name: 'enrichGlassBox',
  description: 'Enriches trades with full Glass Box transparency data',

  inputSchema: {
    type: 'object',
    required: ['validateTrades'],
    properties: {
      validateTrades: { type: 'object' }
    }
  },

  outputSchema: {
    type: 'object',
    properties: {
      trades: { type: 'array' },
      glassBoxData: { type: 'object' }
    }
  },

  timeout: 5000,
  optional: false,

  /**
   * Execute the enrich Glass Box step
   * @param {Object} context - Pipeline context
   * @returns {Promise<Object>} Enriched trades
   */
  async execute(context) {
    const { telemetry } = context;
    const { validTrades, invalidTrades, validationResults } = context.results.validateTrades;
    const { metadata: aiMetadata } = context.results.callAI;

    telemetry?.debug('enrichGlassBox', `Enriching ${validTrades.length} trades with Glass Box data`);

    const enrichedTrades = [];
    const glassBoxData = {
      trades: {},
      summary: null
    };

    for (const trade of validTrades) {
      // Build Glass Box for this trade
      const glassBox = new GlassBoxBuilder(trade, context)
        .addReasoning()
        .addCriteriaMatched()
        .addConfidenceFactors()
        .addValidationResults()
        .addAuditTrail()
        .build();

      // Merge Glass Box into trade
      const enrichedTrade = {
        ...trade,
        glassBox
      };

      enrichedTrades.push(enrichedTrade);
      glassBoxData.trades[trade.id] = glassBox;
    }

    // Build summary Glass Box for the entire execution
    glassBoxData.summary = {
      executionId: context.executionId,
      timestamp: Date.now(),
      totalGenerated: validTrades.length + invalidTrades.length,
      totalValid: validTrades.length,
      totalInvalid: invalidTrades.length,
      aiProvider: aiMetadata.provider,
      aiModel: aiMetadata.model,
      latency: aiMetadata.latency,
      tokensUsed: aiMetadata.tokensUsed,
      pipelineSteps: context.logs,
      validationSummary: validationResults.map(r => ({
        tradeId: r.tradeId,
        asset: r.asset,
        valid: r.valid,
        checksCount: r.results.length,
        passedCount: r.results.filter(v => v.passed).length
      }))
    };

    telemetry?.info('enrichGlassBox', 'Glass Box enrichment complete', {
      enrichedCount: enrichedTrades.length,
      hasSummary: true
    });

    return {
      trades: enrichedTrades,
      invalidTrades,
      glassBoxData,
      metadata: {
        enrichedCount: enrichedTrades.length,
        timestamp: Date.now()
      }
    };
  }
};

export default enrichGlassBoxStep;
