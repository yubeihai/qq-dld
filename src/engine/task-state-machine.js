const STATES = Object.freeze({
  PENDING: 'pending',
  CAN_CLAIM: 'can_claim',
  DONE: 'done',
  COMPLETED: 'completed',
  REPLACED: 'replaced',
  SKIPPED: 'skipped',
  FAILED: 'failed',
});

const TERMINAL_STATES = new Set([
  STATES.DONE,
  STATES.COMPLETED,
  STATES.SKIPPED,
  STATES.FAILED,
]);

const VALID_TRANSITIONS = {
  [STATES.PENDING]: [STATES.CAN_CLAIM, STATES.REPLACED, STATES.SKIPPED, STATES.FAILED, STATES.COMPLETED],
  [STATES.REPLACED]: [STATES.PENDING, STATES.CAN_CLAIM, STATES.DONE, STATES.FAILED],
  [STATES.CAN_CLAIM]: [STATES.COMPLETED, STATES.FAILED, STATES.DONE],
  [STATES.COMPLETED]: [],
  [STATES.DONE]: [],
  [STATES.SKIPPED]: [],
  [STATES.FAILED]: [],
};

class TaskStateMachine {
  constructor(task) {
    this.task = task;
    this.state = task.status || STATES.PENDING;
    this.history = [{ from: null, to: this.state, reason: 'init' }];
  }

  get currentState() {
    return this.state;
  }

  get isTerminal() {
    return TERMINAL_STATES.has(this.state);
  }

  get isPending() {
    return this.state === STATES.PENDING;
  }

  get canClaim() {
    return this.state === STATES.CAN_CLAIM;
  }

  transition(newState, reason = '') {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(newState)) {
      throw new Error(`无效状态转换: ${this.state} -> ${newState}`);
    }

    const oldState = this.state;
    this.state = newState;
    this.history.push({ from: oldState, to: newState, reason });
    return true;
  }

  forceState(newState) {
    this.state = newState;
    this.history.push({ from: null, to: newState, reason: 'force' });
  }

  getStatusMessage() {
    switch (this.state) {
      case STATES.DONE: return '已完成';
      case STATES.COMPLETED: return '已领取奖励';
      case STATES.SKIPPED: return '已跳过';
      case STATES.REPLACED: return '已替换';
      case STATES.FAILED: return '失败';
      case STATES.CAN_CLAIM: return '可领取';
      case STATES.PENDING: return '待执行';
      default: return this.state;
    }
  }

  toJSON() {
    return {
      task: this.task,
      state: this.state,
      statusMessage: this.getStatusMessage(),
      isTerminal: this.isTerminal,
      history: this.history,
    };
  }
}

module.exports = { TaskStateMachine, STATES };
