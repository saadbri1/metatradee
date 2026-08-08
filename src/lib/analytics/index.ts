/**
 * Public surface of the analytics layer.
 *
 * Call sites import `trackEvent` from here and nothing else. The sink, the
 * sanitiser and the vendor are deliberately not re-exported: a component has no
 * business reaching past `trackEvent`, and keeping them out of this barrel makes
 * that the path of least resistance.
 */
export { trackEvent } from './analytics';
export { pageGroupFor } from './page-group';
export {
  CALCULATOR_IDS,
  PAGE_GROUPS,
  type AnalyticsEventName,
  type CalculatorId,
  type PageGroup,
} from './events';
