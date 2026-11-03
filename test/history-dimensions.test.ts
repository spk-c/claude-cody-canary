import {describe,expect,it} from 'vitest';
import {historyDimensions,safeHistoryDimension,summarizeHistoryMatrix} from '../src/history-dimensions.js';
import {renderHistoryDashboard} from '../src/history-dashboard.js';

describe('privacy-preserving version OS plugin history dimensions',()=>{
  it('accepts versioned identifiers but drops arbitrary paths, token-like values and invalid OS values',()=>{
    expect(historyDimensions({kind:'run',createdAt:'2026-11-03T00:00:00Z',
      version:'v2.3.1',platform:'win32',plugin:'@example/my-plugin'})).toEqual({
      version:'v2.3.1',platform:'win32',plugin:'@example/my-plugin',
    });
    expect(safeHistoryDimension('plugin','C:/private/config')).toBeUndefined();
    expect(safeHistoryDimension('version','secret token')).toBeUndefined();
    expect(safeHistoryDimension('platform','freebsd')).toBeUndefined();
    expect(historyDimensions({kind:'run',createdAt:'2026-11-03T00:00:00Z',
      version:'https://secret',platform:'fake',plugin:'<script>alert(1)</script>'})).toEqual({});
  });
  it('does not claim a pass rate without at least ten observed outcomes per matching group',()=>{
    const input={schemaVersion:1 as const,history:[
      {kind:'run',createdAt:'2026-11-03',passed:true,version:'1.2.3',platform:'linux',plugin:'safe'},
      {kind:'run',createdAt:'2026-11-03',passed:false,version:'1.2.3',platform:'linux',plugin:'safe'},
      {kind:'run',createdAt:'2026-11-03',status:'unavailable'},
    ]};
    const result=summarizeHistoryMatrix(input);
    expect(result.totalGroups).toBe(2);
    expect(result.groups[0]).toMatchObject({version:'1.2.3',platform:'linux',plugin:'safe',
      total:2,passed:1,failed:1,unknown:0});
    expect(result.groups[0].passRate).toBeUndefined();
    expect(result.groups[1]).toMatchObject({version:'unknown',platform:'unknown',plugin:'unknown',
      unknown:1});
    expect(summarizeHistoryMatrix(input,1).truncated).toBe(true);
  });
  it('shows escaped labels and interactive filters without embedded raw names',()=>{
    const html=renderHistoryDashboard({schemaVersion:1,history:[
      {kind:'run',createdAt:'2026-11-03',passed:true,version:'1.2.3',platform:'darwin',plugin:'safe'},
      {kind:'run',createdAt:'2026-11-03',passed:false,plugin:'<img src=x onerror=alert(1)>'},
    ]});
    expect(html).toContain('Version / OS / Plugin');
    expect(html).toContain('id="platform"');
    expect(html).toContain('data-version="1.2.3"');
    expect(html).toContain('data-plugin="unknown"');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain("querySelectorAll('#entries tbody tr')");
  });
  it('rejects excessive history and invalid matrix limits',()=>{
    expect(()=>summarizeHistoryMatrix({schemaVersion:1,history:[]},0)).toThrow('limit');
    expect(()=>summarizeHistoryMatrix({schemaVersion:1,history:[]},5001)).toThrow('limit');
  });
});
