class App {
  constructor() {
    this.appState = new AppState();
    this.uiManager = new UIManager(this.appState);
    this.apiService = new CodeforcesAPIService();
    this.repository = new CodeforcesRepository(this.apiService);
    this.recommendationService = new RecommendationService();
    this.recommendationService.setStrategy(new RatingBasedStrategy());
  }

  async init() {
    this.uiManager.bindEvents(this);
    const data = await browser.storage.local.get(['lastHandle', 'yearFilter']);
    this.appState.setState({ handle: data.lastHandle, yearFilter: data.yearFilter || '2020' });
    this.uiManager.setInitialValues(data.lastHandle, data.yearFilter);
    if (data.lastHandle) {
      await this.loadHistory(data.lastHandle);
    }
  }

  async handleInputChange(handle) {
    this.appState.setState({ handle });
    await this.loadHistory(handle);
  }

  async handleYearFilterChange(yearFilter) {
    this.appState.setState({ yearFilter });
    await browser.storage.local.set({ yearFilter });
  }

  async handleGetRecs() {
    const handle = this.uiManager.getHandle();
    if (!handle) return this.uiManager.showStatus('Please enter a Codeforces handle', 'error');

    try {
      this.uiManager.showStatus('Loading...', 'loading');
      await browser.storage.local.set({ lastHandle: handle });
      
      const [userData, problems, contestData] = await Promise.all([
          this.repository.getUserData(handle),
          this.repository.getProblemset(),
          this.repository.getContestData()
      ]);
      this.appState.setState({ userData });
      
      const recommendations = this.recommendationService.generateRecommendations({
        problems,
        solvedList: userData.solvedList,
        userRating: userData.rating,
        minYear: this.uiManager.getYearFilter() === 'all' ? 0 : parseInt(this.uiManager.getYearFilter()),
        contestData
      });

      if (recommendations.length === 0) {
        return this.uiManager.showStatus('No new problems found. Try again later.', 'error');
      }

      await this.repository.saveHistory(handle, recommendations);
      await this.loadHistory(handle);
      this.uiManager.showStatus('');

    } catch (error) {
      console.error(error);
      this.uiManager.showStatus(error.message || 'An error occurred', 'error');
    }
  }

  async handleClearHistory() {
    const handle = this.uiManager.getHandle();
    if (!handle) return this.uiManager.showStatus('Please enter a handle first', 'error');
    if (!confirm(`Are you sure you want to clear all history for ${handle}?`)) return;
    
    await this.repository.clearHistory(handle);
    await this.loadHistory(handle);
    this.uiManager.showStatus('History cleared');
  }

  async handleManualRecheck() {
    const handle = this.uiManager.getHandle();
    if (!handle) return;
    
    this.uiManager.showStatus('Re-checking recent submissions...', 'loading');
    try {
      await this.repository.getUserData(handle, true);
      const updated = await this.repository.updateSolvedStatus(handle);
      if (updated) {
        await this.checkActiveTimer(handle);
      }
      await this.loadHistory(handle);
      this.uiManager.showStatus('Re-check complete!', '');
    } catch (error) {
      this.uiManager.showStatus(error.message, 'error');
    }
  }

  async loadHistory(handle) {
    if (!handle) {
      this.appState.setState({ history: null, userData: null });
      return;
    }
    try {
      await this.repository.updateSolvedStatus(handle);
      const [history, userData] = await Promise.all([
        this.repository.getHistory(handle),
        this.repository.getUserData(handle)
      ]);
      this.appState.setState({ history, userData });
    } catch (error) {
      console.error('Error loading history:', error);
      this.appState.setState({ history: null, userData: null });
      this.uiManager.showStatus(error.message, 'error');
    }
  }

  async checkActiveTimer(handle) {
    const state = this.appState.getState();
    if (state.activeTimer) {
      const userData = await this.repository.getUserData(handle);
      if (userData.solvedList.includes(state.activeTimer.problemId)) {
        this.appState.setState({ activeTimer: null });
      }
    }
  }
}
