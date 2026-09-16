import { CollaborationStore } from '../server/database/CollaborationStore';
import { AccessControlService } from '../server/services/AccessControlService';
import { getSessionDatasetStoreKey } from '../server/utils/workspaceHelper';

export async function runProjectSwitchingAndIsolationTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  const store = CollaborationStore.getInstance();
  const wsId = 'ws_primary';
  const userId = 'usr_admin';

  console.log('\n--- Running Project Switching & Resource Isolation Tests ---');

  try {
    // 1. Setup Projects A and B
    const projA = store.createProject(wsId, 'Project Alpha', 'First isolated test project');
    const projB = store.createProject(wsId, 'Project Beta', 'Second isolated test project');

    results.push({
      name: '1. Projects Alpha and Beta created successfully',
      passed: Boolean(projA.id && projB.id && projA.id !== projB.id)
    });

    // 2. Create Project-Scoped Queries (PROJECT_A_TEST and PROJECT_B_TEST)
    const queryA = store.saveQuery({
      workspaceId: wsId,
      projectId: projA.id,
      name: 'PROJECT_A_TEST',
      query: 'SELECT id, revenue FROM project_a_sales;',
      description: 'Project A test query',
      tags: ['alpha'],
      createdByUserId: userId
    });

    const queryB = store.saveQuery({
      workspaceId: wsId,
      projectId: projB.id,
      name: 'PROJECT_B_TEST',
      query: 'SELECT id, expenses FROM project_b_finance;',
      description: 'Project B test query',
      tags: ['beta'],
      createdByUserId: userId
    });

    results.push({
      name: '2. Created distinct project-scoped queries PROJECT_A_TEST and PROJECT_B_TEST',
      passed: Boolean(queryA?.id && queryB?.id)
    });

    // 3. Create Project-Scoped Dashboards
    const dashA = store.saveDashboard({
      workspaceId: wsId,
      projectId: projA.id,
      title: 'PROJECT_A_DASHBOARD',
      description: 'Dashboard for Project A',
      widgets: [],
      filters: [],
      layout: { columns: 3, rowHeight: 180, gap: 16 },
      createdByUserId: userId
    });

    const dashB = store.saveDashboard({
      workspaceId: wsId,
      projectId: projB.id,
      title: 'PROJECT_B_DASHBOARD',
      description: 'Dashboard for Project B',
      widgets: [],
      filters: [],
      layout: { columns: 3, rowHeight: 180, gap: 16 },
      createdByUserId: userId
    });

    results.push({
      name: '3. Created distinct project-scoped dashboards',
      passed: Boolean(dashA?.id && dashB?.id)
    });

    // 4. Create Project-Scoped Reports
    const repA = store.createReport({
      workspaceId: wsId,
      projectId: projA.id,
      ownerId: userId,
      title: 'PROJECT_A_REPORT',
      description: 'Executive report for Project A',
      config: {},
      kpis: [],
      narrativeInsights: ['Project A operational summary'],
      filters: {}
    });

    const repB = store.createReport({
      workspaceId: wsId,
      projectId: projB.id,
      ownerId: userId,
      title: 'PROJECT_B_REPORT',
      description: 'Executive report for Project B',
      config: {},
      kpis: [],
      narrativeInsights: ['Project B operational summary'],
      filters: {}
    });

    results.push({
      name: '4. Created distinct project-scoped reports',
      passed: Boolean(repA?.id && repB?.id)
    });

    // 5. Create Project-Scoped Cleaning Pipelines
    const pipeA = store.savePipeline({
      workspaceId: wsId,
      projectId: projA.id,
      name: 'PROJECT_A_PIPELINE',
      description: 'Data cleaning pipeline for Project A',
      steps: [{ id: 'step-1', type: 'trim_whitespace', label: 'Trim text', config: {} }] as any,
      datasetId: 'ds_alpha',
      createdByUserId: userId
    });

    const pipeB = store.savePipeline({
      workspaceId: wsId,
      projectId: projB.id,
      name: 'PROJECT_B_PIPELINE',
      description: 'Data cleaning pipeline for Project B',
      steps: [{ id: 'step-2', type: 'remove_duplicates', label: 'Dedupe', config: {} }] as any,
      datasetId: 'ds_beta',
      createdByUserId: userId
    });

    results.push({
      name: '5. Created distinct project-scoped cleaning pipelines',
      passed: Boolean(pipeA?.id && pipeB?.id)
    });

    // 6. Dataset Storage Key Isolation
    const mockRes = {} as any;
    const mockReqA = { headers: { 'x-session-id': 'sess_test_user', 'x-workspace-id': wsId, 'x-project-id': projA.id } } as any;
    const mockReqB = { headers: { 'x-session-id': 'sess_test_user', 'x-workspace-id': wsId, 'x-project-id': projB.id } } as any;
    const mockReqAll = { headers: { 'x-session-id': 'sess_test_user', 'x-workspace-id': wsId } } as any;

    const dsKeyA = getSessionDatasetStoreKey(mockReqA, mockRes);
    const dsKeyB = getSessionDatasetStoreKey(mockReqB, mockRes);
    const dsKeyAll = getSessionDatasetStoreKey(mockReqAll, mockRes);

    results.push({
      name: '6. Dataset storage keys are isolated per projectId',
      passed: dsKeyA !== dsKeyB && dsKeyA.includes(projA.id) && dsKeyB.includes(projB.id) && dsKeyA !== dsKeyAll
    });

    // 7. Test Switching to Project A:
    // PROJECT_A_TEST visible, PROJECT_B_TEST NOT visible
    const queriesA = store.listSavedQueries(wsId, projA.id);
    const queriesAHasA = queriesA.some(q => q.name === 'PROJECT_A_TEST');
    const queriesAHasB = queriesA.some(q => q.name === 'PROJECT_B_TEST');

    const dashesA = store.listDashboards(wsId, projA.id);
    const dashesAHasA = dashesA.some(d => d.title === 'PROJECT_A_DASHBOARD');
    const dashesAHasB = dashesA.some(d => d.title === 'PROJECT_B_DASHBOARD');

    const reportsA = store.listReports(wsId, projA.id);
    const reportsAHasA = reportsA.some(r => r.title === 'PROJECT_A_REPORT');
    const reportsAHasB = reportsA.some(r => r.title === 'PROJECT_B_REPORT');

    const pipesA = store.listPipelines(wsId, projA.id);
    const pipesAHasA = pipesA.some(p => p.name === 'PROJECT_A_PIPELINE');
    const pipesAHasB = pipesA.some(p => p.name === 'PROJECT_B_PIPELINE');

    results.push({
      name: '7. Project A selected -> Only Project A resources visible, Project B resources strictly excluded',
      passed: queriesAHasA && !queriesAHasB && dashesAHasA && !dashesAHasB && reportsAHasA && !reportsAHasB && pipesAHasA && !pipesAHasB
    });

    // 8. Test Switching to Project B:
    // PROJECT_B_TEST visible, PROJECT_A_TEST NOT visible
    const queriesB = store.listSavedQueries(wsId, projB.id);
    const queriesBHasA = queriesB.some(q => q.name === 'PROJECT_A_TEST');
    const queriesBHasB = queriesB.some(q => q.name === 'PROJECT_B_TEST');

    const dashesB = store.listDashboards(wsId, projB.id);
    const dashesBHasA = dashesB.some(d => d.title === 'PROJECT_A_DASHBOARD');
    const dashesBHasB = dashesB.some(d => d.title === 'PROJECT_B_DASHBOARD');

    const reportsB = store.listReports(wsId, projB.id);
    const reportsBHasA = reportsB.some(r => r.title === 'PROJECT_A_REPORT');
    const reportsBHasB = reportsB.some(r => r.title === 'PROJECT_B_REPORT');

    const pipesB = store.listPipelines(wsId, projB.id);
    const pipesBHasA = pipesB.some(p => p.name === 'PROJECT_A_PIPELINE');
    const pipesBHasB = pipesB.some(p => p.name === 'PROJECT_B_PIPELINE');

    results.push({
      name: '8. Project B selected -> Only Project B resources visible, Project A resources strictly excluded',
      passed: !queriesBHasA && queriesBHasB && !dashesBHasA && dashesBHasB && !reportsBHasA && reportsBHasB && !pipesBHasA && pipesBHasB
    });

    // 9. Test Switching Back to Project A (Roundtrip A -> B -> A)
    const queriesARoundtrip = store.listSavedQueries(wsId, projA.id);
    const queriesARoundtripPassed =
      queriesARoundtrip.some(q => q.name === 'PROJECT_A_TEST') &&
      !queriesARoundtrip.some(q => q.name === 'PROJECT_B_TEST');

    results.push({
      name: '9. Roundtrip Project switching (A -> B -> A) reliably restores Project A context',
      passed: queriesARoundtripPassed
    });

    // 10. All Projects / Workspace-wide filter returns both if no project selected
    const allQueries = store.listSavedQueries(wsId, undefined);
    const allQueriesHasBoth =
      allQueries.some(q => q.name === 'PROJECT_A_TEST') &&
      allQueries.some(q => q.name === 'PROJECT_B_TEST');

    results.push({
      name: '10. All Projects view (no project filter) aggregates accessible workspace resources',
      passed: allQueriesHasBoth
    });

    // 11. Cross-Project Isolation Enforcement
    // Check if Project B query excludes Project A items
    const projectBReports = store.listReports(wsId, projB.id);
    const projectAReportInB = projectBReports.some(r => r.id === repA.id);
    results.push({
      name: '11. Cross-project access restriction: Project A report rejected under Project B filter',
      passed: !projectAReportInB
    });

  } catch (err: any) {
    results.push({
      name: 'Execution Error',
      passed: false,
      error: err.message || String(err)
    });
  }

  return results;
}

// Standalone runner
if (process.argv[1]?.endsWith('testProjectSwitchingAndIsolation.ts')) {
  runProjectSwitchingAndIsolationTests().then(res => {
    let allPassed = true;
    for (const r of res) {
      if (r.passed) {
        console.log(`  PASS: ${r.name}`);
      } else {
        console.error(`  FAIL: ${r.name} ${r.error ? `(${r.error})` : ''}`);
        allPassed = false;
      }
    }
    process.exit(allPassed ? 0 : 1);
  });
}
