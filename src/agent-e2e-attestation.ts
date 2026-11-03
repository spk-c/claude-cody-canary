import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {z} from 'zod';
import {AgentE2eManifestSchema,type AgentE2eManifest} from './agent-e2e.js';

const signedSchema=z.object({
  schemaVersion:z.literal(1),
  algorithm:z.literal('ed25519-e2e-v1'),
  manifest:AgentE2eManifestSchema,
  manifestHash:z.string().regex(/^[a-f0-9]{64}$/),
  reviewerKeyFingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  signature:z.string().min(84).max(96).regex(/^[A-Za-z0-9+/=]+$/),
}).strict();
export type SignedAgentE2eManifest=z.infer<typeof signedSchema>;
export interface E2eReviewerVerification {
  verified:boolean;
  reviewerKeyFingerprint?:string;
  manifestHash?:string;
  reason:'valid'|'invalid-envelope'|'invalid-signature'|'wrong-reviewer-key';
}
function fingerprint(publicKey:ReturnType<typeof createPublicKey>):string{
  const bytes=publicKey.export({type:'spki',format:'der'});
  return createHash('sha256').update(bytes).digest('hex');
}
function canonicalManifest(value:unknown):{manifest:AgentE2eManifest;bytes:Buffer;hash:string}{
  const result=AgentE2eManifestSchema.safeParse(value);
  if(!result.success)throw new Error('Invalid E2E fixture manifest (sensitive schema details suppressed).');
  const manifest=result.data;
  // Fixed schema field order is enforced by Zod; caller input serialization order
  // and formatting cannot alter the signature payload.
  const bytes=Buffer.from(JSON.stringify(manifest),'utf8');
  return {manifest,bytes,hash:createHash('sha256').update(bytes).digest('hex')};
}
/** Sign only reviewed fixture input. No private keys are written or returned. */
export function signAgentE2eManifest(input:unknown,privateKeyPem:string):SignedAgentE2eManifest{
  const {manifest,bytes,hash}=canonicalManifest(input);
  let privateKey:ReturnType<typeof createPrivateKey>;
  try{privateKey=createPrivateKey(privateKeyPem);}
  catch{throw new Error('Invalid reviewer Ed25519 private key.');}
  if(privateKey.asymmetricKeyType!=='ed25519')
    throw new Error('Reviewer signing requires Ed25519.');
  return {
    schemaVersion:1,algorithm:'ed25519-e2e-v1',manifest,
    manifestHash:hash,
    reviewerKeyFingerprint:fingerprint(createPublicKey(privateKey)),
    signature:sign(null,bytes,privateKey).toString('base64'),
  };
}
/** Fail-closed. The public key MUST be pinned out of band to the reviewer. */
export function verifyAgentE2eManifest(signedInput:unknown,reviewerPublicKeyPem:string):
  E2eReviewerVerification {
  const envelope=signedSchema.safeParse(signedInput);
  if(!envelope.success)return {verified:false,reason:'invalid-envelope'};
  const signed=envelope.data;
  try{
    const reviewerKey=createPublicKey(reviewerPublicKeyPem);
    if(reviewerKey.asymmetricKeyType!=='ed25519')
      return {verified:false,reason:'wrong-reviewer-key'};
    const expectedFingerprint=fingerprint(reviewerKey);
    if(expectedFingerprint!==signed.reviewerKeyFingerprint)
      return {verified:false,reviewerKeyFingerprint:expectedFingerprint,
        reason:'wrong-reviewer-key'};
    const {bytes,hash}=canonicalManifest(signed.manifest);
    if(hash!==signed.manifestHash||
       !verify(null,bytes,reviewerKey,Buffer.from(signed.signature,'base64')))
      return {verified:false,reviewerKeyFingerprint:expectedFingerprint,
        reason:'invalid-signature'};
    return {verified:true,reviewerKeyFingerprint:expectedFingerprint,
      manifestHash:hash,reason:'valid'};
  }catch{return {verified:false,reason:'invalid-signature'};}
}
