/**
 * ARRAY_MATCHING evaluation strategy.
 * Port of ArrayMatchingEvaluationStrategy.java.
 *
 * Used for SECURITY_TYPE_METRIC.
 * Checks if items from PEC's required security list exist in company's offered security list.
 * Supports tiered fuzzy matching via securityValueMap (value ranges like 1.0–1.9, 2.0–2.9).
 */
import { multiStepEvaluate } from './multiStep.js';
import { evaluateExpression } from '../evaluator.js';

/**
 * Checks if a single PEC security item is matched in the company's security list.
 * Mirror of ArrayMatchingEvaluationStrategy.mandatorySecurityMatching()
 */
function mandatorySecurityMatching(arrayToBeMatchedIn, item, securityValueMap) {
    if (securityValueMap && item in securityValueMap) {
        const pecValue = securityValueMap[item];
        return arrayToBeMatchedIn.some(companyItem => {
            const companyValue = securityValueMap[companyItem];
            if (companyValue === undefined || companyValue === null) return false;
            return companyValue <= pecValue && companyValue >= Math.floor(pecValue);
        });
    }
    return arrayToBeMatchedIn.includes(item);
}

function calculateMatchResult(array, arrayToBeMatchedIn, securityValueMap) {
    const matchedSet = new Set();
    const unmatchedSet = new Set();
    for (const item of array) {
        if (mandatorySecurityMatching(arrayToBeMatchedIn, item, securityValueMap)) {
            matchedSet.add(item);
        } else {
            unmatchedSet.add(item);
        }
    }
    return { matchedSet, unmatchedSet };
}

function matchRatio(matched, unmatched) {
    const total = matched.size + unmatched.size;
    return total === 0 ? 0 : matched.size / total;
}

/**
 * @param {string[]}        formulas         - score formula steps
 * @param {Object}          dataPool         - contains arrayToMatch, arrayToMatchIn, securityValueMap
 * @returns {{ SCORE, MATCHED, UNMATCHED, STATUS, steps }}
 */
export function arrayMatchingEvaluate(formulas, dataPool) {
    const securityValueMap = dataPool.securityValueMap || {};
    // arrayToMatch: list-of-lists (PEC security groups)
    const arrayToMatch = Array.isArray(dataPool.arrayToMatch) ? dataPool.arrayToMatch : [];
    // arrayToMatchIn: flat list (company securities)
    const arrayToMatchIn = Array.isArray(dataPool.arrayToMatchIn) ? dataPool.arrayToMatchIn : [];

    // Clean dataPool for formula evaluation
    const cleanPool = { ...dataPool };
    delete cleanPool.securityValueMap;
    delete cleanPool.arrayToMatch;
    delete cleanPool.arrayToMatchIn;

    let bestMatchedSet = new Set();
    let bestUnmatchedSet = new Set();
    let bestRatio = -1;

    for (const array of arrayToMatch) {
        const { matchedSet, unmatchedSet } = calculateMatchResult(array, arrayToMatchIn, securityValueMap);
        if (matchedSet.size === 0 && unmatchedSet.size === 0) continue;
        const ratio = matchRatio(matchedSet, unmatchedSet);
        if (ratio > bestRatio) {
            bestRatio = ratio;
            bestMatchedSet = matchedSet;
            bestUnmatchedSet = unmatchedSet;
        }
    }

    let scoreResult = 0;
    let steps = [];

    if (bestMatchedSet.size === 0 && bestUnmatchedSet.size === 0) {
        // No items at all
        cleanPool.resultFromFormulaEval = 0;
        const { result, processedFormula } = evaluateExpression(formulas[formulas.length - 1], cleanPool);
        scoreResult = result || 0;
        steps = [{ formula: formulas[formulas.length - 1], processedFormula, result: scoreResult, note: 'No security items — empty match' }];
    } else if (bestUnmatchedSet.size === 0) {
        // All matched
        cleanPool.resultFromFormulaEval = 1;
        const { result, processedFormula } = evaluateExpression(formulas[formulas.length - 1], cleanPool);
        scoreResult = result || 0;
        steps = [{ formula: formulas[formulas.length - 1], processedFormula, result: scoreResult, note: 'All PEC securities matched' }];
    } else {
        // Partial match — run multi-step
        const size = bestMatchedSet.size + bestUnmatchedSet.size;
        cleanPool.matchedCount = bestMatchedSet.size;
        cleanPool.size = size;
        const { result, steps: msSteps } = multiStepEvaluate(formulas, cleanPool);
        scoreResult = result || 0;
        steps = msSteps;
    }

    return {
        SCORE: scoreResult,
        MATCHED: [...bestMatchedSet],
        UNMATCHED: [...bestUnmatchedSet],
        STATUS: bestUnmatchedSet.size === 0 && (bestMatchedSet.size > 0 || arrayToMatch.length === 0),
        steps,
    };
}
