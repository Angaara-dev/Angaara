// Makes the Ed25519 key pair for perk passes. Run: node scripts/perks-keygen.mjs
// The private JWK goes in the PERKS_SIGNING_KEY secret; the public one in PERKS_PUBLIC_KEY and the client.
const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
  'sign',
  'verify',
]);
const priv = await crypto.subtle.exportKey('jwk', privateKey);
const pub = await crypto.subtle.exportKey('jwk', publicKey);
console.log('PERKS_SIGNING_KEY (secret, never commit):');
console.log(JSON.stringify(priv));
console.log('\nPERKS_PUBLIC_KEY (worker variable) and PERKS_PUBLIC_KEY_X in src/client/perks.ts:');
console.log(JSON.stringify(pub));
