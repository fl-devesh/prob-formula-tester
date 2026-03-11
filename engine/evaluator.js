/**
 * Core formula evaluator.
 * Uses math.js (loaded as a global via CDN in index.html) with custom functions registered.
 * Handles string literal preprocessing (converts 'SHA signed' → hashCode).
 */
import { preprocessFormula, toDouble } from './preprocessor.js';
import { CUSTOM_FUNCTIONS } from './functions.js';

let mathInstance = null;

/**
 * Initialize math.js with all custom functions.
 * Must be called once after math.js CDN loads.
 */
export function initMath(mathLib) {
    mathInstance = mathLib.create(mathLib.all);
    mathInstance.import(CUSTOM_FUNCTIONS, { override: true });
}

export function getMath() {
    if (!mathInstance) throw new Error('Math not initialized. Call initMath() first.');
    return mathInstance;
}

/**
 * Evaluate a single formula expression with given numeric variable map.
 * @param {string} formula       - raw formula string (may contain string literals)
 * @param {Object} variables     - map of { VARIABLE_NAME: number }
 * @returns {{ result: number, processedFormula: string, error: string|null }}
 */
export function evaluateExpression(formula, variables) {
    try {
        const processed = preprocessFormula(formula);
        const scope = { ...variables };
        const result = getMath().evaluate(processed, scope);
        const num = typeof result === 'number' ? result : toDouble(result);
        return { result: num, processedFormula: processed, error: null };
    } catch (e) {
        return { result: null, processedFormula: preprocessFormula(formula), error: e.message };
    }
}
