/**
 * @fileoverview React hook for using the trade pipeline
 * @module trading/hooks/useTradePipeline
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { TradePipeline } from '../pipeline/index.js';
import {
  fetchPricesStep,
  buildContextStep,
  generatePromptStep,
  callAIStep,
  parseResponseStep,
  validateTradesStep,
  enrichGlassBoxStep
} from '../pipeline/steps/index.js';

/**
 * Hook states
 */
const STATES = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * Create a configured pipeline instance
 * @param {Object} options - Pipeline options
 * @returns {TradePipeline} Configured pipeline
 */
function createConfiguredPipeline(options = {}) {
  const pipeline = new TradePipeline(options);

  // Add all steps in order
  pipeline
    .addStep(fetchPricesStep)
    .addStep(buildContextStep)
    .addStep(generatePromptStep)
    .addStep(callAIStep)
    .addStep(parseResponseStep)
    .addStep(validateTradesStep)
    .addStep(enrichGlassBoxStep);

  return pipeline;
}

/**
 * React hook for using the trade generation pipeline
 *
 * @param {Object} options - Hook options
 * @param {Function} options.onStepStart - Callback when step starts
 * @param {Function} options.onStepComplete - Callback when step completes
 * @param {Function} options.onComplete - Callback when pipeline completes
 * @param {Function} options.onError - Callback when error occurs
 * @returns {Object} Hook state and controls
 *
 * @example
 * function TradeGenerator() {
 *   const {
 *     state,
 *     events,
 *     trades,
 *     error,
 *     execute,
 *     reset
 *   } = useTradePipeline({
 *     onComplete: (result) => console.log('Done!', result),
 *     onError: (err) => console.error('Failed:', err)
 *   });
 *
 *   const handleGenerate = () => {
 *     execute({
 *       prompt: { name: 'My Strategy', content: '...' },
 *       config: { capital: 1000, leverage: 5 }
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleGenerate} disabled={state === 'running'}>
 *         Generate Trades
 *       </button>
 *       <GenerationProgress events={events} />
 *       {trades && <TradeList trades={trades} />}
 *     </div>
 *   );
 * }
 */
export function useTradePipeline(options = {}) {
  const {
    onStepStart,
    onStepComplete,
    onComplete,
    onError
  } = options;

  // State
  const [state, setState] = useState(STATES.IDLE);
  const [events, setEvents] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Refs for cleanup
  const pipelineRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setState(STATES.IDLE);
    setEvents([]);
    setResult(null);
    setError(null);
  }, []);

  /**
   * Execute the pipeline
   * @param {Object} input - Pipeline input
   * @param {Object} input.prompt - Strategy prompt
   * @param {Object} input.config - Trade configuration
   */
  const execute = useCallback(async (input) => {
    // Reset state
    setState(STATES.RUNNING);
    setEvents([]);
    setResult(null);
    setError(null);

    // Create abort controller
    abortControllerRef.current = new AbortController();

    // Create pipeline
    const pipeline = createConfiguredPipeline({
      enableTelemetry: true
    });
    pipelineRef.current = pipeline;

    // Subscribe to events
    pipeline.on('step:start', (data) => {
      setEvents(prev => [...prev, {
        type: 'step:start',
        timestamp: Date.now(),
        ...data
      }]);
      onStepStart?.(data);
    });

    pipeline.on('step:complete', (data) => {
      setEvents(prev => [...prev, {
        type: 'step:complete',
        timestamp: Date.now(),
        ...data
      }]);
      onStepComplete?.(data);
    });

    pipeline.on('step:error', (data) => {
      setEvents(prev => [...prev, {
        type: 'step:error',
        timestamp: Date.now(),
        ...data
      }]);
    });

    try {
      // Execute pipeline
      const pipelineResult = await pipeline.execute(input);

      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      // Check for pipeline error
      if (pipelineResult.error) {
        throw pipelineResult.error;
      }

      // Success
      setResult(pipelineResult);
      setState(STATES.SUCCESS);
      onComplete?.(pipelineResult);

    } catch (err) {
      // Check if aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setError(err.message || 'Pipeline execution failed');
      setState(STATES.ERROR);
      onError?.(err);
    }
  }, [onStepStart, onStepComplete, onComplete, onError]);

  /**
   * Cancel running pipeline
   */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setState(STATES.IDLE);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Derived values
  const isRunning = state === STATES.RUNNING;
  const isComplete = state === STATES.SUCCESS;
  const hasError = state === STATES.ERROR;

  // Extract trades from result
  const trades = result?.results?.enrichGlassBox?.trades || [];
  const invalidTrades = result?.results?.enrichGlassBox?.invalidTrades || [];
  const glassBoxData = result?.results?.enrichGlassBox?.glassBoxData || null;

  // Get telemetry summary
  const telemetrySummary = result?.telemetry?.getSummary() || null;

  return {
    // State
    state,
    isRunning,
    isComplete,
    hasError,

    // Data
    events,
    result,
    trades,
    invalidTrades,
    glassBoxData,
    telemetrySummary,
    error,

    // Actions
    execute,
    cancel,
    reset
  };
}

/**
 * Simpler hook that just returns the execute function
 * Useful when you don't need full state management
 *
 * @returns {Function} Execute function
 */
export function useTradeGenerator() {
  const execute = useCallback(async (input) => {
    const pipeline = createConfiguredPipeline();
    return pipeline.execute(input);
  }, []);

  return execute;
}

export default useTradePipeline;
