class UIManager {
  constructor(appState) {
    this.appState = appState;
    this.appState.subscribe(this.render.bind(this));

    this.handleInput = document.getElementById('handleInput');
    this.getRecsBtn = document.getElementById('getRecsBtn');
    this.yearFilter = document.getElementById('yearFilter');
    this.userInfo = document.getElementById('userInfo');
    this.userInfoText = document.getElementById('userInfoText');
    this.manualRecheckBtn = document.getElementById('manualRecheckBtn');
    this.todaysRecs = document.getElementById('todaysRecs');
    this.todaysRecsList = document.getElementById('todaysRecsList');
    this.historyCard = document.getElementById('historyCard');
    this.historyHeader = document.getElementById('historyHeader');
    this.historyList = document.getElementById('historyList');
    this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
    this.status = document.getElementById('status');
    
    this.historyCard.classList.add('collapsed');
    this.timerIntervals = {};
  }

  bindEvents(controller) {
    this.controller = controller; // Store controller instance
    this.historyHeader.addEventListener('click', () => this.historyCard.classList.toggle('collapsed'));
    this.getRecsBtn.addEventListener('click', controller.handleGetRecs.bind(controller));
    this.clearHistoryBtn.addEventListener('click', controller.handleClearHistory.bind(controller));
    this.manualRecheckBtn.addEventListener('click', controller.handleManualRecheck.bind(controller));
    this.handleInput.addEventListener('input', (e) => controller.handleInputChange(e.target.value.trim()));
    this.yearFilter.addEventListener('change', (e) => controller.handleYearFilterChange(e.target.value));
  }

  render() {
    // Clear all running timer intervals before re-rendering
    Object.values(this.timerIntervals).forEach(clearInterval);
    this.timerIntervals = {};

    const state = this.appState.getState();
    this.renderUserInfo(state.handle, state.userData);
    this.renderTodaysRecs(state.history, state.activeTimers);
    this.renderHistory(state.history, state.activeTimers);
    this.updateGetRecsButtonState(state.handle, state.history);
  }

  renderUserInfo(handle, userData) {
    if (handle && userData) {
      const roundedRating = Math.floor(userData.rating / 100) * 100;
      this.userInfoText.textContent = `Handle: ${handle} | Rating: ${userData.rating} (Recommending for ~${roundedRating})`;
      this.userInfo.classList.remove('hidden');
    } else {
      this.userInfo.classList.add('hidden');
    }
  }

  renderHistory(history, activeTimers) {
    if (!history || Object.keys(history).length === 0) {
      this.historyList.innerHTML = '<div class="empty-history">No recommendations yet</div>';
      return;
    }

    const allProblems = Object.values(history);
    const grouped = {};
    allProblems.forEach(problem => {
      if (!grouped[problem.recommendedOn]) grouped[problem.recommendedOn] = [];
      grouped[problem.recommendedOn].push(problem);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    this.historyList.innerHTML = '';
    const todayStr = new Date().toISOString().split('T')[0];

    dates.forEach(date => {
      const dateGroup = document.createElement('div');
      dateGroup.className = 'history-date-group';
      const headerText = (date === todayStr) ? 'Today' : new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      
      const headerElement = document.createElement('div');
      headerElement.className = 'history-date-header';
      headerElement.textContent = headerText;
      dateGroup.appendChild(headerElement);
      
      grouped[date].sort((a, b) => a.rating - b.rating).forEach(problem => {
        // Today's problems in the history view should also have timer capabilities
        const isToday = date === todayStr;
        dateGroup.appendChild(this.createProblemElement(problem, isToday, activeTimers));
      });
      this.historyList.appendChild(dateGroup);
    });
  }

  renderTodaysRecs(history, activeTimers) {
    if (!history) {
      this.todaysRecs.classList.add('hidden');
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysProblems = Object.values(history).filter(p => p.recommendedOn === todayStr).sort((a, b) => a.rating - b.rating);
    
    this.todaysRecsList.innerHTML = '';
    if (todaysProblems.length > 0) {
      todaysProblems.forEach(problem => {
        this.todaysRecsList.appendChild(this.createProblemElement(problem, true, activeTimers));
      });
      this.todaysRecs.classList.remove('hidden');
    } else {
      this.todaysRecs.classList.add('hidden');
    }
  }

  createProblemElement(problem, withTimer, activeTimers) {
    const problemId = `${problem.contestId}${problem.index}`;
    const item = document.createElement('div');
    item.className = `problem-item ${problem.status === 'solved' ? 'solved' : ''}`;
    
    const headerElement = document.createElement('div');
    headerElement.className = 'problem-header';

    const nameElement = document.createElement('a');
    nameElement.href = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
    nameElement.target = '_blank';
    nameElement.className = 'problem-name';
    nameElement.textContent = problem.name;
    headerElement.appendChild(nameElement);

    const ratingElement = document.createElement('span');
    ratingElement.className = 'problem-rating';
    ratingElement.textContent = problem.rating;
    headerElement.appendChild(ratingElement);
    item.appendChild(headerElement);

    const idElement = document.createElement('div');
    idElement.className = 'problem-id';
    idElement.textContent = problemId;
    item.appendChild(idElement);

    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';
    item.appendChild(timerContainer);

    const timer = activeTimers[problemId];

    if (withTimer && problem.status !== 'solved') {
      if (timer) {
        const timerDisplay = document.createElement('div');
        timerDisplay.className = 'timer-display';
        
        const update = () => {
          const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
          const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
          const seconds = (elapsed % 60).toString().padStart(2, '0');
          timerDisplay.textContent = `${minutes}:${seconds}`;
        };
        update();
        this.timerIntervals[problemId] = setInterval(update, 1000);
        timerContainer.appendChild(timerDisplay);

      } else {
        const timerButton = document.createElement('button');
        timerButton.textContent = 'Start Timer';
        timerButton.className = 'start-timer-btn';
        timerButton.addEventListener('click', () => {
          this.controller.handleStartTimer(problemId);
        });
        timerContainer.appendChild(timerButton);
      }
    }

    return item;
  }

  updateGetRecsButtonState(handle, history) {
    if (!handle) {
      this.getRecsBtn.disabled = false;
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const todaysRecs = Object.values(history || {}).filter(p => p.recommendedOn === today);
    if (todaysRecs.length === 0) {
      this.getRecsBtn.disabled = false;
      return;
    }
    this.getRecsBtn.disabled = !todaysRecs.every(p => p.status === 'solved');
  }

  showStatus(message, type = '') {
    this.status.textContent = message;
    this.status.className = `status ${type}`;
    if (message) {
      setTimeout(() => this.showStatus(''), 2000);
    }
  }

  getHandle() {
    return this.handleInput.value.trim();
  }

  getYearFilter() {
    return this.yearFilter.value;
  }

  setInitialValues(handle, yearFilter) {
    if (handle) this.handleInput.value = handle;
    if (yearFilter) this.yearFilter.value = yearFilter;
  }
}
