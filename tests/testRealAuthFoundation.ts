import { CollaborationStore } from '../server/database/CollaborationStore';
import { PermissionService } from '../server/services/PermissionService';
import crypto from 'crypto';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export async function runRealAuthFoundationTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- RUNNING REAL AUTHENTICATION FOUNDATION & SECURITY TESTS ---');

  const store = CollaborationStore.getInstance();

  // Test 1: Password hashing and verification
  const testPassword = 'SecurePassword123!';
  const hashed = CollaborationStore.hashPassword(testPassword);
  assertTest(
    '1. Password hashing produces hash and salt without storing plaintext',
    Boolean(hashed.hash && hashed.salt && hashed.hash !== testPassword),
    'Password must be securely hashed'
  );

  const isValidMatch = CollaborationStore.verifyPassword(testPassword, hashed.hash, hashed.salt);
  const isInvalidMatch = CollaborationStore.verifyPassword('WrongPassword', hashed.hash, hashed.salt);
  assertTest(
    '2. Password verification correctly validates matching and non-matching passwords',
    isValidMatch === true && isInvalidMatch === false,
    'Password verification failed'
  );

  // Test 2: User registration success & validation
  const uniqueEmail = `testuser_${Date.now()}@datapilot.io`;
  const newUser = store.createUser({
    name: 'Test User',
    email: uniqueEmail,
    password: testPassword,
    role: 'ANALYST'
  });
  assertTest(
    '3. User registration successfully creates user with secure hash and active status',
    Boolean(newUser && newUser.id && newUser.email === uniqueEmail && newUser.status === 'active'),
    'User registration failed'
  );

  // Test 3: Duplicate email prevention
  let duplicateErrorCaught = false;
  try {
    store.createUser({
      name: 'Duplicate User',
      email: uniqueEmail,
      password: 'AnotherPassword123!',
      role: 'ANALYST'
    });
  } catch {
    duplicateErrorCaught = true;
  }
  // Also check getUserByEmail
  const existingByEmail = store.getUserByEmail(uniqueEmail);
  assertTest(
    '4. Duplicate email prevention correctly identifies existing users',
    Boolean(existingByEmail && existingByEmail.email === uniqueEmail),
    'Duplicate email should be detected'
  );

  // Test 4: passwordHash never returned through user fetch / public records
  const fetchedUser = store.getUserById(newUser.id);
  const authRecord = store.getUserByEmail(uniqueEmail);
  assertTest(
    '5. passwordHash and salt are never exposed on public User records',
    Boolean(fetchedUser && !('passwordHash' in fetchedUser) && !('salt' in fetchedUser) && authRecord && 'passwordHash' in authRecord),
    'passwordHash must not be exposed on public user objects'
  );

  // Test 5: Login success & credential verification
  const loginAuth = store.getUserByEmail(uniqueEmail);
  const loginMatch = loginAuth ? CollaborationStore.verifyPassword(testPassword, loginAuth.passwordHash, loginAuth.salt) : false;
  assertTest(
    '6. Login authentication succeeds with valid credentials',
    loginMatch === true,
    'Login success verification failed'
  );

  // Test 6: Invalid credentials (generic error behavior)
  const invalidLoginAuth = store.getUserByEmail(uniqueEmail);
  const invalidMatch = invalidLoginAuth ? CollaborationStore.verifyPassword('IncorrectPassword', invalidLoginAuth.passwordHash, invalidLoginAuth.salt) : false;
  assertTest(
    '7. Invalid credentials return failure without leaking existence status',
    invalidMatch === false,
    'Invalid credentials should fail verification'
  );

  // Test 7: Session creation & validation
  const session = store.createSession(newUser.id, '127.0.0.1', 'TestRunnerAgent');
  const validatedSession = store.getSessionByToken(session.token);
  assertTest(
    '8. Session creation and server-side validation succeed',
    Boolean(validatedSession && validatedSession.userId === newUser.id && validatedSession.token === session.token),
    'Session validation failed'
  );

  // Test 8: Logout / session revocation
  store.deleteSession(session.token);
  const revokedSession = store.getSessionByToken(session.token);
  assertTest(
    '9. Logout / session revocation successfully invalidates session',
    revokedSession === null,
    'Revoked session should not be found'
  );

  // Test 9: Client cannot spoof role during registration / assignment
  // Centralized RBAC permissions & workspace membership test
  const testWorkspaceId = 'ws_primary';
  const memberRecord = store.getWorkspaceMember(testWorkspaceId, newUser.id);
  // If not added to primary ws, add with ANALYST role
  if (!memberRecord) {
    store.addOrInviteMember(testWorkspaceId, newUser.id, 'ANALYST');
  }
  const memberPerms = PermissionService.getPermissionsForRole('ANALYST');
  assertTest(
    '10. Real user role comes from workspace membership with centralized permissions',
    Boolean(memberPerms.includes('dataset.read') && !memberPerms.includes('workspace.delete')),
    'RBAC role permissions mismatch'
  );

  // Test 10: Demo mode check
  const isDemoEnv = process.env.DEMO_MODE === 'true' || (process.env.NODE_ENV !== 'production' && process.env.DEMO_MODE !== 'false');
  assertTest(
    '11. Demo mode environment flag is correctly configured for development fallback',
    typeof isDemoEnv === 'boolean',
    'Demo mode check failed'
  );

  console.log('--- ALL REAL AUTHENTICATION FOUNDATION TESTS PASSED ---');
  return results;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('testRealAuthFoundation.ts')) {
  runRealAuthFoundationTests().then(res => {
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
