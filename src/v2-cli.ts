#!/usr/bin/env node

const argv = process.argv.slice(2);
const suiteSubcommand = argv[0] === 'suite' ? argv[1] : undefined;
const diffCommand = (argv[0] === 'lock' || argv[0] === 'compat') && argv[1] === 'diff' ? argv[0] : undefined;
const compatSubcommand = argv[0] === 'compat' ? argv[1] : undefined;
const registrySubcommand = argv[0] === 'registry' ? argv[1] : undefined;
const packSubcommand = argv[0] === 'pack' ? argv[1] : undefined;

async function failClosed(run: () => Promise<void>, exitCode = 4): Promise<void> {
  try {
    await run();
  } catch (error) {
    console.error(`claude-canary: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = exitCode;
  }
}

if (suiteSubcommand === 'init') {
  await failClosed(async () => {
    const { runSuiteInitCli } = await import('./suite-init.js');
    await runSuiteInitCli(argv.slice(2));
  }, 2);
} else if (suiteSubcommand === 'migrate') {
  await failClosed(async () => {
    const { runSuiteMigrateCli } = await import('./suite-migrate.js');
    await runSuiteMigrateCli(argv.slice(2));
  }, 2);
} else if (diffCommand) {
  await failClosed(async () => {
    const { runCompatibilityDiffCli } = await import('./compatibility-diff.js');
    await runCompatibilityDiffCli(diffCommand === 'lock' ? 'lock' : 'manifest', argv.slice(2));
  }, 2);
} else if (compatSubcommand === 'diagnose') {
  await failClosed(async () => {
    const { runCompatibilityDiagnoseCli } = await import('./compatibility-diagnostics.js');
    await runCompatibilityDiagnoseCli(argv.slice(2));
  });
} else if (compatSubcommand === 'sign') {
  await failClosed(async () => {
    const { runCompatibilitySignCli } = await import('./manifest-signing.js');
    await runCompatibilitySignCli(argv.slice(2));
  });
} else if (compatSubcommand === 'verify') {
  await failClosed(async () => {
    const { runCompatibilityVerifyCli } = await import('./manifest-signing.js');
    await runCompatibilityVerifyCli(argv.slice(2));
  });
} else if (compatSubcommand === 'badge') {
  await failClosed(async () => {
    const { runCompatibilityBadgeCli } = await import('./compatibility-badge.js');
    await runCompatibilityBadgeCli(argv.slice(2));
  });
} else if (registrySubcommand === 'publish') {
  await failClosed(async () => {
    const { runRegistryPublishCli } = await import('./registry-publish.js');
    await runRegistryPublishCli(argv.slice(2));
  });
} else if (registrySubcommand === 'export') {
  await failClosed(async () => {
    const { runRegistryExportCli } = await import('./registry-exchange.js');
    await runRegistryExportCli(argv.slice(2));
  });
} else if (registrySubcommand === 'import') {
  await failClosed(async () => {
    const { runRegistryImportCli } = await import('./registry-exchange.js');
    await runRegistryImportCli(argv.slice(2));
  });
} else if (packSubcommand === 'metadata') {
  await failClosed(async () => {
    const { runPackMetadataCli } = await import('./pack-discovery.js');
    await runPackMetadataCli(argv.slice(2));
  });
} else if (packSubcommand === 'catalog') {
  await failClosed(async () => {
    const { runPackCatalogCli } = await import('./pack-discovery.js');
    await runPackCatalogCli(argv.slice(2));
  });
} else if ((await import('./platform-cli.js')).isPlatformCommand(argv)) {
  await failClosed(async () => {
    const { runPlatformCommand } = await import('./platform-cli.js');
    await runPlatformCommand(argv);
  }, 2);
} else {
  await import('./v2-core-cli.js');
  const rootHelp = argv.length === 0 ||
    (argv.length === 1 && ['--help', '-h'].includes(argv[0])) ||
    (argv[0] === 'suite' && argv.some((value) => value === '--help' || value === '-h'));
  if (rootHelp) {
    console.log(
      '\nDeveloper experience and publishing:\n' +
      '  suite init                  Create a validated scenario suite interactively\n' +
      '  suite migrate <file>        Migrate a legacy suite layout safely\n' +
      '  lock diff <old> <new>       Explain semantic canary.lock changes\n' +
      '  compat diff <old> <new>     Explain manifest regressions and evidence changes\n' +
      '  compat diagnose <file>      Diagnose invalid or stale compatibility evidence\n' +
      '  compat sign <file>          Sign a compatibility manifest with Ed25519\n' +
      '  compat verify <file>        Verify a signed compatibility manifest\n' +
      '  compat badge <file>         Publish an evidence-backed compatibility badge\n' +
      '  registry publish <file>     Build a static Pages/Release registry bundle\n' +
      '  registry export <file>      Export a filtered independent registry\n' +
      '  registry import <files...>  Merge independent registries with conflict checks\n' +
      '  pack metadata <dir>         Generate community scenario-pack discovery metadata\n' +
      '  pack catalog <files...>     Build a deterministic scenario-pack catalog\n' +
      '  ci analyze <logfile>         Classify CI failures without exporting raw logs\n' +
      '  mcp conformance <json>      Offline JSON-RPC envelope conformance audit\n' +
      '  minimize <json> <marker>    Reduce a reproducible string-list failure\n' +
      '  stats <bp> <br> <cp> <cr>   Compare pass rates with confidence intervals\n' +
      '  plugin scan <directory>    Read-only plugin compatibility inventory\n' +
      '  security audit <json>      Static Claude permissions and hook review\n' +
      '  agent doctor               Discover Claude/Codex/Qwen executable adapters\n' +
      '  smart select <json>         Prioritize affected and historically failing tests\n' +
      '  dashboard <index> <html>    Generate an offline interactive history view\n' +
      '  ci run <owner> <repo> <id>   Read historical GitHub Actions attempt metadata\n' +
      '  mcp live <contract>         Trusted read-only MCP audit; --negative is loopback only\n' +
      '  mcp listen-cycles <url>     Trusted bounded numeric-loopback subscription reconnection probe\n' +
      '  minimize replay <json>      Approved isolated scenario command replay\n' +
      '  agent run <agent> <file>    Approved read-only Claude/Codex/Qwen run\n' +
      '  agent e2e <fixture.json>   Paid runs require signed reviewer fixtures and billing review\n' +
      '  agent e2e-sign <file>      Sign a reviewed E2E fixture with Ed25519\n' +
      '  agent e2e-verify <file>    Verify E2E fixture reviewer signature\n' +
      '  agent hash-answer <file>   Compute the SHA-256 of an expected answer without printing text\n' +
      '  history sqlite-import <index> <db>   Persist sanitized history (Node 22+)\n' +
      '  history sqlite-trends <db>          Local daily history metrics\n' +
      '  history sqlite-dashboard <db> <html>   Export local offline HTML',
    );
  }
}
