import { readFile, writeFile, stat } from 'node:fs/promises';
export interface HistoryDashboardRecord {kind:string;createdAt:string;passed?:boolean;failed?:number;status?:string;}
export interface HistoryDashboardInput {schemaVersion:1;history:HistoryDashboardRecord[];}
function escapeHtml(s:string):string{return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
/** Offline, dependency-free interactive dashboard. No browser network requests. */
export function renderHistoryDashboard(data:HistoryDashboardInput):string {
  if(data.schemaVersion!==1||!Array.isArray(data.history)||data.history.length>5000)throw new Error('Invalid or excessive history.');
  const clean=data.history.map(x=>({
    kind:String(x.kind??'unknown').slice(0,64),at:String(x.createdAt??'').slice(0,32),
    status:x.passed===false||Number(x.failed??0)>0?'failed':x.passed===true?'passed':String(x.status??'unknown').slice(0,48),
  }));
  const rows=clean.map(x=>`<tr data-kind="${escapeHtml(x.kind)}" data-status="${escapeHtml(x.status)}"><td>${escapeHtml(x.at)}</td><td>${escapeHtml(x.kind)}</td><td>${escapeHtml(x.status)}</td></tr>`).join('');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Canary offline history</title>
  <style>body{font:15px system-ui;background:#101923;color:#eef4f8;margin:auto;max-width:1100px;padding:28px}input,select{background:#1d2c3a;color:inherit;border:1px solid #526678;padding:10px;border-radius:6px}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #354859}tr[hidden]{display:none}small{color:#abc2d4}</style>
  <h1>Claude Code Canary — Offline History</h1><p><small>Local summary only. No prompts, secrets or network requests.</small></p>
  <p id="count">Entries: ${clean.length}</p><label>Filter <input id="find" aria-label="Filter history"></label>
  <label>Status <select id="status"><option value="">All</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label>
  <table><thead><tr><th>Time</th><th>Kind</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
  <script>const rows=[...document.querySelectorAll('tbody tr')],search=document.getElementById('find'),state=document.getElementById('status'),count=document.getElementById('count');function filter(){let n=0;for(const r of rows){const ok=r.textContent.toLowerCase().includes(search.value.toLowerCase())&&(!state.value||r.dataset.status===state.value);r.hidden=!ok;if(ok)n++}count.textContent='Visible: '+n+' / '+rows.length}search.addEventListener('input',filter);state.addEventListener('change',filter);</script></html>`;
}
export async function buildHistoryDashboard(indexFile:string,outputFile:string):Promise<void>{
  if((await stat(indexFile)).size>4*1024*1024)throw new Error('History index exceeds 4 MiB.');
  const parsed=JSON.parse(await readFile(indexFile,'utf8')) as HistoryDashboardInput;
  await writeFile(outputFile,renderHistoryDashboard(parsed),{encoding:'utf8',flag:'wx'});
}
