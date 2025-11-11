class AppState {
  constructor() {
    this.state = {
      handle: null,
      userData: null,
      history: null,
      activeTimers: {},
      yearFilter: '2020',
    };
    this.subscribers = [];
  }

  getState() {
    return this.state;
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  notify() {
    this.subscribers.forEach(callback => callback());
  }
}
