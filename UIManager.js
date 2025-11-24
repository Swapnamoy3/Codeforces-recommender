class UIManager {
    constructor(appState) {
        this.appState = appState;
        this.appState.subscribe(this.render.bind(this));

        this.handleInput = document.getElementById('handleInput');
        this.getRecsBtn = document.getElementById('getRecsBtn');
        this.yearFrom = document.getElementById('yearFrom');
        this.yearTo = document.getElementById('yearTo');
        this.userInfo = document.getElementById('userInfo');
        this.userInfoText = document.getElementById('userInfoText');
        this.manualRecheckBtn = document.getElementById('manualRecheckBtn');
        this.todaysRecs = document.getElementById('todaysRecs');
        this.todaysRecsList = document.getElementById('todaysRecsList');
        this.historyCard = document.getElementById('historyCard');
        this.historyHeader = document.getElementById('historyHeader');
        this.historyList = document.getElementById('historyList');
        this.historyToggleIcon = document.getElementById('historyToggleIcon');
        this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
        this.status = document.getElementById('status');
        
        this.timerIntervals = {};
    }

    bindEvents(controller) {
        this.controller = controller;

        this.historyHeader.addEventListener('click', (e) => {
            if (e.target === this.clearHistoryBtn) return;
            
            const isHidden = this.historyList.classList.contains('hidden');
            if (isHidden) {
                this.historyList.classList.remove('hidden');
                this.historyToggleIcon.style.transform = 'rotate(0deg)';
            } else {
                this.historyList.classList.add('hidden');
                this.historyToggleIcon.style.transform = 'rotate(-90deg)';
            }
        });

        this.getRecsBtn.addEventListener('click', controller.handleGetRecs.bind(controller));
        this.clearHistoryBtn.addEventListener('click', controller.handleClearHistory.bind(controller));
        this.manualRecheckBtn.addEventListener('click', controller.handleManualRecheck.bind(controller));
        this.handleInput.addEventListener('input', (e) => controller.handleInputChange(e.target.value.trim()));
        this.yearFrom.addEventListener('input', () => controller.handleYearFilterChange(this.getYearFilter()));
        this.yearTo.addEventListener('input', () => controller.handleYearFilterChange(this.getYearFilter()));
    }

    render() {
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
            this.userInfoText.innerHTML = `Logged in as <b>${handle}</b> (${userData.rating})`;
            this.userInfo.classList.remove('hidden');
        } else {
            this.userInfo.classList.add('hidden');
        }
    }

    renderHistory(history, activeTimers) {
        if (!history || Object.keys(history).length === 0) {
            this.historyList.innerHTML = '<div class="text-center" style="padding:12px; color:var(--slate-400);">No recommendations yet</div>';
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
            dateGroup.style.marginBottom = '12px';
            
            const headerText = (date === todayStr) ? 'Today' : new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            
            const headerElement = document.createElement('div');
            headerElement.className = 'section-label';
            headerElement.textContent = headerText;
            dateGroup.appendChild(headerElement);
            
            grouped[date].sort((a, b) => a.rating - b.rating).forEach(problem => {
                dateGroup.appendChild(this.createHistoryItemElement(problem));
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
        const todaysProblems = Object.values(history)
            .filter(p => p.recommendedOn === todayStr)
            .sort((a, b) => {
                if (a.recommendationOrder !== b.recommendationOrder) {
                    return b.recommendationOrder - a.recommendationOrder;
                }
                return a.rating - b.rating;
            });
        
        this.todaysRecsList.innerHTML = '';
        
        if (todaysProblems.length > 0) {
            let lastOrder = -1;
            todaysProblems.forEach(problem => {
                if (problem.recommendationOrder !== lastOrder) {
                    const header = document.createElement('h4');
                    header.className = 'section-label';
                    header.style.marginTop = '8px';
                    header.textContent = `Batch #${problem.recommendationOrder}`;
                    this.todaysRecsList.appendChild(header);
                    lastOrder = problem.recommendationOrder;
                }
                this.todaysRecsList.appendChild(this.createActiveProblemElement(problem, activeTimers));
            });
            this.todaysRecs.classList.remove('hidden');
        } else {
            this.todaysRecs.classList.add('hidden');
        }
    }

    // --- Active Card (Big) ---
    createActiveProblemElement(problem, activeTimers) {
        const problemId = `${problem.contestId}${problem.index}`;
        const item = document.createElement('div');
        
        // Use css classes defined in popup.css
        item.className = 'problem-card';
        if (problem.status === 'solved') {
            item.classList.add('solved');
        }

        // LEFT: Info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'flex-1';
        infoDiv.style.minWidth = '0'; // Flex truncate fix

        const metaRow = document.createElement('div');
        metaRow.className = 'flex items-center';
        
        const ratingBadge = document.createElement('span');
        ratingBadge.className = 'rating-badge';
        ratingBadge.textContent = problem.rating || 'N/A';
        
        const idSpan = document.createElement('span');
        idSpan.className = 'problem-id';
        idSpan.textContent = problemId;

        metaRow.appendChild(ratingBadge);
        metaRow.appendChild(idSpan);

        const titleLink = document.createElement('a');
        titleLink.href = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
        titleLink.target = '_blank';
        titleLink.className = 'problem-title truncate';
        titleLink.title = problem.name;
        titleLink.textContent = problem.name;

        infoDiv.appendChild(metaRow);
        infoDiv.appendChild(titleLink);
        item.appendChild(infoDiv);

        // RIGHT: Action
        const actionContainer = document.createElement('div');

        if (problem.status === 'solved') {
            const solvedBadge = document.createElement('div');
            solvedBadge.className = 'solved-badge';
            
            let timeText = 'Solved';
            if (problem.solveTime) {
                const minutes = Math.floor(problem.solveTime / 60);
                const seconds = (problem.solveTime % 60).toString().padStart(2, '0');
                timeText = `${minutes}:${seconds}`;
            }
            
            solvedBadge.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>${timeText}</span>
            `;
            actionContainer.appendChild(solvedBadge);

        } else {
            const timer = activeTimers && activeTimers[problemId];
            const btn = document.createElement('button');
            
            if (timer) {
                btn.className = 'btn-timer running';
                const updateTimerUI = () => {
                    const elapsed = Math.floor((Date.now() - timer.startTime) / 1000);
                    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                    const seconds = (elapsed % 60).toString().padStart(2, '0');
                    btn.innerHTML = `
                        <svg class="icon-pulse" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        ${minutes}:${seconds}
                    `;
                };
                updateTimerUI();
                this.timerIntervals[problemId] = setInterval(updateTimerUI, 1000);
            } else {
                btn.className = 'btn-timer';
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Start
                `;
                btn.onclick = () => this.controller.handleStartTimer(problemId);
            }
            actionContainer.appendChild(btn);
        }

        item.appendChild(actionContainer);
        return item;
    }

    // --- History Item (Compact) ---
    // Inside UIManager class ...

  // --- History Item (Redesigned for Clarity) ---
  createHistoryItemElement(problem) {
    const item = document.createElement('div');
    const isSolved = problem.status === 'solved';
    
    // 1. Container
    item.className = 'history-item';
    if (isSolved) item.classList.add('solved');

    // 2. Icon (Left)
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'history-icon-wrapper';
    
    if (isSolved) {
        iconWrapper.innerHTML = `<svg style="color:var(--green-600);" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
        iconWrapper.innerHTML = `<svg style="color:var(--slate-300);" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
    }
    item.appendChild(iconWrapper);

    // 3. Middle Info (Name)
    const infoDiv = document.createElement('div');
    infoDiv.className = 'history-info';
    
    const link = document.createElement('a');
    link.href = `https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}`;
    link.target = '_blank';
    link.className = 'history-name';
    link.textContent = problem.name;
    link.title = problem.name; // Tooltip for long names
    
    infoDiv.appendChild(link);
    item.appendChild(infoDiv);

    // 4. Right Side (Rating Badge ABOVE Time)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'history-meta';

    // Rating Badge
    const ratingBadge = document.createElement('span');
    ratingBadge.className = 'history-rating';
    ratingBadge.textContent = problem.rating || '-';
    metaDiv.appendChild(ratingBadge);

    // Time (only if solved)
    if (isSolved && problem.solveTime) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'history-time';
        const minutes = Math.floor(problem.solveTime / 60);
        const seconds = (problem.solveTime % 60).toString().padStart(2, '0');
        
        // Small clock icon next to time
        timeSpan.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${minutes}:${seconds}
        `;
        metaDiv.appendChild(timeSpan);
    }

    item.appendChild(metaDiv);
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
        
        const allSolved = todaysRecs.every(p => p.status === 'solved');
        this.getRecsBtn.disabled = !allSolved;
    }

    showStatus(message, type = '') {
        this.status.textContent = message;
        
        this.status.className = 'status-footer';
        if (type === 'error') this.status.classList.add('status-error');
        if (type === 'loading') this.status.classList.add('status-loading');

        if (message && type !== 'loading') {
            setTimeout(() => this.showStatus(''), 3000);
        }
    }

    getHandle() { return this.handleInput.value.trim(); }
    getYearFilter() {
        return {
            from: this.yearFrom.value ? parseInt(this.yearFrom.value) : null,
            to: this.yearTo.value ? parseInt(this.yearTo.value) : null
        };
    }
    
    setInitialValues(handle, yearFilter) {
        if (handle) this.handleInput.value = handle;
        if (yearFilter) {
            this.yearFrom.value = yearFilter.from || '';
            this.yearTo.value = yearFilter.to || '';
        }
    }

    startRefreshAnimation() {
        if (this.manualRecheckBtn) {
            this.manualRecheckBtn.classList.add('rotate-animation');
        }
    }

    stopRefreshAnimation() {
        if (this.manualRecheckBtn) {
            this.manualRecheckBtn.classList.remove('rotate-animation');
        }
    }
}