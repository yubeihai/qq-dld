import { randomUUID } from 'node:crypto';
import { hash33 } from './qq-login-client';

export interface QrSession {
  id: string;
  qrsig: string;
  ptqrtoken: number;
  cookieJar: Map<string, string>;
  createdAt: number;
  status: 'waiting' | 'scanned' | 'success' | 'expired';
  uin?: string;
  nickname?: string;
}

const SESSION_TTL_MS = 2 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 30 * 1000;

export class QrSessionManager {
  private sessions = new Map<string, QrSession>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  create(qrsig: string, cookieJar: Map<string, string>): QrSession {
    const session: QrSession = {
      id: randomUUID(),
      qrsig,
      ptqrtoken: hash33(qrsig),
      cookieJar,
      createdAt: Date.now(),
      status: 'waiting',
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): QrSession | undefined {
    return this.sessions.get(id);
  }

  updateStatus(
    id: string,
    status: QrSession['status'],
    patch?: { uin?: string; nickname?: string },
  ): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.status = status;
    if (patch?.uin !== undefined) session.uin = patch.uin;
    if (patch?.nickname !== undefined) session.nickname = patch.nickname;
  }

  remove(id: string): void {
    this.sessions.delete(id);
  }

  isExpired(session: QrSession): boolean {
    return Date.now() - session.createdAt > SESSION_TTL_MS;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.sessions) {
        if (now - session.createdAt > SESSION_TTL_MS) {
          this.sessions.delete(id);
        }
      }
    }, CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.sessions.clear();
  }
}
