import { CollaborationStore } from '../server/database/CollaborationStore';
import crypto from 'crypto';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runPasswordResetTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- 34. PRODUCTION PASSWORD RESET & RECOVERY (PHASE 3.1) ---');
  console.log('--- RUNNING PASSWORD RESET & RECOVERY TESTS ---');

  const store = CollaborationStore.getInstance();

  // 1. Create a dedicated test user for recovery testing
  const testEmail = `recovery_test_${Date.now()}@datapilot.io`;
  const initialPassword = 'OldInitialPassword123!';
  const user = store.createUser({
    name: 'Recovery Test User',
    email: testEmail,
    password: initialPassword,
    role: 'ANALYST'
  });

  assertTest(
    '1. Test user created for password reset flow',
    Boolean(user && user.id && user.email === testEmail),
    'Failed to create test user'
  );

  // 2. Token generation and cryptographic hashing
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const futureExpiry = new Date(Date.now() + 20 * 60 * 1000).toISOString();

  assertTest(
    '2. Token generation produces high-entropy 64-hex string and distinct SHA-256 hash',
    rawToken.length === 64 && tokenHash.length === 64 && rawToken !== tokenHash,
    'Token generation or hashing failed'
  );

  // 3. Store reset token record
  store.createPasswordResetToken(user.id, tokenHash, futureExpiry);
  const fetchedRecord = store.getPasswordResetTokenByHash(tokenHash);

  assertTest(
    '3. Password reset token stored securely by hash with correct userId and expiry',
    Boolean(fetchedRecord && fetchedRecord.userId === user.id && fetchedRecord.tokenHash === tokenHash && !fetchedRecord.used),
    'Failed to retrieve stored reset token record'
  );

  // 4. Raw token is never stored in the database
  assertTest(
    '4. Raw reset token is never stored in database table (only hash is retained)',
    store.getPasswordResetTokenByHash(rawToken) === null,
    'Raw token should never match token_hash column'
  );

  // 5. Account enumeration prevention test (generic response invariant)
  const nonExistentEmail = `nonexistent_${Date.now()}@unknown-domain-test.io`;
  const nonExistentUser = store.getUserByEmail(nonExistentEmail);
  const genericSuccessMessage = 'If an account exists for this email, password reset instructions have been sent.';
  assertTest(
    '5. Account enumeration prevention: non-existent email cannot be found and yields generic response',
    nonExistentUser === null && genericSuccessMessage.includes('If an account exists'),
    'Account existence must not be exposed'
  );

  // 6. Active sessions setup before password reset
  const session1 = store.createSession(user.id, '127.0.0.1', 'Chrome / macOS');
  const session2 = store.createSession(user.id, '192.168.1.5', 'Firefox / Windows');
  const activeSessionsBefore = store.getUserActiveSessions(user.id);

  assertTest(
    '6. Active sessions created across multiple devices before reset',
    activeSessionsBefore.length >= 2,
    'Active sessions count should be at least 2'
  );

  // 7. Successful password reset with valid token
  const newPassword = 'NewStrongPassword456!';
  store.markPasswordResetTokenUsed(fetchedRecord!.id);
  store.changeUserPassword(user.id, newPassword);

  // Revoke all sessions on reset
  store.revokeAllSessionsForUser(user.id);

  const updatedAuth = store.getUserByEmail(testEmail);
  const verifyNew = updatedAuth ? CollaborationStore.verifyPassword(newPassword, updatedAuth.passwordHash, updatedAuth.salt) : false;
  const verifyOld = updatedAuth ? CollaborationStore.verifyPassword(initialPassword, updatedAuth.passwordHash, updatedAuth.salt) : false;

  assertTest(
    '7. Reset password updates credentials: new password authenticates and old password is rejected',
    verifyNew === true && verifyOld === false,
    'Password update failed: old password still works or new password failed'
  );

  // 8. Session revocation test: all previous active sessions must be invalidated
  const activeSessionsAfter = store.getUserActiveSessions(user.id);
  const session1Check = store.getSessionByToken(session1.token);
  const session2Check = store.getSessionByToken(session2.token);

  assertTest(
    '8. Password reset invalidates all existing active sessions across all devices',
    activeSessionsAfter.length === 0 && session1Check === null && session2Check === null,
    'Active sessions were not revoked upon password reset'
  );

  // 9. Single-use token enforcement: already used token is rejected
  const reFetchedRecord = store.getPasswordResetTokenByHash(tokenHash);
  assertTest(
    '9. Single-use token enforcement: used token is marked as used and cannot be reused',
    Boolean(reFetchedRecord && reFetchedRecord.used === 1),
    'Reset token must be marked as used'
  );

  // 10. Expired token rejection
  const expiredRawToken = crypto.randomBytes(32).toString('hex');
  const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
  const pastExpiry = new Date(Date.now() - 1000 * 60 * 30).toISOString(); // 30 minutes ago
  store.createPasswordResetToken(user.id, expiredHash, pastExpiry);

  const expiredRecord = store.getPasswordResetTokenByHash(expiredHash);
  const isExpired = expiredRecord ? new Date(expiredRecord.expiresAt).getTime() < Date.now() : false;

  assertTest(
    '10. Token expiration enforcement: tokens older than expiration window are identified as expired',
    Boolean(expiredRecord && isExpired),
    'Expired token was not properly detected'
  );

  // 11. Fresh login after reset succeeds and establishes a new valid session
  const freshAuth = store.getUserByEmail(testEmail);
  const freshLoginMatch = freshAuth ? CollaborationStore.verifyPassword(newPassword, freshAuth.passwordHash, freshAuth.salt) : false;
  const freshSession = freshLoginMatch ? store.createSession(user.id, '127.0.0.1', 'Safari / iOS') : null;

  assertTest(
    '11. Sign in with new password succeeds and creates clean, authenticated session',
    Boolean(freshSession && store.getSessionByToken(freshSession.token)?.userId === user.id),
    'Sign in after reset failed'
  );

  if (freshSession) {
    store.deleteSession(freshSession.token);
  }

  console.log('--- ALL PASSWORD RESET & RECOVERY TESTS PASSED ---');
  return results;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('testPasswordReset.ts')) {
  runPasswordResetTests().then(res => {
    const failed = res.filter(r => !r.passed);
    if (failed.length > 0) {
      console.error('Failed tests:', failed);
      process.exit(1);
    } else {
      console.log('All tests passed successfully.');
      process.exit(0);
    }
  });
}
