import {describe,expect,it} from 'vitest';
import {comparePassRateFamily} from '../src/statistical-regressions.js';

describe('conservative family-wise statistical correction',()=>{
  const scenario=(id:string,bp=99,br=100,cp=50,cr=100)=>({
    id,baselinePasses:bp,baselineRuns:br,candidatePasses:cp,candidateRuns:cr,
  });
  it('raises the critical threshold for multiple comparisons and returns family metadata',()=>{
    const one=comparePassRateFamily([scenario('one')]);
    const many=comparePassRateFamily([scenario('one'),scenario('two'),scenario('three')]);
    expect(many.familyWiseAlpha).toBe(0.05);
    expect(many.criticalZ).toBeGreaterThan(one.criticalZ);
    expect(many.comparisons[0].decision.baseline.high -
      many.comparisons[0].decision.baseline.low).toBeGreaterThanOrEqual(
        one.comparisons[0].decision.baseline.high -
        one.comparisons[0].decision.baseline.low);
    expect(many.comparisons[0].decision.verdict).toBe('regression');
  });
  it('never claims a change for insufficient data and can classify improvements',()=>{
    const short=comparePassRateFamily([scenario('tiny',4,4,0,4)]);
    expect(short.comparisons[0].decision.verdict).toBe('insufficient-data');
    const improved=comparePassRateFamily([scenario('improved',0,100,100,100)]);
    expect(improved.comparisons[0].decision.verdict).toBe('improvement');
  });
  it('rejects invalid alpha, duplicate identifiers, and impossible samples',()=>{
    expect(()=>comparePassRateFamily([])).toThrow();
    expect(()=>comparePassRateFamily([scenario('a'),scenario('a')])).toThrow('duplicate');
    expect(()=>comparePassRateFamily([scenario('a')],0)).toThrow('budget');
    expect(()=>comparePassRateFamily([scenario('a',101,100)])).toThrow('sample');
    expect(()=>comparePassRateFamily([scenario('private/secret')])).toThrow('identifier');
  });
});
