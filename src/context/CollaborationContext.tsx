import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  Workspace,
  Project,
  Notification,
  ActivityItem,
  UserRole,
  Permission
} from '../types/collaboration';
import { CollaborationApiClient } from '../services/collaborationApi';
import { ImportApiClient } from '../services/importApi';
import { DatabaseApiClient } from '../services/databaseApi';
import { CleaningApiClient } from '../services/cleaningApi';
import { DashboardService } from '../services/dashboardService';

export const syncAllWorkspaceClients = (workspaceId: string) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('datapilot_active_workspace_id', workspaceId);
  }
  CollaborationApiClient.setWorkspaceId(workspaceId);
  ImportApiClient.setWorkspaceId(workspaceId);
  DatabaseApiClient.setWorkspaceId(workspaceId);
  CleaningApiClient.setWorkspaceId(workspaceId);
  DashboardService.setWorkspaceId(workspaceId);
};

interface CollaborationContextType {
  user: User | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  activeProject: Project | null;
  projects: Project[];
  role: UserRole;
  permissions: Permission[];
  unreadNotificationsCount: number;
  notifications: Notification[];
  activities: ActivityItem[];
  isLoadingAuth: boolean;
  can: (permission: Permission) => boolean;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  switchProject: (projectId: string | null) => void;
  refreshWorkspaces: () => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshActivities: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchDemoUser: (role: 'admin' | 'analyst' | 'viewer') => Promise<void>;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export const CollaborationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [role, setRole] = useState<UserRole>('OWNER');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  // Initialize Auth and Workspace State
  const initAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const res = await CollaborationApiClient.getCurrentAuth();
      if (res.success && (res as any).user) {
        const authData: any = res;
        setUser(authData.user);
        setRole(authData.memberRole || 'ANALYST');
        setPermissions(authData.permissions || []);

        const wsRes = await CollaborationApiClient.listWorkspaces();
        if (wsRes.success && wsRes.workspaces) {
          setWorkspaces(wsRes.workspaces);
          const currentWs = wsRes.workspaces.find(w => w.id === authData.workspaceId) || wsRes.workspaces[0];
          if (currentWs) {
            setActiveWorkspace(currentWs);
            syncAllWorkspaceClients(currentWs.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to init auth context', err);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  const refreshWorkspaces = useCallback(async () => {
    try {
      const res = await CollaborationApiClient.listWorkspaces();
      if (res.success && res.workspaces) {
        setWorkspaces(res.workspaces);
        if (activeWorkspace) {
          const updated = res.workspaces.find(w => w.id === activeWorkspace.id);
          if (updated) setActiveWorkspace(updated);
        }
      }
    } catch (err) {
      console.error('Failed to refresh workspaces', err);
    }
  }, [activeWorkspace]);

  const refreshProjects = useCallback(async () => {
    try {
      const res = await CollaborationApiClient.listProjects();
      if (res.success && res.projects) {
        setProjects(res.projects);
      }
    } catch (err) {
      console.error('Failed to refresh projects', err);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        CollaborationApiClient.listNotifications(),
        CollaborationApiClient.getUnreadCount()
      ]);
      if (listRes.success) setNotifications(listRes.notifications);
      if (countRes.success) setUnreadNotificationsCount(countRes.count);
    } catch (err) {
      console.error('Failed to refresh notifications', err);
    }
  }, []);

  const refreshActivities = useCallback(async () => {
    try {
      const res = await CollaborationApiClient.listActivity(30);
      if (res.success) setActivities(res.activities);
    } catch (err) {
      console.error('Failed to refresh activities', err);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (activeWorkspace) {
      refreshProjects();
      refreshNotifications();
      refreshActivities();
    }
  }, [activeWorkspace, refreshProjects, refreshNotifications, refreshActivities]);

  const switchWorkspace = useCallback(async (workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (ws) {
      setActiveWorkspace(ws);
      setActiveProject(null);
      syncAllWorkspaceClients(ws.id);
      // Re-fetch auth context for this workspace to get member role and permissions
      const authRes = await CollaborationApiClient.getCurrentAuth();
      if (authRes.success) {
        const authData: any = authRes;
        setRole(authData.memberRole || 'ANALYST');
        setPermissions(authData.permissions || []);
      }
      refreshProjects();
      refreshNotifications();
      refreshActivities();
    }
  }, [workspaces, refreshProjects, refreshNotifications, refreshActivities]);

  const switchProject = useCallback((projectId: string | null) => {
    if (!projectId) {
      setActiveProject(null);
    } else {
      const found = projects.find(p => p.id === projectId) || null;
      setActiveProject(found);
    }
  }, [projects]);

  const can = useCallback((permission: Permission): boolean => {
    return permissions.includes(permission);
  }, [permissions]);

  const login = async (email: string, password: string) => {
    const res = await CollaborationApiClient.login(email, password);
    if (res.success) {
      setUser(res.user);
      setRole(res.memberRole);
      setPermissions(res.permissions);
      await initAuth();
      return { success: true };
    }
    return { success: false, error: res.error || 'Login failed' };
  };

  const register = async (name: string, email: string, password: string, regRole?: UserRole) => {
    const res = await CollaborationApiClient.register(name, email, password, regRole);
    if (res.success) {
      setUser(res.user);
      setRole(res.memberRole);
      setPermissions(res.permissions);
      await initAuth();
      return { success: true };
    }
    return { success: false, error: res.error || 'Registration failed' };
  };

  const logout = async () => {
    await CollaborationApiClient.logout();
    await initAuth();
  };

  // Demo user fast-switcher for testing roles and collaboration flows
  const switchDemoUser = async (demoRole: 'admin' | 'analyst' | 'viewer') => {
    const demoCredentials = {
      admin: { email: 'admin@datapilot.local', pass: 'Admin123!' },
      analyst: { email: 'analyst@datapilot.local', pass: 'Analyst123!' },
      viewer: { email: 'viewer@datapilot.local', pass: 'Viewer123!' }
    };
    const cred = demoCredentials[demoRole];
    if (cred) {
      await login(cred.email, cred.pass);
    }
  };

  const value = useMemo(() => ({
    user,
    activeWorkspace,
    workspaces,
    activeProject,
    projects,
    role,
    permissions,
    unreadNotificationsCount,
    notifications,
    activities,
    isLoadingAuth,
    can,
    switchWorkspace,
    switchProject,
    refreshWorkspaces,
    refreshProjects,
    refreshNotifications,
    refreshActivities,
    login,
    register,
    logout,
    switchDemoUser
  }), [
    user,
    activeWorkspace,
    workspaces,
    activeProject,
    projects,
    role,
    permissions,
    unreadNotificationsCount,
    notifications,
    activities,
    isLoadingAuth,
    can,
    switchWorkspace,
    switchProject,
    refreshWorkspaces,
    refreshProjects,
    refreshNotifications,
    refreshActivities
  ]);

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
};

export const useCollaboration = (): CollaborationContextType => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};
