import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, chmod, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { verifyReleaseManifest } from './release-signature.js';
const RELEASE_BASE = 'https://downloads.claude.ai/claude-code-releases';
const EXACT_VERSION = /^\d+\.\d+\.\d+$/;
const MAX_METADATA_BYTES = 8 * 1024 * 1024;
const MAX_BINARY_BYTES = 1024 * 1024 * 1024;
const SUPPORTED_PLATFORM_IDS = new Set([
    'win32-x64',
    'win32-arm64',
    'darwin-x64',
    'darwin-arm64',
    'linux-x64',
    'linux-arm64',
    'linux-x64-musl',
    'linux-arm64-musl',
]);
function status(options, message) {
    options.onStatus?.(message);
}
export function isExactVersion(value) {
    return EXACT_VERSION.test(value);
}
export function validatePlatformId(value) {
    if (!SUPPORTED_PLATFORM_IDS.has(value)) {
        throw new Error(`Unsupported Claude Code platform id: ${JSON.stringify(value)}.`);
    }
    return value;
}
function selectedPlatform(value) {
    return value === undefined ? platformId() : validatePlatformId(value);
}
function detectMusl() {
    if (process.platform !== 'linux')
        return false;
    try {
        const report = process.report?.getReport();
        return !report?.header?.glibcVersionRuntime;
    }
    catch {
        return false;
    }
}
export function platformId(platform = process.platform, arch = process.arch, musl = detectMusl()) {
    if (arch !== 'x64' && arch !== 'arm64') {
        throw new Error(`Unsupported architecture: ${arch}. Claude Code Canary currently supports x64 and arm64.`);
    }
    if (platform === 'win32')
        return `win32-${arch}`;
    if (platform === 'darwin')
        return `darwin-${arch}`;
    if (platform === 'linux')
        return `linux-${arch}${musl ? '-musl' : ''}`;
    throw new Error(`Unsupported platform: ${platform}`);
}
export function defaultVersionCacheRoot() {
    if (process.env.CC_CANARY_CACHE_DIR)
        return path.resolve(process.env.CC_CANARY_CACHE_DIR);
    if (process.platform === 'win32') {
        return path.join(process.env.LOCALAPPDATA ?? homedir(), 'claude-code-canary', 'cache');
    }
    return path.join(process.env.XDG_CACHE_HOME ?? path.join(homedir(), '.cache'), 'claude-code-canary');
}
function executableName(platform) {
    return platform.startsWith('win32-') ? 'claude.exe' : 'claude';
}
function validateResolvedVersion(value, source) {
    const version = value.trim();
    if (!isExactVersion(version))
        throw new Error(`Invalid Claude Code version returned for ${source}: ${JSON.stringify(version)}`);
    return version;
}
async function fetchBytes(url, maxBytes = MAX_METADATA_BYTES) {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok)
        throw new Error(`HTTP ${response.status} while fetching ${url}`);
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new Error(`Response too large while fetching ${url}: ${declaredLength} bytes exceeds ${maxBytes}.`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes)
        throw new Error(`Response too large while fetching ${url}: exceeds ${maxBytes} bytes.`);
    return bytes;
}
async function fetchText(url) {
    return new TextDecoder().decode(await fetchBytes(url));
}
export async function resolveClaudeVersion(spec) {
    if (isExactVersion(spec))
        return spec;
    if (spec !== 'latest' && spec !== 'stable') {
        throw new Error(`Version must be x.y.z, latest, or stable; received ${JSON.stringify(spec)}`);
    }
    return validateResolvedVersion(await fetchText(`${RELEASE_BASE}/${spec}`), spec);
}
function parseManifest(raw, expectedVersion) {
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        throw new Error(`Release ${expectedVersion} returned invalid manifest JSON`);
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error(`Release ${expectedVersion} manifest is not an object`);
    const record = value;
    if (record.version !== expectedVersion)
        throw new Error(`Manifest version mismatch: expected ${expectedVersion}, got ${String(record.version)}`);
    if (typeof record.platforms !== 'object' || record.platforms === null || Array.isArray(record.platforms))
        throw new Error(`Release ${expectedVersion} manifest has no platforms map`);
    const platforms = {};
    for (const [id, entry] of Object.entries(record.platforms)) {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry))
            continue;
        const platform = entry;
        if (typeof platform.checksum !== 'string' || !/^[a-fA-F0-9]{64}$/.test(platform.checksum))
            continue;
        platforms[id] = {
            checksum: platform.checksum.toLowerCase(),
            size: typeof platform.size === 'number' && Number.isSafeInteger(platform.size) && platform.size > 0 ? platform.size : undefined,
        };
    }
    return { version: expectedVersion, buildDate: typeof record.buildDate === 'string' ? record.buildDate : undefined, platforms };
}
async function fileExists(file) {
    try {
        await access(file);
        return true;
    }
    catch {
        return false;
    }
}
async function hashFile(file) {
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const chunk of createReadStream(file)) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bytes += buffer.length;
        hash.update(buffer);
    }
    return { checksum: hash.digest('hex'), bytes };
}
async function downloadBinary(url, destination, expectedSize) {
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok || !response.body)
        throw new Error(`HTTP ${response.status} while downloading ${url}`);
    const maxBytes = expectedSize ?? MAX_BINARY_BYTES;
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        throw new Error(`Claude Code download is larger than expected: ${declaredLength} bytes exceeds ${maxBytes}.`);
    }
    const hash = createHash('sha256');
    let bytes = 0;
    const meter = new Transform({
        transform(chunk, _encoding, callback) {
            bytes += chunk.length;
            if (bytes > maxBytes) {
                callback(new Error(`Claude Code download exceeded ${maxBytes} bytes.`));
                return;
            }
            hash.update(chunk);
            callback(null, chunk);
        },
    });
    await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(destination, { mode: 0o755 }));
    return { checksum: hash.digest('hex'), bytes };
}
async function writeInstallMetadata(metadataPath, version, platform, checksum, bytes, verification) {
    const metadata = {
        version,
        platform,
        checksum,
        bytes,
        manifestVerification: verification.mode,
        signingFingerprint: verification.fingerprint,
        verifiedAt: new Date().toISOString(),
    };
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}
export async function installClaudeVersion(spec, options = {}) {
    const version = await resolveClaudeVersion(spec);
    const platform = selectedPlatform(options.platform);
    const cacheRoot = options.cacheRoot ?? defaultVersionCacheRoot();
    const versionDir = path.join(cacheRoot, 'versions', version, platform);
    const executablePath = path.join(versionDir, executableName(platform));
    const manifestPath = path.join(versionDir, 'manifest.json');
    const metadataPath = path.join(versionDir, 'install.json');
    status(options, `Resolving Claude Code ${version} (${platform})...`);
    const manifestBytes = await fetchBytes(`${RELEASE_BASE}/${version}/manifest.json`);
    const verification = await verifyReleaseManifest(version, manifestBytes, cacheRoot);
    const manifestRaw = new TextDecoder().decode(manifestBytes);
    const manifest = parseManifest(manifestRaw, version);
    const expected = manifest.platforms[platform];
    if (!expected) {
        const available = Object.keys(manifest.platforms).sort().join(', ');
        throw new Error(`Claude Code ${version} has no ${platform} binary. Available platforms: ${available}`);
    }
    status(options, verification.mode === 'signed'
        ? `Verified signed release manifest (${verification.fingerprint}).`
        : 'Release predates signed manifests; using checksum-only verification.');
    await mkdir(versionDir, { recursive: true });
    await writeFile(manifestPath, manifestBytes);
    if (await fileExists(executablePath)) {
        const current = await hashFile(executablePath);
        const sizeMatches = expected.size === undefined || expected.size === current.bytes;
        if (current.checksum === expected.checksum && sizeMatches) {
            await writeInstallMetadata(metadataPath, version, platform, current.checksum, current.bytes, verification);
            status(options, `Using cached Claude Code ${version} (${platform}).`);
            return {
                requested: spec,
                version,
                platform,
                executablePath,
                manifestPath,
                metadataPath,
                checksum: current.checksum,
                bytes: current.bytes,
                cached: true,
                manifestVerification: verification.mode,
                signingFingerprint: verification.fingerprint,
            };
        }
        status(options, `Cached Claude Code ${version} failed integrity check; replacing it.`);
        await rm(executablePath, { force: true });
    }
    const binary = executableName(platform);
    const url = `${RELEASE_BASE}/${version}/${platform}/${binary}`;
    const temporary = `${executablePath}.tmp-${process.pid}-${Date.now()}`;
    status(options, `Downloading Claude Code ${version} (${platform})...`);
    try {
        const downloaded = await downloadBinary(url, temporary, expected.size);
        if (downloaded.checksum !== expected.checksum) {
            throw new Error(`SHA256 mismatch for Claude Code ${version} ${platform}: expected ${expected.checksum}, got ${downloaded.checksum}`);
        }
        if (expected.size !== undefined && downloaded.bytes !== expected.size) {
            throw new Error(`Size mismatch for Claude Code ${version} ${platform}: expected ${expected.size}, got ${downloaded.bytes}`);
        }
        if (process.platform !== 'win32')
            await chmod(temporary, 0o755);
        await rename(temporary, executablePath);
        await writeInstallMetadata(metadataPath, version, platform, downloaded.checksum, downloaded.bytes, verification);
        status(options, `Cached Claude Code ${version} at ${executablePath}`);
        return {
            requested: spec,
            version,
            platform,
            executablePath,
            manifestPath,
            metadataPath,
            checksum: downloaded.checksum,
            bytes: downloaded.bytes,
            cached: false,
            manifestVerification: verification.mode,
            signingFingerprint: verification.fingerprint,
        };
    }
    catch (error) {
        await rm(temporary, { force: true });
        throw error;
    }
}
export async function cachedClaudePath(version, options = {}) {
    if (!isExactVersion(version))
        throw new Error('Cached path lookup requires an exact x.y.z version.');
    const platform = selectedPlatform(options.platform);
    const cacheRoot = options.cacheRoot ?? defaultVersionCacheRoot();
    const executablePath = path.join(cacheRoot, 'versions', version, platform, executableName(platform));
    if (!(await fileExists(executablePath)))
        throw new Error(`Claude Code ${version} (${platform}) is not cached. Run: claude-canary versions install ${version}`);
    return executablePath;
}
function compareVersionsDesc(a, b) {
    const aa = a.split('.').map(Number);
    const bb = b.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) {
        if (aa[i] !== bb[i])
            return (bb[i] ?? 0) - (aa[i] ?? 0);
    }
    return 0;
}
export async function listCachedClaudeVersions(options = {}) {
    const platform = selectedPlatform(options.platform);
    const cacheRoot = options.cacheRoot ?? defaultVersionCacheRoot();
    const root = path.join(cacheRoot, 'versions');
    let entries;
    try {
        entries = await readdir(root, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const versions = [];
    for (const entry of entries) {
        if (!entry.isDirectory() || !isExactVersion(entry.name))
            continue;
        const executablePath = path.join(root, entry.name, platform, executableName(platform));
        if (await fileExists(executablePath))
            versions.push(entry.name);
    }
    return versions.sort(compareVersionsDesc);
}
export async function readCachedManifest(version, options = {}) {
    const platform = selectedPlatform(options.platform);
    const cacheRoot = options.cacheRoot ?? defaultVersionCacheRoot();
    return readFile(path.join(cacheRoot, 'versions', version, platform, 'manifest.json'), 'utf8');
}
//# sourceMappingURL=versions.js.map