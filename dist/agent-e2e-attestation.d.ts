import { z } from 'zod';
declare const signedSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<1>;
    algorithm: z.ZodLiteral<"ed25519-e2e-v1">;
    manifest: z.ZodObject<{
        schemaVersion: z.ZodLiteral<1>;
        agent: z.ZodEnum<{
            claude: "claude";
            codex: "codex";
            qwen: "qwen";
        }>;
        version: z.ZodString;
        experiment: z.ZodObject<{
            suiteHash: z.ZodString;
            configurationHash: z.ZodString;
            hardwareHash: z.ZodString;
            platform: z.ZodEnum<{
                darwin: "darwin";
                linux: "linux";
                win32: "win32";
            }>;
        }, z.core.$strict>;
        limits: z.ZodObject<{
            maxRuns: z.ZodNumber;
            maxDurationMs: z.ZodNumber;
            perRunTimeoutMs: z.ZodNumber;
            maxReportedCostUsd: z.ZodNumber;
            reserveUsdPerRun: z.ZodNumber;
        }, z.core.$strict>;
        cases: z.ZodArray<z.ZodObject<{
            scenarioHash: z.ZodString;
            replicate: z.ZodNumber;
            prompt: z.ZodString;
            expectedAnswerSha256: z.ZodString;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    manifestHash: z.ZodString;
    reviewerKeyFingerprint: z.ZodString;
    signature: z.ZodString;
}, z.core.$strict>;
export type SignedAgentE2eManifest = z.infer<typeof signedSchema>;
export interface E2eReviewerVerification {
    verified: boolean;
    reviewerKeyFingerprint?: string;
    manifestHash?: string;
    reason: 'valid' | 'invalid-envelope' | 'invalid-signature' | 'wrong-reviewer-key';
}
/** Sign only reviewed fixture input. No private keys are written or returned. */
export declare function signAgentE2eManifest(input: unknown, privateKeyPem: string): SignedAgentE2eManifest;
/** Fail-closed. The public key MUST be pinned out of band to the reviewer. */
export declare function verifyAgentE2eManifest(signedInput: unknown, reviewerPublicKeyPem: string): E2eReviewerVerification;
export {};
//# sourceMappingURL=agent-e2e-attestation.d.ts.map