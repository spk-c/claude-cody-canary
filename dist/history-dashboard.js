import { readFile, writeFile, stat } from 'node:fs/promises';
import { summarizeHistory } from './history-insights.js';
import { historyDimensions, summarizeHistoryMatrix } from './history-dimensions.js';
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
/** Offline, dependency-free interactive dashboard. No browser network requests. */
export function renderHistoryDashboard(data) {
    if (data.schemaVersion !== 1 || !Array.isArray(data.history) || data.history.length > 5000)
        throw new Error('Invalid or excessive history.');
    const clean = data.history.map(x => ({
        kind: String(x.kind ?? 'unknown').slice(0, 64), at: String(x.createdAt ?? '').slice(0, 32),
        status: x.passed === false || Number(x.failed ?? 0) > 0 ? 'failed' : x.passed === true ? 'passed' : String(x.status ?? 'unknown').slice(0, 48),
        ...historyDimensions(x),
    }));
    const insights = summarizeHistory(data);
    const matrix = summarizeHistoryMatrix(data);
    const peak = Math.max(1, ...insights.days.map(x => x.total));
    const trends = insights.days.map(x => '<div class="trend"><span>' + escapeHtml(x.day) + '</span><div class="bar-track"><span style="width:' + Math.round(100 * x.total / peak) + '%"></span></div><span>' + x.failed + ' / ' + x.total + ' failed</span></div>').join('');
    const clusters = insights.failureClusters.map(x => '<li>' + escapeHtml(x.kind) + ': ' + x.count + ' failures</li>').join('');
    const confidence = insights.passRate ? 'Wilson 95% interval: ' + Math.round(100 * insights.passRate.low) + '–' + Math.round(100 * insights.passRate.high) + '%' : 'Pass rate unavailable (no known outcomes)';
    const rows = clean.map(x => `<tr data-kind="${escapeHtml(x.kind)}" data-status="${escapeHtml(x.status)}" data-version="${escapeHtml(x.version ?? 'unknown')}" data-platform="${escapeHtml(x.platform ?? 'unknown')}" data-plugin="${escapeHtml(x.plugin ?? 'unknown')}"><td>${escapeHtml(x.at)}</td><td>${escapeHtml(x.kind)}</td><td>${escapeHtml(x.status)}</td><td>${escapeHtml(x.version ?? 'unknown')}</td><td>${escapeHtml(x.platform ?? 'unknown')}</td><td>${escapeHtml(x.plugin ?? 'unknown')}</td></tr>`).join('');
    const dimensions = (key) => ['<option value="">All</option>', ...[...new Set(clean.map(x => x[key] ?? 'unknown'))].sort().map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`)].join('');
    const matrixRows = matrix.groups.map(x => `<tr><td>${escapeHtml(x.version)}</td><td>${escapeHtml(x.platform)}</td><td>${escapeHtml(x.plugin)}</td><td>${x.passed}/${x.failed}/${x.unknown}</td><td>${x.passRate ? Math.round(x.passRate.proportion * 100) + '%' : 'insufficient data'}</td></tr>`).join('');
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Canary offline history</title>
  <style>body{font:15px system-ui;background:#101923;color:#eef4f8;margin:auto;max-width:1100px;padding:28px}input,select{background:#1d2c3a;color:inherit;border:1px solid #526678;padding:10px;border-radius:6px}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #354859}tr[hidden]{display:none}small{color:#abc2d4}.overview{display:flex;gap:14px;flex-wrap:wrap}.metric{padding:12px;background:#1d2c3a;border:1px solid #354859;border-radius:8px;min-width:120px}.trend{display:grid;grid-template-columns:110px minmax(80px,1fr) 100px;gap:10px;align-items:center;margin:6px 0;font-size:12px}.bar-track{height:14px;background:#354859;border-radius:4px;overflow:hidden}.bar-track span{display:block;height:100%;background:#91b7e3}section{margin:18px 0}li{margin:6px 0}</style>
  <h1>Claude Code Canary — Offline History</h1><p><small>Local summary only. No prompts, secrets or network requests.</small></p>
  <section aria-label="Summary"><h2>Summary</h2><div class="overview"><div class="metric">Total: ${insights.total}</div><div class="metric">Passed: ${insights.passed}</div><div class="metric">Failed: ${insights.failed}</div><div class="metric">Unknown: ${insights.unknown}</div></div><p><small>${escapeHtml(confidence)}</small></p></section>
  <section aria-label="Daily trends"><h2>Daily trends</h2>${trends || '<p>No dated records.</p>'}</section>
  <section aria-label="Failure groups"><h2>Failure groups</h2><ol>${clusters || '<li>No recorded failures.</li>'}</ol></section>
  <section aria-label="Version platform plugin matrix"><h2>Version / OS / Plugin</h2><p><small>Descriptive summaries only. Unknown metadata are not inferred; groups may use different tests. ${matrix.truncated ? 'Showing largest groups only.' : ''}</small></p><table><thead><tr><th>Version</th><th>OS</th><th>Plugin</th><th>Passed / failed / unknown</th><th>Pass rate (n>=10)</th></tr></thead><tbody>${matrixRows}</tbody></table></section>
  <p id="count">Entries: ${clean.length}</p><label>Filter <input id="find" aria-label="Filter history"></label>
  <label>Status <select id="status"><option value="">All</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label>
  <label>Version <select id="version">${dimensions('version')}</select></label>
  <label>OS <select id="platform">${dimensions('platform')}</select></label>
  <label>Plugin <select id="plugin">${dimensions('plugin')}</select></label>
  <table id="entries"><thead><tr><th>Time</th><th>Kind</th><th>Status</th><th>Version</th><th>OS</th><th>Plugin</th></tr></thead><tbody>${rows}</tbody></table>
  <script>const rows=[...document.querySelectorAll('#entries tbody tr')],search=document.getElementById('find'),state=document.getElementById('status'),version=document.getElementById('version'),platform=document.getElementById('platform'),plugin=document.getElementById('plugin'),count=document.getElementById('count');function filter(){let n=0;for(const r of rows){const ok=r.textContent.toLowerCase().includes(search.value.toLowerCase())&&(!state.value||r.dataset.status===state.value)&&(!version.value||r.dataset.version===version.value)&&(!platform.value||r.dataset.platform===platform.value)&&(!plugin.value||r.dataset.plugin===plugin.value);r.hidden=!ok;if(ok)n++}count.textContent='Visible: '+n+' / '+rows.length}for(const el of [search,state,version,platform,plugin])el.addEventListener('input',filter);</script></html>`;
}
export async function buildHistoryDashboard(indexFile, outputFile) {
    if ((await stat(indexFile)).size > 4 * 1024 * 1024)
        throw new Error('History index exceeds 4 MiB.');
    const parsed = JSON.parse((await readFile(indexFile, 'utf8')).replace(/^\uFEFF/, ''));
    await writeFile(outputFile, renderHistoryDashboard(parsed), { encoding: 'utf8', flag: 'wx' });
}
//# sourceMappingURL=history-dashboard.js.map