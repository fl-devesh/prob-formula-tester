/**
 * MULTI_STEP_FORMULA evaluation strategy.
 * Port of MultiStepFormulaEvaluationStrategy.java.
 *
 * Evaluates an array of formula strings sequentially.
 * After each step:
 *   - resultFromFormulaEval = current result
 *   - resultFromFormulaEvalStep{N} = result of step N (1-indexed)
 *
 * Variables are pre-converted to doubles. Null → 0, strings → hashCode.
 */
import { evaluateExpression } from '../evaluator.js';
import { toDouble } from '../preprocessor.js';

/**
 * @param {string[]}      formulas   - ordered array of formula strings
 * @param {Object}        dataPool   - { VARIABLE_NAME: any }
 * @returns {{ result: number|null, steps: StepTrace[], variables: Object }}
 */
export function multiStepEvaluate(formulas, dataPool) {
    const steps = [];
    let resultFromFormulaEval = null;

    // Convert all values to doubles (mirror Java's MultiStepFormulaEvaluationStrategy)
    const variables = {};
    for (const [key, value] of Object.entries(dataPool)) {
        if (value === null || value === undefined) {
            variables[key] = 0;
        } else {
            try {
                variables[key] = toDouble(value);
            } catch {
                variables[key] = 0;
            }
        }
    }

    for (let i = 0; i < formulas.length; i++) {
        const formula = formulas[i];
        const { result, processedFormula, error } = evaluateExpression(formula, variables);

        const stepResult = (result !== null && result !== undefined) ? result : null;
        resultFromFormulaEval = stepResult;

        // Store for subsequent steps
        variables['resultFromFormulaEval'] = resultFromFormulaEval ?? 0;
        variables[`resultFromFormulaEvalStep${i + 1}`] = resultFromFormulaEval ?? 0;

        steps.push({
            stepIndex: i + 1,
            formula,
            processedFormula,
            result: stepResult,
            error,
            variableSnapshot: { ...variables },
        });
    }

    return { result: resultFromFormulaEval, steps, variables };
}
