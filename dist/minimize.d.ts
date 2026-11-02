export interface MinimizationResult<T> {
    originalCount: number;
    remaining: T[];
    checks: number;
    budgetExhausted: boolean;
}
/** Delta debugging for independently removable steps; the predicate must be repeatable.
 * Bounded and fail-closed: a failed baseline is required, and budget exhaustion is explicit.
 */
export declare function minimizeFailure<T>(input: readonly T[], stillFails: (candidate: readonly T[]) => Promise<boolean>, maxChecks?: number): Promise<MinimizationResult<T>>;
//# sourceMappingURL=minimize.d.ts.map