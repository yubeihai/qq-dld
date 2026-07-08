class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (!this.listeners.has(event)) return;
    const handlers = this.listeners.get(event);
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    const handlers = this.listeners.get(event);
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (error) {
        console.error(`[事件总线][${event}] 处理异常:`, error.message);
      }
    }
  }

  async emitAsync(event, data) {
    if (!this.listeners.has(event)) return;
    const handlers = this.listeners.get(event);
    for (const handler of handlers) {
      try {
        await handler(data);
      } catch (error) {
        console.error(`[事件总线][${event}] 异步处理异常:`, error.message);
      }
    }
  }

  once(event, handler) {
    const wrapper = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  removeAll(event = null) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

module.exports = { EventBus };
