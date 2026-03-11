/**
 * STRING_ARRAY_MATCHING evaluation strategy.
 * Port of StringArrayEvaluationStrategy.java.
 *
 * Used for SECTOR_METRIC and STATE_METRIC.
 * Checks if company's string value exists in PEC's allowed array.
 * If match: score = last formula evaluated with resultFromFormulaEval=1
 * If no match: score = 0
 */
import { evaluateExpression } from '../evaluator.js';

/**
 * @param {string[]} formulas   - formula steps; only last one is used
 * @param {Object}   dataPool   - { stringToMatch: string, arrayToMatchIn: string[], weight, totalWeight }
 * @returns {{ SCORE, STATUS, COMPANY_VALUE, steps }}
 */
export function stringArrayEvaluate(formulas, dataPool) {
    const stringToMatch = typeof dataPool.stringToMatch === 'string' ? dataPool.stringToMatch : '';
    const arrayToMatchIn = Array.isArray(dataPool.arrayToMatchIn) ? dataPool.arrayToMatchIn : [];

    const cleanPool = { ...dataPool };
    delete cleanPool.stringToMatch;
    delete cleanPool.arrayToMatchIn;

    const lastFormula = formulas[formulas.length - 1];
    let score = 0;
    let matched = false;

    if (arrayToMatchIn.includes(stringToMatch)) {
        matched = true;
        cleanPool.resultFromFormulaEval = 1;
        const { result, processedFormula } = evaluateExpression(lastFormula, cleanPool);
        score = result || 0;
        return {
            SCORE: score,
            STATUS: true,
            COMPANY_VALUE: stringToMatch,
            steps: [{ formula: lastFormula, processedFormula, result: score, note: `"${stringToMatch}" found in PEC list` }],
        };
    } else {
        return {
            SCORE: 0,
            STATUS: false,
            COMPANY_VALUE: stringToMatch,
            steps: [{ formula: lastFormula, processedFormula: lastFormula, result: 0, note: `"${stringToMatch}" NOT in PEC list [${arrayToMatchIn.join(', ')}]` }],
        };
    }
}
