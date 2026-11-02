export { AgentTeamScenarioSchema, parseAgentTeamScenario, loadAgentTeamScenario, aggregateAgentTeamEvents, evaluateAgentTeamExpectations, runAgentTeam, loadAgentTeamResult, compareAgentTeamResults, formatAgentTeamRun, formatAgentTeamComparison, } from './agent-team.js';
export { runDoctor, runDoctorReport, formatDoctor, detectProviderConfiguration, findExecutable, } from './doctor.js';
export { ScenarioSchema, loadScenario, parseScenario } from './config.js';
export { runScenario, filterFixtureChanges } from './runner.js';
export { formatRun, formatComparison } from './report.js';
export { formatComparisonMarkdown } from './comparison-markdown.js';
export { evaluateComparisonRegressions } from './regressions.js';
export { runPrCheck } from './pr-check.js';
export { updateBaseline, checkBaseline, loadBaseline, defaultBaselinePath } from './baseline.js';
export { proposeBaselineUpdate, applyBaselineProposal } from './baseline-review.js';
export { bisectCommands, bisectReleases } from './bisect.js';
export { runExperiment, formatExperiment } from './experiment.js';
export { discoverPlugin, generatePluginScenarios } from './plugin-init.js';
export { discoverExtendedPluginSurfaces } from './plugin-surfaces.js';
export { runPluginMatrix, resolvePluginMatrixVersions, formatPluginMatrixMarkdown, validateExplicitVersions, selectRecentPublishedVersions, } from './plugin-matrix.js';
export { runPluginSuite, formatPluginSuiteMarkdown, loadGeneratedPluginSuite, validatePluginSuiteRunBudget, } from './plugin-suite.js';
export { McpContractSchema, loadMcpContract, inspectMcpContract, evaluateMcpExpectations, compareMcpSnapshots, writeMcpSnapshot, loadMcpSnapshot, checkMcpContract, compareMcpContracts, defaultMcpSnapshotPath, formatMcpCheckMarkdown, formatMcpComparisonMarkdown, } from './mcp-contract.js';
export { createReproBundle } from './repro.js';
export { cachedClaudePath, installClaudeVersion, listCachedClaudeVersions, platformId, resolveClaudeVersion, validatePlatformId, } from './versions.js';
// v1.3: suites, release watch, stability, failure families, selective execution and safe result reuse.
export { SuiteSchema, parseSuite, loadSuite, resolveSuiteScenarios, explainSuiteSelection, runSuite, combineSuiteResults, formatSuiteMarkdown, } from './suite.js';
export { fingerprintRun, clusterRunFailures, classifyRunFailure } from './fingerprint.js';
export { analyzeFlakiness, summarizeFlakeRuns, formatFlakeMarkdown } from './flake.js';
export { analyzeSuiteFlakiness, summarizeSuiteFlakiness, formatSuiteFlakeMarkdown } from './suite-flake.js';
export { watchClaudeCodeReleases, readWatchState, formatWatchMarkdown } from './watch.js';
export { buildResultCacheIdentity, resultCacheKey, readCachedRun, writeCachedRun, runScenarioWithCache, } from './result-cache.js';
// v1.4: interoperable reports and explicit baseline review.
export { suiteToJUnit } from './junit.js';
export { suiteToSarif } from './sarif.js';
export { loadResultSummaries, renderStaticHtmlReport, generateStaticHtmlReport } from './report-html.js';
export { loadTrendPoints, summarizeTrends, formatTrendMarkdown } from './trend.js';
// v1.5/v2: portable compatibility evidence, lockfiles, registries, graph/query API and scenario packs.
export { CompatibilityManifestSchema, CanaryLockSchema, CompatibilityRegistrySchema, sha256Canonical, createCompatibilityManifest, writeCompatibilityManifest, loadCompatibilityManifest, loadCompatibilityRegistry, writeCompatibilityRegistry, createCanaryLock, writeCanaryLock, loadCanaryLock, checkCanaryLock, mergeCompatibilityRegistries, aggregateRegistryFiles, queryCompatibility, compareVersion, newestKnownGood, firstKnownBad, explainCompatibility, buildCompatibilityGraph, compatibilityBadgeMarkdown, } from './compatibility.js';
export { detectCompatibilityArtifactKind, diagnoseCompatibilityArtifact, diagnoseCompatibilityFile, formatCompatibilityDiagnostics, } from './compatibility-diagnostics.js';
export { StaticRegistryReleaseSchema, StaticRegistryComponentSchema, StaticRegistryIndexSchema, buildStaticRegistryIndex, renderStaticRegistryHtml, publishCompatibilityRegistry, } from './registry-publish.js';
export { SignedCompatibilityManifestSchema, signCompatibilityManifest, verifySignedCompatibilityManifest, loadSignedCompatibilityManifest, writeSignedCompatibilityManifest, } from './manifest-signing.js';
export { CompatibilityBadgeMetadataSchema, buildCompatibilityBadgeMetadata, renderCompatibilityBadgeSvg, publishCompatibilityBadge, } from './compatibility-badge.js';
export { RegistryExchangeConflictSchema, exportCompatibilityRegistry, importCompatibilityRegistries, } from './registry-exchange.js';
export { ScenarioPackSchema, inspectScenarioPack, installScenarioPack } from './packs.js';
export { ScenarioPackDiscoverySchema, ScenarioPackCatalogSchema, buildScenarioPackDiscovery, buildScenarioPackCatalog, loadScenarioPackDiscovery, } from './pack-discovery.js';
// v1.6: policy/trust, gateway matrices, isolated MCP fixtures and attestation.
export { PermissionPolicySchema, evaluatePermissionPolicy } from './policy.js';
export { LifecycleTrustPolicySchema, evaluateLifecycleTrust, compareTrustSurfaces } from './trust.js';
export { GatewayMatrixSchema, loadGatewayMatrix, runGatewayMatrix } from './gateway.js';
export { createSafeMcpFixture } from './mcp-fixtures.js';
export { createBundleAttestation, verifyBundleAttestation } from './attestation.js';
export { CanaryExitCode, exitCodeForSuite, exitCodeForWatch } from './exit-codes.js';
export { CANARY_VERSION } from './version.js';
/** Offline-first platform features introduced in v2.3.0 (not part of v2.2.0 npm). */
export { analyzeCiLog, groupCiInsights } from './ci-insights.js';
export { validateMcpEnvelopes, mcpMalformedCorpus } from './mcp-conformance.js';
export { minimizeFailure } from './minimize.js';
export { wilsonPassRate, comparePassRates } from './statistical-regressions.js';
export { auditPluginDiscovery, auditPluginDirectory } from './plugin-audit.js';
export { auditClaudeSettings } from './security-audit.js';
export { discoverAgentAdapters, KNOWN_AGENT_ADAPTERS } from './agent-adapters.js';
export { prioritizeScenarios } from './smart-selection.js';
export { renderHistoryDashboard, buildHistoryDashboard } from './history-dashboard.js';
export { analyzeGithubRun } from './github-diagnostics.js';
export { auditLiveMcp } from './mcp-live-audit.js';
export { agentReadOnlyArgs, runAgentTest } from './agent-runner.js';
export { minimizeDependentSteps, replayMinimizeScenario, validateReplayScenario } from './scenario-replay.js';
export { importHistorySqlite, queryHistorySqlite, queryHistoryTrends, renderStoredHistory } from './history-sqlite.js';
export { sortSuiteByPriority } from './suite.js';
//# sourceMappingURL=api.js.map