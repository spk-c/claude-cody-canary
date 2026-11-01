export const CanaryExitCode = {
    success: 0,
    regression: 2,
    infrastructure: 3,
    configuration: 4,
};
export function exitCodeForSuite(result) {
    if (result.passed)
        return CanaryExitCode.success;
    if (result.infrastructureFailedCount > 0)
        return CanaryExitCode.infrastructure;
    return CanaryExitCode.regression;
}
export function exitCodeForWatch(status, infrastructureFailedCount = 0) {
    if (infrastructureFailedCount > 0 || status === 'infrastructure-error')
        return CanaryExitCode.infrastructure;
    if (status === 'regression')
        return CanaryExitCode.regression;
    return CanaryExitCode.success;
}
//# sourceMappingURL=exit-codes.js.map