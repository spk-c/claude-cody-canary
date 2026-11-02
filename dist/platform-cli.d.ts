export declare const PLATFORM_COMMANDS: readonly [readonly ["ci", "analyze"], readonly ["mcp", "conformance"], readonly ["minimize"], readonly ["stats"], readonly ["plugin", "scan"], readonly ["security", "audit"], readonly ["agent", "doctor"], readonly ["smart", "select"], readonly ["dashboard"]];
export declare function isPlatformCommand(argv: string[]): boolean;
export declare function runPlatformCommand(argv: string[]): Promise<void>;
//# sourceMappingURL=platform-cli.d.ts.map