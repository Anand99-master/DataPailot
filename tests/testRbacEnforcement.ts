import { PermissionService } from '../server/services/PermissionService';
import { QuerySafetyValidator } from '../server/database/QuerySafetyValidator';
import { UserRole, Permission } from '../src/types/collaboration';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runRbacEnforcementTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const assertTest = (name: string, condition: boolean, errorMsg: string) => {
    try {
      assert(condition, errorMsg);
      results.push({ name, passed: true });
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  console.log('--- RUNNING RBAC & PERMISSION ENFORCEMENT TESTS ---');

  // Test 1: Role Definitions & Permission Mapping
  const roles: UserRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'ANALYST', 'VIEWER'];
  for (const role of roles) {
    const perms = PermissionService.getPermissionsForRole(role);
    assertTest(
      `Role ${role} has valid permission array`,
      Array.isArray(perms) && perms.length > 0,
      `Role ${role} should have permissions`
    );
  }

  // Test 2: VIEWER Restrictions
  const viewerPerms = PermissionService.getPermissionsForRole('VIEWER');
  assertTest(
    'VIEWER cannot create datasets',
    !viewerPerms.includes('dataset.create'),
    'VIEWER must not have dataset.create'
  );
  assertTest(
    'VIEWER cannot update datasets',
    !viewerPerms.includes('dataset.update'),
    'VIEWER must not have dataset.update'
  );
  assertTest(
    'VIEWER cannot delete datasets',
    !viewerPerms.includes('dataset.delete'),
    'VIEWER must not have dataset.delete'
  );
  assertTest(
    'VIEWER cannot create queries',
    !viewerPerms.includes('query.create'),
    'VIEWER must not have query.create'
  );
  assertTest(
    'VIEWER cannot create pipelines',
    !viewerPerms.includes('pipeline.create'),
    'VIEWER must not have pipeline.create'
  );
  assertTest(
    'VIEWER cannot create dashboards',
    !viewerPerms.includes('dashboard.create'),
    'VIEWER must not have dashboard.create'
  );
  assertTest(
    'VIEWER cannot manage members',
    !viewerPerms.includes('workspace.manage_members'),
    'VIEWER must not have workspace.manage_members'
  );
  assertTest(
    'VIEWER can read datasets and queries',
    viewerPerms.includes('dataset.read') && viewerPerms.includes('query.read') && viewerPerms.includes('dashboard.read'),
    'VIEWER must have read permissions'
  );

  // Test 3: SQL Write / DDL Safety Validation
  const writeQueries = [
    "UPDATE users SET role = 'admin'",
    "INSERT INTO datasets (name) VALUES ('test')",
    "DELETE FROM logs WHERE id = 1",
    "DROP TABLE imported_data",
    "ALTER TABLE users ADD COLUMN secret TEXT",
    "CREATE TABLE hack (id INT)",
    "TRUNCATE TABLE audit_logs"
  ];

  for (const q of writeQueries) {
    const validation = QuerySafetyValidator.validate(q);
    assertTest(
      `SQL Safety Validator blocks write query: ${q.slice(0, 20)}...`,
      !validation.isValid,
      `Query should be blocked: ${q}`
    );
  }

  // Test 4: Safe Read-Only SELECT Query Validation
  const readQuery = "SELECT region, SUM(sales) FROM imported_sales GROUP BY region ORDER BY sales DESC LIMIT 10";
  const readValidation = QuerySafetyValidator.validate(readQuery);
  assertTest(
    'SQL Safety Validator allows safe read-only SELECT query',
    readValidation.isValid,
    'Safe SELECT query should be allowed'
  );

  return results;
}
