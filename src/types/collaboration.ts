/**
 * Phase 16: Production-Grade Analytics & Collaboration Types
 * Provider-agnostic Authentication, Workspaces, Projects, RBAC,
 * Resource Sharing, Reports, Snapshots, Notifications, Activity, and Audit.
 */

export type UserRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'ANALYST' | 'VIEWER';
export type UserStatus = 'active' | 'suspended' | 'invited';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: UserStatus;
  role?: UserRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  lastAccessedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export type Permission =
  | 'workspace.read'
  | 'workspace.update'
  | 'workspace.delete'
  | 'workspace.manage_members'
  | 'member.read'
  | 'member.invite'
  | 'member.update'
  | 'member.remove'
  | 'dataset.read'
  | 'dataset.create'
  | 'dataset.update'
  | 'dataset.delete'
  | 'query.read'
  | 'query.create'
  | 'query.update'
  | 'query.delete'
  | 'pipeline.read'
  | 'pipeline.create'
  | 'pipeline.update'
  | 'pipeline.delete'
  | 'visualization.read'
  | 'visualization.create'
  | 'visualization.update'
  | 'visualization.delete'
  | 'dashboard.read'
  | 'dashboard.create'
  | 'dashboard.update'
  | 'dashboard.delete'
  | 'report.read'
  | 'report.create'
  | 'report.export'
  | 'audit.read';

export interface AuthContext {
  user: User;
  session: Session;
  workspaceId: string;
  projectId?: string | null;
  memberRole: UserRole;
  permissions: Permission[];
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  projectCount?: number;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  user?: User;
  role: UserRole;
  status: 'active' | 'invited';
  invitedAt: string;
  joinedAt?: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  ownerId: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type ResourceType =
  | 'dataset'
  | 'query'
  | 'pipeline'
  | 'visualization'
  | 'dashboard'
  | 'report';

export type ResourceVisibility = 'PRIVATE' | 'WORKSPACE' | 'SHARED';

export type ShareAccessLevel = 'VIEW' | 'EDIT' | 'ADMIN' | 'viewer' | 'editor';

export interface ResourceShare {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  workspaceId: string;
  sharedWithUserId: string;
  sharedWithUserName?: string;
  sharedWithUserEmail?: string;
  sharedWithUser?: {
    id: string;
    name: string;
    email: string;
  };
  accessLevel: ShareAccessLevel;
  sharedByUserId: string;
  createdAt: string;
}

export interface ReportKPI {
  id?: string;
  title: string;
  value: string | number;
  change?: string;
  subtitle?: string;
  isPositive?: boolean;
}

export interface ReportConfig {
  dashboardId?: string;
  selectedVisualizations?: string[];
  kpis?: ReportKPI[];
  narrativeInsights?: string[];
  filters?: Record<string, any>;
  theme?: 'dark' | 'light';
}

export interface Report {
  id: string;
  workspaceId: string;
  projectId?: string;
  ownerId: string;
  title: string;
  description?: string;
  dashboardId?: string;
  config?: ReportConfig;
  kpis: ReportKPI[];
  narrativeInsights: string[];
  filters?: Record<string, any>;
  generatedAt: string;
  generatedBy?: string;
  generatedByName?: string;
  status?: 'draft' | 'published' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportSnapshot {
  id: string;
  reportId: string;
  workspaceId: string;
  snapshotTitle?: string;
  title?: string;
  config?: ReportConfig;
  metrics?: Record<string, any>;
  filters?: Record<string, any>;
  generatedBy?: string;
  generatedByName?: string;
  snapshotTimestamp?: string;
  timestamp?: string;
  createdAt?: string;
}

export type NotificationType =
  | 'workspace_invitation'
  | 'role_changed'
  | 'resource_shared'
  | 'report_generated'
  | 'pipeline_completed'
  | 'pipeline_failed'
  | 'dataset_imported'
  | 'dataset_failed'
  | 'system_alert';

export interface AppNotification {
  id: string;
  userId: string;
  workspaceId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead?: boolean;
  read?: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export type Notification = AppNotification;

export interface ActivityItem {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  resourceType: ResourceType | 'workspace' | 'project' | 'member' | 'auth';
  resourceId?: string;
  resourceName?: string;
  workspaceId: string;
  projectId?: string;
  createdAt?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogEntry {
  id: string;
  eventId?: string;
  actorId: string;
  actorName: string;
  workspaceId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  metadata?: Record<string, any>;
  correlationId?: string;
  timestamp: string;
}

export interface GlobalSearchResult {
  id: string;
  type: ResourceType | 'project';
  title: string;
  subtitle?: string;
  description?: string;
  workspaceId: string;
  projectId?: string;
  projectName?: string;
  ownerId?: string;
  ownerName?: string;
  visibility?: ResourceVisibility;
  updatedAt?: string;
  score?: number;
}

export type SearchResultItem = GlobalSearchResult;
