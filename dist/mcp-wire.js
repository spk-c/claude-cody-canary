function object(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function notificationCounts() {
    return { toolsListChanged: 0, promptsListChanged: 0, resourcesListChanged: 0, progress: 0, message: 0 };
}
/** A result requiring input is reported rather than silently invoked/fulfilled. */
export function classifyMcpResult(value, method) {
    if (!object(value))
        throw new Error('MCP result must be a JSON object.');
    if (value.resultType === 'complete')
        return 'complete';
    if (value.resultType === 'input_required') {
        if (!['prompts/get', 'resources/read', 'tools/call'].includes(method)) {
            throw new Error('MCP input_required is not valid for this read-only method.');
        }
        if (value.inputRequests !== undefined && !object(value.inputRequests)) {
            throw new Error('MCP MRTR inputRequests has invalid shape.');
        }
        if (value.requestState !== undefined && typeof value.requestState !== 'string') {
            throw new Error('MCP MRTR requestState has invalid shape.');
        }
        return 'input_required';
    }
    throw new Error('Unsupported MCP resultType (no implicit fallback).');
}
export function parseMcpSseResponse(source, requestId, maxEvents = 128) {
    if (!Number.isSafeInteger(maxEvents) || maxEvents < 1 || maxEvents > 512 ||
        Buffer.byteLength(source, 'utf8') > 4 * 1024 * 1024) {
        throw new Error('MCP SSE resource limit exceeded.');
    }
    const notifications = notificationCounts();
    let events = 0;
    let response;
    let eventType = '';
    let fields = [];
    const finish = () => {
        if (!fields.length) {
            eventType = '';
            return;
        }
        if (++events > maxEvents)
            throw new Error('MCP SSE event count exceeded.');
        if (eventType && eventType !== 'message')
            throw new Error('Unsupported MCP SSE event type.');
        let parsed;
        try {
            parsed = JSON.parse(fields.join('\n'));
        }
        catch {
            throw new Error('MCP SSE data is not valid JSON.');
        }
        fields = [];
        eventType = '';
        if (!object(parsed) || parsed.jsonrpc !== '2.0')
            throw new Error('Invalid MCP SSE JSON-RPC envelope.');
        if (typeof parsed.method === 'string') {
            if (parsed.id !== undefined)
                throw new Error('MCP SSE server-initiated requests are unsupported.');
            switch (parsed.method) {
                case 'notifications/tools/list_changed':
                    notifications.toolsListChanged++;
                    break;
                case 'notifications/prompts/list_changed':
                    notifications.promptsListChanged++;
                    break;
                case 'notifications/resources/list_changed':
                    notifications.resourcesListChanged++;
                    break;
                case 'notifications/progress':
                    notifications.progress++;
                    break;
                case 'notifications/message':
                    notifications.message++;
                    break;
                default: throw new Error('Unexpected MCP SSE notification method.');
            }
        }
        else {
            if (response !== undefined || parsed.id !== requestId ||
                (Object.hasOwn(parsed, 'result') === Object.hasOwn(parsed, 'error'))) {
                throw new Error('MCP SSE response is duplicated, ambiguous or mismatched.');
            }
            response = parsed;
        }
    };
    for (const line of source.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
        if (line === '') {
            finish();
            continue;
        }
        if (line.startsWith(':'))
            continue;
        const sep = line.indexOf(':');
        const name = sep < 0 ? line : line.slice(0, sep);
        const content = sep < 0 ? '' : line.slice(sep + 1).replace(/^ /, '');
        if (name === 'data')
            fields.push(content);
        else if (name === 'event')
            eventType = content;
        else if (name === 'id' || name === 'retry')
            throw new Error('SSE resumption is not supported by MCP 2026-07-28.');
    }
    finish();
    if (!response)
        throw new Error('MCP SSE ended without a matching final response.');
    return { response, notifications, events };
}
//# sourceMappingURL=mcp-wire.js.map