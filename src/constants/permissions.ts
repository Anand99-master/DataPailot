import { Permission, UserRole } from '../types/collaboration';

export interface PermissionDefinition {
  key: Permission;
  name: string;
  description: string;
  category: 'Workspace' | 'Members & Access' | 'Data & Queries' | 'Pipelines' | 'Visuals & Dashboards' | 'Reports' | 'Compliance';
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Workspace
  { key: 'workspace.read', name: 'View Workspace', description: 'View workspace metadata, details, and statistics', category: 'Workspace' },
  { key: 'workspace.update', name: 'Update Workspace', description: 'Rename workspace and edit configuration settings', category: 'Workspace' },
  { key: 'workspace.delete', name: 'Archive / Delete Workspace', description: 'Permanently archive or delete the workspace', category: 'Workspace' },
  { key: 'workspace.manage_members', name: 'Manage Workspace Members', description: 'Invite, update roles, or remove members', category: 'Workspace' },

  // Members
  { key: 'member.read', name: 'View Members', description: 'View list of workspace members and their roles', category: 'Members & Access' },
  { key: 'member.invite', name: 'Invite Members', description: 'Send invitations to new team members', category: 'Members & Access' },
  { key: 'member.update', name: 'Modify Member Roles', description: 'Elevate or restrict permissions of members', category: 'Members & Access' },
  { key: 'member.remove', name: 'Remove Members', description: 'Remove members from the workspace', category: 'Members & Access' },

  // Data & Queries
  { key: 'dataset.read', name: 'Read Datasets', description: 'Query and explore imported datasets and database tables', category: 'Data & Queries' },
  { key: 'dataset.create', name: 'Import Datasets', description: 'Upload and import new CSV, JSON, or SQL datasets', category: 'Data & Queries' },
  { key: 'dataset.update', name: 'Update Datasets', description: 'Edit dataset metadata, columns, and quality rules', category: 'Data & Queries' },
  { key: 'dataset.delete', name: 'Delete Datasets', description: 'Delete imported datasets and staging tables', category: 'Data & Queries' },
  { key: 'query.read', name: 'Read & Run Queries', description: 'Execute read-only SQL queries in editor and viewer', category: 'Data & Queries' },
  { key: 'query.create', name: 'Save SQL Queries', description: 'Save queries into the workspace query library', category: 'Data & Queries' },
  { key: 'query.update', name: 'Edit Saved Queries', description: 'Modify existing saved SQL queries and parameters', category: 'Data & Queries' },
  { key: 'query.delete', name: 'Delete Saved Queries', description: 'Remove saved queries from the library', category: 'Data & Queries' },

  // Pipelines
  { key: 'pipeline.read', name: 'View Pipelines', description: 'Inspect ETL pipelines and transformation history', category: 'Pipelines' },
  { key: 'pipeline.create', name: 'Create Pipelines', description: 'Build and schedule data transformation workflows', category: 'Pipelines' },
  { key: 'pipeline.update', name: 'Edit Pipelines', description: 'Modify pipeline steps, rules, and configurations', category: 'Pipelines' },
  { key: 'pipeline.delete', name: 'Delete Pipelines', description: 'Remove pipelines and transformation schedules', category: 'Pipelines' },

  // Visuals & Dashboards
  { key: 'visualization.read', name: 'View Charts', description: 'View and interact with saved visualizations', category: 'Visuals & Dashboards' },
  { key: 'visualization.create', name: 'Create Charts', description: 'Build new interactive charts and graphics', category: 'Visuals & Dashboards' },
  { key: 'visualization.update', name: 'Edit Charts', description: 'Update chart dimensions, metrics, and styling', category: 'Visuals & Dashboards' },
  { key: 'visualization.delete', name: 'Delete Charts', description: 'Remove charts from workspace', category: 'Visuals & Dashboards' },
  { key: 'dashboard.read', name: 'View Dashboards', description: 'View real-time analytic dashboards and widgets', category: 'Visuals & Dashboards' },
  { key: 'dashboard.create', name: 'Create Dashboards', description: 'Create multi-widget analytical dashboards', category: 'Visuals & Dashboards' },
  { key: 'dashboard.update', name: 'Edit Dashboards', description: 'Rearrange layouts, add metrics, and update widgets', category: 'Visuals & Dashboards' },
  { key: 'dashboard.delete', name: 'Delete Dashboards', description: 'Remove dashboards from the workspace', category: 'Visuals & Dashboards' },

  // Reports
  { key: 'report.read', name: 'View Reports', description: 'View curated analytical reports and summaries', category: 'Reports' },
  { key: 'report.create', name: 'Create Reports', description: 'Generate AI-assisted executive report documents', category: 'Reports' },
  { key: 'report.export', name: 'Export Reports', description: 'Export snapshots, PDF, Markdown, and CSV data', category: 'Reports' },

  // Compliance
  { key: 'audit.read', name: 'Audit Logs', description: 'Inspect security events and audit compliance history', category: 'Compliance' }
];

export const ROLE_PERMISSIONS_MAP: Record<UserRole, Permission[]> = {
  OWNER: [
    'workspace.read', 'workspace.update', 'workspace.delete', 'workspace.manage_members',
    'member.read', 'member.invite', 'member.update', 'member.remove',
    'dataset.read', 'dataset.create', 'dataset.update', 'dataset.delete',
    'query.read', 'query.create', 'query.update', 'query.delete',
    'pipeline.read', 'pipeline.create', 'pipeline.update', 'pipeline.delete',
    'visualization.read', 'visualization.create', 'visualization.update', 'visualization.delete',
    'dashboard.read', 'dashboard.create', 'dashboard.update', 'dashboard.delete',
    'report.read', 'report.create', 'report.export',
    'audit.read'
  ],
  ADMIN: [
    'workspace.read', 'workspace.update', 'workspace.manage_members',
    'member.read', 'member.invite', 'member.update', 'member.remove',
    'dataset.read', 'dataset.create', 'dataset.update', 'dataset.delete',
    'query.read', 'query.create', 'query.update', 'query.delete',
    'pipeline.read', 'pipeline.create', 'pipeline.update', 'pipeline.delete',
    'visualization.read', 'visualization.create', 'visualization.update', 'visualization.delete',
    'dashboard.read', 'dashboard.create', 'dashboard.update', 'dashboard.delete',
    'report.read', 'report.create', 'report.export',
    'audit.read'
  ],
  EDITOR: [
    'workspace.read',
    'member.read',
    'dataset.read', 'dataset.create', 'dataset.update',
    'query.read', 'query.create', 'query.update', 'query.delete',
    'pipeline.read', 'pipeline.create', 'pipeline.update', 'pipeline.delete',
    'visualization.read', 'visualization.create', 'visualization.update', 'visualization.delete',
    'dashboard.read', 'dashboard.create', 'dashboard.update', 'dashboard.delete',
    'report.read', 'report.create', 'report.export'
  ],
  ANALYST: [
    'workspace.read',
    'member.read',
    'dataset.read', 'dataset.create', 'dataset.update',
    'query.read', 'query.create', 'query.update', 'query.delete',
    'pipeline.read', 'pipeline.create', 'pipeline.update', 'pipeline.delete',
    'visualization.read', 'visualization.create', 'visualization.update', 'visualization.delete',
    'dashboard.read', 'dashboard.create', 'dashboard.update', 'dashboard.delete',
    'report.read', 'report.create', 'report.export'
  ],
  VIEWER: [
    'workspace.read',
    'member.read',
    'dataset.read',
    'query.read',
    'pipeline.read',
    'visualization.read',
    'dashboard.read',
    'report.read',
    'report.export'
  ]
};

export const ROLE_METADATA: Record<UserRole, { label: string; badgeColor: string; description: string }> = {
  OWNER: {
    label: 'Owner',
    badgeColor: 'bg-purple-950/80 text-purple-300 border-purple-700/50',
    description: 'Full workspace ownership, destructive operations, billing & access governance'
  },
  ADMIN: {
    label: 'Admin',
    badgeColor: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/50',
    description: 'Workspace configuration, user & role management, and audit log inspection'
  },
  EDITOR: {
    label: 'Editor',
    badgeColor: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50',
    description: 'Create and modify queries, pipelines, visuals, dashboards, and imported datasets'
  },
  ANALYST: {
    label: 'Analyst',
    badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50',
    description: 'Explore data, execute SQL, author analytics reports, and build visualizations'
  },
  VIEWER: {
    label: 'Viewer',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    description: 'Read-only access to saved queries, dashboards, visual reports, and exports'
  }
};
