export type EventType =
  | 'session_start'
  | 'pre_tool_execution'
  | 'post_tool_execution'
  | 'on_error'
  | 'pre_commit'
  | 'pre_turn'
  | 'post_turn';

export interface EventPayload {
  type: EventType;
  data: Record<string, unknown>;
  timestamp: number;
}

type EventHandler = (payload: EventPayload) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<EventType, EventHandler[]>();

  on(type: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(type) ?? [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  off(type: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(type) ?? [];
    this.handlers.set(type, handlers.filter((h) => h !== handler));
  }

  async emit(type: EventType, data: Record<string, unknown> = {}): Promise<void> {
    const handlers = this.handlers.get(type) ?? [];
    const payload: EventPayload = { type, data, timestamp: Date.now() };

    for (const handler of handlers) {
      try {
        await handler(payload);
      } catch (e) {
        console.error(`EventBus error in ${type}:`, e);
      }
    }
  }
}

export const eventBus = new EventBus();
