export interface MinimizationResult<T> {
  originalCount: number;
  remaining: T[];
  checks: number;
  budgetExhausted: boolean;
}
/** Delta debugging for independently removable steps; the predicate must be repeatable.
 * Bounded and fail-closed: a failed baseline is required, and budget exhaustion is explicit.
 */
export async function minimizeFailure<T>(
  input: readonly T[],
  stillFails: (candidate: readonly T[]) => Promise<boolean>,
  maxChecks = 128,
): Promise<MinimizationResult<T>> {
  if (!Number.isSafeInteger(maxChecks) || maxChecks < 1 || maxChecks > 10000) throw new Error('Invalid minimization budget.');
  if (input.length > 10000) throw new Error('Too many minimization elements.');
  let checks=0;
  let current=[...input];
  if (!(await stillFails(current))) throw new Error('Original case does not reproduce the target failure.');
  checks++;
  let granularity=2;
  while(current.length>1 && checks<maxChecks) {
    const part=Math.ceil(current.length/granularity);
    let reduced=false;
    for (let start=0;start<current.length && checks<maxChecks;start+=part) {
      const candidate=current.slice(0,start).concat(current.slice(start+part));
      checks++;
      if (await stillFails(candidate)) {current=candidate;granularity=Math.max(2,granularity-1);reduced=true;break;}
    }
    if (!reduced) {
      if(granularity>=current.length)break;
      granularity=Math.min(current.length,granularity*2);
    }
  }
  return {originalCount:input.length,remaining:current,checks,budgetExhausted:checks>=maxChecks};
}
