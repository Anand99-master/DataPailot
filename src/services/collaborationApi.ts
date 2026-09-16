import {
  User,
  Workspace,
  WorkspaceMember,
  Project,
  ResourceShare,
  Report,
  ReportSnapshot,
  Notification,
  ActivityItem,
  AuditLogEntry,
  SearchResultItem,
  UserRole,
  ShareAccessLevel,
  ResourceType,
  AuthContext
} from '../types/collaboration';

export class CollaborationApiClient {
  private static workspaceId: string = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_workspace_id')) || 'ws_primary';
  private static projectId: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_active_project_id')) || null;
  private static sessionToken: string | null = (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_session_token')) || null;
  private static demoRole: string | null = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('datapilot_demo_role')) || (typeof localStorage !== 'undefined' && localStorage.getItem('datapilot_demo_role')) || null;

  public static setWorkspaceId(id: string) {
    this.workspaceId = id;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('datapilot_active_workspace_id', id);
    }
  }

  public static getWorkspaceId(): string {
    return this.workspaceId;
  }

  public static setProjectId(id: string | null) {
    this.projectId = id && id.trim() && id !== 'null' && id !== 'undefined' ? id.trim() : null;
    if (typeof localStorage !== 'undefined') {
      if (this.projectId) {
        localStorage.setItem('datapilot_active_project_id', this.projectId);
      } else {
        localStorage.removeItem('datapilot_active_project_id');
      }
    }
  }

  public static getProjectId(): string | null {
    return this.projectId;
  }

  public static setSessionToken(token: string | null) {
    this.sessionToken = token;
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem('datapilot_session_token', token);
      } else {
        localStorage.removeItem('datapilot_session_token');
      }
    }
  }

  public static getSessionToken(): string | null {
    return this.sessionToken;
  }

  public static setDemoRole(role: string | null) {
    this.demoRole = role;
    if (typeof sessionStorage !== 'undefined') {
      if (role) {
        sessionStorage.setItem('datapilot_demo_role', role);
      } else {
        sessionStorage.removeItem('datapilot_demo_role');
      }
    }
    if (typeof localStorage !== 'undefined') {
      if (role) {
        localStorage.setItem('datapilot_demo_role', role);
      } else {
        localStorage.removeItem('datapilot_demo_role');
      }
    }
  }

  public static getDemoRole(): string | null {
    return this.demoRole;
  }

  private static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-workspace-id': this.workspaceId
    };
    if (this.projectId) {
      headers['x-project-id'] = this.projectId;
    }
    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
      headers['x-session-token'] = this.sessionToken;
    }
    if (this.demoRole) {
      headers['x-demo-role'] = this.demoRole;
    }
    return headers;
  }

  // ==========================================
  // AUTHENTICATION
  // ==========================================
  public static async getCurrentAuth(): Promise<{ success: boolean; data?: AuthContext; error?: string }> {
    try {
      const res = await fetch('/api/auth/me', {
        headers: this.getHeaders()
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async demoSwitch(role: string): Promise<any> {
    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ role, workspaceId: this.workspaceId })
      });
      const data = await res.json();
      if (data.success && data.session?.token) {
        this.setSessionToken(data.session.token);
        this.setDemoRole(data.memberRole || role);
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async login(email: string, password: string): Promise<any> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success && data.session?.token) {
        this.setSessionToken(data.session.token);
        this.setDemoRole(data.memberRole || data.user?.role || 'ANALYST');
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async register(name: string, email: string, password: string, role?: UserRole): Promise<any> {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, email, password, role })
      });
      const data = await res.json();
      if (data.success && data.session?.token) {
        this.setSessionToken(data.session.token);
        this.setDemoRole(data.memberRole || role || 'ANALYST');
      }
      return data;
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public static async updateProfile(profile: { name: string; jobTitle?: string; email?: string; avatar?: string }): Promise<any> {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(profile)
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  }

  public static async logout(): Promise<any> {
    try {
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: this.getHeaders()
      });
      this.setSessionToken(null);
      this.setDemoRole(null);
      return res.json();
    } catch (err: any) {
      this.setSessionToken(null);
      this.setDemoRole(null);
      return { success: true };
    }
  }

  public static async changePassword(newPassword: string, oldPassword?: string): Promise<any> {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ newPassword, oldPassword })
    });
    return res.json();
  }

  public static async listAllUsers(): Promise<{ success: boolean; users: User[] }> {
    const res = await fetch('/api/users', { headers: this.getHeaders() });
    return res.json();
  }

  // ==========================================
  // WORKSPACES
  // ==========================================
  public static async listWorkspaces(): Promise<{ success: boolean; workspaces: Workspace[] }> {
    const res = await fetch('/api/workspaces', { headers: this.getHeaders() });
    return res.json();
  }

  public static async createWorkspace(name: string, description?: string): Promise<{ success: boolean; workspace: Workspace }> {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, description })
    });
    return res.json();
  }

  public static async updateWorkspace(id: string, name: string, description?: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, description })
    });
    return res.json();
  }

  public static async archiveWorkspace(id: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  public static async listWorkspaceMembers(workspaceId: string): Promise<{ success: boolean; members: WorkspaceMember[] }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, { headers: this.getHeaders() });
    return res.json();
  }

  public static async inviteWorkspaceMember(workspaceId: string, email: string, role: UserRole): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email, role })
    });
    return res.json();
  }

  public static async updateMemberRole(workspaceId: string, memberId: string, role: UserRole): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ role })
    });
    return res.json();
  }

  public static async removeMember(workspaceId: string, memberId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // ==========================================
  // PROJECTS
  // ==========================================
  public static async listProjects(): Promise<{ success: boolean; projects: Project[] }> {
    const res = await fetch('/api/projects', { headers: this.getHeaders() });
    return res.json();
  }

  public static async createProject(name: string, description?: string): Promise<{ success: boolean; project: Project }> {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, description })
    });
    return res.json();
  }

  public static async updateProject(id: string, name: string, description?: string): Promise<{ success: boolean; project?: Project; error?: string }> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ name, description })
    });
    return res.json();
  }

  public static async archiveProject(id: string): Promise<any> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  public static async deleteProject(id: string): Promise<any> {
    return this.archiveProject(id);
  }

  // ==========================================
  // SAVED QUERIES
  // ==========================================
  public static async listSavedQueries(projectId?: string): Promise<{ success: boolean; queries: any[] }> {
    const targetProj = projectId !== undefined ? projectId : (this.projectId || undefined);
    const url = targetProj ? `/api/queries?projectId=${encodeURIComponent(targetProj)}` : '/api/queries';
    const res = await fetch(url, { headers: this.getHeaders() });
    return res.json();
  }

  public static async getSavedQuery(id: string): Promise<{ success: boolean; query: any }> {
    const res = await fetch(`/api/queries/${id}`, { headers: this.getHeaders() });
    return res.json();
  }

  public static async saveSavedQuery(queryData: {
    id?: string;
    name: string;
    query?: string;
    sql?: string;
    description?: string;
    tags?: string[];
    visibility?: string;
    projectId?: string;
    isFavorite?: boolean;
  }): Promise<{ success: boolean; query: any }> {
    const payload = {
      ...queryData,
      query: queryData.query || queryData.sql,
      projectId: queryData.projectId !== undefined ? queryData.projectId : (this.projectId || undefined)
    };
    const res = await fetch('/api/queries', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  public static async deleteSavedQuery(id: string): Promise<any> {
    const res = await fetch(`/api/queries/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // ==========================================
  // DASHBOARDS
  // ==========================================
  public static async listDashboards(projectId?: string): Promise<{ success: boolean; dashboards: any[] }> {
    const targetProj = projectId !== undefined ? projectId : (this.projectId || undefined);
    const url = targetProj ? `/api/dashboards?projectId=${encodeURIComponent(targetProj)}` : '/api/dashboards';
    const res = await fetch(url, { headers: this.getHeaders() });
    return res.json();
  }

  public static async getDashboard(id: string): Promise<{ success: boolean; dashboard: any }> {
    const res = await fetch(`/api/dashboards/${id}`, { headers: this.getHeaders() });
    return res.json();
  }

  public static async saveDashboard(dashboardData: {
    id?: string;
    title: string;
    description?: string;
    widgets?: any[];
    filters?: any[];
    layout?: any;
    visibility?: string;
    autoRefreshInterval?: number;
    projectId?: string;
  }): Promise<{ success: boolean; dashboard: any }> {
    const payload = {
      ...dashboardData,
      projectId: dashboardData.projectId !== undefined ? dashboardData.projectId : (this.projectId || undefined)
    };
    const res = await fetch('/api/dashboards', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  public static async deleteDashboard(id: string): Promise<any> {
    const res = await fetch(`/api/dashboards/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // ==========================================
  // PIPELINES
  // ==========================================
  public static async listPipelines(projectId?: string): Promise<{ success: boolean; pipelines: any[] }> {
    const targetProj = projectId !== undefined ? projectId : (this.projectId || undefined);
    const url = targetProj ? `/api/pipelines?projectId=${encodeURIComponent(targetProj)}` : '/api/pipelines';
    const res = await fetch(url, { headers: this.getHeaders() });
    return res.json();
  }

  public static async getPipeline(id: string): Promise<{ success: boolean; pipeline: any }> {
    const res = await fetch(`/api/pipelines/${id}`, { headers: this.getHeaders() });
    return res.json();
  }

  public static async savePipeline(pipelineData: {
    id?: string;
    name: string;
    description?: string;
    steps: any[];
    datasetId?: string;
    visibility?: string;
    projectId?: string;
  }): Promise<{ success: boolean; pipeline: any }> {
    const payload = {
      ...pipelineData,
      projectId: pipelineData.projectId !== undefined ? pipelineData.projectId : (this.projectId || undefined)
    };
    const res = await fetch('/api/pipelines', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  public static async deletePipeline(id: string): Promise<any> {
    const res = await fetch(`/api/pipelines/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // ==========================================
  // SHARING
  // ==========================================
  public static async listResourceShares(resourceType: ResourceType, resourceId: string): Promise<{ success: boolean; shares: ResourceShare[] }> {
    const res = await fetch(`/api/shares/${resourceType}/${resourceId}`, { headers: this.getHeaders() });
    return res.json();
  }

  public static async shareResource(
    resourceType: ResourceType,
    resourceId: string,
    sharedWithUserId: string,
    accessLevel: ShareAccessLevel
  ): Promise<any> {
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ resourceType, resourceId, sharedWithUserId, accessLevel })
    });
    return res.json();
  }

  public static async revokeShare(shareId: string): Promise<any> {
    const res = await fetch(`/api/shares/${shareId}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // ==========================================
  // REPORTS & SNAPSHOTS
  // ==========================================
  public static async listReports(projectId?: string): Promise<{ success: boolean; reports: Report[] }> {
    const targetProj = projectId !== undefined ? projectId : (this.projectId || undefined);
    const url = targetProj ? `/api/reports?projectId=${encodeURIComponent(targetProj)}` : '/api/reports';
    const res = await fetch(url, { headers: this.getHeaders() });
    return res.json();
  }

  public static async createReport(reportData: Partial<Report>): Promise<{ success: boolean; report: Report }> {
    const payload = {
      ...reportData,
      projectId: reportData.projectId !== undefined ? reportData.projectId : (this.projectId || undefined)
    };
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  public static async createSnapshot(reportId: string, snapshotTitle?: string, metrics?: any): Promise<{ success: boolean; snapshot: ReportSnapshot }> {
    const res = await fetch(`/api/reports/${reportId}/snapshot`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ snapshotTitle, metrics })
    });
    return res.json();
  }

  public static async listSnapshots(reportId: string): Promise<{ success: boolean; snapshots: ReportSnapshot[] }> {
    const res = await fetch(`/api/reports/${reportId}/snapshots`, { headers: this.getHeaders() });
    return res.json();
  }

  public static async deleteReport(id: string): Promise<any> {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  public static async listNotifications(): Promise<{ success: boolean; notifications: Notification[] }> {
    const res = await fetch('/api/notifications', { headers: this.getHeaders() });
    return res.json();
  }

  public static async getUnreadCount(): Promise<{ success: boolean; count: number }> {
    const res = await fetch('/api/notifications/unread-count', { headers: this.getHeaders() });
    return res.json();
  }

  public static async markNotificationRead(id: string): Promise<any> {
    const res = await fetch(`/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: this.getHeaders()
    });
    return res.json();
  }

  public static async markAllNotificationsRead(): Promise<any> {
    const res = await fetch('/api/notifications/mark-all-read', {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ workspaceId: this.workspaceId })
    });
    return res.json();
  }

  // ==========================================
  // ACTIVITY & AUDIT
  // ==========================================
  public static async listActivity(limit: number = 50, projectId?: string): Promise<{ success: boolean; activities: ActivityItem[] }> {
    const targetProj = projectId !== undefined ? projectId : (this.projectId || undefined);
    const url = targetProj
      ? `/api/activity?limit=${limit}&projectId=${encodeURIComponent(targetProj)}`
      : `/api/activity?limit=${limit}`;
    const res = await fetch(url, { headers: this.getHeaders() });
    return res.json();
  }

  public static async listAuditLogs(filters?: { actorId?: string; action?: string; result?: string; limit?: number }): Promise<{ success: boolean; logs: AuditLogEntry[] }> {
    const params = new URLSearchParams();
    if (filters?.actorId) params.append('actorId', filters.actorId);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.result) params.append('result', filters.result);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const res = await fetch(`/api/audit/logs?${params.toString()}`, { headers: this.getHeaders() });
    return res.json();
  }

  // ==========================================
  // GLOBAL SEARCH
  // ==========================================
  public static async search(query: string): Promise<{ success: boolean; results: SearchResultItem[] }> {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { headers: this.getHeaders() });
    return res.json();
  }
}
