import { findExecutable } from './doctor.js';
export const KNOWN_AGENT_ADAPTERS = Object.freeze([
    { agent: 'claude', executable: 'claude' },
    { agent: 'codex', executable: 'codex' },
    { agent: 'qwen', executable: 'qwen' },
]);
/** Discovery-only adapter catalog. This does not execute an agent or assume CLI flag compatibility. */
export async function discoverAgentAdapters(cwd, env = process.env) {
    const states = [];
    for (const adapter of KNOWN_AGENT_ADAPTERS) {
        const executable = await findExecutable(adapter.executable, cwd, env);
        states.push({ agent: adapter.agent, executable: adapter.executable, available: executable !== null });
    }
    return states;
}
//# sourceMappingURL=agent-adapters.js.map