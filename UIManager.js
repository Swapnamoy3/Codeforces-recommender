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

        this.exportBtn = document.getElementById('exportBtn');
        this.importBtn = document.getElementById('importBtn');
        this.importFile = document.getElementById('importFile');
        
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

        if (this.exportBtn) this.exportBtn.addEventListener('click', controller.handleExportData.bind(controller));
        if (this.importBtn) {
            this.importBtn.addEventListener('click', () => {
                browser.tabs.create({ url: 'import.html' });
            });
        }
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
        // Safe replacement for innerHTML
        this.userInfoText.textContent = ''; 
        
        if (handle && userData) {
            const textStart = document.createTextNode('Logged in as ');
            const boldHandle = document.createElement('b');
            boldHandle.textContent = handle;
            const textEnd = document.createTextNode(` (${userData.rating})`);

            this.userInfoText.appendChild(textStart);
            this.userInfoText.appendChild(boldHandle);
            this.userInfoText.appendChild(textEnd);
            
            this.userInfo.classList.remove('hidden');
        } else {
            this.userInfo.classList.add('hidden');
        }
    }

    renderHistory(history, activeTimers) {
        // Clear existing content safely
        this.historyList.textContent = '';

        if (!history || Object.keys(history).length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'text-center';
            emptyState.style.padding = '12px';
            emptyState.style.color = 'var(--slate-400)';
            emptyState.textContent = 'No recommendations yet';
            this.historyList.appendChild(emptyState);
            return;
        }

        const allProblems = Object.values(history);
        const grouped = {};
        allProblems.forEach(problem => {
            if (!grouped[problem.recommendedOn]) grouped[problem.recommendedOn] = [];
            grouped[problem.recommendedOn].push(problem);
        });

        const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
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
        
        // Safe clear
        this.todaysRecsList.textContent = '';
        
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
        
        item.className = 'problem-card';
        if (problem.status === 'solved') {
            item.classList.add('solved');
        }

        // LEFT: Info
        const infoDiv = document.createElement('div');
        infoDiv.className = 'flex-1';
        infoDiv.style.minWidth = '0';

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
            
            // Add Icon safely
            solvedBadge.appendChild(this.createIcon('check', { width: 12, height: 12, strokeWidth: 3 }));
            
            // Add text safely
            const textSpan = document.createElement('span');
            textSpan.textContent = timeText;
            solvedBadge.appendChild(textSpan);
            
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
                    
                    btn.textContent = ''; // Clear content
                    const icon = this.createIcon('pause', { width: 12, height: 12 });
                    icon.classList.add('icon-pulse');
                    btn.appendChild(icon);
                    btn.appendChild(document.createTextNode(` ${minutes}:${seconds}`));
                };
                updateTimerUI();
                this.timerIntervals[problemId] = setInterval(updateTimerUI, 1000);
            } else {
                btn.className = 'btn-timer';
                btn.appendChild(this.createIcon('play', { width: 12, height: 12 }));
                btn.appendChild(document.createTextNode(' Start'));
                btn.onclick = () => this.controller.handleStartTimer(problemId);
            }
            actionContainer.appendChild(btn);
        }

        item.appendChild(actionContainer);
        return item;
    }

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
            const checkIcon = this.createIcon('check', { width: 16, height: 16, strokeWidth: 3 });
            checkIcon.style.color = 'var(--green-600)';
            iconWrapper.appendChild(checkIcon);
        } else {
            const circleIcon = this.createIcon('circle', { width: 16, height: 16 });
            circleIcon.style.color = 'var(--slate-300)';
            iconWrapper.appendChild(circleIcon);
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
        link.title = problem.name;
        
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
            
            timeSpan.appendChild(this.createIcon('clock', { width: 10, height: 10 }));
            timeSpan.appendChild(document.createTextNode(` ${minutes}:${seconds}`));
            metaDiv.appendChild(timeSpan);
        }

        item.appendChild(metaDiv);
        return item;
    }

    // --- Helper to Create SVGs safely without innerHTML ---
    createIcon(type, options = {}) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", options.width || "24");
        svg.setAttribute("height", options.height || "24");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", options.strokeWidth || "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");

        if (type === 'check') {
            const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            polyline.setAttribute("points", "20 6 9 17 4 12");
            svg.appendChild(polyline);
        } else if (type === 'pause') {
            const r1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r1.setAttribute("x", "6"); r1.setAttribute("y", "4"); r1.setAttribute("width", "4"); r1.setAttribute("height", "16");
            const r2 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            r2.setAttribute("x", "14"); r2.setAttribute("y", "4"); r2.setAttribute("width", "4"); r2.setAttribute("height", "16");
            svg.appendChild(r1);
            svg.appendChild(r2);
        } else if (type === 'play' || type === 'clock') {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "10");
            const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
            
            if (type === 'play') polyline.setAttribute("points", "10 8 16 12 10 16"); // Play Triangle
            else polyline.setAttribute("points", "12 6 12 12 16 14"); // Clock hands
            
            svg.appendChild(circle);
            svg.appendChild(polyline);
        } else if (type === 'circle') {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "10");
            svg.appendChild(circle);
        }

        return svg;
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