/**
 * Preprocesses formula strings before evaluation.
 *
 * Java's FormulaEvaluationService converts string literals like 'SHA signed'
 * into their Java hashCode representation so exp4j can treat them as numbers.
 * We replicate that here: 'SHA signed' → hashCode('sha signed')
 *
 * NOTE: Java converts to lowercase before hashing (from CompanyMetricsServiceImpl:
 *   value instanceof String → (double) ((String) value).toLowerCase().hashCode())
 */
import { javaHashCode } from './hashcode.js';

const STRING_LITERAL_REGEX = /'([^']*)'/g;

/**
 * Replace all single-quoted string literals in a formula with their Java hashCode.
 * @param {string} formula
 * @returns {string} formula with literals replaced by numbers
 */
export function preprocessFormula(formula) {
    return formula.replace(STRING_LITERAL_REGEX, (match, str) => {
        return String(javaHashCode(str.toLowerCase()));
    });
}

/**
 * Convert a value to a double, matching Java's conversion logic in MultiStepFormulaEvaluationStrategy:
 * - null → 0
 * - number → number
 * - string → try parseFloat; if not numeric, use javaHashCode(str.toLowerCase())
 * - other → hashCode of string representation
 */
export function toDouble(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'string') {
        const n = parseFloat(value);
        if (!isNaN(n) && value.trim() !== '') return n;
        return javaHashCode(value.toLowerCase());
    }
    return javaHashCode(String(value).toLowerCase());
}
