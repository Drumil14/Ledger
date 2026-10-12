/**
 * Cash-flow forecasting engine — public surface.
 *
 * Pure, deterministic, framework-free domain logic (Phase 2A). Consumers wire it
 * up through a query hook + the repository layer in a later phase; nothing here
 * imports React, Supabase, or the system clock.
 */

export { buildForecast } from './forecast';
export {
  estimateRunRate,
  DEFAULT_RUN_RATE_WINDOW_DAYS,
  MIN_HISTORY_DAYS,
  MIN_HISTORY_TRANSACTIONS,
  IRREGULAR_CV_THRESHOLD,
  type RunRateEstimate,
} from './run-rate';
export { generateIncomeEvents, generateRecurringEvents } from './schedule';
export { assembleForecastInput, type AssembleResult } from './assemble';
export type {
  BuildForecast,
  Cents,
  ForecastBasis,
  ForecastConfidence,
  ForecastDirection,
  ForecastEvent,
  ForecastHorizon,
  ForecastIncomeSource,
  ForecastInput,
  ForecastPoint,
  ForecastResult,
  ForecastSource,
  ForecastWarning,
  IncomeSchedule,
} from './types';
