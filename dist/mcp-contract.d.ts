import { z } from 'zod';
export declare const McpContractSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    name: z.ZodString;
    server: z.ZodObject<{
        transport: z.ZodDefault<z.ZodEnum<{
            stdio: "stdio";
            "streamable-http": "streamable-http";
        }>>;
        command: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        args: z.ZodDefault<z.ZodArray<z.ZodString>>;
        cwd: z.ZodOptional<z.ZodString>;
        env: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        timeout_seconds: z.ZodDefault<z.ZodNumber>;
        protocol_version: z.ZodDefault<z.ZodString>;
    }, z.core.$strict>;
    expect: z.ZodOptional<z.ZodObject<{
        tools: z.ZodOptional<z.ZodObject<{
            require: z.ZodDefault<z.ZodArray<z.ZodString>>;
            deny: z.ZodDefault<z.ZodArray<z.ZodString>>;
            exact: z.ZodDefault<z.ZodBoolean>;
            require_read_only: z.ZodDefault<z.ZodArray<z.ZodString>>;
            deny_destructive: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>>;
        prompts: z.ZodOptional<z.ZodObject<{
            require: z.ZodDefault<z.ZodArray<z.ZodString>>;
            deny: z.ZodDefault<z.ZodArray<z.ZodString>>;
            exact: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>>;
        resources: z.ZodOptional<z.ZodObject<{
            require: z.ZodDefault<z.ZodArray<z.ZodString>>;
            deny: z.ZodDefault<z.ZodArray<z.ZodString>>;
            exact: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>>;
        resource_templates: z.ZodOptional<z.ZodObject<{
            require: z.ZodDefault<z.ZodArray<z.ZodString>>;
            deny: z.ZodDefault<z.ZodArray<z.ZodString>>;
            exact: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strict>>;
        capabilities: z.ZodOptional<z.ZodObject<{
            tools_list_changed: z.ZodOptional<z.ZodBoolean>;
            prompts_list_changed: z.ZodOptional<z.ZodBoolean>;
            resources_list_changed: z.ZodOptional<z.ZodBoolean>;
            resources_subscribe: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type McpContract = z.infer<typeof McpContractSchema>;
export interface McpToolSnapshot {
    name: string;
    title?: string;
    description?: string;
    inputSchema: unknown;
    outputSchema?: unknown;
    annotations?: Record<string, unknown>;
}
export interface McpPromptSnapshot {
    name: string;
    title?: string;
    description?: string;
    arguments?: unknown[];
}
export interface McpResourceSnapshot {
    uri: string;
    name?: string;
    title?: string;
    description?: string;
    mimeType?: string;
}
export interface McpResourceTemplateSnapshot {
    uriTemplate: string;
    name?: string;
    title?: string;
    description?: string;
    mimeType?: string;
}
export interface McpContractSnapshot {
    schemaVersion: 1;
    contract: string;
    capturedAt: string;
    requestedProtocolVersion: string;
    protocolVersion: string;
    serverInfo?: Record<string, unknown>;
    capabilities: Record<string, unknown>;
    tools: McpToolSnapshot[];
    prompts: McpPromptSnapshot[];
    resources: McpResourceSnapshot[];
    resourceTemplates: McpResourceTemplateSnapshot[];
    observedNotifications: {
        toolsListChanged: number;
        promptsListChanged: number;
        resourcesListChanged: number;
    };
    fingerprint: string;
}
export interface McpExpectationResult {
    passed: boolean;
    failures: string[];
}
export interface McpComparisonResult {
    passed: boolean;
    breakingChanges: string[];
    nonBreakingChanges: string[];
}
export interface McpCheckResult {
    contract: McpContract;
    snapshot: McpContractSnapshot;
    expectations: McpExpectationResult;
    baseline?: McpContractSnapshot;
    comparison?: McpComparisonResult;
    passed: boolean;
    snapshotPath?: string;
}
export interface McpSnapshotOptions {
    cwd?: string;
    output?: string;
}
export interface McpCheckOptions {
    cwd?: string;
    baseline?: string;
    requireBaseline?: boolean;
    saveSnapshot?: string;
}
export interface McpCompareOptions {
    cwd?: string;
}
export declare function loadMcpContract(contractPath: string): Promise<McpContract>;
export declare function inspectMcpContract(contract: McpContract, options?: {
    cwd?: string;
    contractPath?: string;
}): Promise<McpContractSnapshot>;
export declare function evaluateMcpExpectations(contract: McpContract, snapshot: McpContractSnapshot): McpExpectationResult;
export declare function compareMcpSnapshots(baseline: McpContractSnapshot, candidate: McpContractSnapshot): McpComparisonResult;
export declare function defaultMcpSnapshotPath(contract: McpContract, cwd?: string): string;
export declare function loadMcpSnapshot(snapshotPath: string): Promise<McpContractSnapshot>;
export declare function writeMcpSnapshot(contractPath: string, options?: McpSnapshotOptions): Promise<{
    snapshot: McpContractSnapshot;
    path: string;
}>;
export declare function checkMcpContract(contractPath: string, options?: McpCheckOptions): Promise<McpCheckResult>;
export declare function compareMcpContracts(baselineContractPath: string, candidateContractPath: string, options?: McpCompareOptions): Promise<{
    baseline: McpContractSnapshot;
    candidate: McpContractSnapshot;
    comparison: McpComparisonResult;
    passed: boolean;
}>;
export declare function formatMcpCheckMarkdown(result: McpCheckResult): string;
export declare function formatMcpComparisonMarkdown(result: {
    baseline: McpContractSnapshot;
    candidate: McpContractSnapshot;
    comparison: McpComparisonResult;
    passed: boolean;
}): string;
//# sourceMappingURL=mcp-contract.d.ts.map