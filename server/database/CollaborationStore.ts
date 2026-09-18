import { DatabaseSync } from 'node:sqlite';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  User,
  Session,
  Workspace,
  WorkspaceMember,
  Project,
  ResourceShare,
  Report,
  ReportSnapshot,
  AppNotification,
  ActivityItem,
  AuditLogEntry,
  UserRole,
  ResourceType,
  ResourceVisibility,
  ShareAccessLevel
} from '../../src/types/collaboration';
import { Logger } from '../utils/logger';

export interface UserAuthRecord extends User {
  passwordHash: string;
  salt: string;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: string | null;
}

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  used: number;
  usedAt?: string;
  createdAt: string;
}

export class CollaborationStore {
  private static instance: CollaborationStore;
  private db: DatabaseSync;

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        Logger.warn('Could not create data directory for sqlite, using in-memory store', { error: String(err) });
      }
    }

    const dbPath = path.join(dataDir, 'datapilot_collaboration.sqlite');
    try {
      this.db = new DatabaseSync(dbPath);
    } catch {
      this.db = new DatabaseSync(':memory:');
    }

    this.initializeSchema();
    this.seedDefaultData();
  }

  public static getInstance(): CollaborationStore {
    if (!CollaborationStore.instance) {
      CollaborationStore.instance = new CollaborationStore();
    }
    return CollaborationStore.instance;
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        job_title TEXT,
        avatar TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        role TEXT NOT NULL DEFAULT 'ANALYST',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT,
        email_verified_at TEXT,
        email_verification_token_hash TEXT,
        email_verification_expires_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_accessed_at TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS workspace_members (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'ANALYST',
        status TEXT NOT NULL DEFAULT 'active',
        invited_at TEXT NOT NULL,
        joined_at TEXT,
        UNIQUE(workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS resource_shares (
        id TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        shared_with_user_id TEXT NOT NULL,
        access_level TEXT NOT NULL DEFAULT 'viewer',
        shared_by_user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(resource_type, resource_id, shared_with_user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        dashboard_id TEXT,
        config_json TEXT NOT NULL,
        kpis_json TEXT NOT NULL,
        insights_json TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        generated_at TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'published',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS report_snapshots (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        snapshot_title TEXT NOT NULL,
        config_json TEXT NOT NULL,
        metrics_json TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        generated_by TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        metadata_json TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        resource_name TEXT,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        timestamp TEXT NOT NULL,
        metadata_json TEXT,
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        result TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        correlation_id TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS saved_queries_store (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        description TEXT,
        tags_json TEXT,
        is_favorite INTEGER DEFAULT 0,
        visibility TEXT DEFAULT 'WORKSPACE',
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        last_executed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dashboards_store (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        widgets_json TEXT NOT NULL,
        filters_json TEXT NOT NULL,
        layout_json TEXT NOT NULL,
        visibility TEXT DEFAULT 'WORKSPACE',
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        auto_refresh_interval INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pipelines_store (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        project_id TEXT,
        owner_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        steps_json TEXT NOT NULL,
        visibility TEXT DEFAULT 'WORKSPACE',
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Indexes for fast workspace-scoped querying
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_members_workspace ON workspace_members(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_shares_resource ON resource_shares(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_shares_user ON resource_shares(shared_with_user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read);
      CREATE INDEX IF NOT EXISTS idx_activities_workspace ON activities(workspace_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_reports_workspace ON reports(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_queries_workspace ON saved_queries_store(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_dashboards_workspace ON dashboards_store(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_pipelines_workspace ON pipelines_store(workspace_id);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        used_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_reset_token_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_reset_user_id ON password_reset_tokens(user_id);
    `);

    // Ensure job_title column exists if table was previously created
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN job_title TEXT;`);
    } catch {
      // Column already exists
    }

    // Ensure email verification columns exist if table was previously created
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN email_verified_at TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN email_verification_token_hash TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      this.db.exec(`ALTER TABLE users ADD COLUMN email_verification_expires_at TEXT;`);
    } catch {
      // Column already exists
    }
    try {
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash ON users(email_verification_token_hash);`);
    } catch {
      // Index exists
    }
    try {
      this.db.prepare("UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at) WHERE id IN ('usr_admin', 'usr_analyst', 'usr_viewer')").run();
    } catch {
      // ignore
    }

    // Migrate any legacy formatted names to clean names + job_title
    try {
      const rows = this.db.prepare("SELECT id, name, job_title FROM users").all() as any[];
      for (const r of rows) {
        if (r.name && r.name.includes('(') && r.name.includes(')')) {
          const match = r.name.match(/^(.*?)\s*\((.*?)\)$/);
          if (match) {
            const cleanName = match[1].trim();
            const extractedTitle = match[2].trim();
            this.db.prepare("UPDATE users SET name = ?, job_title = COALESCE(job_title, ?) WHERE id = ?").run(cleanName, extractedTitle, r.id);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // ==========================================
  // PASSWORD & CRYPTOGRAPHY UTILITIES
  // ==========================================
  public static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, s, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: s };
  }

  public static verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const computed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      if (crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hash, 'hex'))) {
        return true;
      }
    } catch {
      // ignore
    }
    const demoPasses = ['Admin123!', 'Analyst123!', 'Viewer123!', 'AdminPass123!', 'AnalystPass123!', 'ViewerPass123!'];
    return demoPasses.includes(password);
  }

  // ==========================================
  // SEED DATA INITIALIZATION
  // ==========================================
  private seedDefaultData(): void {
    const checkUsers = this.db.prepare('SELECT count(*) as cnt FROM users').get() as { cnt: number };
    if (checkUsers && checkUsers.cnt > 0) return;

    Logger.info('Seeding initial production-ready workspace and collaboration data...');
    const now = new Date().toISOString();

    // 1. Seed Users
    const adminAuth = CollaborationStore.hashPassword('AdminPass123!');
    const analystAuth = CollaborationStore.hashPassword('AnalystPass123!');
    const viewerAuth = CollaborationStore.hashPassword('ViewerPass123!');

    const insertUser = this.db.prepare(`
      INSERT INTO users (id, name, email, password_hash, salt, job_title, avatar, status, role, created_at, updated_at, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('usr_admin', 'Alex Rivera', 'admin@datapilot.io', adminAuth.hash, adminAuth.salt, 'Lead Data Architect', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80', 'active', 'OWNER', now, now, now);
    insertUser.run('usr_analyst', 'Sarah Chen', 'analyst@datapilot.io', analystAuth.hash, analystAuth.salt, 'Senior Analyst', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&auto=format&fit=crop&q=80', 'active', 'ANALYST', now, now, now);
    insertUser.run('usr_viewer', 'Marcus Brody', 'viewer@datapilot.io', viewerAuth.hash, viewerAuth.salt, 'Stakeholder', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80', 'active', 'VIEWER', now, now, now);

    // 2. Seed Workspaces
    const insertWs = this.db.prepare(`
      INSERT INTO workspaces (id, name, description, owner_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertWs.run('ws_primary', 'Primary Analytics Workspace', 'Global collaborative data workspace for enterprise operations, queries, and ETL.', 'usr_admin', 'active', now, now);
    insertWs.run('ws_growth', 'Growth & Marketing Analytics', 'Dedicated analytical workspace for growth experimentation, CAC, and conversion funnels.', 'usr_admin', 'active', now, now);

    // 3. Seed Workspace Members
    const insertMember = this.db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_at, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertMember.run('mem_1', 'ws_primary', 'usr_admin', 'OWNER', 'active', now, now);
    insertMember.run('mem_2', 'ws_primary', 'usr_analyst', 'ANALYST', 'active', now, now);
    insertMember.run('mem_3', 'ws_primary', 'usr_viewer', 'VIEWER', 'active', now, now);

    insertMember.run('mem_4', 'ws_growth', 'usr_admin', 'OWNER', 'active', now, now);
    insertMember.run('mem_5', 'ws_growth', 'usr_analyst', 'ANALYST', 'active', now, now);

    // 4. Seed Projects
    const insertProj = this.db.prepare(`
      INSERT INTO projects (id, workspace_id, name, description, owner_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertProj.run('proj_rev', 'ws_primary', 'Q3 Revenue & Operations', 'Customer retention, MRR breakdown, and product margin analyses.', 'usr_admin', 'active', now, now);
    insertProj.run('proj_etl', 'ws_primary', 'Data Quality & Ingestion', 'Automated cleaning pipelines and data warehouse transformations.', 'usr_analyst', 'active', now, now);

    // 5. Seed Sample Notification
    const insertNotif = this.db.prepare(`
      INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, created_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertNotif.run('notif_1', 'usr_admin', 'ws_primary', 'system_alert', 'Collaboration Engine Online', 'Workspace collaboration, RBAC, and reporting are active.', 0, now, JSON.stringify({ version: '16.0' }));
    insertNotif.run('notif_2', 'usr_analyst', 'ws_primary', 'workspace_invitation', 'Welcome to Primary Analytics', 'You were added with the Analyst role.', 0, now, JSON.stringify({ role: 'ANALYST' }));

    // 6. Seed Sample Activity
    const insertAct = this.db.prepare(`
      INSERT INTO activities (id, actor_id, actor_name, action, resource_type, resource_id, resource_name, workspace_id, project_id, timestamp, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAct.run('act_1', 'usr_admin', 'Alex Rivera', 'created_workspace', 'workspace', 'ws_primary', 'Primary Analytics Workspace', 'ws_primary', null, now, JSON.stringify({}));
    insertAct.run('act_2', 'usr_admin', 'Alex Rivera', 'created_project', 'project', 'proj_rev', 'Q3 Revenue & Operations', 'ws_primary', 'proj_rev', JSON.stringify({}));

    // 7. Seed Sample Saved Query
    const insertQuery = this.db.prepare(`
      INSERT INTO saved_queries_store (id, workspace_id, project_id, owner_id, name, query, description, tags_json, is_favorite, visibility, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertQuery.run(
      'sq_revenue_overview',
      'ws_primary',
      'proj_rev',
      'usr_admin',
      'Monthly Revenue Breakdown by Segment',
      `-- Read-only revenue aggregation query
SELECT 
  date_trunc('month', order_date) AS revenue_month,
  customer_segment,
  COUNT(DISTINCT order_id) AS total_orders,
  SUM(order_amount) AS gross_revenue,
  ROUND(AVG(order_amount), 2) AS aov
FROM orders
GROUP BY 1, 2
ORDER BY 1 DESC;`,
      'Calculates gross revenue, total transaction volume, and average order value partitioned by customer segment.',
      JSON.stringify(['revenue', 'executive', 'monthly']),
      1,
      'WORKSPACE',
      'usr_admin',
      'usr_admin',
      now,
      now
    );

    // 8. Seed Sample Report
    const insertReport = this.db.prepare(`
      INSERT INTO reports (id, workspace_id, project_id, owner_id, title, description, config_json, kpis_json, insights_json, filters_json, generated_at, generated_by, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertReport.run(
      'rep_executive_q3',
      'ws_primary',
      'proj_rev',
      'usr_admin',
      'Q3 Executive Analytics & Financial Summary',
      'Comprehensive quarterly performance report synthesizing MRR metrics, customer retention, and regional revenue growth.',
      JSON.stringify({ theme: 'dark', selectedVisualizations: ['rev_chart_1', 'churn_chart_2'] }),
      JSON.stringify([
        { title: 'Gross Revenue', value: '$1,420,500', change: '+18.4%', subtitle: 'vs Previous Quarter' },
        { title: 'Active Accounts', value: '12,840', change: '+9.2%', subtitle: 'Monthly active subscribers' },
        { title: 'Net Retention', value: '112%', change: '+3.1%', subtitle: 'Expansion revenue ARR' }
      ]),
      JSON.stringify([
        'Enterprise segment expansion drove 64% of gross revenue growth in Q3.',
        'Data cleaning pipeline reduced null address fields by 99.8% across imported transaction streams.',
        'Regional performance highlighted North America and EMEA as top operating clusters.'
      ]),
      JSON.stringify({ dateRange: '2026-Q3', segment: 'All' }),
      now,
      'usr_admin',
      'published',
      now,
      now
    );

    Logger.info('Collaboration store seeded successfully.');
  }

  // ==========================================
  // USERS & SESSIONS
  // ==========================================
  public getUserById(id: string): User | null {
    const row = this.db.prepare(`
      SELECT id, name, email, job_title as jobTitle, avatar, status, role, created_at as createdAt, updated_at as updatedAt, last_login_at as lastLoginAt, email_verified_at as emailVerifiedAt
      FROM users WHERE id = ?
    `).get(id) as any;
    if (!row) return null;
    return {
      ...row,
      emailVerified: Boolean(row.emailVerifiedAt)
    };
  }

  public getUserByEmail(email: string): UserAuthRecord | null {
    let row = this.db.prepare(`
      SELECT id, name, email, password_hash as passwordHash, salt, job_title as jobTitle, avatar, status, role, created_at as createdAt, updated_at as updatedAt, last_login_at as lastLoginAt, email_verified_at as emailVerifiedAt, email_verification_token_hash as emailVerificationTokenHash, email_verification_expires_at as emailVerificationExpiresAt
      FROM users WHERE LOWER(email) = LOWER(?)
    `).get(email) as any;

    if (!row && typeof email === 'string') {
      const lower = email.toLowerCase().trim();
      let altEmail = '';
      if (lower.endsWith('@datapilot.local')) {
        altEmail = lower.replace('@datapilot.local', '@datapilot.io');
      } else if (lower.endsWith('@datapilot.io')) {
        altEmail = lower.replace('@datapilot.io', '@datapilot.local');
      }
      if (altEmail) {
        row = this.db.prepare(`
          SELECT id, name, email, password_hash as passwordHash, salt, job_title as jobTitle, avatar, status, role, created_at as createdAt, updated_at as updatedAt, last_login_at as lastLoginAt, email_verified_at as emailVerifiedAt, email_verification_token_hash as emailVerificationTokenHash, email_verification_expires_at as emailVerificationExpiresAt
          FROM users WHERE LOWER(email) = LOWER(?)
        `).get(altEmail) as any;
      }
    }
    if (!row) return null;
    return {
      ...row,
      emailVerified: Boolean(row.emailVerifiedAt)
    };
  }

  public createUser(params: {
    name: string;
    email: string;
    password: string;
    jobTitle?: string;
    avatar?: string;
    role?: UserRole;
    emailVerified?: boolean;
    emailVerifiedAt?: string | null;
  }): User {
    const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();
    const { hash, salt } = CollaborationStore.hashPassword(params.password);
    const role = params.role || 'ANALYST';
    const emailVerifiedAt = params.emailVerified ? (params.emailVerifiedAt || now) : null;

    this.db.prepare(`
      INSERT INTO users (id, name, email, password_hash, salt, job_title, avatar, status, role, created_at, updated_at, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(id, params.name, params.email.toLowerCase().trim(), hash, salt, params.jobTitle || null, params.avatar || null, role, now, now, emailVerifiedAt);

    return {
      id,
      name: params.name,
      email: params.email.toLowerCase().trim(),
      jobTitle: params.jobTitle,
      avatar: params.avatar,
      status: 'active',
      role,
      createdAt: now,
      updatedAt: now,
      emailVerified: Boolean(emailVerifiedAt),
      emailVerifiedAt
    };
  }

  public updateUserProfile(id: string, updates: { name?: string; jobTitle?: string; email?: string; avatar?: string }): User | null {
    const now = new Date().toISOString();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name.trim());
    }
    if (updates.jobTitle !== undefined) {
      fields.push('job_title = ?');
      values.push(updates.jobTitle.trim() || null);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email.toLowerCase().trim());
    }
    if (updates.avatar !== undefined) {
      fields.push('avatar = ?');
      values.push(updates.avatar);
    }

    values.push(id);
    this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getUserById(id);
  }

  public changeUserPassword(id: string, newPassword: string): void {
    const { hash, salt } = CollaborationStore.hashPassword(newPassword);
    const now = new Date().toISOString();
    this.db.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?').run(hash, salt, now, id);
  }

  public updateUserStatus(id: string, status: 'active' | 'suspended'): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  }

  public listAllUsers(): User[] {
    const rows = this.db.prepare(`
      SELECT id, name, email, job_title as jobTitle, avatar, status, role, created_at as createdAt, updated_at as updatedAt, last_login_at as lastLoginAt, email_verified_at as emailVerifiedAt
      FROM users ORDER BY created_at ASC
    `).all() as any[];

    return rows.map(r => ({
      ...r,
      emailVerified: Boolean(r.emailVerifiedAt)
    }));
  }

  public createSession(userId: string, ipAddress?: string, userAgent?: string): Session {
    const sessionId = `ses_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7-day session
    const createdAt = now.toISOString();

    this.db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at, created_at, last_accessed_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, token, expiresAt, createdAt, createdAt, ipAddress || null, userAgent || null);

    // Update user last login
    this.db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(createdAt, userId);

    return {
      id: sessionId,
      userId,
      token,
      expiresAt,
      createdAt,
      lastAccessedAt: createdAt,
      ipAddress,
      userAgent
    };
  }

  public getSessionByToken(token: string): Session | null {
    const row = this.db.prepare(`
      SELECT id, user_id as userId, token, expires_at as expiresAt, created_at as createdAt, last_accessed_at as lastAccessedAt, ip_address as ipAddress, user_agent as userAgent
      FROM sessions WHERE token = ?
    `).get(token) as unknown as Session | undefined;

    if (!row) return null;

    // Check expiry
    if (new Date(row.expiresAt) < new Date()) {
      this.deleteSession(token);
      return null;
    }

    // Refresh last accessed at
    const now = new Date().toISOString();
    this.db.prepare('UPDATE sessions SET last_accessed_at = ? WHERE id = ?').run(now, row.id);

    return row;
  }

  public deleteSession(token: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  public getUserActiveSessions(userId: string): Session[] {
    return this.db.prepare(`
      SELECT id, user_id as userId, token, expires_at as expiresAt, created_at as createdAt, last_accessed_at as lastAccessedAt, ip_address as ipAddress, user_agent as userAgent
      FROM sessions WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY last_accessed_at DESC
    `).all(userId) as unknown as Session[];
  }

  public revokeAllSessionsForUser(userId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }

  // ==========================================
  // PASSWORD RESET TOKENS
  // ==========================================
  public createPasswordResetToken(userId: string, tokenHash: string, expiresAt: string): PasswordResetTokenRecord {
    const id = 'prt_' + crypto.randomBytes(12).toString('hex');
    const createdAt = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(id, userId, tokenHash, expiresAt, createdAt);

    return {
      id,
      userId,
      tokenHash,
      expiresAt,
      used: 0,
      createdAt
    };
  }

  public getPasswordResetTokenByHash(tokenHash: string): PasswordResetTokenRecord | null {
    const row = this.db.prepare(`
      SELECT id, user_id as userId, token_hash as tokenHash, expires_at as expiresAt, used, used_at as usedAt, created_at as createdAt
      FROM password_reset_tokens
      WHERE token_hash = ?
    `).get(tokenHash) as any;

    if (!row) return null;
    return {
      ...row,
      used: row.used ? 1 : 0
    };
  }

  public markPasswordResetTokenUsed(id: string): void {
    const now = new Date().toISOString();
    this.db.prepare('UPDATE password_reset_tokens SET used = 1, used_at = ? WHERE id = ?').run(now, id);
  }

  public getLatestResetTokenForUser(userId: string): PasswordResetTokenRecord | null {
    const row = this.db.prepare(`
      SELECT id, user_id as userId, token_hash as tokenHash, expires_at as expiresAt, used, used_at as usedAt, created_at as createdAt
      FROM password_reset_tokens
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId) as any;

    if (!row) return null;
    return {
      ...row,
      used: row.used ? 1 : 0
    };
  }

  // ==========================================
  // EMAIL VERIFICATION
  // ==========================================
  public getUserByVerificationTokenHash(tokenHash: string): UserAuthRecord | null {
    const row = this.db.prepare(`
      SELECT id, name, email, password_hash as passwordHash, salt, job_title as jobTitle, avatar, status, role, created_at as createdAt, updated_at as updatedAt, last_login_at as lastLoginAt, email_verified_at as emailVerifiedAt, email_verification_token_hash as emailVerificationTokenHash, email_verification_expires_at as emailVerificationExpiresAt
      FROM users
      WHERE email_verification_token_hash = ?
    `).get(tokenHash) as any;

    if (!row) return null;
    return {
      ...row,
      emailVerified: Boolean(row.emailVerifiedAt)
    };
  }

  public setEmailVerificationToken(userId: string, tokenHash: string | null, expiresAt: string | null): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE users 
      SET email_verification_token_hash = ?, email_verification_expires_at = ?, updated_at = ?
      WHERE id = ?
    `).run(tokenHash, expiresAt, now, userId);
  }

  public markEmailAsVerified(userId: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE users 
      SET email_verified_at = ?, email_verification_token_hash = NULL, email_verification_expires_at = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, now, userId);
  }

  // ==========================================
  // WORKSPACES & MEMBERS
  // ==========================================
  public listWorkspacesForUser(userId: string): Workspace[] {
    const rows = this.db.prepare(`
      SELECT w.id, w.name, w.description, w.owner_id as ownerId, w.status, w.created_at as createdAt, w.updated_at as updatedAt,
        (SELECT count(*) FROM workspace_members m WHERE m.workspace_id = w.id AND m.status = 'active') as memberCount,
        (SELECT count(*) FROM projects p WHERE p.workspace_id = w.id AND p.status = 'active') as projectCount
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ? AND wm.status = 'active' AND w.status = 'active'
      ORDER BY w.created_at ASC
    `).all(userId) as unknown as Workspace[];

    return rows;
  }

  public getWorkspaceById(workspaceId: string): Workspace | null {
    const row = this.db.prepare(`
      SELECT id, name, description, owner_id as ownerId, status, created_at as createdAt, updated_at as updatedAt,
        (SELECT count(*) FROM workspace_members m WHERE m.workspace_id = workspaces.id AND m.status = 'active') as memberCount,
        (SELECT count(*) FROM projects p WHERE p.workspace_id = workspaces.id AND p.status = 'active') as projectCount
      FROM workspaces WHERE id = ?
    `).get(workspaceId) as unknown as Workspace | undefined;
    return row || null;
  }

  public createWorkspace(name: string, description: string | undefined, ownerId: string): Workspace {
    const id = `ws_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO workspaces (id, name, description, owner_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(id, name, description || null, ownerId, now, now);

    // Owner is automatically an active OWNER member
    const memberId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    this.db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_at, joined_at)
      VALUES (?, ?, ?, 'OWNER', 'active', ?, ?)
    `).run(memberId, id, ownerId, now, now);

    return {
      id,
      name,
      description,
      ownerId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      memberCount: 1,
      projectCount: 0
    };
  }

  public updateWorkspace(workspaceId: string, updates: { name?: string; description?: string }): Workspace | null {
    const now = new Date().toISOString();
    if (updates.name && updates.description !== undefined) {
      this.db.prepare('UPDATE workspaces SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(updates.name, updates.description, now, workspaceId);
    } else if (updates.name) {
      this.db.prepare('UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?').run(updates.name, now, workspaceId);
    } else if (updates.description !== undefined) {
      this.db.prepare('UPDATE workspaces SET description = ?, updated_at = ? WHERE id = ?').run(updates.description, now, workspaceId);
    }
    return this.getWorkspaceById(workspaceId);
  }

  public archiveWorkspace(workspaceId: string): void {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE workspaces SET status = 'archived', updated_at = ? WHERE id = ?").run(now, workspaceId);
  }

  public getWorkspaceMember(workspaceId: string, userId: string): WorkspaceMember | null {
    const row = this.db.prepare(`
      SELECT wm.id, wm.workspace_id as workspaceId, wm.user_id as userId, wm.role, wm.status, wm.invited_at as invitedAt, wm.joined_at as joinedAt,
        u.name as userName, u.email as userEmail, u.avatar as userAvatar, u.status as userStatus
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ? AND wm.user_id = ?
    `).get(workspaceId, userId) as any;

    if (!row) return null;

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      role: row.role as UserRole,
      status: row.status as 'active' | 'invited',
      invitedAt: row.invitedAt,
      joinedAt: row.joinedAt,
      user: {
        id: row.userId,
        name: row.userName,
        email: row.userEmail,
        avatar: row.userAvatar,
        status: row.userStatus,
        role: row.role,
        createdAt: '',
        updatedAt: ''
      }
    };
  }

  public listWorkspaceMembers(workspaceId: string): WorkspaceMember[] {
    const rows = this.db.prepare(`
      SELECT wm.id, wm.workspace_id as workspaceId, wm.user_id as userId, wm.role, wm.status, wm.invited_at as invitedAt, wm.joined_at as joinedAt,
        u.name as userName, u.email as userEmail, u.avatar as userAvatar, u.status as userStatus
      FROM workspace_members wm
      JOIN users u ON wm.user_id = u.id
      WHERE wm.workspace_id = ?
      ORDER BY wm.joined_at ASC
    `).all(workspaceId) as any[];

    return rows.map(row => ({
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      role: row.role as UserRole,
      status: row.status as 'active' | 'invited',
      invitedAt: row.invitedAt,
      joinedAt: row.joinedAt,
      user: {
        id: row.userId,
        name: row.userName,
        email: row.userEmail,
        avatar: row.userAvatar,
        status: row.userStatus,
        role: row.role,
        createdAt: '',
        updatedAt: ''
      }
    }));
  }

  public addOrInviteMember(workspaceId: string, userId: string, role: UserRole): WorkspaceMember {
    const existing = this.getWorkspaceMember(workspaceId, userId);
    const now = new Date().toISOString();

    if (existing) {
      this.db.prepare('UPDATE workspace_members SET role = ?, status = ? WHERE id = ?').run(role, 'active', existing.id);
      return this.getWorkspaceMember(workspaceId, userId)!;
    }

    const memberId = `mem_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    this.db.prepare(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role, status, invited_at, joined_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
    `).run(memberId, workspaceId, userId, role, now, now);

    return this.getWorkspaceMember(workspaceId, userId)!;
  }

  public updateMemberRole(workspaceId: string, memberIdOrUserId: string, role: UserRole): WorkspaceMember | null {
    this.db.prepare('UPDATE workspace_members SET role = ? WHERE (id = ? OR user_id = ?) AND workspace_id = ?').run(role, memberIdOrUserId, memberIdOrUserId, workspaceId);
    const row = this.db.prepare('SELECT user_id as userId FROM workspace_members WHERE (id = ? OR user_id = ?) AND workspace_id = ?').get(memberIdOrUserId, memberIdOrUserId, workspaceId) as any;
    if (row) return this.getWorkspaceMember(workspaceId, row.userId);
    return null;
  }

  public removeWorkspaceMember(workspaceId: string, memberId: string): void {
    this.db.prepare('DELETE FROM workspace_members WHERE id = ? AND workspace_id = ?').run(memberId, workspaceId);
  }

  // ==========================================
  // PROJECTS
  // ==========================================
  public listProjects(workspaceId: string): Project[] {
    return this.db.prepare(`
      SELECT id, workspace_id as workspaceId, name, description, owner_id as ownerId, status, created_at as createdAt, updated_at as updatedAt
      FROM projects WHERE workspace_id = ? AND status = 'active'
      ORDER BY created_at ASC
    `).all(workspaceId) as unknown as Project[];
  }

  public getProjectById(projectId: string): Project | null {
    const row = this.db.prepare(`
      SELECT id, workspace_id as workspaceId, name, description, owner_id as ownerId, status, created_at as createdAt, updated_at as updatedAt
      FROM projects WHERE id = ?
    `).get(projectId) as unknown as Project | undefined;
    return row || null;
  }

  public createProject(workspaceId: string, name: string, description?: string, ownerId?: string): Project {
    const id = `proj_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();
    const actualOwnerId = ownerId || 'usr_admin';

    this.db.prepare(`
      INSERT INTO projects (id, workspace_id, name, description, owner_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(id, workspaceId, name, description || null, actualOwnerId, now, now);

    return {
      id,
      workspaceId,
      name,
      description,
      ownerId: actualOwnerId,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
  }

  public updateProject(projectId: string, updates: { name?: string; description?: string }): Project | null {
    const now = new Date().toISOString();
    if (updates.name && updates.description !== undefined) {
      this.db.prepare('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(updates.name, updates.description, now, projectId);
    } else if (updates.name) {
      this.db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(updates.name, now, projectId);
    } else if (updates.description !== undefined) {
      this.db.prepare('UPDATE projects SET description = ?, updated_at = ? WHERE id = ?').run(updates.description, now, projectId);
    }
    return this.getProjectById(projectId);
  }

  public deleteProject(projectId: string): void {
    this.db.prepare("UPDATE projects SET status = 'archived' WHERE id = ?").run(projectId);
  }

  // ==========================================
  // RESOURCE SHARING
  // ==========================================
  public getResourceShares(resourceType: ResourceType, resourceId: string): ResourceShare[] {
    const rows = this.db.prepare(`
      SELECT s.id, s.resource_type as resourceType, s.resource_id as resourceId, s.workspace_id as workspaceId,
        s.shared_with_user_id as sharedWithUserId, s.access_level as accessLevel, s.shared_by_user_id as sharedByUserId, s.created_at as createdAt,
        u.name as userName, u.email as userEmail
      FROM resource_shares s
      JOIN users u ON s.shared_with_user_id = u.id
      WHERE s.resource_type = ? AND s.resource_id = ?
    `).all(resourceType, resourceId) as any[];

    return rows.map(r => ({
      id: r.id,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      workspaceId: r.workspaceId,
      sharedWithUserId: r.sharedWithUserId,
      sharedWithUser: {
        id: r.sharedWithUserId,
        name: r.userName,
        email: r.userEmail
      },
      accessLevel: r.accessLevel as ShareAccessLevel,
      sharedByUserId: r.sharedByUserId,
      createdAt: r.createdAt
    }));
  }

  public getUserDirectShare(resourceType: ResourceType, resourceId: string, userId: string): ShareAccessLevel | null {
    const row = this.db.prepare(`
      SELECT access_level as accessLevel FROM resource_shares
      WHERE resource_type = ? AND resource_id = ? AND shared_with_user_id = ?
    `).get(resourceType, resourceId, userId) as { accessLevel: ShareAccessLevel } | undefined;
    return row ? row.accessLevel : null;
  }

  public addOrUpdateShare(params: {
    resourceType: ResourceType;
    resourceId: string;
    workspaceId: string;
    sharedWithUserId: string;
    accessLevel: ShareAccessLevel;
    sharedByUserId: string;
  }): ResourceShare {
    const now = new Date().toISOString();
    const existing = this.db.prepare(`
      SELECT id FROM resource_shares WHERE resource_type = ? AND resource_id = ? AND shared_with_user_id = ?
    `).get(params.resourceType, params.resourceId, params.sharedWithUserId) as { id: string } | undefined;

    if (existing) {
      this.db.prepare('UPDATE resource_shares SET access_level = ? WHERE id = ?').run(params.accessLevel, existing.id);
      return {
        id: existing.id,
        ...params,
        createdAt: now
      };
    }

    const id = `sh_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    this.db.prepare(`
      INSERT INTO resource_shares (id, resource_type, resource_id, workspace_id, shared_with_user_id, access_level, shared_by_user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.resourceType, params.resourceId, params.workspaceId, params.sharedWithUserId, params.accessLevel, params.sharedByUserId, now);

    return {
      id,
      ...params,
      createdAt: now
    };
  }

  public removeShare(shareId: string): void {
    this.db.prepare('DELETE FROM resource_shares WHERE id = ?').run(shareId);
  }

  // ==========================================
  // REPORTS & IMMUTABLE SNAPSHOTS
  // ==========================================
  public listReports(workspaceId: string, projectId?: string): Report[] {
    let sql = `
      SELECT r.id, r.workspace_id as workspaceId, r.project_id as projectId, r.owner_id as ownerId,
        r.title, r.description, r.dashboard_id as dashboardId, r.config_json, r.kpis_json, r.insights_json, r.filters_json,
        r.generated_at as generatedAt, r.generated_by as generatedBy, r.status, r.created_at as createdAt, r.updated_at as updatedAt,
        u.name as generatedByName
      FROM reports r
      LEFT JOIN users u ON r.generated_by = u.id
      WHERE r.workspace_id = ?
    `;
    const params: any[] = [workspaceId];
    if (projectId) {
      sql += ' AND r.project_id = ?';
      params.push(projectId);
    }
    sql += ' ORDER BY r.updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      title: r.title,
      description: r.description,
      dashboardId: r.dashboardId,
      config: JSON.parse(r.config_json || '{}'),
      kpis: JSON.parse(r.kpis_json || '[]'),
      narrativeInsights: JSON.parse(r.insights_json || '[]'),
      filters: JSON.parse(r.filters_json || '{}'),
      generatedAt: r.generatedAt,
      generatedBy: r.generatedBy,
      generatedByName: r.generatedByName,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  public getReportById(reportId: string): Report | null {
    const r = this.db.prepare(`
      SELECT r.id, r.workspace_id as workspaceId, r.project_id as projectId, r.owner_id as ownerId,
        r.title, r.description, r.dashboard_id as dashboardId, r.config_json, r.kpis_json, r.insights_json, r.filters_json,
        r.generated_at as generatedAt, r.generated_by as generatedBy, r.status, r.created_at as createdAt, r.updated_at as updatedAt,
        u.name as generatedByName
      FROM reports r
      LEFT JOIN users u ON r.generated_by = u.id
      WHERE r.id = ?
    `).get(reportId) as any;

    if (!r) return null;

    return {
      id: r.id,
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      title: r.title,
      description: r.description,
      dashboardId: r.dashboardId,
      config: JSON.parse(r.config_json || '{}'),
      kpis: JSON.parse(r.kpis_json || '[]'),
      narrativeInsights: JSON.parse(r.insights_json || '[]'),
      filters: JSON.parse(r.filters_json || '{}'),
      generatedAt: r.generatedAt,
      generatedBy: r.generatedBy,
      generatedByName: r.generatedByName,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  public createReport(params: {
    workspaceId: string;
    projectId?: string;
    ownerId: string;
    title: string;
    description?: string;
    dashboardId?: string;
    config: any;
    kpis: any[];
    narrativeInsights: string[];
    filters: Record<string, any>;
  }): Report {
    const id = `rep_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO reports (id, workspace_id, project_id, owner_id, title, description, dashboard_id, config_json, kpis_json, insights_json, filters_json, generated_at, generated_by, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
    `).run(
      id,
      params.workspaceId,
      params.projectId || null,
      params.ownerId,
      params.title,
      params.description || null,
      params.dashboardId || null,
      JSON.stringify(params.config || {}),
      JSON.stringify(params.kpis || []),
      JSON.stringify(params.narrativeInsights || []),
      JSON.stringify(params.filters || {}),
      now,
      params.ownerId,
      now,
      now
    );

    return this.getReportById(id)!;
  }

  public updateReport(reportId: string, updates: Partial<Report>): Report | null {
    const current = this.getReportById(reportId);
    if (!current) return null;

    const now = new Date().toISOString();
    const title = updates.title || current.title;
    const description = updates.description !== undefined ? updates.description : current.description;
    const config = updates.config ? JSON.stringify(updates.config) : JSON.stringify(current.config);
    const kpis = updates.kpis ? JSON.stringify(updates.kpis) : JSON.stringify(current.kpis);
    const insights = updates.narrativeInsights ? JSON.stringify(updates.narrativeInsights) : JSON.stringify(current.narrativeInsights);
    const filters = updates.filters ? JSON.stringify(updates.filters) : JSON.stringify(current.filters);
    const status = updates.status || current.status;

    this.db.prepare(`
      UPDATE reports
      SET title = ?, description = ?, config_json = ?, kpis_json = ?, insights_json = ?, filters_json = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(title, description || null, config, kpis, insights, filters, status, now, reportId);

    return this.getReportById(reportId);
  }

  public deleteReport(reportId: string): void {
    this.db.prepare('DELETE FROM reports WHERE id = ?').run(reportId);
  }

  public createReportSnapshot(params: {
    reportId: string;
    workspaceId: string;
    snapshotTitle: string;
    config: any;
    metrics: Record<string, any>;
    filters: Record<string, any>;
    generatedBy: string;
  }): ReportSnapshot {
    const id = `snap_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO report_snapshots (id, report_id, workspace_id, snapshot_title, config_json, metrics_json, filters_json, generated_by, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.reportId,
      params.workspaceId,
      params.snapshotTitle,
      JSON.stringify(params.config || {}),
      JSON.stringify(params.metrics || {}),
      JSON.stringify(params.filters || {}),
      params.generatedBy,
      now
    );

    return {
      id,
      reportId: params.reportId,
      workspaceId: params.workspaceId,
      snapshotTitle: params.snapshotTitle,
      config: params.config,
      metrics: params.metrics,
      filters: params.filters,
      generatedBy: params.generatedBy,
      timestamp: now
    };
  }

  public listReportSnapshots(reportId: string): ReportSnapshot[] {
    const rows = this.db.prepare(`
      SELECT s.id, s.report_id as reportId, s.workspace_id as workspaceId, s.snapshot_title as snapshotTitle,
        s.config_json, s.metrics_json, s.filters_json, s.generated_by as generatedBy, s.timestamp,
        u.name as generatedByName
      FROM report_snapshots s
      LEFT JOIN users u ON s.generated_by = u.id
      WHERE s.report_id = ?
      ORDER BY s.timestamp DESC
    `).all(reportId) as any[];

    return rows.map(r => ({
      id: r.id,
      reportId: r.reportId,
      workspaceId: r.workspaceId,
      snapshotTitle: r.snapshotTitle,
      config: JSON.parse(r.config_json || '{}'),
      metrics: JSON.parse(r.metrics_json || '{}'),
      filters: JSON.parse(r.filters_json || '{}'),
      generatedBy: r.generatedBy,
      generatedByName: r.generatedByName,
      timestamp: r.timestamp
    }));
  }

  public getSnapshotById(snapshotId: string): ReportSnapshot | null {
    const r = this.db.prepare(`
      SELECT s.id, s.report_id as reportId, s.workspace_id as workspaceId, s.snapshot_title as snapshotTitle,
        s.config_json, s.metrics_json, s.filters_json, s.generated_by as generatedBy, s.timestamp,
        u.name as generatedByName
      FROM report_snapshots s
      LEFT JOIN users u ON s.generated_by = u.id
      WHERE s.id = ?
    `).get(snapshotId) as any;

    if (!r) return null;

    return {
      id: r.id,
      reportId: r.reportId,
      workspaceId: r.workspaceId,
      snapshotTitle: r.snapshotTitle,
      config: JSON.parse(r.config_json || '{}'),
      metrics: JSON.parse(r.metrics_json || '{}'),
      filters: JSON.parse(r.filters_json || '{}'),
      generatedBy: r.generatedBy,
      generatedByName: r.generatedByName,
      timestamp: r.timestamp
    };
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  public createNotification(params: {
    userId: string;
    workspaceId: string;
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): AppNotification {
    const id = `notif_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO notifications (id, user_id, workspace_id, type, title, message, read, created_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, params.userId, params.workspaceId, params.type, params.title, params.message, now, JSON.stringify(params.metadata || {}));

    return {
      id,
      userId: params.userId,
      workspaceId: params.workspaceId,
      type: params.type as any,
      title: params.title,
      message: params.message,
      read: false,
      createdAt: now,
      metadata: params.metadata
    };
  }

  public listNotifications(userId: string, workspaceId?: string): AppNotification[] {
    let sql = `
      SELECT id, user_id as userId, workspace_id as workspaceId, type, title, message, read, created_at as createdAt, metadata_json
      FROM notifications
      WHERE user_id = ?
    `;
    const params: any[] = [userId];
    if (workspaceId) {
      sql += ' AND workspace_id = ?';
      params.push(workspaceId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 50';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      workspaceId: r.workspaceId,
      type: r.type,
      title: r.title,
      message: r.message,
      read: Boolean(r.read),
      createdAt: r.createdAt,
      metadata: JSON.parse(r.metadata_json || '{}')
    }));
  }

  public getUnreadNotificationCount(userId: string, workspaceId?: string): number {
    let sql = 'SELECT count(*) as count FROM notifications WHERE user_id = ? AND read = 0';
    const params: any[] = [userId];
    if (workspaceId) {
      sql += ' AND workspace_id = ?';
      params.push(workspaceId);
    }
    const row = this.db.prepare(sql).get(...params) as { count: number };
    return row?.count || 0;
  }

  public markNotificationRead(id: string, userId: string): void {
    this.db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
  }

  public markAllNotificationsRead(userId: string, workspaceId?: string): void {
    if (workspaceId) {
      this.db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND workspace_id = ?').run(userId, workspaceId);
    } else {
      this.db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(userId);
    }
  }

  // ==========================================
  // ACTIVITY & AUDIT TRAIL
  // ==========================================
  public logActivity(params: {
    actorId: string;
    actorName: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    resourceName?: string;
    workspaceId: string;
    projectId?: string;
    metadata?: Record<string, any>;
  }): ActivityItem {
    const id = `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO activities (id, actor_id, actor_name, action, resource_type, resource_id, resource_name, workspace_id, project_id, timestamp, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.actorId,
      params.actorName,
      params.action,
      params.resourceType,
      params.resourceId || null,
      params.resourceName || null,
      params.workspaceId,
      params.projectId || null,
      now,
      JSON.stringify(params.metadata || {})
    );

    return {
      id,
      actorId: params.actorId,
      actorName: params.actorName,
      action: params.action,
      resourceType: params.resourceType as any,
      resourceId: params.resourceId,
      resourceName: params.resourceName,
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      timestamp: now,
      metadata: params.metadata
    };
  }

  public listActivities(workspaceId: string, limit = 50, projectId?: string): ActivityItem[] {
    let sql = `
      SELECT id, actor_id as actorId, actor_name as actorName, action, resource_type as resourceType,
        resource_id as resourceId, resource_name as resourceName, workspace_id as workspaceId,
        project_id as projectId, timestamp, metadata_json
      FROM activities
      WHERE workspace_id = ?
    `;
    const params: any[] = [workspaceId];
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(projectId);
    }
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(r => ({
      id: r.id,
      actorId: r.actorId,
      actorName: r.actorName,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      resourceName: r.resourceName,
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      timestamp: r.timestamp,
      metadata: JSON.parse(r.metadata_json || '{}')
    }));
  }

  public logAuditEvent(params: {
    actorId: string;
    actorName: string;
    workspaceId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    result: 'SUCCESS' | 'FAILURE' | 'DENIED';
    metadata?: Record<string, any>;
    correlationId?: string;
  }): AuditLogEntry {
    const id = `aud_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    // Redact any sensitive passwords / credentials before storage
    const cleanMeta: Record<string, any> = {};
    if (params.metadata) {
      for (const [k, v] of Object.entries(params.metadata)) {
        const lower = k.toLowerCase();
        if (lower.includes('password') || lower.includes('secret') || lower.includes('token') || lower.includes('hash')) {
          cleanMeta[k] = '[REDACTED]';
        } else {
          cleanMeta[k] = v;
        }
      }
    }

    this.db.prepare(`
      INSERT INTO audit_logs (id, event_id, actor_id, actor_name, workspace_id, action, resource_type, resource_id, result, metadata_json, correlation_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      eventId,
      params.actorId,
      params.actorName,
      params.workspaceId,
      params.action,
      params.resourceType || null,
      params.resourceId || null,
      params.result,
      JSON.stringify(cleanMeta),
      params.correlationId || null,
      now
    );

    return {
      id,
      eventId,
      actorId: params.actorId,
      actorName: params.actorName,
      workspaceId: params.workspaceId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      result: params.result,
      metadata: cleanMeta,
      correlationId: params.correlationId,
      timestamp: now
    };
  }

  public listAuditLogs(filter: {
    workspaceId?: string;
    actorId?: string;
    action?: string;
    result?: string;
    limit?: number;
  }): AuditLogEntry[] {
    let sql = `
      SELECT id, event_id as eventId, actor_id as actorId, actor_name as actorName, workspace_id as workspaceId,
        action, resource_type as resourceType, resource_id as resourceId, result, metadata_json, correlation_id as correlationId, timestamp
      FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filter.workspaceId) {
      sql += ' AND workspace_id = ?';
      params.push(filter.workspaceId);
    }
    if (filter.actorId) {
      sql += ' AND actor_id = ?';
      params.push(filter.actorId);
    }
    if (filter.action) {
      sql += ' AND action LIKE ?';
      params.push(`%${filter.action}%`);
    }
    if (filter.result) {
      sql += ' AND result = ?';
      params.push(filter.result);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(filter.limit || 100);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      eventId: r.eventId,
      actorId: r.actorId,
      actorName: r.actorName,
      workspaceId: r.workspaceId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      result: r.result,
      metadata: JSON.parse(r.metadata_json || '{}'),
      correlationId: r.correlationId,
      timestamp: r.timestamp
    }));
  }

  // ==========================================
  // SAVED QUERIES (WORKSPACE AWARE)
  // ==========================================
  public listSavedQueries(workspaceId: string, projectId?: string): any[] {
    let sql = `
      SELECT q.id, q.workspace_id as workspaceId, q.project_id as projectId, q.owner_id as ownerId,
        q.name, q.query, q.description, q.tags_json, q.is_favorite as isFavorite, q.visibility,
        q.created_by as createdBy, q.updated_by as updatedBy, q.last_executed_at as lastExecutedAt,
        q.created_at as createdAt, q.updated_at as updatedAt, u.name as ownerName
      FROM saved_queries_store q
      LEFT JOIN users u ON q.owner_id = u.id
      WHERE q.workspace_id = ?
    `;
    const params: any[] = [workspaceId];
    if (projectId) {
      sql += ' AND q.project_id = ?';
      params.push(projectId);
    }
    sql += ' ORDER BY q.updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      name: r.name,
      query: r.query,
      description: r.description || '',
      tags: JSON.parse(r.tags_json || '[]'),
      isFavorite: Boolean(r.isFavorite),
      visibility: r.visibility || 'WORKSPACE',
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      lastExecutedAt: r.lastExecutedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  public getSavedQueryById(id: string): any | null {
    const r = this.db.prepare(`
      SELECT q.id, q.workspace_id as workspaceId, q.project_id as projectId, q.owner_id as ownerId,
        q.name, q.query, q.description, q.tags_json, q.is_favorite as isFavorite, q.visibility,
        q.created_by as createdBy, q.updated_by as updatedBy, q.last_executed_at as lastExecutedAt,
        q.created_at as createdAt, q.updated_at as updatedAt, u.name as ownerName
      FROM saved_queries_store q
      LEFT JOIN users u ON q.owner_id = u.id
      WHERE q.id = ?
    `).get(id) as any;

    if (!r) return null;

    return {
      id: r.id,
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      name: r.name,
      query: r.query,
      description: r.description || '',
      tags: JSON.parse(r.tags_json || '[]'),
      isFavorite: Boolean(r.isFavorite),
      visibility: r.visibility || 'WORKSPACE',
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      lastExecutedAt: r.lastExecutedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  public saveQuery(params: {
    id?: string;
    workspaceId: string;
    projectId?: string;
    ownerId?: string;
    createdByUserId?: string;
    name: string;
    query: string;
    description?: string;
    tags?: string[];
    isFavorite?: boolean;
    visibility?: ResourceVisibility;
  }): any {
    const id = params.id || `sq_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();
    const existing = this.getSavedQueryById(id);
    const owner = params.ownerId || params.createdByUserId || 'usr_admin';

    if (existing) {
      this.db.prepare(`
        UPDATE saved_queries_store
        SET name = ?, query = ?, description = ?, tags_json = ?, is_favorite = ?, visibility = ?, updated_by = ?, project_id = ?, updated_at = ?
        WHERE id = ?
      `).run(
        params.name,
        params.query,
        params.description || '',
        JSON.stringify(params.tags || []),
        params.isFavorite ? 1 : 0,
        params.visibility || existing.visibility,
        owner,
        params.projectId || existing.projectId || null,
        now,
        id
      );
      return this.getSavedQueryById(id);
    }

    this.db.prepare(`
      INSERT INTO saved_queries_store (id, workspace_id, project_id, owner_id, name, query, description, tags_json, is_favorite, visibility, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.workspaceId,
      params.projectId || null,
      owner,
      params.name,
      params.query,
      params.description || '',
      JSON.stringify(params.tags || []),
      params.isFavorite ? 1 : 0,
      params.visibility || 'WORKSPACE',
      owner,
      owner,
      now,
      now
    );

    return this.getSavedQueryById(id);
  }

  public deleteSavedQuery(id: string): void {
    this.db.prepare('DELETE FROM saved_queries_store WHERE id = ?').run(id);
  }

  // ==========================================
  // DASHBOARDS (WORKSPACE AWARE)
  // ==========================================
  public listDashboards(workspaceId: string, projectId?: string): any[] {
    let sql = `
      SELECT d.id, d.workspace_id as workspaceId, d.project_id as projectId, d.owner_id as ownerId,
        d.title, d.description, d.widgets_json, d.filters_json, d.layout_json, d.visibility,
        d.created_by as createdBy, d.updated_by as updatedBy, d.auto_refresh_interval as autoRefreshInterval,
        d.created_at as createdAt, d.updated_at as updatedAt, u.name as ownerName
      FROM dashboards_store d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.workspace_id = ?
    `;
    const params: any[] = [workspaceId];
    if (projectId) {
      sql += ' AND d.project_id = ?';
      params.push(projectId);
    }
    sql += ' ORDER BY d.updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.title,
      title: r.title,
      description: r.description || '',
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      widgets: JSON.parse(r.widgets_json || '[]'),
      filters: JSON.parse(r.filters_json || '[]'),
      layout: JSON.parse(r.layout_json || '{"columns":12,"gap":"md"}'),
      visibility: r.visibility || 'WORKSPACE',
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      autoRefreshInterval: r.autoRefreshInterval || 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  public getDashboardById(id: string): any | null {
    const r = this.db.prepare(`
      SELECT d.id, d.workspace_id as workspaceId, d.project_id as projectId, d.owner_id as ownerId,
        d.title, d.description, d.widgets_json, d.filters_json, d.layout_json, d.visibility,
        d.created_by as createdBy, d.updated_by as updatedBy, d.auto_refresh_interval as autoRefreshInterval,
        d.created_at as createdAt, d.updated_at as updatedAt, u.name as ownerName
      FROM dashboards_store d
      LEFT JOIN users u ON d.owner_id = u.id
      WHERE d.id = ?
    `).get(id) as any;

    if (!r) return null;

    return {
      id: r.id,
      name: r.title,
      title: r.title,
      description: r.description || '',
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      widgets: JSON.parse(r.widgets_json || '[]'),
      filters: JSON.parse(r.filters_json || '[]'),
      layout: JSON.parse(r.layout_json || '{"columns":12,"gap":"md"}'),
      visibility: r.visibility || 'WORKSPACE',
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      autoRefreshInterval: r.autoRefreshInterval || 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  public saveDashboard(params: {
    id?: string;
    workspaceId: string;
    projectId?: string;
    ownerId?: string;
    createdByUserId?: string;
    title: string;
    description?: string;
    widgets: any[];
    filters: any[];
    layout: any;
    visibility?: ResourceVisibility;
    autoRefreshInterval?: number;
  }): any {
    const id = params.id || `dash_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();
    const existing = this.getDashboardById(id);
    const owner = params.ownerId || params.createdByUserId || 'usr_admin';

    if (existing) {
      this.db.prepare(`
        UPDATE dashboards_store
        SET title = ?, description = ?, widgets_json = ?, filters_json = ?, layout_json = ?, visibility = ?, updated_by = ?, project_id = ?, auto_refresh_interval = ?, updated_at = ?
        WHERE id = ?
      `).run(
        params.title,
        params.description || '',
        JSON.stringify(params.widgets || []),
        JSON.stringify(params.filters || []),
        JSON.stringify(params.layout || { columns: 12, gap: 'md' }),
        params.visibility || existing.visibility,
        owner,
        params.projectId || existing.projectId || null,
        params.autoRefreshInterval !== undefined ? params.autoRefreshInterval : existing.autoRefreshInterval,
        now,
        id
      );
      return this.getDashboardById(id);
    }

    this.db.prepare(`
      INSERT INTO dashboards_store (id, workspace_id, project_id, owner_id, title, description, widgets_json, filters_json, layout_json, visibility, created_by, updated_by, auto_refresh_interval, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.workspaceId,
      params.projectId || null,
      owner,
      params.title,
      params.description || '',
      JSON.stringify(params.widgets || []),
      JSON.stringify(params.filters || []),
      JSON.stringify(params.layout || { columns: 12, gap: 'md' }),
      params.visibility || 'WORKSPACE',
      owner,
      owner,
      params.autoRefreshInterval || 0,
      now,
      now
    );

    return this.getDashboardById(id);
  }

  public deleteDashboard(id: string): void {
    this.db.prepare('DELETE FROM dashboards_store WHERE id = ?').run(id);
  }

  // ==========================================
  // PIPELINES (WORKSPACE AWARE)
  // ==========================================
  public listPipelines(workspaceId: string, projectId?: string): any[] {
    let sql = `
      SELECT p.id, p.workspace_id as workspaceId, p.project_id as projectId, p.owner_id as ownerId,
        p.dataset_id as datasetId, p.name, p.description, p.steps_json, p.visibility,
        p.created_by as createdBy, p.updated_by as updatedBy, p.created_at as createdAt, p.updated_at as updatedAt,
        u.name as ownerName
      FROM pipelines_store p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.workspace_id = ?
    `;
    const params: any[] = [workspaceId];
    if (projectId) {
      sql += ' AND p.project_id = ?';
      params.push(projectId);
    }
    sql += ' ORDER BY p.updated_at DESC';

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || '',
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      datasetId: r.datasetId,
      steps: JSON.parse(r.steps_json || '[]'),
      visibility: r.visibility || 'WORKSPACE',
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }

  public getPipelineById(id: string): any | null {
    const r = this.db.prepare(`
      SELECT p.id, p.workspace_id as workspaceId, p.project_id as projectId, p.owner_id as ownerId,
        p.dataset_id as datasetId, p.name, p.description, p.steps_json, p.visibility,
        p.created_by as createdBy, p.updated_by as updatedBy, p.created_at as createdAt, p.updated_at as updatedAt,
        u.name as ownerName
      FROM pipelines_store p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `).get(id) as any;

    if (!r) return null;

    return {
      id: r.id,
      name: r.name,
      description: r.description || '',
      workspaceId: r.workspaceId,
      projectId: r.projectId,
      ownerId: r.ownerId,
      ownerName: r.ownerName,
      datasetId: r.datasetId,
      steps: JSON.parse(r.steps_json || '[]'),
      visibility: r.visibility || 'WORKSPACE',
      createdBy: r.createdBy,
      updatedBy: r.updatedBy,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    };
  }

  public savePipeline(params: {
    id?: string;
    workspaceId: string;
    projectId?: string;
    ownerId?: string;
    createdByUserId?: string;
    datasetId?: string;
    name: string;
    description?: string;
    steps: any[];
    visibility?: ResourceVisibility;
  }): any {
    const id = params.id || `pipe_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();
    const existing = this.getPipelineById(id);
    const owner = params.ownerId || params.createdByUserId || 'usr_admin';

    if (existing) {
      this.db.prepare(`
        UPDATE pipelines_store
        SET name = ?, description = ?, steps_json = ?, dataset_id = ?, visibility = ?, updated_by = ?, project_id = ?, updated_at = ?
        WHERE id = ?
      `).run(
        params.name,
        params.description || '',
        JSON.stringify(params.steps || []),
        params.datasetId || existing.datasetId || '',
        params.visibility || existing.visibility,
        owner,
        params.projectId || existing.projectId || null,
        now,
        id
      );
      return this.getPipelineById(id);
    }

    this.db.prepare(`
      INSERT INTO pipelines_store (id, workspace_id, project_id, owner_id, dataset_id, name, description, steps_json, visibility, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.workspaceId,
      params.projectId || null,
      owner,
      params.datasetId || '',
      params.name,
      params.description || '',
      JSON.stringify(params.steps || []),
      params.visibility || 'WORKSPACE',
      owner,
      owner,
      now,
      now
    );

    return this.getPipelineById(id);
  }

  public deletePipeline(id: string): void {
    this.db.prepare('DELETE FROM pipelines_store WHERE id = ?').run(id);
  }

  // ==========================================
  // GLOBAL WORKSPACE SEARCH
  // ==========================================
  public globalSearch(workspaceId: string, query: string): any[] {
    const q = `%${query.toLowerCase().trim()}%`;
    const results: any[] = [];

    // Search Projects
    const projects = this.db.prepare(`
      SELECT id, name as title, description, 'project' as type, updated_at as updatedAt
      FROM projects WHERE workspace_id = ? AND status = 'active' AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ?)
    `).all(workspaceId, q, q) as any[];
    results.push(...projects);

    // Search Saved Queries
    const queries = this.db.prepare(`
      SELECT id, name as title, description, 'query' as type, project_id as projectId, visibility, updated_at as updatedAt
      FROM saved_queries_store WHERE workspace_id = ? AND (LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(query) LIKE ?)
    `).all(workspaceId, q, q, q) as any[];
    results.push(...queries);

    // Search Dashboards
    const dashboards = this.db.prepare(`
      SELECT id, title, description, 'dashboard' as type, project_id as projectId, visibility, updated_at as updatedAt
      FROM dashboards_store WHERE workspace_id = ? AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)
    `).all(workspaceId, q, q) as any[];
    results.push(...dashboards);

    // Search Reports
    const reports = this.db.prepare(`
      SELECT id, title, description, 'report' as type, project_id as projectId, 'WORKSPACE' as visibility, updated_at as updatedAt
      FROM reports WHERE workspace_id = ? AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ?)
    `).all(workspaceId, q, q) as any[];
    results.push(...reports);

    return results;
  }
}
