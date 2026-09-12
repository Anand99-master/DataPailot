import crypto from 'crypto';
import { DatabaseAdapter, DatabaseConnectionParams, ConnectionTestResult } from './DatabaseAdapter';
import { DatabaseAdapterFactory } from './DatabaseAdapterFactory';

export interface SanitizedConnectionInfo {
  id: string;
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  ssl: boolean;
  isConnected: boolean;
  serverVersion?: string;
  connectedAt?: string;
}

interface ActiveSessionConnection {
  adapter: DatabaseAdapter;
  info: SanitizedConnectionInfo;
  lastActive: number;
}

export class ConnectionManager {
  private static instance: ConnectionManager;
  // Map session IDs to active connections
  private connections = new Map<string, ActiveSessionConnection>();

  private constructor() {
    // Periodically clean up stale inactive connections (after 30 minutes of inactivity)
    setInterval(() => {
      const now = Date.now();
      for (const [sessionId, conn] of this.connections.entries()) {
        if (now - conn.lastActive > 30 * 60 * 1000) {
          conn.adapter.disconnect().catch(() => {});
          this.connections.delete(sessionId);
        }
      }
    }, 5 * 60 * 1000);
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  public createAdapter(params: DatabaseConnectionParams): DatabaseAdapter {
    return DatabaseAdapterFactory.create(params);
  }

  public async testConnection(params: DatabaseConnectionParams): Promise<ConnectionTestResult> {
    const adapter = this.createAdapter(params);
    return await adapter.testConnection();
  }

  public async connect(sessionId: string, params: DatabaseConnectionParams): Promise<SanitizedConnectionInfo> {
    // If existing connection for this session, disconnect first
    await this.disconnect(sessionId);

    const adapter = this.createAdapter(params);
    await adapter.connect();

    // Verify version safely
    const testRes = await adapter.testConnection();

    const info: SanitizedConnectionInfo = {
      id: crypto.randomUUID(),
      type: params.type,
      host: params.host,
      port: params.port,
      database: params.database,
      username: params.username,
      ssl: Boolean(params.ssl),
      isConnected: true,
      serverVersion: testRes.serverVersion,
      connectedAt: new Date().toISOString()
    };

    this.connections.set(sessionId, {
      adapter,
      info,
      lastActive: Date.now()
    });

    return info;
  }

  public async disconnect(sessionId: string): Promise<void> {
    const existing = this.connections.get(sessionId);
    if (existing) {
      await existing.adapter.disconnect().catch(() => {});
      this.connections.delete(sessionId);
    }
  }

  public getAdapter(sessionId: string): DatabaseAdapter | null {
    const conn = this.connections.get(sessionId);
    if (conn) {
      conn.lastActive = Date.now();
      return conn.adapter;
    }
    return null;
  }

  public getConnectionInfo(sessionId: string): SanitizedConnectionInfo | null {
    const conn = this.connections.get(sessionId);
    if (conn && conn.adapter.isConnected()) {
      return conn.info;
    }
    return null;
  }

  public getActiveSessionCount(): number {
    return this.connections.size;
  }
}
