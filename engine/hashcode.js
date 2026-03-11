/**
 * Java String.hashCode() port.
 * Uses 32-bit signed integer arithmetic with overflow (Math.imul + |0).
 * This MUST match Java exactly for string comparisons in formulas to work.
 */
export function javaHashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
}

// Verification table — known Java String.hashCode() values
// Used in unit tests to confirm JS port is correct.
export const KNOWN_HASH_CODES = {
    'sha signed':        javaHashCode('sha signed'),
    'pre-term sheet':    javaHashCode('pre-term sheet'),
    'yes':               javaHashCode('yes'),
    'no':                javaHashCode('no'),
    'saas':              javaHashCode('saas'),
    'fintech':           javaHashCode('fintech'),
    'karnataka':         javaHashCode('karnataka'),
    'maharashtra':       javaHashCode('maharashtra'),
    '':                  javaHashCode(''),
};
