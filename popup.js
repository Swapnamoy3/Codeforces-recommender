// Constants
const API_BASE = 'https://codeforces.com/api/';
const PROBLEMSET_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const USER_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// DOM Elements
const handleInput = document.getElementById('handleInput');
const getRecsBtn = document.getElementById('getRecsBtn');
const yearFilter = document.getElementById('yearFilter');
const userInfo = document.getElementById('userInfo');
const todaysRecs = document.getElementById('todaysRecs');
const todaysRecsList = document.getElementById('todaysRecsList');
const historyCard = document.getElementById('historyCard');
const historyHeader = document.getElementById('historyHeader');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const status = document.getElementById('status');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // --- Collapsible History Logic ---
  historyCard.classList.add('collapsed'); // Start collapsed by default
  historyHeader.addEventListener('click', () => {
    historyCard.classList.toggle('collapsed');
  });
  
  // Load last used handle and year filter
  const data = await browser.storage.local.get(['lastHandle', 'yearFilter']);
  
  if (data.lastHandle) {
    handleInput.value = data.lastHandle;
    // Load history will now render both today's and past problems
    await loadAndRenderHistory(data.lastHandle);
  }
  
  if (data.yearFilter) {
    yearFilter.value = data.yearFilter;
  }

  // Always check the button state on initialization
  await updateGetRecsButtonState();

  // --- Other Event Listeners ---
  getRecsBtn.addEventListener('click', handleGetRecs);
  clearHistoryBtn.addEventListener('click', handleClearHistory);
  
  handleInput.addEventListener('input', async (e) => {
    const handle = e.target.value.trim();
    await loadAndRenderHistory(handle);
    await updateGetRecsButtonState();
  });
  
  yearFilter.addEventListener('change', async () => {
    await browser.storage.local.set({ yearFilter: yearFilter.value });
  });
}


// Main recommendation flow
async function handleGetRecs() {
  const handle = handleInput.value.trim();
  if (!handle) {
    showStatus('Please enter a Codeforces handle', 'error');
    return;
  }

  try {
    showStatus('Loading...', 'loading');
    getRecsBtn.disabled = true;

    await browser.storage.local.set({ lastHandle: handle });
    const userData = await getUserData(handle);
    const roundedRating = Math.floor(userData.rating / 100) * 100;
    
    userInfo.textContent = `Handle: ${handle} | Rating: ${userData.rating} (Recommending for ~${roundedRating})`;
    userInfo.classList.remove('hidden');

    const problems = await getProblemset();
    const minYear = yearFilter.value === 'all' ? 0 : parseInt(yearFilter.value);
    const recommendations = generateRecommendations(problems, userData.solvedList, roundedRating, minYear);

    if (recommendations.length === 0) {
      showStatus('No new problems found in your rating range. Try again later.', 'error');
      return;
    }

    await saveToHistory(handle, recommendations);
    await loadAndRenderHistory(handle); // Re-render UI
    showStatus('');

  } catch (error) {
    console.error(error);
    showStatus(error.message || 'An error occurred', 'error');
  } finally {
    await updateGetRecsButtonState(); // Update button based on new history
  }
}

// Renders a list of problems to a specified container
function renderProblemList(containerElement, problems) {
  containerElement.innerHTML = '';
  problems.forEach(problem => {
    const item = document.createElement('div');
    item.className = `problem-item ${problem.status === 'solved' ? 'solved' : ''}`;
    
    // Add solved checkmark if needed
    if (problem.status === 'solved') {
      item.innerHTML = `
        <div class="problem-header">
          <a href="https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}" target="_blank" class="problem-name">${problem.name}</a>
          <span class="problem-rating">${problem.rating}</span>
        </div>
        <div class="problem-id">${problem.contestId}${problem.index}</div>
      `;
    } else {
      item.innerHTML = `
        <div class="problem-header">
          <a href="https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}" target="_blank" class="problem-name">${problem.name}</a>
          <span class="problem-rating">${problem.rating}</span>
        </div>
        <div class="problem-id">${problem.contestId}${problem.index}</div>
      `;
    }
    containerElement.appendChild(item);
  });
}

// Main function to load, split, and render history
async function loadAndRenderHistory(handle) {
  if (!handle) {
    todaysRecs.classList.add('hidden');
    historyList.innerHTML = '';
    return;
  }

  try {
    await updateSolvedStatus(handle); // Always update status first
    const historyKey = `history_${handle}`;
    const data = await browser.storage.local.get(historyKey);
    const history = Object.values(data[historyKey] || {});

    const todayStr = new Date().toISOString().split('T')[0];
    
    const todaysProblems = history
      .filter(p => p.recommendedOn === todayStr)
      .sort((a, b) => a.rating - b.rating);
      
    const pastProblems = history.filter(p => p.recommendedOn !== todayStr);

    // Render Today's Recommendations
    if (todaysProblems.length > 0) {
      renderProblemList(todaysRecsList, todaysProblems);
      todaysRecs.classList.remove('hidden');
    } else {
      todaysRecs.classList.add('hidden');
    }
    
    // Render Past History
    if (pastProblems.length === 0) {
      historyList.innerHTML = '<div class="empty-history">No past recommendations</div>';
      return;
    }

    // Group past problems by date
    const grouped = {};
    pastProblems.forEach(problem => {
      if (!grouped[problem.recommendedOn]) {
        grouped[problem.recommendedOn] = [];
      }
      grouped[problem.recommendedOn].push(problem);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    historyList.innerHTML = ''; // Clear previous history render
    
    dates.forEach(date => {
      const dateGroup = document.createElement('div');
      dateGroup.className = 'history-date-group';
      const d = new Date(date);
      dateGroup.innerHTML = `<div class="history-date-header">${d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>`;
      
      const problemsForDate = grouped[date].sort((a, b) => a.rating - b.rating);
      
      problemsForDate.forEach(problem => {
        const item = document.createElement('div');
        item.className = `history-item ${problem.status === 'solved' ? 'solved' : ''}`;
        item.innerHTML = `
          <div class="problem-header">
            <a href="https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}" target="_blank" class="problem-name">${problem.name}</a>
            <span class="problem-rating">${problem.rating}</span>
          </div>
          <div class="problem-id">${problem.contestId}${problem.index}</div>
        `;
        dateGroup.appendChild(item);
      });
      historyList.appendChild(dateGroup);
    });

  } catch (error) {
    console.error('Error loading history:', error);
  }
}

async function handleClearHistory() {
  const handle = handleInput.value.trim();
  if (!handle) {
    showStatus('Please enter a handle first', 'error');
    return;
  }

  if (!confirm(`Are you sure you want to clear all history for ${handle}?`)) {
    return;
  }

  const historyKey = `history_${handle}`;
  await browser.storage.local.remove(historyKey);
  
  await loadAndRenderHistory(handle); // Re-render to show empty state
  showStatus('History cleared');
  
  await updateGetRecsButtonState(); // Re-enable button
  setTimeout(() => showStatus(''), 2000);
}

// --- UTILITY AND API FUNCTIONS (largely unchanged) ---

async function getUserData(handle) {
  const cacheKey = 'userCache';
  const cache = await browser.storage.local.get(cacheKey);
  if (cache[cacheKey]?.[handle] && (Date.now() - cache[cacheKey][handle].timestamp < USER_CACHE_DURATION)) {
    return cache[cacheKey][handle];
  }
  const [infoResponse, statusResponse] = await Promise.all([
    fetch(`${API_BASE}user.info?handles=${handle}`),
    fetch(`${API_BASE}user.status?handle=${handle}`)
  ]);
  const infoData = await infoResponse.json();
  const statusData = await statusResponse.json();
  if (infoData.status !== 'OK') throw new Error('User not found');
  if (statusData.status !== 'OK') throw new Error('Failed to fetch user submissions');
  const solvedSet = new Set(
    statusData.result
      .filter(s => s.verdict === 'OK')
      .map(s => `${s.problem.contestId}${s.problem.index}`)
  );
  const userData = {
    rating: infoData.result[0].rating || 0,
    solvedList: Array.from(solvedSet),
    timestamp: Date.now()
  };
  const newCache = cache[cacheKey] || {};
  newCache[handle] = userData;
  await browser.storage.local.set({ [cacheKey]: newCache });
  return userData;
}

async function getProblemset() {
  const cacheKey = 'problemsetCache';
  const cache = await browser.storage.local.get(cacheKey);
  if (cache[cacheKey]?.problems && (Date.now() - cache[cacheKey].timestamp < PROBLEMSET_CACHE_DURATION)) {
    return cache[cacheKey].problems;
  }
  const response = await fetch(`${API_BASE}problemset.problems`);
  const data = await response.json();
  if (data.status !== 'OK') throw new Error('Failed to fetch problemset');
  const problems = data.result.problems;
  await browser.storage.local.set({ [cacheKey]: { problems, timestamp: Date.now() } });
  return problems;
}

function generateRecommendations(problems, solvedList, roundedRating, minYear = 0) {
  const targetMin = roundedRating;
  const targetMax = roundedRating + 200;
  const candidates = problems.filter(p => {
    if (!p.rating || p.rating < targetMin || p.rating > targetMax) return false;
    if (minYear > 0 && p.contestId) {
      const approxYear = Math.floor(p.contestId / 100) + 2000;
      if (approxYear < minYear) return false;
    }
    return !solvedList.includes(`${p.contestId}${p.index}`);
  });
  return candidates.sort(() => Math.random() - 0.5).slice(0, 3);
}

async function saveToHistory(handle, recommendations) {
  const historyKey = `history_${handle}`;
  const data = await browser.storage.local.get(historyKey);
  const history = data[historyKey] || {};
  const today = new Date().toISOString().split('T')[0];
  recommendations.forEach(problem => {
    const key = `${problem.contestId}${problem.index}`;
    history[key] = { ...problem, status: 'recommended', recommendedOn: today };
  });
  await browser.storage.local.set({ [historyKey]: history });
}

async function updateSolvedStatus(handle) {
  try {
    const userData = await getUserData(handle);
    const historyKey = `history_${handle}`;
    const data = await browser.storage.local.get(historyKey);
    const history = data[historyKey] || {};
    let updated = false;
    Object.keys(history).forEach(key => {
      if (userData.solvedList.includes(key) && history[key].status === 'recommended') {
        history[key].status = 'solved';
        updated = true;
      }
    });
    if (updated) {
      await browser.storage.local.set({ [historyKey]: history });
    }
  } catch (error) {
    console.error('Error updating solved status:', error);
  }
}

async function updateGetRecsButtonState() {
  const handle = handleInput.value.trim();
  if (!handle) {
    getRecsBtn.disabled = false;
    return;
  }
  const historyKey = `history_${handle}`;
  const data = await browser.storage.local.get(historyKey);
  const history = data[historyKey] || {};
  const today = new Date().toISOString().split('T')[0];
  const todaysRecs = Object.values(history).filter(p => p.recommendedOn === today);
  if (todaysRecs.length === 0) {
    getRecsBtn.disabled = false;
    return;
  }
  const allSolved = todaysRecs.every(p => p.status === 'solved');
  getRecsBtn.disabled = !allSolved;
}

function showStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`;
}