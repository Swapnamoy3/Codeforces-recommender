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
    this.timerDisplay = document.getElementById('timerDisplay'); // Assuming you add this to your HTML

    this.historyCard.classList.add('collapsed');
  }

  bindEvents(controller) {
    this.historyHeader.addEventListener('click', () => this.historyCard.classList.toggle('collapsed'));
    this.getRecsBtn.addEventListener('click', controller.handleGetRecs.bind(controller));
    this.clearHistoryBtn.addEventListener('click', controller.handleClearHistory.bind(controller));
    this.manualRecheckBtn.addEventListener('click', controller.handleManualRecheck.bind(controller));
    this.handleInput.addEventListener('input', (e) => controller.handleInputChange(e.target.value.trim()));
    this.yearFilter.addEventListener('change', (e) => controller.handleYearFilterChange(e.target.value));
  }

  render() {
    const state = this.appState.getState();
    this.renderUserInfo(state.handle, state.userData);
    this.renderHistory(state.history);
    this.renderTodaysRecs(state.history);
    this.updateGetRecsButtonState(state.handle, state.history);
    this.renderTimer(state.activeTimer);
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

  renderHistory(history) {
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
        dateGroup.appendChild(this.createProblemElement(problem));
      });
      this.historyList.appendChild(dateGroup);
    });
  }

  renderTodaysRecs(history) {
    if (!history) {
      this.todaysRecs.classList.add('hidden');
      return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysProblems = Object.values(history).filter(p => p.recommendedOn === todayStr).sort((a, b) => a.rating - b.rating);
    
    if (todaysProblems.length > 0) {
      this.todaysRecsList.innerHTML = '';
      todaysProblems.forEach(problem => {
        this.todaysRecsList.appendChild(this.createProblemElement(problem, true));
      });
      this.todaysRecs.classList.remove('hidden');
    } else {
      this.todaysRecs.classList.add('hidden');
    }
  }

  createProblemElement(problem, withTimerButton = false) {
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

    const idElement = document.createElement('div');
    idElement.className = 'problem-id';
    idElement.textContent = `${problem.contestId}${problem.index}`;
    item.appendChild(headerElement);
    item.appendChild(idElement);

    if (withTimerButton && problem.status !== 'solved') {
      const timerButton = document.createElement('button');
      timerButton.textContent = 'Start Timer';
      timerButton.className = 'start-timer-btn';
      timerButton.addEventListener('click', () => {
        this.appState.setState({ activeTimer: { problemId: `${problem.contestId}${problem.index}`, startTime: Date.now() } });
      });
      item.appendChild(timerButton);
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

  renderTimer(activeTimer) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (activeTimer) {
      this.timerDisplay.classList.remove('hidden');
      const update = () => {
        const elapsed = Math.floor((Date.now() - activeTimer.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        this.timerDisplay.textContent = `Timing ${activeTimer.problemId}: ${minutes}:${seconds}`;
      };
      update();
      this.timerInterval = setInterval(update, 1000);
    } else {
      this.timerDisplay.classList.add('hidden');
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
