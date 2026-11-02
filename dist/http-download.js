/** Streaming, size-bounded HTTP metadata fetch with an explicit deadline. */
export async function fetchBoundedBytes(url, maxBytes, timeoutMs = 30_000) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1)
        throw new Error('maxBytes must be positive.');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
        throw new Error('timeoutMs must be positive.');
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok)
        throw new Error(`HTTP ${response.status} while fetching ${url}`);
    const lengthHeader = response.headers.get('content-length');
    const declaredLength = lengthHeader === null ? null : Number(lengthHeader);
    if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`Response too large while fetching ${url}: ${declaredLength} bytes exceeds ${maxBytes}.`);
    }
    if (!response.body)
        throw new Error(`HTTP response has no body while fetching ${url}`);
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    let complete = false;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                complete = true;
                break;
            }
            size += value.byteLength;
            if (size > maxBytes)
                throw new Error(`Response too large while fetching ${url}: exceeds ${maxBytes} bytes.`);
            chunks.push(value);
        }
    }
    finally {
        if (!complete)
            await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
    const result = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return result;
}
//# sourceMappingURL=http-download.js.map