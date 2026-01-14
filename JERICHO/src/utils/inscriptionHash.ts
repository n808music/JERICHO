export function computeInscriptionHash(input: string): string {
  // FNV-1a 64-bit BigInt. Deterministic fingerprint, not a security primitive.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }

  return hash.toString(16).padStart(16, '0');
}
