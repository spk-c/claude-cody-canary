import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

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

async function walk(root: string, current = root, output: string[] = []): Promise<string[]> {
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) await walk(root, absolute, output);
    else if (entry.isFile()) output.push(absolute);
  }
  return output;
}

async function describeFile(root: string, file: string): Promise<BundleAttestationFile> {
  const stats = await lstat(file);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Attestation refuses non-regular file: ${file}`);
  const bytes = await readFile(file);
  return {
    path: path.relative(root, file).replace(/\\/g, '/'),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
  };
}

function manifestBytes(files: BundleAttestationFile[]): Buffer {
  return Buffer.from(JSON.stringify(files.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }))));
}

function publicFingerprint(key: ReturnType<typeof createPublicKey>): string {
  const der = key.export({ type: 'spki', format: 'der' });
  return createHash('sha256').update(der).digest('hex');
}

export async function createBundleAttestation(root: string, options: { privateKeyPem?: string; exclude?: string[] } = {}): Promise<BundleAttestation> {
  const resolved = path.resolve(root);
  const excluded = new Set((options.exclude ?? []).map((value) => value.replace(/\\/g, '/')));
  const files: BundleAttestationFile[] = [];
  for (const file of (await walk(resolved)).sort()) {
    const relative = path.relative(resolved, file).replace(/\\/g, '/');
    if (excluded.has(relative)) continue;
    files.push(await describeFile(resolved, file));
  }
  const payload = manifestBytes(files);
  const manifestHash = createHash('sha256').update(payload).digest('hex');
  if (!options.privateKeyPem) {
    return { schemaVersion: 1, algorithm: 'sha256', createdAt: new Date().toISOString(), files, manifestHash };
  }
  const privateKey = createPrivateKey(options.privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Bundle signing requires an Ed25519 private key.');
  const publicKey = createPublicKey(privateKey);
  return {
    schemaVersion: 1,
    algorithm: 'ed25519-sha256-manifest',
    createdAt: new Date().toISOString(),
    files,
    manifestHash,
    publicKeyFingerprint: publicFingerprint(publicKey),
    signature: sign(null, payload, privateKey).toString('base64'),
  };
}

export async function verifyBundleAttestation(
  root: string,
  attestation: BundleAttestation,
  options: { publicKeyPem?: string; attestationPath?: string; exclude?: string[] } = {},
): Promise<{ passed: boolean; failures: string[] }> {
  const resolved = path.resolve(root);
  const failures: string[] = [];
  if (!attestation || attestation.schemaVersion !== 1 || !Array.isArray(attestation.files) ||
    !['sha256', 'ed25519-sha256-manifest'].includes(attestation.algorithm) ||
    !/^[0-9a-f]{64}$/.test(attestation.manifestHash)) {
    return { passed: false, failures: ['Invalid attestation envelope.'] };
  }
  if ((attestation.algorithm === 'sha256' && attestation.signature !== undefined) ||
    (attestation.algorithm === 'ed25519-sha256-manifest' && !attestation.signature)) {
    return { passed: false, failures: ['Attestation signing metadata does not match the declared algorithm.'] };
  }
  if (attestation.files.some((file) => !file || typeof file.path !== 'string' ||
    !/^[0-9a-f]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0)) {
    return { passed: false, failures: ['Invalid attested file metadata.'] };
  }
  const seen = new Set<string>();
  for (const expected of attestation.files) {
    const normalized = expected.path.replace(/\\/g, '/');
    if (!normalized || normalized.includes('\0') || /^[A-Za-z]:\//.test(normalized) ||
      normalized.startsWith('/') || normalized.split('/').some((segment) =>
        !segment || segment === '.' || segment === '..') || seen.has(normalized)) {
      failures.push(`Unsafe or duplicate attested path: ${expected.path}`);
      continue;
    }
    seen.add(normalized);
    try {
      const absolute = path.join(resolved, normalized);
      let parent = path.dirname(absolute);
      while (parent !== resolved && parent.startsWith(`${resolved}${path.sep}`)) {
        if ((await lstat(parent)).isSymbolicLink()) throw new Error(`Symlinked ancestor: ${parent}`);
        parent = path.dirname(parent);
      }
      const actual = await describeFile(resolved, absolute);
      if (expected.sha256 !== actual.sha256 || expected.bytes !== actual.bytes)
        failures.push(`Integrity mismatch: ${normalized}`);
    } catch (error) {
      failures.push(`Missing/unreadable ${normalized}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const ignored = new Set((options.exclude ?? []).map((item) => item.replace(/\\/g, '/')));
  if (options.attestationPath) {
    const relative = path.relative(resolved, path.resolve(options.attestationPath)).replace(/\\/g, '/');
    if (relative && !relative.startsWith('../') && !path.isAbsolute(relative)) ignored.add(relative);
  }
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(resolved, absolute).replace(/\\/g, '/');
      if (ignored.has(relative)) continue;
      if (entry.isSymbolicLink()) failures.push(`Unexpected symlink in attested bundle: ${relative}`);
      else if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && !seen.has(relative)) failures.push(`Unattested bundle file: ${relative}`);
      else if (!entry.isFile() && !entry.isDirectory()) failures.push(`Unexpected bundle entry: ${relative}`);
    }
  };
  await visit(resolved);
  const payload = manifestBytes(attestation.files);
  const hash = createHash('sha256').update(payload).digest('hex');
  if (hash !== attestation.manifestHash) failures.push('Attestation manifest hash is invalid.');
  if (attestation.signature) {
    if (!options.publicKeyPem) failures.push('Attestation is signed but no public key was provided.');
    else {
      try {
        const publicKey = createPublicKey(options.publicKeyPem);
        if (attestation.publicKeyFingerprint && publicFingerprint(publicKey) !== attestation.publicKeyFingerprint)
          failures.push('Public key fingerprint does not match attestation.');
        if (!verify(null, payload, publicKey, Buffer.from(attestation.signature, 'base64')))
          failures.push('Ed25519 signature verification failed.');
      } catch {
        failures.push('Invalid attestation public key or signature.');
      }
    }
  }
  return { passed: failures.length === 0, failures };
}
