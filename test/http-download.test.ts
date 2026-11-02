import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { fetchBoundedBytes } from '../src/http-download.js';

describe('bounded HTTP metadata downloads', () => {
  it('supports bounded chunked responses without content-length', async () => {
    const server = createServer((_req, res) => {
      res.write('hello'); res.end(' world');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const addr = server.address(); if (!addr || typeof addr === 'string') throw new Error('No port');
      const content = await fetchBoundedBytes(`http://127.0.0.1:${addr.port}`, 20);
      expect(new TextDecoder().decode(content)).toBe('hello world');
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('rejects declared over-sized metadata', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Length': '9999' });
      res.end('too large');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const addr = server.address(); if (!addr || typeof addr === 'string') throw new Error('No port');
      await expect(fetchBoundedBytes(`http://127.0.0.1:${addr.port}`, 5)).rejects.toThrow(/too large/i);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('rejects chunked streams as soon as their size exceeds the limit', async () => {
    const server = createServer((_req, res) => {
      res.write('1234'); res.write('5678'); res.end('9');
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const addr = server.address(); if (!addr || typeof addr === 'string') throw new Error('No port');
      await expect(fetchBoundedBytes(`http://127.0.0.1:${addr.port}`, 6)).rejects.toThrow(/too large/i);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
  it('aborts a response that never arrives by the deadline', async () => {
    const server = createServer((_req, res) => { res.writeHead(200); res.flushHeaders(); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const addr = server.address(); if (!addr || typeof addr === 'string') throw new Error('No port');
      await expect(fetchBoundedBytes(`http://127.0.0.1:${addr.port}`, 10, 75)).rejects.toThrow();
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }, 5000);
});
