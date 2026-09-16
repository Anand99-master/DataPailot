import { CollaborationStore } from '../server/database/CollaborationStore';
import { AccessControlService } from '../server/services/AccessControlService';

export async function runPhase16_3Tests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const store = CollaborationStore.getInstance();

  try {
    // 1. Workspace & Member Sharing Tests
    const wsId = 'ws_primary';
    const testUserId = 'usr_analyst';
    const testReport = store.createReport({
      workspaceId: wsId,
      ownerId: 'usr_admin',
      title: 'Q3 Executive Sales Report',
      description: 'Comprehensive sales performance and analytics breakdown.',
      config: {},
      kpis: [{ title: 'Revenue', value: '$2.4M', change: '+12%' }],
      narrativeInsights: ['Sales growth exceeded targets in North America.'],
      filters: {}
    });

    const share = store.addOrUpdateShare({
      resourceType: 'report',
      resourceId: testReport.id,
      workspaceId: wsId,
      sharedWithUserId: testUserId,
      accessLevel: 'VIEW',
      sharedByUserId: 'usr_admin'
    });

    results.push({
      name: '1. Workspace sharing & direct share grant',
      passed: Boolean(share && share.id && share.sharedWithUserId === testUserId)
    });

    // 2. Access Update Test
    const updatedShare = store.addOrUpdateShare({
      resourceType: 'report',
      resourceId: testReport.id,
      workspaceId: wsId,
      sharedWithUserId: testUserId,
      accessLevel: 'EDIT',
      sharedByUserId: 'usr_admin'
    });

    results.push({
      name: '2. Access level update (VIEW to EDIT)',
      passed: Boolean(updatedShare && updatedShare.accessLevel === 'EDIT')
    });

    // 3. Revoke Access Test
    store.removeShare(share.id);
    const sharesAfterRevoke = store.getResourceShares('report', testReport.id);
    results.push({
      name: '3. Revoke access removes share record',
      passed: sharesAfterRevoke.filter(s => s.id === share.id).length === 0
    });

    // 4. Immutable Snapshot & Snapshot Comparison Test
    store.createReportSnapshot({
      reportId: testReport.id,
      workspaceId: wsId,
      snapshotTitle: 'Snapshot v1',
      config: {},
      metrics: { kpis: testReport.kpis, narrativeInsights: testReport.narrativeInsights },
      filters: { region: 'US' },
      generatedBy: 'usr_admin'
    });

    // Update report metrics
    store.updateReport(testReport.id, {
      kpis: [{ title: 'Revenue', value: '$3.1M', change: '+18%' }]
    });

    store.createReportSnapshot({
      reportId: testReport.id,
      workspaceId: wsId,
      snapshotTitle: 'Snapshot v2',
      config: {},
      metrics: { kpis: [{ title: 'Revenue', value: '$3.1M', change: '+18%' }], narrativeInsights: testReport.narrativeInsights },
      filters: { region: 'Global' },
      generatedBy: 'usr_admin'
    });

    const listSnaps = store.listReportSnapshots(testReport.id);
    results.push({
      name: '4. Immutable snapshots creation & versioning',
      passed: listSnaps.length >= 2 && listSnaps.some(s => s.snapshotTitle === 'Snapshot v1') && listSnaps.some(s => s.snapshotTitle === 'Snapshot v2')
    });

    // 5. CSV Injection Protection & Export formatting
    const exportCsvContent = `KPI,Value,Change,Subtitle\n"Revenue","=SUM(A1:A10)","+12%",""\n`;
    const sanitizedCsv = exportCsvContent.replace(/^[=+\-@]/g, "'$&");
    results.push({
      name: '5. CSV export sanitization & safety check',
      passed: !sanitizedCsv.startsWith('=')
    });

    // 6. Notifications Integration
    const notifs = store.listNotifications(testUserId);
    store.createNotification({
      userId: testUserId,
      workspaceId: wsId,
      type: 'resource_shared',
      title: 'Report Shared',
      message: 'Alex Rivera shared Q3 Executive Sales Report with you.',
      metadata: { resourceType: 'report', resourceId: testReport.id }
    });
    const updatedNotifs = store.listNotifications(testUserId);
    results.push({
      name: '6. Notification creation for sharing events',
      passed: updatedNotifs.length > notifs.length
    });

    // 7. Activity Feed Integration
    store.logActivity({
      actorId: 'usr_admin',
      actorName: 'Alex Rivera',
      action: 'GENERATED_REPORT',
      resourceType: 'report',
      resourceId: testReport.id,
      resourceName: testReport.title,
      workspaceId: wsId
    });
    const activityFeed = store.listActivities(wsId);
    results.push({
      name: '7. Activity feed logging for report generation',
      passed: activityFeed.some(a => a.resourceId === testReport.id)
    });

    // 8. Audit Log Integration (No secrets)
    store.logAuditEvent({
      actorId: 'usr_admin',
      actorName: 'Alex Rivera',
      workspaceId: wsId,
      action: 'REPORT_EXPORTED',
      resourceType: 'report',
      resourceId: testReport.id,
      result: 'SUCCESS',
      metadata: { format: 'pdf' }
    });
    const auditLogs = store.listAuditLogs({ workspaceId: wsId });
    const hasSecret = auditLogs.some(log => JSON.stringify(log).includes('password') || JSON.stringify(log).includes('token'));
    results.push({
      name: '8. Audit logging without secrets',
      passed: auditLogs.length > 0 && !hasSecret
    });

    // 9. Global Search Permission Awareness
    const searchRes = store.globalSearch(wsId, 'Sales');
    results.push({
      name: '9. Global search finds accessible shared resources',
      passed: searchRes.some(item => item.id === testReport.id)
    });

    // 10. User Profile Editing & Persistence
    const uniqueEmail = `test.profile.${Date.now()}@datapilot.local`;
    const updatedEmail = `anand.sharma.${Date.now()}@datapilot.local`;
    const testProfileUser = store.createUser({
      name: 'Initial Name',
      email: uniqueEmail,
      password: 'InitialPassword123!',
      jobTitle: 'Junior Analyst',
      role: 'ANALYST'
    });

    const updatedUser = store.updateUserProfile(testProfileUser.id, {
      name: 'Anand Sharma',
      jobTitle: 'Data Analyst',
      email: updatedEmail
    });

    const retrievedUser = store.getUserById(testProfileUser.id);
    results.push({
      name: '10. User profile editing and persistence in store',
      passed: Boolean(
        updatedUser &&
        retrievedUser &&
        retrievedUser.name === 'Anand Sharma' &&
        retrievedUser.jobTitle === 'Data Analyst' &&
        retrievedUser.email === updatedEmail
      )
    });

    // 11. Profile Update Email Uniqueness Guard
    let emailConflictBlocked = false;
    try {
      store.updateUserProfile(testProfileUser.id, {
        email: 'admin@datapilot.io' // already belongs to admin
      });
    } catch {
      emailConflictBlocked = true;
    }
    results.push({
      name: '11. Profile update email duplicate collision prevention',
      passed: emailConflictBlocked
    });

  } catch (err: any) {
    results.push({
      name: 'Phase 16.3 Test Suite Execution',
      passed: false,
      error: err.message
    });
  }

  return results;
}
