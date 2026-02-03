/**
 * @fileoverview Pipeline Orchestrator for trade generation
 * @module trading/pipeline
 */

import { PipelineTelemetry, createTelemetry } from '../telemetry/index.js';
import { generateExecutionId } from '../types/index.js';

/**
 * Event emitter mixin for pipeline observability
 */
class EventEmitter {
  constructor() {
    this._listeners = new Map();
  }

  /**
   * Register event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {this} For chaining
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return this;
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback to remove
   * @returns {this} For chaining
   */
  off(event, callback) {
    const listeners = this._listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  /**
   * Emit event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const listeners = this._listeners.get(event) || [];
    for (const callback of listeners) {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  /**
   * Register one-time event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {this} For chaining
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }
}

/**
 * Pipeline step wrapper with metadata
 */
class PipelineStepWrapper {
  constructor(step) {
    this.name = step.name;
    this.description = step.description || '';
    this.execute = step.execute;
    this.optional = step.optional || false;
    this.timeout = step.timeout || 30000; // 30s default
    this.retries = step.retries || 0;
    this.inputSchema = step.inputSchema || null;
    this.outputSchema = step.outputSchema || null;
  }
}

/**
 * TradePipeline - Observable pipeline for trade generation
 *
 * @example
 * const pipeline = new TradePipeline()
 *   .addStep(fetchPricesStep)
 *   .addStep(buildContextStep)
 *   .addStep(generatePromptStep)
 *   .addStep(callAIStep)
 *   .addStep(parseResponseStep)
 *   .addStep(validateTradesStep)
 *   .addStep(enrichGlassBoxStep);
 *
 * pipeline.on('step:start', ({ step }) => console.log(`Starting: ${step}`));
 * pipeline.on('step:complete', ({ step, duration }) => console.log(`Done: ${step} in ${duration}ms`));
 *
 * const result = await pipeline.execute({ prompt, config });
 */
export class TradePipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    this.steps = [];
    this.options = {
      stopOnError: true,
      enableTelemetry: true,
      ...options
    };
  }

  /**
   * Add a step to the pipeline
   * @param {Object|Function} step - Step object or execution function
   * @param {Object} [options] - Step options if step is a function
   * @returns {this} For chaining
   */
  addStep(step, options = {}) {
    if (typeof step === 'function') {
      step = {
        name: step.name || `step-${this.steps.length + 1}`,
        execute: step,
        ...options
      };
    }

    this.steps.push(new PipelineStepWrapper(step));
    return this;
  }

  /**
   * Insert a step at a specific position
   * @param {number} index - Position to insert at
   * @param {Object} step - Step to insert
   * @returns {this} For chaining
   */
  insertStep(index, step) {
    if (typeof step === 'function') {
      step = { name: step.name || `step-${index}`, execute: step };
    }
    this.steps.splice(index, 0, new PipelineStepWrapper(step));
    return this;
  }

  /**
   * Remove a step by name
   * @param {string} name - Step name to remove
   * @returns {this} For chaining
   */
  removeStep(name) {
    this.steps = this.steps.filter(s => s.name !== name);
    return this;
  }

  /**
   * Get step by name
   * @param {string} name - Step name
   * @returns {PipelineStepWrapper|undefined} Step or undefined
   */
  getStep(name) {
    return this.steps.find(s => s.name === name);
  }

  /**
   * Execute the pipeline
   * @param {Object} input - Pipeline input
   * @param {Object} input.prompt - Strategy prompt
   * @param {Object} input.config - Trade configuration
   * @returns {Promise<Object>} Pipeline context with results
   */
  async execute(input) {
    const executionId = generateExecutionId();
    const telemetry = this.options.enableTelemetry
      ? createTelemetry(executionId)
      : null;

    const context = {
      executionId,
      input,
      results: {},
      logs: [],
      telemetry,
      startTime: Date.now(),
      currentStep: null,
      completedSteps: [],
      failedSteps: []
    };

    this.emit('pipeline:start', {
      executionId,
      input: this._summarizeInput(input),
      stepsCount: this.steps.length
    });

    telemetry?.info('pipeline', 'Pipeline execution started', {
      stepsCount: this.steps.length,
      config: input.config
    });

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      context.currentStep = step.name;

      try {
        const result = await this._executeStep(step, context, i);
        context.results[step.name] = result;
        context.completedSteps.push(step.name);
      } catch (error) {
        context.failedSteps.push({ step: step.name, error: error.message });

        if (!step.optional && this.options.stopOnError) {
          this.emit('pipeline:error', {
            executionId,
            step: step.name,
            error: error.message,
            context: this._summarizeContext(context)
          });

          telemetry?.error('pipeline', `Pipeline failed at step: ${step.name}`, {
            error: error.message
          });

          context.error = error;
          context.endTime = Date.now();
          context.duration = context.endTime - context.startTime;

          return context;
        }
      }
    }

    context.endTime = Date.now();
    context.duration = context.endTime - context.startTime;
    context.currentStep = null;

    this.emit('pipeline:complete', {
      executionId,
      duration: context.duration,
      completedSteps: context.completedSteps,
      results: this._summarizeResults(context.results)
    });

    telemetry?.info('pipeline', 'Pipeline execution completed', {
      duration: context.duration,
      completedSteps: context.completedSteps.length
    });

    return context;
  }

  /**
   * Execute a single step with error handling and timing
   * @private
   */
  async _executeStep(step, context, index) {
    const { telemetry } = context;

    this.emit('step:start', {
      step: step.name,
      index,
      description: step.description,
      optional: step.optional
    });

    telemetry?.startStep(step.name);

    const startTime = Date.now();
    let result;
    let lastError;

    // Retry logic
    const maxAttempts = step.retries + 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute with timeout
        result = await this._executeWithTimeout(
          step.execute(context),
          step.timeout,
          step.name
        );
        break;
      } catch (error) {
        lastError = error;

        if (attempt < maxAttempts) {
          telemetry?.warn(step.name, `Step failed, retrying (${attempt}/${maxAttempts})`, {
            error: error.message
          });

          this.emit('step:retry', {
            step: step.name,
            attempt,
            maxAttempts,
            error: error.message
          });

          // Exponential backoff
          await this._sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    if (lastError && !result) {
      telemetry?.endStep(step.name, 'error');

      this.emit('step:error', {
        step: step.name,
        error: lastError.message,
        duration: Date.now() - startTime
      });

      throw lastError;
    }

    const duration = Date.now() - startTime;

    // Log step completion
    context.logs.push({
      step: step.name,
      status: 'success',
      duration,
      output: this._summarizeOutput(result)
    });

    telemetry?.endStep(step.name, 'success');

    this.emit('step:complete', {
      step: step.name,
      duration,
      result: this._summarizeOutput(result)
    });

    return result;
  }

  /**
   * Execute promise with timeout
   * @private
   */
  async _executeWithTimeout(promise, timeout, stepName) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Step '${stepName}' timed out after ${timeout}ms`));
        }, timeout);
      })
    ]);
  }

  /**
   * Sleep helper
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Summarize input for logging (avoid sensitive data)
   * @private
   */
  _summarizeInput(input) {
    return {
      promptName: input.prompt?.name,
      config: {
        ...input.config,
        // Redact any API keys
        apiKey: input.config?.apiKey ? '[REDACTED]' : undefined
      }
    };
  }

  /**
   * Summarize context for error reporting
   * @private
   */
  _summarizeContext(context) {
    return {
      executionId: context.executionId,
      completedSteps: context.completedSteps,
      currentStep: context.currentStep,
      duration: Date.now() - context.startTime
    };
  }

  /**
   * Summarize results for logging
   * @private
   */
  _summarizeResults(results) {
    const summary = {};
    for (const [key, value] of Object.entries(results)) {
      if (Array.isArray(value)) {
        summary[key] = `Array(${value.length})`;
      } else if (typeof value === 'object' && value !== null) {
        summary[key] = Object.keys(value);
      } else {
        summary[key] = typeof value;
      }
    }
    return summary;
  }

  /**
   * Summarize output for logging
   * @private
   */
  _summarizeOutput(output) {
    if (output === null || output === undefined) return null;
    if (Array.isArray(output)) return { type: 'array', length: output.length };
    if (typeof output === 'object') {
      return { type: 'object', keys: Object.keys(output) };
    }
    return { type: typeof output };
  }

  /**
   * Clone the pipeline
   * @returns {TradePipeline} Cloned pipeline
   */
  clone() {
    const cloned = new TradePipeline(this.options);
    cloned.steps = [...this.steps];
    return cloned;
  }

  /**
   * Get pipeline configuration
   * @returns {Object} Pipeline info
   */
  getInfo() {
    return {
      stepsCount: this.steps.length,
      steps: this.steps.map(s => ({
        name: s.name,
        description: s.description,
        optional: s.optional,
        timeout: s.timeout
      })),
      options: this.options
    };
  }
}

/**
 * Create a pre-configured trade generation pipeline
 * @param {Object} [options] - Pipeline options
 * @returns {TradePipeline} Configured pipeline
 */
export function createTradePipeline(options = {}) {
  return new TradePipeline(options);
}

export default TradePipeline;
