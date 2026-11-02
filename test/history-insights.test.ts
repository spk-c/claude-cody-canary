import {describe,expect,it} from 'vitest';
import {summarizeHistory} from '../src/history-insights.js';
import {renderHistoryDashboard} from '../src/history-dashboard.js';
describe('offline history timeline, clusters and quality confidence',()=>{
  const input={schemaVersion:1 as const,history:[
    {kind:'run',createdAt:'2026-11-01T08:00:00Z',passed:true},
    {kind:'run',createdAt:'2026-11-01T09:00:00Z',passed:false},
    {kind:'suite',createdAt:'2026-11-02T08:00:00Z',passed:false},
    {kind:'suite',createdAt:'2026-11-02T09:00:00Z',status:'unknown'},
  ]};
  it('groups real days and failures and retains known-sample Wilson intervals',()=>{
    const insight=summarizeHistory(input);
    expect(insight).toMatchObject({total:4,passed:1,failed:2,unknown:1});
    expect(insight.days).toHaveLength(2);
    expect(insight.days[0]).toMatchObject({total:2,failed:1});
    expect(insight.failureClusters).toHaveLength(2);
    expect(insight.passRate?.trials).toBe(3);
  });
  it('renders a local interactive dashboard with trends, group counts and no injected markup',()=>{
    const html=renderHistoryDashboard({schemaVersion:1,history:[
      ...input.history,{kind:'<img src=x onerror=alert(1)>',createdAt:'not a date',passed:false},
    ]});
    expect(html).toContain('Daily trends');
    expect(html).toContain('Failure groups');
    expect(html).toContain('Wilson 95% interval');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('https://');
  });
  it('has an honest missing-data state',()=>{
    const insight=summarizeHistory({schemaVersion:1,history:[{kind:'run',createdAt:'invalid'}]});
    expect(insight.passRate).toBeUndefined();
    expect(insight.days[0]?.day).toBe('undated');
    expect(renderHistoryDashboard({schemaVersion:1,history:[]})).toContain('Pass rate unavailable');
  });
});
