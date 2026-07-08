class TaskResult {
  constructor() {
    this.items = [];
  }

  add(taskId, taskName, status, message = '', detail = {}) {
    this.items.push({
      task_id: taskId,
      task_name: taskName,
      status,
      message,
      detail,
      timestamp: new Date().toISOString(),
    });
  }

  getCompleted() {
    return this.items.filter(i => i.status === 'completed');
  }

  getSkipped() {
    return this.items.filter(i => i.status === 'skipped');
  }

  getFailed() {
    return this.items.filter(i => i.status === 'failed');
  }

  getReplaced() {
    return this.items.filter(i => i.status === 'replaced');
  }

  getPending() {
    return this.items.filter(i => i.status === 'pending');
  }

  getCanClaim() {
    return this.items.filter(i => i.status === 'can_claim');
  }

  summary() {
    return {
      total: this.items.length,
      completed: this.getCompleted().length,
      skipped: this.getSkipped().length,
      failed: this.getFailed().length,
      replaced: this.getReplaced().length,
      pending: this.getPending().length,
      can_claim: this.getCanClaim().length,
    };
  }

  isSuccess() {
    return this.getFailed().length === 0;
  }

  toHumanReadable() {
    const lines = [];
    for (const item of this.items) {
      const icon = this.statusIcon(item.status);
      lines.push(`${icon} ${item.task_name}: ${item.message || item.status}`);
    }
    return lines.join('\n');
  }

  statusIcon(status) {
    switch (status) {
      case 'completed': return '✅';
      case 'skipped': return '⏭️';
      case 'failed': return '❌';
      case 'replaced': return '🔄';
      case 'can_claim': return '🎁';
      case 'done': return '✔️';
      default: return '❓';
    }
  }
}

module.exports = { TaskResult };
