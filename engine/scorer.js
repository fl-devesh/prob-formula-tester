/**
 * Main probability scoring engine.
 * Port of CompanyMetricsServiceImpl.calculateProbabilityMetricV2() + getTotalWeightV2().
 *
 * Importance → weight mapping (PEC_IMPORTANCE_VALUE_MAP)
 * Reduction multiplier per metric (REDUCTION_PEC_IMPORTANCE_VALUE_MAP)
 *
 * Returns full trace including per-metric breakdown and final score.
 */
import { multiStepEvaluate } from './strategies/multiStep.js';
import { arrayMatchingEvaluate } from './strategies/arrayMatching.js';
import { stringArrayEvaluate } from './strategies/stringArray.js';

// From InvestmentPreferenceConstant.java
export const PEC_IMPORTANCE_VALUE_MAP = {
    'Critical':   1.00,
    'High':       0.75,
    'Medium':     0.50,
    'Low':        0.25,
    'Not Needed': 0.00,
};

// reduction % applied if metric fails
const REDUCTION_PEC_IMPORTANCE_VALUE_MAP = {
    1.00: 50.0,
    0.75: 25.0,
    0.50: 12.5,
    0.25: 0.0,
    0.00: 0.0,
};

const EPSILON24 = 1e-24;

/**
 * Evaluate all 31 probability metrics and return full trace + final score.
 *
 * @param {Object} probabilityConfig - metrics config (from metrics.json)
 * @param {Object} companyMetrics    - flat map of CM variables { COMPANY_AGE_CM: 36, ... }
 * @param {Object} pecValues         - flat map of PEC variables { MINIMUM_COMPANY_AGE_PEC: 24, ... }
 * @param {Object} pecImportance     - { PROBABILITY_VINTAGE_METRIC: 'High', ... }
 * @param {Object} constants         - { SCALING_FACTOR: 2, ... }
 * @param {Object} arrayFields       - { SECURITY_TYPE_CM: [...], MANDATORY_SECURITY_OFFERED_PEC: [[...]], ... }
 * @param {Object} securityValueMap  - { 'Charge On Assets': 1.1, ... }
 * @returns {ScoringResult}
 */
export function calculateProbabilityScore(
    probabilityConfig,
    companyMetrics,
    pecValues,
    pecImportance,
    constants = { SCALING_FACTOR: 2 },
    arrayFields = {},
    securityValueMap = {}
) {
    // Build flat variable pool: CM + PEC + constants
    const basePool = {
        ...companyMetrics,
        ...pecValues,
        ...constants,
    };

    // ── Step 1: Compute total weight ──────────────────────────────────────────
    const metricWeights = {};
    let totalWeight = 0;

    for (const metricName of Object.keys(probabilityConfig)) {
        const importance = pecImportance[metricName] || 'Not Needed';
        const weight = PEC_IMPORTANCE_VALUE_MAP[importance] ?? 0;
        metricWeights[metricName] = weight;
        totalWeight += weight;
    }

    if (totalWeight === 0) totalWeight = EPSILON24;

    // ── Step 2: Evaluate each metric ─────────────────────────────────────────
    let probabilityScore = 0;
    let reductionMultiplier = 1.0;
    const metricTraces = {};

    for (const metricName of Object.keys(probabilityConfig)) {
        const metricConfig = probabilityConfig[metricName];
        const weight = metricWeights[metricName];

        if (!metricConfig || weight === 0) {
            metricTraces[metricName] = { skipped: true, reason: weight === 0 ? 'Not Needed / zero weight' : 'No config', weight: 0 };
            continue;
        }

        const trace = {
            metricName,
            weight,
            totalWeight,
            importance: pecImportance[metricName] || 'Not Needed',
        };

        // Build metric-level pool with weight and totalWeight injected
        const metricPool = { ...basePool, weight, totalWeight };

        // ── SCORE evaluation ──
        let metricScore = 0;
        if (metricConfig.SCORE) {
            const scoreResult = evaluateScoreConfig(metricConfig.SCORE, metricPool, arrayFields, securityValueMap, weight, totalWeight);
            metricScore = scoreResult.score;
            trace.SCORE = scoreResult;

            // Reduction multiplier
            const weightForScore = weight || EPSILON24;
            const reductionPct = REDUCTION_PEC_IMPORTANCE_VALUE_MAP[weight] ?? 0;
            const curr = 1.0 - ((1.0 - (metricScore * totalWeight / weightForScore)) * reductionPct / 100.0);
            reductionMultiplier *= curr;
            trace.reductionMultiplierContribution = curr;
        }

        // ── MATCHED_CONFIG evaluation ──
        if (metricConfig.MATCHED_CONFIG) {
            const matchedResult = evaluateMatchedConfig(metricConfig.MATCHED_CONFIG, metricPool, arrayFields, securityValueMap, weight, totalWeight);
            metricScore += matchedResult.score;
            trace.MATCHED_CONFIG = matchedResult;

            const weightForScore = weight || EPSILON24;
            const reductionPct = REDUCTION_PEC_IMPORTANCE_VALUE_MAP[weight] ?? 0;
            const curr = 1.0 - ((1.0 - (matchedResult.score * totalWeight / weightForScore)) * reductionPct / 100.0);
            reductionMultiplier *= curr;
            trace.reductionMultiplierContribution = (trace.reductionMultiplierContribution ?? 1) * curr;
        }

        // ── STATUS evaluation ──
        if (metricConfig.STATUS) {
            trace.STATUS = evaluateStatusConfig(metricConfig.STATUS, metricPool);
        }

        // ── COMPANY_VALUE display ──
        if (metricConfig.COMPANY_VALUE) {
            trace.COMPANY_VALUE = evaluateDisplayConfig(metricConfig.COMPANY_VALUE, metricPool, arrayFields);
        }

        // ── PEC_VALUE display ──
        if (metricConfig.PEC_VALUE) {
            trace.PEC_VALUE = evaluateDisplayConfig(metricConfig.PEC_VALUE, metricPool, arrayFields);
        }

        // ── IMPORTANCE display ──
        if (metricConfig.IMPORTANCE_OF_METRIC_FROM_PEC) {
            const imp = pecImportance[metricName];
            trace.IMPORTANCE_OF_METRIC_FROM_PEC = imp || '-';
        }

        trace.metricScore = metricScore;
        probabilityScore += metricScore;
        metricTraces[metricName] = trace;
    }

    const finalScore = probabilityScore * reductionMultiplier;

    return {
        finalScore,
        probabilityScore,
        reductionMultiplier,
        totalWeight,
        metricWeights,
        metricTraces,
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function evaluateScoreConfig(scoreConfig, pool, arrayFields, securityValueMap, weight, totalWeight) {
    const strategy = scoreConfig.evaluationStrategy;
    const formulas = scoreConfig.formula;
    const metricPool = { ...pool };

    try {
        if (strategy === 'MULTI_STEP_FORMULA') {
            const { result, steps } = multiStepEvaluate(formulas, metricPool);
            return { score: result ?? 0, steps, strategy };
        }
        return { score: 0, error: `Unknown strategy: ${strategy}`, strategy };
    } catch (e) {
        return { score: 0, error: e.message, strategy };
    }
}

function evaluateMatchedConfig(matchedConfig, pool, arrayFields, securityValueMap, weight, totalWeight) {
    const strategy = matchedConfig.evaluationStrategy;
    const formulas = matchedConfig.formula;
    const dataPool = matchedConfig.dataPool || {};

    try {
        if (strategy === 'ARRAY_MATCHING') {
            // Map dataPool keys: { arrayToMatch: 'MANDATORY_SECURITY_OFFERED_PEC', arrayToMatchIn: 'SECURITY_TYPE_CM' }
            const matchPool = { ...pool };
            for (const [key, sourceKey] of Object.entries(dataPool)) {
                matchPool[key] = arrayFields[sourceKey] || [];
            }
            matchPool.securityValueMap = securityValueMap;
            const result = arrayMatchingEvaluate(formulas, matchPool);
            return { score: result.SCORE ?? 0, MATCHED: result.MATCHED, UNMATCHED: result.UNMATCHED, STATUS: result.STATUS, steps: result.steps, strategy };
        }

        if (strategy === 'STRING_ARRAY_MATCHING') {
            const matchPool = { ...pool };
            for (const [key, sourceKey] of Object.entries(dataPool)) {
                if (key === 'stringToMatch') matchPool.stringToMatch = pool[sourceKey] || arrayFields[sourceKey] || '';
                else if (key === 'arrayToMatchIn') matchPool.arrayToMatchIn = arrayFields[sourceKey] || pool[sourceKey] || [];
            }
            const result = stringArrayEvaluate(formulas, matchPool);
            return { score: result.SCORE ?? 0, STATUS: result.STATUS, COMPANY_VALUE: result.COMPANY_VALUE, steps: result.steps, strategy };
        }

        return { score: 0, error: `Unknown matched strategy: ${strategy}`, strategy };
    } catch (e) {
        return { score: 0, error: e.message, strategy };
    }
}

function evaluateStatusConfig(statusConfig, pool) {
    try {
        const { result, steps } = multiStepEvaluate(statusConfig.formula, pool);
        return { pass: result === 1, steps };
    } catch (e) {
        return { pass: false, error: e.message };
    }
}

function evaluateDisplayConfig(displayConfig, pool, arrayFields) {
    const keyToConcat = displayConfig.keyToConcat || [];
    const prefix = displayConfig.prefix || '';
    const suffix = displayConfig.suffix || '';
    const parts = [];
    for (const key of keyToConcat) {
        const val = pool[key] ?? arrayFields[key];
        if (val !== undefined && val !== null && val !== 0) parts.push(val);
    }
    if (parts.length === 0) return '-';
    const joined = parts.join(' - ');
    return [prefix, joined, suffix].filter(Boolean).join(' ');
}
