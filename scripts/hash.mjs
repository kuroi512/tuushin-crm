import bcrypt from 'bcryptjs';

const [, , arg1, arg2, arg3] = process.argv;

async function generate(password, rounds, fixedSalt) {
  const r = Number(rounds) || 12;
  let hash;
  if (fixedSalt && fixedSalt.startsWith('$2')) {
    console.warn(
      '[warn] Using a fixed salt makes the hash deterministic and is NOT recommended for production.',
    );
    hash = await bcrypt.hash(password, fixedSalt);
  } else {
    hash = await bcrypt.hash(password, r);
  }
  console.log(`password: ${password}`);
  console.log(`rounds:   ${r}`);
  if (fixedSalt) console.log(`salt:     ${fixedSalt}`);
  console.log(`hash:     ${hash}`);
}

async function verify(password, hash) {
  const ok = await bcrypt.compare(password, hash);
  console.log(`verify:   ${ok ? 'MATCH' : 'NO MATCH'}`);
}

/*
Usage:
  - Generate (random salt each time):
      node scripts/hash.mjs <password> [rounds]
  - Generate with a fixed salt (for testing ONLY):
      node scripts/hash.mjs <password> <rounds> "$2b$12$xxxxxxxxxxxxxxxxxxxxxxxx"
  - Verify a password against an existing hash:
      node scripts/hash.mjs --verify <password> <hash>
*/

(async () => {
  if (arg1 === '--verify') {
    const pwd = arg2;
    const hash = arg3;
    if (!pwd || !hash) {
      console.error('Usage: node scripts/hash.mjs --verify <password> <hash>');
      process.exit(1);
    }
    await verify(pwd, hash);
    return;
  }

  const pwd = arg1 || 'test123';
  const roundsOrSalt = arg2;
  const maybeSalt = arg3; // if provided and starts with $2, treated as salt
  await generate(pwd, roundsOrSalt, maybeSalt);
})();
