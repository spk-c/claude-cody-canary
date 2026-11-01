import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
async function walk(root, current = root, output = []) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory())
            await walk(root, absolute, output);
        else if (entry.isFile())
            output.push(absolute);
    }
    return output;
}
async function describeFile(root, file) {
    const stats = await lstat(file);
    if (!stats.isFile() || stats.isSymbolicLink())
        throw new Error(`Attestation refuses non-regular file: ${file}`);
    const bytes = await readFile(file);
    return {
        path: path.relative(root, file).replace(/\\/g, '/'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
        bytes: bytes.length,
    };
}
function manifestBytes(files) {
    return Buffer.from(JSON.stringify(files.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes }))));
}
function publicFingerprint(key) {
    const der = key.export({ type: 'spki', format: 'der' });
    return createHash('sha256').update(der).digest('hex');
}
export async function createBundleAttestation(root, options = {}) {
    const resolved = path.resolve(root);
    const excluded = new Set((options.exclude ?? []).map((value) => value.replace(/\\/g, '/')));
    const files = [];
    for (const file of (await walk(resolved)).sort()) {
        const relative = path.relative(resolved, file).replace(/\\/g, '/');
        if (excluded.has(relative))
            continue;
        files.push(await describeFile(resolved, file));
    }
    const payload = manifestBytes(files);
    const manifestHash = createHash('sha256').update(payload).digest('hex');
    if (!options.privateKeyPem) {
        return { schemaVersion: 1, algorithm: 'sha256', createdAt: new Date().toISOString(), files, manifestHash };
    }
    const privateKey = createPrivateKey(options.privateKeyPem);
    if (privateKey.asymmetricKeyType !== 'ed25519')
        throw new Error('Bundle signing requires an Ed25519 private key.');
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
export async function verifyBundleAttestation(root, attestation, options = {}) {
    const resolved = path.resolve(root);
    const failures = [];
    const actual = [];
    const seen = new Set();
    for (const expected of attestation.files) {
        const normalized = expected.path.replace(/\\/g, '/');
        if (!normalized || normalized.includes('\0') || /^[A-Za-z]:\//.test(normalized) ||
            normalized.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
            seen.has(normalized)) {
            failures.push(`Unsafe or duplicate attested path: ${expected.path}`);
            continue;
        }
        seen.add(normalized);
        try {
            const absolute = path.join(resolved, normalized);
            let parent = path.dirname(absolute);
            while (parent !== resolved && parent.startsWith(`${resolved}${path.sep}`)) {
                if ((await lstat(parent)).isSymbolicLink())
                    throw new Error(`Symlinked ancestor: ${parent}`);
                parent = path.dirname(parent);
            }
            actual.push(await describeFile(resolved, absolute));
        }
        catch (error) {
            failures.push(`Missing/unreadable ${normalized}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const expectedByPath = new Map(attestation.files.map((file) => [file.path, file]));
    for (const file of actual) {
        const expected = expectedByPath.get(file.path);
        if (!expected || expected.sha256 !== file.sha256 || expected.bytes !== file.bytes)
            failures.push(`Integrity mismatch: ${file.path}`);
    }
    // A valid attestation covers the entire bundle, not merely listed files.
    const ignored = new Set((options.exclude ?? []).map((name) => name.replace(/\\/g, '/')));
    if (options.attestationPath) {
        const relative = path.relative(resolved, path.resolve(options.attestationPath)).replace(/\\/g, '/');
        if (relative && !relative.startsWith('../') && !path.isAbsolute(relative))
            ignored.add(relative);
    }
    const listed = new Set(attestation.files.map((file) => file.path.replace(/\\/g, '/')));
    const visit = async (directory) => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            const relative = path.relative(resolved, absolute).replace(/\\/g, '/');
            if (ignored.has(relative)) continue;
            if (entry.isSymbolicLink()) failures.push(`Unexpected symlink in attested bundle: ${relative}`);
            else if (entry.isDirectory()) await visit(absolute);
            else if (entry.isFile() && !listed.has(relative)) failures.push(`Unattested bundle file: ${relative}`);
            else if (!entry.isFile() && !entry.isDirectory()) failures.push(`Unexpected bundle entry: ${relative}`);
        }
    };
    await visit(resolved);
    const payload = manifestBytes(attestation.files);
    const hash = createHash('sha256').update(payload).digest('hex');
    if (hash !== attestation.manifestHash)
        failures.push('Attestation manifest hash is invalid.');
    if (attestation.signature) {
        if (!options.publicKeyPem)
            failures.push('Attestation is signed but no public key was provided.');
        else {
            const publicKey = createPublicKey(options.publicKeyPem);
            if (attestation.publicKeyFingerprint && publicFingerprint(publicKey) !== attestation.publicKeyFingerprint)
                failures.push('Public key fingerprint does not match attestation.');
            if (!verify(null, payload, publicKey, Buffer.from(attestation.signature, 'base64')))
                failures.push('Ed25519 signature verification failed.');
        }
    }
    return { passed: failures.length === 0, failures };
}
//# sourceMappingURL=attestation.js.map