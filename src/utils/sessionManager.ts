import { v4 as uuidv4 } from 'uuid';

interface Session {
  sessionId: string;
  context: string;
  lastUpdated: string;
}

const STORAGE_KEY = 'jarvis_sessions';
const MAX_SESSIONS = 5;

export class SessionManager {
  private sessions: Session[] = [];

  constructor() {
    this.loadSessions();
  }

  private loadSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      this.sessions = data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading sessions:', error);
      this.sessions = [];
      this.saveSessions();
    }
  }

  private saveSessions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sessions));
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  public getOrCreateSession(context: string): string {
    // Look for an existing session with similar context
    const existingSession = this.sessions.find(s => s.context === context);
    if (existingSession) {
      existingSession.lastUpdated = new Date().toISOString();
      this.saveSessions();
      return existingSession.sessionId;
    }

    // Create new session
    const newSession: Session = {
      sessionId: uuidv4(),
      context,
      lastUpdated: new Date().toISOString()
    };

    // If we've reached max sessions, remove the oldest one
    if (this.sessions.length >= MAX_SESSIONS) {
      this.sessions.sort((a, b) => 
        new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime()
      );
      this.sessions.shift(); // Remove oldest session
    }

    this.sessions.push(newSession);
    this.saveSessions();
    return newSession.sessionId;
  }

  public updateSession(sessionId: string, context: string) {
    const session = this.sessions.find(s => s.sessionId === sessionId);
    if (session) {
      session.context = context;
      session.lastUpdated = new Date().toISOString();
      this.saveSessions();
    }
  }

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.find(s => s.sessionId === sessionId);
  }

  public getAllSessions(): Session[] {
    return [...this.sessions];
  }
}

export const sessionManager = new SessionManager();
