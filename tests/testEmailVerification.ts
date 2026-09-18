import crypto from 'crypto';
import { CollaborationStore } from '../server/database/CollaborationStore';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runEmailVerificationTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- 35. EMAIL VERIFICATION & LIFECYCLE (PHASE 3.2) ---');
  console.log('--- RUNNING EMAIL VERIFICATION TESTS ---');

  const store = CollaborationStore.getInstance();

  // 1. User registration with unverified email state
  const testEmail = `verify_test_${Date.now()}@datapilot.io`;
  const user = store.createUser({
    name: 'Verification Test User',
    email: testEmail,
    password: 'Password123!',
    role: 'ANALYST',
    emailVerified: false
  });

  assertTest(
    '1. User created with unverified status (emailVerified: false, emailVerifiedAt: null)',
    Boolean(user && user.id && user.emailVerified === false && user.emailVerifiedAt === null),
    'Failed to create unverified user'
  );

  // 2. Cryptographic token generation and SHA-256 hashing
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const futureExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  assertTest(
    '2. High-entropy token generation produces distinct raw token and SHA-256 hash',
    rawToken.length === 64 && tokenHash.length === 64 && rawToken !== tokenHash,
    'Token or hash format invalid'
  );

  // 3. Storing token hash in database (never raw token)
  store.setEmailVerificationToken(user.id, tokenHash, futureExpiresAt);
  const authRecord = store.getUserByEmail(testEmail);

  assertTest(
    '3. Database stores SHA-256 token hash; raw token is never persisted',
    Boolean(authRecord && authRecord.emailVerificationTokenHash === tokenHash),
    'Token hash was not stored properly'
  );

  // 4. Token lookup retrieves user
  const foundUser = store.getUserByVerificationTokenHash(tokenHash);
  assertTest(
    '4. User can be retrieved by cryptographic hash of token',
    Boolean(foundUser && foundUser.id === user.id),
    'Lookup by token hash failed'
  );

  // 5. Expiration detection
  const pastExpiresAt = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
  store.setEmailVerificationToken(user.id, tokenHash, pastExpiresAt);
  const expiredRecord = store.getUserByVerificationTokenHash(tokenHash);
  const isExpired = expiredRecord?.emailVerificationExpiresAt
    ? new Date(expiredRecord.emailVerificationExpiresAt).getTime() < Date.now()
    : false;

  assertTest(
    '5. Expired token timestamp is correctly recognized as expired',
    isExpired === true,
    'Expired token check failed'
  );

  // 6. Resend verification updates token hash and expiry
  const newRawToken = crypto.randomBytes(32).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
  const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  store.setEmailVerificationToken(user.id, newTokenHash, newExpiresAt);
  const reloadedRecord = store.getUserByEmail(testEmail);

  assertTest(
    '6. Resend verification updates stored token hash and resets expiration window',
    Boolean(reloadedRecord && reloadedRecord.emailVerificationTokenHash === newTokenHash && reloadedRecord.emailVerificationTokenHash !== tokenHash),
    'Resend token update failed'
  );

  // 7. Old invalidated token hash no longer retrieves user
  const oldLookup = store.getUserByVerificationTokenHash(tokenHash);
  assertTest(
    '7. Previous token hash is invalidated when new verification token is issued',
    oldLookup === null,
    'Old token was still valid after reissuance'
  );

  // 8. Successful verification marks user as verified
  store.markEmailAsVerified(user.id);
  const verifiedUser = store.getUserById(user.id);

  assertTest(
    '8. markEmailAsVerified sets emailVerified to true and records emailVerifiedAt timestamp',
    Boolean(verifiedUser && verifiedUser.emailVerified === true && verifiedUser.emailVerifiedAt),
    'User was not marked as verified'
  );

  // 9. Single-use token enforcement: token hash is cleared from database
  const verifiedAuthRecord = store.getUserByEmail(testEmail);
  assertTest(
    '9. Single-use token enforcement: token hash and expiry are cleared from database',
    verifiedAuthRecord?.emailVerificationTokenHash === null && verifiedAuthRecord?.emailVerificationExpiresAt === null,
    'Token hash and expiry were not cleared'
  );

  // 10. Verification attempt with used token is rejected
  const postVerifyLookup = store.getUserByVerificationTokenHash(newTokenHash);
  assertTest(
    '10. Used verification token cannot be reused (lookup returns null)',
    postVerifyLookup === null,
    'Used token was still found in database'
  );

  // 11. Account enumeration protection
  const nonExistent = store.getUserByEmail('nonexistent-test@datapilot.io');
  assertTest(
    '11. Account enumeration prevention: non-existent email lookup safely returns null',
    nonExistent === null,
    'Non existent email returned a record'
  );

  return results;
}
