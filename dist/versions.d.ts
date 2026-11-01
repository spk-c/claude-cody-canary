import { type ManifestVerification } from './release-signature.js';
export interface InstallVersionOptions {
    platform?: string;
    cacheRoot?: string;
    onStatus?: (message: string) => void;
}
export interface InstalledClaudeVersion {
    requested: string;
    version: string;
    platform: string;
    executablePath: string;
    manifestPath: string;
    metadataPath: string;
    checksum: string;
    bytes: number;
    cached: boolean;
    manifestVerification: ManifestVerification['mode'];
    signingFingerprint: string | null;
}
export declare function isExactVersion(value: string): boolean;
export declare function validatePlatformId(value: string): string;
export declare function platformId(platform?: NodeJS.Platform, arch?: string, musl?: boolean): string;
export declare function defaultVersionCacheRoot(): string;
export declare function resolveClaudeVersion(spec: string): Promise<string>;
export declare function installClaudeVersion(spec: string, options?: InstallVersionOptions): Promise<InstalledClaudeVersion>;
export declare function cachedClaudePath(version: string, options?: Pick<InstallVersionOptions, 'platform' | 'cacheRoot'>): Promise<string>;
export declare function listCachedClaudeVersions(options?: Pick<InstallVersionOptions, 'platform' | 'cacheRoot'>): Promise<string[]>;
export declare function readCachedManifest(version: string, options?: Pick<InstallVersionOptions, 'platform' | 'cacheRoot'>): Promise<string>;
//# sourceMappingURL=versions.d.ts.map