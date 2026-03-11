/**
 * localStorage persistence layer for test cases and metric overrides.
 */

const KEYS = {
    TEST_CASES: 'pft_test_cases',
    METRIC_OVERRIDES: 'pft_metric_overrides',
    ACTIVE_TEST_CASE: 'pft_active_tc',
};

// ── Test Cases ─────────────────────────────────────────────────────────────────

export function loadTestCases(sampleTestCases) {
    try {
        const stored = localStorage.getItem(KEYS.TEST_CASES);
        if (stored) return JSON.parse(stored);
    } catch {}
    // Seed with samples on first load
    saveTestCases(sampleTestCases);
    return sampleTestCases;
}

export function saveTestCases(testCases) {
    localStorage.setItem(KEYS.TEST_CASES, JSON.stringify(testCases));
}

export function saveTestCase(tc, testCases) {
    const idx = testCases.findIndex(t => t.id === tc.id);
    if (idx >= 0) testCases[idx] = tc;
    else testCases.push(tc);
    saveTestCases(testCases);
    return testCases;
}

export function deleteTestCase(id, testCases) {
    const filtered = testCases.filter(t => t.id !== id);
    saveTestCases(filtered);
    return filtered;
}

// ── Metric overrides ───────────────────────────────────────────────────────────

export function loadMetricOverrides() {
    try {
        const stored = localStorage.getItem(KEYS.METRIC_OVERRIDES);
        if (stored) return JSON.parse(stored);
    } catch {}
    return {};
}

export function saveMetricOverride(metricName, config) {
    const overrides = loadMetricOverrides();
    overrides[metricName] = config;
    localStorage.setItem(KEYS.METRIC_OVERRIDES, JSON.stringify(overrides));
}

export function deleteMetricOverride(metricName) {
    const overrides = loadMetricOverrides();
    delete overrides[metricName];
    localStorage.setItem(KEYS.METRIC_OVERRIDES, JSON.stringify(overrides));
}

// ── Import / Export ────────────────────────────────────────────────────────────

export function exportAll(testCases) {
    const data = {
        exportedAt: new Date().toISOString(),
        testCases,
        metricOverrides: loadMetricOverrides(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pft-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importAll(jsonText) {
    const data = JSON.parse(jsonText);
    if (data.testCases) saveTestCases(data.testCases);
    if (data.metricOverrides) localStorage.setItem(KEYS.METRIC_OVERRIDES, JSON.stringify(data.metricOverrides));
    return data;
}

export function generateId() {
    return 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}
