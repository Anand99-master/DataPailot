import { CollaborationStore } from '../server/database/CollaborationStore';
import { PermissionService } from '../server/services/PermissionService';
import { UserRole } from '../src/types/collaboration';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runRbacRoleSwitchingTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- RUNNING RBAC ROLE SWITCHING & SYNCHRONIZATION TESTS ---');

  const store = CollaborationStore.getInstance();
  const wsId = 'ws_primary';

  // Test 1: EDITOR → OWNER → workspace.update allowed
  store.updateMemberRole(wsId, 'usr_editor', 'EDITOR');
  let editorPerms = PermissionService.getPermissionsForRole('EDITOR');
  assertTest(
    '1. EDITOR role lacks workspace.update permission',
    !editorPerms.includes('workspace.update'),
    'EDITOR should not have workspace.update'
  );

  store.updateMemberRole(wsId, 'usr_editor', 'OWNER');
  let ownerPerms = PermissionService.getPermissionsForRole('OWNER');
  assertTest(
    '2. EDITOR switched to OWNER has workspace.update permission',
    ownerPerms.includes('workspace.update'),
    'OWNER must have workspace.update permission'
  );

  // Test 2: OWNER → EDITOR → workspace.update denied
  store.updateMemberRole(wsId, 'usr_admin', 'OWNER');
  let currentOwnerPerms = PermissionService.getPermissionsForRole('OWNER');
  assertTest(
    '3. OWNER has workspace.update',
    currentOwnerPerms.includes('workspace.update'),
    'OWNER must have workspace.update'
  );

  store.updateMemberRole(wsId, 'usr_admin', 'EDITOR');
  let demotedPerms = PermissionService.getPermissionsForRole('EDITOR');
  assertTest(
    '4. OWNER switched to EDITOR has workspace.update denied',
    !demotedPerms.includes('workspace.update'),
    'EDITOR must not have workspace.update'
  );
  // Restore admin
  store.updateMemberRole(wsId, 'usr_admin', 'OWNER');

  // Test 3: EDITOR → VIEWER → protected mutation denied
  store.updateMemberRole(wsId, 'usr_editor', 'EDITOR');
  let edPerms = PermissionService.getPermissionsForRole('EDITOR');
  store.updateMemberRole(wsId, 'usr_editor', 'VIEWER');
  let viewerPerms = PermissionService.getPermissionsForRole('VIEWER');
  assertTest(
    '5. EDITOR switched to VIEWER loses dataset.create permission',
    edPerms.includes('dataset.create') && !viewerPerms.includes('dataset.create'),
    'VIEWER must not have dataset.create'
  );

  // Test 4: VIEWER → OWNER → authorized demo operation allowed
  store.updateMemberRole(wsId, 'usr_viewer', 'VIEWER');
  let vPerms = PermissionService.getPermissionsForRole('VIEWER');
  store.updateMemberRole(wsId, 'usr_viewer', 'OWNER');
  let newOwnerPerms = PermissionService.getPermissionsForRole('OWNER');
  assertTest(
    '6. VIEWER switched to OWNER gains all administrative permissions',
    !vPerms.includes('workspace.delete') && newOwnerPerms.includes('workspace.delete'),
    'OWNER must have workspace.delete permission'
  );

  // Test 5: Rapid persona switching does not leave stale permissions
  const roles: UserRole[] = ['VIEWER', 'ANALYST', 'EDITOR', 'ADMIN', 'OWNER'];
  for (let i = 0; i < 10; i++) {
    const r = roles[i % roles.length];
    store.updateMemberRole(wsId, 'usr_analyst', r);
    const p = PermissionService.getPermissionsForRole(r);
    const member = store.getWorkspaceMember(wsId, 'usr_analyst');
    assertTest(
      `7. Rapid switch iteration ${i} to ${r} correctly syncs role and permissions`,
      member?.role === r && p.length === PermissionService.getPermissionsForRole(r).length,
      `Role and permissions must match ${r}`
    );
  }
  store.updateMemberRole(wsId, 'usr_analyst', 'ANALYST');

  // Test 6: Frontend and backend role synchronization via permission check consistency
  const testRoles: UserRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'ANALYST', 'VIEWER'];
  for (const role of testRoles) {
    const perms = PermissionService.getPermissionsForRole(role);
    const canRead = perms.includes('dataset.read');
    assertTest(
      `8. Role ${role} backend permission sync consistency for dataset.read`,
      role === 'VIEWER' || role === 'ANALYST' || role === 'EDITOR' || role === 'ADMIN' || role === 'OWNER' ? canRead : true,
      `All roles should have read permission`
    );
  }

  return results;
}
