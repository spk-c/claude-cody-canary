export interface McpConformanceFinding {
  code: 'INVALID_JSONRPC' | 'INVALID_ID' | 'MISSING_OUTCOME' | 'AMBIGUOUS_OUTCOME' | 'INVALID_ERROR' | 'INVALID_METHOD' | 'OVERSIZE';
  index: number;
}
export interface McpConformanceResult {
  schemaVersion: 1;
  valid: boolean;
  inspected: number;
  findings: McpConformanceFinding[];
}
function record(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}
/** Pure offline envelope conformance: does not execute tools or contact remote MCP servers. */
export function validateMcpEnvelopes(input: unknown, maxMessages = 1000): McpConformanceResult {
  if (!Array.isArray(input)) throw new Error('Expected an array of MCP JSON-RPC envelopes.');
  if (input.length > maxMessages || maxMessages < 1 || maxMessages > 10000) throw new Error('MCP envelope count exceeds limit.');
  const findings: McpConformanceFinding[] = [];
  input.forEach((raw, index) => {
    if (!record(raw)) { findings.push({code:'INVALID_JSONRPC', index}); return; }
    if (JSON.stringify(raw).length > 1_048_576) { findings.push({code:'OVERSIZE', index}); return; }
    if (raw.jsonrpc !== '2.0') findings.push({code:'INVALID_JSONRPC', index});
    const hasId = Object.prototype.hasOwnProperty.call(raw,'id');
    const isId = typeof raw.id === 'string' || (typeof raw.id === 'number' && Number.isSafeInteger(raw.id));
    if (hasId && !isId) findings.push({code:'INVALID_ID', index});
    const method = Object.prototype.hasOwnProperty.call(raw,'method');
    const result = Object.prototype.hasOwnProperty.call(raw,'result');
    const error = Object.prototype.hasOwnProperty.call(raw,'error');
    if (method) {
      if (typeof raw.method !== 'string' || !raw.method.trim()) findings.push({code:'INVALID_METHOD', index});
      if (result || error) findings.push({code:'AMBIGUOUS_OUTCOME', index});
    } else {
      if (!hasId || (!result && !error)) findings.push({code:'MISSING_OUTCOME', index});
      if (result && error) findings.push({code:'AMBIGUOUS_OUTCOME', index});
      if (error && (!record(raw.error) || typeof raw.error.message !== 'string' || !Number.isSafeInteger(raw.error.code))) {
        findings.push({code:'INVALID_ERROR', index});
      }
    }
  });
  return { schemaVersion:1, valid:findings.length===0, inspected:input.length, findings };
}
/** Deterministic negative corpus; harmless data for testing a parser, NOT active server fuzzing. */
export function mcpMalformedCorpus(): unknown[] {
  return [
    null, [], { jsonrpc:'1.0', id:1, result:{} }, { jsonrpc:'2.0', id:null, result:{} },
    { jsonrpc:'2.0', id:1 }, { jsonrpc:'2.0', id:1, result:{}, error:{code:-1,message:'x'} },
    { jsonrpc:'2.0', id:1, error:{} }, { jsonrpc:'2.0', method:'', params:{} },
    { jsonrpc:'2.0', method:'tools/list', result:{} },
  ];
}
