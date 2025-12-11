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

    // Listen for updates from the background script
    browser.runtime.onMessage.addListener((message) => {
      const { command, payload } = message;
      if (command === 'timerTick' || command === 'syncState') {
        this.appState.setState({ 
          activeTimers: payload.activeTimers,
          solvedProblems: payload.solvedProblems 
        });
      }
    });

    // Request initial state from the background script
    const initialState = await browser.runtime.sendMessage({ command: 'requestSync' });
    this.appState.setState({ 
      activeTimers: initialState.activeTimers,
      solvedProblems: initialState.solvedProblems
    });

    const data = await browser.storage.local.get(['lastHandle', 'yearFilter']);
    const currentYear = new Date().getFullYear();
    this.appState.setState({ 
      handle: data.lastHandle, 
      yearFilter: data.yearFilter || { from: 2020, to: currentYear } 
    });
    this.uiManager.setInitialValues(data.lastHandle, this.appState.getState().yearFilter);
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

      const history = await this.repository.getHistory(handle);
      const today = new Date().toISOString().split('T')[0];
      const todaysProblems = Object.values(history).filter(p => p.recommendedOn === today);

      const count = todaysProblems.length === 0 ? 3 : 1;
      const recommendationOrder = todaysProblems.length === 0 ? 1 : Math.max(...todaysProblems.map(p => p.recommendationOrder)) + 1;

      const [userData, problems, contestData] = await Promise.all([
        this.repository.getUserData(handle),
        this.repository.getProblemset(),
        this.repository.getContestData()
      ]);
      this.appState.setState({ userData });

      const yearRange = this.uiManager.getYearFilter();

      const recommendations = this.recommendationService.generateRecommendations({
        problems,
        solvedList: userData.solvedList,
        userRating: userData.rating,
        yearRange: yearRange,
        contestData
      }, count);

      if (recommendations.length === 0) {
        return this.uiManager.showStatus('No new problems found. Try again later.', 'error');
      }

      await this.repository.saveHistory(handle, recommendations, recommendationOrder);
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
    this.uiManager.startRefreshAnimation();
    try {
      const userData = await this.repository.getUserData(handle, true);
      await this.stopTimersForSolvedProblems(handle, userData);
      await this.repository.updateSolvedStatus(handle, userData);
      await this.loadHistory(handle);
      this.uiManager.showStatus('Re-check complete!', '');
    } catch (error) {
      this.uiManager.showStatus(error.message, 'error');
    } finally {
      this.uiManager.stopRefreshAnimation();
    }
  }

  async loadHistory(handle) {
    if (!handle) {
      this.appState.setState({ history: null, userData: null });
      return;
    }
    try {
      const userData = await this.repository.getUserData(handle);
      await this.stopTimersForSolvedProblems(handle, userData);
      await this.repository.updateSolvedStatus(handle, userData);
      const history = await this.repository.getHistory(handle);
      this.appState.setState({ history, userData });
    } catch (error) {
      console.error('Error loading history:', error);
      this.appState.setState({ history: null, userData: null });
      this.uiManager.showStatus(error.message, 'error');
    }
  }

  async handleExportData() {
    try {
      const data = await browser.storage.local.get(null);
      await browser.runtime.sendMessage({ 
        command: 'downloadData', 
        payload: { data } 
      });
    } catch (error) {
      console.error('Export failed:', error);
      this.uiManager.showStatus('Export init failed: ' + error.message, 'error');
    }
  }

  async handleImportData(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      
      // Basic validation
      if (typeof json !== 'object') throw new Error('Invalid JSON format');
      
      this.uiManager.showStatus('Importing...', 'loading');

      // Delegate to background script
      await browser.runtime.sendMessage({ 
        command: 'importData', 
        payload: { data: json } 
      });
      
      this.uiManager.showStatus('Import successful! Reloading...', '');
      
      // Reload state
      await this.init();
      
    } catch (error) {
      console.error('Import failed:', error);
      this.uiManager.showStatus('Import failed: ' + error.message, 'error');
    }
  }

  handleStartTimer(problemId) {
    browser.runtime.sendMessage({ command: 'startTimer', payload: { problemId } });
  }

  async stopTimersForSolvedProblems(handle, userData) {
    const state = this.appState.getState();
    const activeTimers = state.activeTimers;
    let historyUpdated = false;

    for (const problemId in activeTimers) {
      if (userData.solvedList.includes(problemId)) {
        const startTime = activeTimers[problemId].startTime;
        const solveTime = Math.floor((Date.now() - startTime) / 1000); // solveTime in seconds

        await this.repository.markProblemAsSolved(handle, problemId, solveTime);
        historyUpdated = true;
        
        browser.runtime.sendMessage({ command: 'stopTimer', payload: { problemId, handle } });
      }
    }

  }
}
