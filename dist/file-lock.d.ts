export interface FileLockOptions {
    waitMs?: number;
    staleMs?: number;
    retryMs?: number;
}
/** Exclusive lock across Node processes; only expired abandoned locks may be reclaimed. */
export declare function withFileLock<T>(lockPath: string, operation: () => Promise<T>, { waitMs, staleMs, retryMs }?: FileLockOptions): Promise<T>;
//# sourceMappingURL=file-lock.d.ts.map