import { sessionManager } from '../utils/sessionManager';

const CALENDAR_API_URL = process.env.REACT_APP_CALENDAR_API_URL || '';
const CALENDAR_API_AUTH = process.env.REACT_APP_CALENDAR_API_AUTH || '';

interface ConversationContext {
  sessionId: string;
  topic: string;
  lastQuery: string;
  lastResponse: any;
  timestamp: string;
}

export class CalendarService {
  private async makeRequest(chatInput: string, context: string) {
    // Determine if this is a new conversation context
    const isNewContext = this.shouldCreateNewContext(chatInput, context);
    const sessionId = isNewContext 
      ? sessionManager.getOrCreateSession(context)
      : this.getCurrentSessionId(context);

    const response = await fetch(CALENDAR_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': CALENDAR_API_AUTH,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        action: 'sendMessage',
        chatInput,
      }),
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Update context with the latest interaction
    this.updateConversationContext(sessionId, {
      sessionId,
      topic: this.extractTopic(chatInput),
      lastQuery: chatInput,
      lastResponse: data,
      timestamp: new Date().toISOString()
    });

    return { data, sessionId };
  }

  private shouldCreateNewContext(chatInput: string, context: string): boolean {
    // If no context provided, it's a new conversation
    if (!context) return true;

    const currentContext = this.getCurrentContext(context);
    if (!currentContext) return true;

    // Check if the current query is related to the previous conversation
    const timeDiff = Date.now() - new Date(currentContext.timestamp).getTime();
    const isTimeExpired = timeDiff > 30 * 60 * 1000; // 30 minutes threshold

    // Check if the topic has changed significantly
    const newTopic = this.extractTopic(chatInput);
    const isTopicChanged = !this.areTopicsRelated(currentContext.topic, newTopic);

    return isTimeExpired || isTopicChanged;
  }

  private getCurrentSessionId(context: string): string {
    const currentContext = this.getCurrentContext(context);
    return currentContext?.sessionId || sessionManager.getOrCreateSession(context);
  }

  private getCurrentContext(context: string): ConversationContext | null {
    try {
      return JSON.parse(context) as ConversationContext;
    } catch {
      return null;
    }
  }

  private extractTopic(query: string): string {
    // Simple topic extraction based on key terms
    const topics = ['meeting', 'schedule', 'appointment', 'calendar', 'availability'];
    const words = query.toLowerCase().split(' ');
    for (const topic of topics) {
      if (words.includes(topic)) return topic;
    }
    return 'general';
  }

  private areTopicsRelated(topic1: string, topic2: string): boolean {
    // Group related topics
    const relatedTopics = {
      meetings: ['meeting', 'schedule', 'appointment'],
      calendar: ['calendar', 'availability', 'time'],
    };

    const findTopicGroup = (topic: string) => {
      return Object.entries(relatedTopics).find(([_, topics]) => 
        topics.includes(topic)
      )?.[0];
    };

    const group1 = findTopicGroup(topic1);
    const group2 = findTopicGroup(topic2);

    return group1 === group2;
  }

  private updateConversationContext(sessionId: string, context: ConversationContext) {
    sessionManager.updateSession(sessionId, JSON.stringify({
      ...context,
      sessionId
    }));
  }

  public async handleCalendarQuery(query: string, context: string = '') {
    try {
      const { data, sessionId } = await this.makeRequest(query, context);
      return {
        ...data,
        sessionId, // Include sessionId in response for tracking
        context: this.getCurrentContext(context) // Include current context for reference
      };
    } catch (error) {
      console.error('Error handling calendar query:', error);
      throw error;
    }
  }
}

export const calendarService = new CalendarService();
