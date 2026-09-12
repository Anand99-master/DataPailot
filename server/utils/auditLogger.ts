/**
 * Lightweight Audit Event Model for DataPilot operations.
 * Tracks important lifecycle operations:
 * - database connected / disconnected
 * - schema refreshed
 * - query executed / rejected
 * - AI SQL generated / rejected
 * - dashboard created / updated / deleted
 * CRITICAL: Never stores sensitive database credentials or secrets.
 */

export type AuditEventType =
  | 'DATABASE_CONNECTED'
  | 'DATABASE_DISCONNECTED'
  | 'SCHEMA_REFRESHED'
  | 'QUERY_EXECUTED'
  | 'QUERY_REJECTED'
  | 'AI_SQL_GENERATED'
  | 'AI_SQL_REJECTED'
  | 'DASHBOARD_CREATED'
  | 'DASHBOARD_UPDATED'
  | 'DASHBOARD_DELETED';

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;
  sessionId: string;
  status: 'success' | 'failure';
  details: Record<string, unknown>;
  durationMs?: number;
}

export class AuditLogger {
  private static readonly MAX_EVENTS = 300;
  private static readonly events: AuditEvent[] = [];

  public static record(event: {
    type: AuditEventType;
    sessionId?: string;
    status: 'success' | 'failure';
    details?: Record<string, unknown>;
    durationMs?: number;
  }): void {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = new Date().toISOString();

    // Sanitize any potential sensitive fields in details
    const cleanDetails: Record<string, unknown> = {};
    if (event.details) {
      for (const [k, v] of Object.entries(event.details)) {
        const lower = k.toLowerCase();
        if (
          lower.includes('password') ||
          lower.includes('secret') ||
          lower.includes('token') ||
          lower.includes('credential')
        ) {
          cleanDetails[k] = '[REDACTED]';
        } else {
          cleanDetails[k] = v;
        }
      }
    }

    const auditEvent: AuditEvent = {
      id,
      timestamp,
      type: event.type,
      sessionId: event.sessionId || 'anonymous',
      status: event.status,
      details: cleanDetails,
      durationMs: event.durationMs
    };

    this.events.unshift(auditEvent);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.pop();
    }
  }

  public static getRecentEvents(limit = 50): AuditEvent[] {
    return this.events.slice(0, Math.min(limit, this.MAX_EVENTS));
  }
}
