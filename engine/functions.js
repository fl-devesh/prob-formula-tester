/**
 * Custom functions registered with math.js, porting FormulaEvaluationServiceImpl.registerCustomFunctions().
 * All functions return numbers (0 or 1 for booleans).
 */

function andGeneric(...args) {
    for (const a of args) if (a === 0) return 0;
    return 1;
}

export const CUSTOM_FUNCTIONS = {
    // Conditional
    ifElse: (cond, a, b) => cond !== 0 ? a : b,

    // Comparisons → 1 or 0
    ge: (a, b) => a >= b ? 1 : 0,
    gt: (a, b) => a  > b ? 1 : 0,
    le: (a, b) => a <= b ? 1 : 0,
    lt: (a, b) => a  < b ? 1 : 0,
    eq: (a, b) => a === b ? 1 : 0,
    ne: (a, b) => a !== b ? 1 : 0,

    // Logic
    and:  (a, b)       => andGeneric(a, b),
    and3: (a, b, c)    => andGeneric(a, b, c),
    and4: (a, b, c, d) => andGeneric(a, b, c, d),
    or:   (a, b)       => (a !== 0 || b !== 0) ? 1 : 0,
    not:  (a)          => a === 0 ? 1 : 0,

    // Null checks (null is stored as 0.0 in Java after conversion)
    isNull:    (a) => (a === 0) ? 1 : 0,
    isNotNull: (a) => (a !== 0) ? 1 : 0,

    // Min/max (math.js has built-in min/max but they work differently with scoping)
    min: (a, b) => Math.min(a, b),
    max: (a, b) => Math.max(a, b),

    // Rounding — matches Java's BigDecimal.setScale(n, HALF_UP) only-if-scale-exceeds-n
    round: (value, precision) => {
        const prec = Math.floor(precision);
        const bd = value.toString();
        const dotIdx = bd.indexOf('.');
        const currentScale = dotIdx === -1 ? 0 : bd.length - dotIdx - 1;
        if (currentScale <= prec) return value;
        const factor = Math.pow(10, prec);
        return Math.round((value + Number.EPSILON) * factor) / factor;
    },

    // Safe division — returns 0 if denominator is 0
    safeDivide: (num, denom) => denom === 0 ? 0 : num / denom,

    // Returns MAX_VALUE if arg is 0 (null substitute)
    nullDefaultMax: (a) => a === 0 ? Number.MAX_VALUE : a,
};
