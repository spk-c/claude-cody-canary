import { readFile, stat } from 'node:fs/promises';
import { analyzeCiLog } from './ci-insights.js';
import { validateMcpEnvelopes } from './mcp-conformance.js';
import { minimizeFailure } from './minimize.js';
import { comparePassRates } from './statistical-regressions.js';
import { auditPluginDirectory } from './plugin-audit.js';
import { auditClaudeSettings } from './security-audit.js';
import { discoverAgentAdapters } from './agent-adapters.js';
import { prioritizeScenarios } from './smart-selection.js';
import { buildHistoryDashboard } from './history-dashboard.js';
async function readBounded(file, maxBytes = 4 * 1024 * 1024) {
    if (!file || file.startsWith('-'))
        throw new Error('Expected a file path.');
    const size = (await stat(file)).size;
    if (size > maxBytes)
        throw new Error('Input file is too large.');
    return readFile(file, 'utf8');
}
function required(value, name) {
    if (!value || value.startsWith('--'))
        throw new Error('Missing ' + name + '.');
    return value;
}
function integer(value, name) {
    const input = required(value, name);
    if (!/^\d+$/.test(input))
        throw new Error('Expected nonnegative integer for ' + name);
    const n = Number(input);
    if (!Number.isSafeInteger(n))
        throw new Error('Invalid integer for ' + name);
    return n;
}
export const PLATFORM_COMMANDS = [
    ['ci', 'analyze'], ['mcp', 'conformance'], ['minimize'], ['stats'], ['plugin', 'scan'],
    ['security', 'audit'], ['agent', 'doctor'], ['smart', 'select'], ['dashboard'],
];
export function isPlatformCommand(argv) {
    return PLATFORM_COMMANDS.some(x => x.length === 1 ? argv[0] === x[0] : argv[0] === x[0] && argv[1] === x[1]);
}
export async function runPlatformCommand(argv) {
    const [cmd, sub, ...rest] = argv;
    let result;
    if (cmd === 'ci' && sub === 'analyze')
        result = analyzeCiLog(await readBounded(required(rest[0], 'CI log')), rest.includes('--success') ? 0 : undefined);
    else if (cmd === 'mcp' && sub === 'conformance')
        result = validateMcpEnvelopes(JSON.parse(await readBounded(required(rest[0], 'MCP JSON array'))));
    else if (cmd === 'minimize') {
        const items = JSON.parse(await readBounded(required(sub, 'JSON array')));
        const match = required(rest[0], 'literal failure marker');
        if (!Array.isArray(items) || items.some(x => typeof x !== 'string'))
            throw new Error('Minimizer expects an array of strings.');
        result = await minimizeFailure(items, async (candidate) => candidate.some(x => x.includes(match)));
    }
    else if (cmd === 'stats')
        result = comparePassRates(integer(sub, 'baseline passes'), integer(rest[0], 'baseline runs'), integer(rest[1], 'candidate passes'), integer(rest[2], 'candidate runs'));
    else if (cmd === 'plugin' && sub === 'scan')
        result = await auditPluginDirectory(required(rest[0], 'plugin directory'));
    else if (cmd === 'security' && sub === 'audit')
        result = auditClaudeSettings(JSON.parse(await readBounded(required(rest[0], 'settings JSON'))));
    else if (cmd === 'agent' && sub === 'doctor')
        result = await discoverAgentAdapters(process.cwd());
    else if (cmd === 'smart' && sub === 'select') {
        const rows = JSON.parse(await readBounded(required(rest[0], 'scenario JSON array')));
        if (!Array.isArray(rows) || rows.some(x => !x || typeof x !== 'object' || typeof x.name !== 'string' || !Array.isArray(x.affects) || x.affects.some((p) => typeof p !== 'string')))
            throw new Error('Invalid smart scenarios.');
        const flag = rest.indexOf('--changed');
        const changed = flag === -1 ? [] : required(rest[flag + 1], 'changed path list').split(',').filter(Boolean);
        result = prioritizeScenarios(rows, changed);
    }
    else if (cmd === 'dashboard') {
        const output = required(rest[0], 'output HTML');
        await buildHistoryDashboard(required(sub, 'history-index.json'), output);
        result = { ok: true, output };
    }
    else
        throw new Error('Unsupported platform command.');
    console.log(JSON.stringify(result, null, 2));
}
//# sourceMappingURL=platform-cli.js.map