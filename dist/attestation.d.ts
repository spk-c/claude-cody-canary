export interface BundleAttestationFile {
    path: string;
    sha256: string;
    bytes: number;
}
export interface BundleAttestation {
    schemaVersion: 1;
    algorithm: 'sha256' | 'ed25519-sha256-manifest';
    createdAt: string;
    files: BundleAttestationFile[];
    manifestHash: string;
    publicKeyFingerprint?: string;
    signature?: string;
}
export declare function createBundleAttestation(root: string, options?: {
    privateKeyPem?: string;
    exclude?: string[];
}): Promise<BundleAttestation>;
export declare function verifyBundleAttestation(root: string, attestation: BundleAttestation, options?: {
    publicKeyPem?: string;
    attestationPath?: string;
    exclude?: string[];
}): Promise<{
    passed: boolean;
    failures: string[];
}>;
//# sourceMappingURL=attestation.d.ts.map