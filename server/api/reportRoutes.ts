import { Router, Request, Response } from 'express';
import { CollaborationStore } from '../database/CollaborationStore';
import { requireAuth, requirePermission } from '../middleware/authMiddleware';
import { Report } from '../../src/types/collaboration';

const router = Router();

/**
 * GET /api/reports
 */
router.get('/', requireAuth, requirePermission('report.read'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const projectId = req.query.projectId as string | undefined;
    const reports = store.listReports(wsId, projectId);
    res.json({ success: true, reports });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve reports.' });
  }
});

/**
 * POST /api/reports
 */
router.post('/', requireAuth, requirePermission('report.create'), (req: Request, res: Response) => {
  try {
    const { title, description, projectId, dashboardId, config, kpis, narrativeInsights, filters } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length < 2) {
      res.status(400).json({ success: false, error: 'Report title is required.' });
      return;
    }

    const store = CollaborationStore.getInstance();
    const wsId = req.authContext!.workspaceId;
    const userId = req.authContext!.user.id;

    const report = store.createReport({
      workspaceId: wsId,
      projectId,
      ownerId: userId,
      title: title.trim(),
      description,
      dashboardId,
      config: config || {},
      kpis: Array.isArray(kpis) ? kpis : [],
      narrativeInsights: Array.isArray(narrativeInsights) ? narrativeInsights : [],
      filters: filters || {}
    });

    store.logActivity({
      actorId: userId,
      actorName: req.authContext!.user.name,
      action: 'GENERATED_REPORT',
      resourceType: 'report',
      resourceId: report.id,
      resourceName: report.title,
      workspaceId: wsId,
      projectId
    });

    store.logAuditEvent({
      actorId: userId,
      actorName: req.authContext!.user.name,
      workspaceId: wsId,
      action: 'REPORT_GENERATED',
      resourceType: 'report',
      resourceId: report.id,
      result: 'SUCCESS',
      metadata: { title: report.title },
      correlationId: req.correlationId
    });

    res.status(201).json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to create report.' });
  }
});

/**
 * GET /api/reports/:id
 */
router.get('/:id', requireAuth, requirePermission('report.read'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const report = store.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }

    if (report.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot access report from another workspace.' });
      return;
    }

    res.json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to get report.' });
  }
});

/**
 * PUT /api/reports/:id
 */
router.put('/:id', requireAuth, requirePermission('report.create'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const report = store.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }

    if (report.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot modify report from another workspace.' });
      return;
    }

    const updated = store.updateReport(req.params.id, req.body);
    res.json({ success: true, report: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update report.' });
  }
});

/**
 * DELETE /api/reports/:id
 */
router.delete('/:id', requireAuth, requirePermission('report.create'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const report = store.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }

    if (report.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot delete report from another workspace.' });
      return;
    }

    store.deleteReport(req.params.id);
    res.json({ success: true, message: 'Report deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete report.' });
  }
});

/**
 * POST /api/reports/:id/snapshot
 * Create an immutable point-in-time snapshot
 */
router.post('/:id/snapshot', requireAuth, requirePermission('report.create'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const report = store.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }

    if (report.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Cannot snapshot report from another workspace.' });
      return;
    }

    const { snapshotTitle, metrics } = req.body;
    const title = snapshotTitle || `${report.title} — Snapshot (${new Date().toLocaleDateString()})`;

    const snapshot = store.createReportSnapshot({
      reportId: report.id,
      workspaceId: report.workspaceId,
      snapshotTitle: title,
      config: report.config,
      metrics: metrics || { kpis: report.kpis, narrativeInsights: report.narrativeInsights },
      filters: report.filters,
      generatedBy: req.authContext!.user.id
    });

    store.logAuditEvent({
      actorId: req.authContext!.user.id,
      actorName: req.authContext!.user.name,
      workspaceId: report.workspaceId,
      action: 'REPORT_SNAPSHOT_CREATED',
      resourceType: 'report_snapshot',
      resourceId: snapshot.id,
      result: 'SUCCESS',
      metadata: { reportId: report.id, snapshotTitle: title },
      correlationId: req.correlationId
    });

    res.status(201).json({ success: true, snapshot });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to create snapshot.' });
  }
});

/**
 * GET /api/reports/:id/snapshots
 */
router.get('/:id/snapshots', requireAuth, requirePermission('report.read'), (req: Request, res: Response) => {
  try {
    const store = CollaborationStore.getInstance();
    const snapshots = store.listReportSnapshots(req.params.id);
    res.json({ success: true, snapshots });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve snapshots.' });
  }
});

/**
 * GET /api/reports/:id/export
 * Export report in PDF (Printable HTML), Markdown, JSON, or CSV
 */
router.get('/:id/export', requireAuth, requirePermission('report.export'), (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'pdf';
    const store = CollaborationStore.getInstance();
    const report = store.getReportById(req.params.id);
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found.' });
      return;
    }

    if (report.workspaceId !== req.authContext!.workspaceId) {
      res.status(403).json({ success: false, error: 'Access denied.' });
      return;
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/\s+/g, '_')}.json"`);
      res.send(JSON.stringify(report, null, 2));
      return;
    }

    if (format === 'markdown') {
      let md = `# ${report.title}\n\n`;
      if (report.description) md += `*${report.description}*\n\n`;
      md += `**Generated By:** ${report.generatedByName || 'DataPilot User'} | **Generated At:** ${new Date(report.generatedAt).toLocaleString()}\n\n`;
      md += `## Key Performance Indicators\n\n`;
      for (const kpi of report.kpis) {
        md += `- **${kpi.title}:** ${kpi.value} (${kpi.change || ''} ${kpi.subtitle || ''})\n`;
      }
      md += `\n## Executive Narrative & Insights\n\n`;
      for (const ins of report.narrativeInsights) {
        md += `- ${ins}\n`;
      }
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/\s+/g, '_')}.md"`);
      res.send(md);
      return;
    }

    if (format === 'csv') {
      let csv = 'KPI,Value,Change,Subtitle\n';
      for (const kpi of report.kpis) {
        csv += `"${String(kpi.title || '').replace(/"/g, '""')}","${String(kpi.value ?? '').replace(/"/g, '""')}","${String(kpi.change || '').replace(/"/g, '""')}","${String(kpi.subtitle || '').replace(/"/g, '""')}"\n`;
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/\s+/g, '_')}_KPIs.csv"`);
      res.send(csv);
      return;
    }

    // Default: Printable HTML / PDF preview layout
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${report.title} — DataPilot Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; margin: 0; }
    .container { max-width: 900px; margin: 0 auto; background: #1e293b; padding: 36px; border-radius: 12px; border: 1px solid #334155; }
    h1 { font-size: 26px; color: #38bdf8; margin-top: 0; }
    .meta { font-size: 13px; color: #94a3b8; margin-bottom: 24px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
    .kpi-card { background: #0f172a; border: 1px solid #334155; padding: 16px; border-radius: 8px; }
    .kpi-title { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 600; }
    .kpi-val { font-size: 24px; font-weight: bold; color: #10b981; margin: 8px 0; }
    .kpi-change { font-size: 12px; color: #38bdf8; }
    .insights { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin-top: 24px; }
    .insights h2 { font-size: 16px; color: #cbd5e1; margin-top: 0; }
    ul { margin: 0; padding-left: 20px; line-height: 1.7; color: #e2e8f0; }
    @media print { body { background: #fff; color: #000; padding: 0; } .container { border: none; background: #fff; color: #000; } .kpi-card, .insights { background: #f8fafc; border: 1px solid #e2e8f0; color: #000; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>${report.title}</h1>
    <div class="meta">
      <strong>Generated by:</strong> ${report.generatedByName || 'DataPilot Workspace'} &bull; 
      <strong>Date:</strong> ${new Date(report.generatedAt).toLocaleString()} &bull; 
      <strong>Status:</strong> ${report.status}
    </div>
    ${report.description ? `<p style="color: #cbd5e1; line-height: 1.6;">${report.description}</p>` : ''}
    
    <div class="kpi-grid">
      ${report.kpis.map(k => `
        <div class="kpi-card">
          <div class="kpi-title">${k.title}</div>
          <div class="kpi-val">${k.value}</div>
          <div class="kpi-change">${k.change || ''} ${k.subtitle || ''}</div>
        </div>
      `).join('')}
    </div>

    <div class="insights">
      <h2>Executive Insights & Summary</h2>
      <ul>
        ${report.narrativeInsights.map(i => `<li>${i}</li>`).join('')}
      </ul>
    </div>
  </div>
  <script>
    if (window.location.search.includes('print=true')) {
      window.print();
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to export report.' });
  }
});

export const reportRoutes = router;
