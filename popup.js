// Constants
const API_BASE = 'https://codeforces.com/api/';
const FULL_RECHECK_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const QUICK_RECHECK_DURATION = 5 * 60 * 1000;      // 5 minutes
const QUICK_RECHECK_COUNT = 20;                     // Number of recent submissions to check

// DOM Elements
const handleInput = document.getElementById('handleInput');
const getRecsBtn = document.getElementById('getRecsBtn');
const yearFilter = document.getElementById('yearFilter');
const userInfo = document.getElementById('userInfo');
const userInfoText = document.getElementById('userInfoText');
const manualRecheckBtn = document.getElementById('manualRecheckBtn');
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
  historyCard.classList.add('collapsed');
  historyHeader.addEventListener('click', () => historyCard.classList.toggle('collapsed'));
  
  const data = await browser.storage.local.get(['lastHandle', 'yearFilter']);
  if (data.lastHandle) {
    handleInput.value = data.lastHandle;
    await loadAndRenderHistory(data.lastHandle);
  }
  if (data.yearFilter) yearFilter.value = data.yearFilter;

  await updateGetRecsButtonState();

  getRecsBtn.addEventListener('click', handleGetRecs);
  clearHistoryBtn.addEventListener('click', handleClearHistory);
  manualRecheckBtn.addEventListener('click', handleManualRecheck);
  
  handleInput.addEventListener('input', async (e) => {
    const handle = e.target.value.trim();
    await loadAndRenderHistory(handle);
    await updateGetRecsButtonState();
  });
  
  yearFilter.addEventListener('change', () => browser.storage.local.set({ yearFilter: yearFilter.value }));
}

async function handleManualRecheck() {
  const handle = handleInput.value.trim();
  if (!handle) return;
  
  showStatus('Re-checking recent submissions...', 'loading');
  try {
    await updateSolvedStatus(handle, true); // `true` forces the check
    await loadAndRenderHistory(handle);
    await updateGetRecsButtonState();
    showStatus('Re-check complete!', '');
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    setTimeout(() => showStatus(''), 2000);
  }
}

async function handleGetRecs() {
  const handle = handleInput.value.trim();
  if (!handle) return showStatus('Please enter a Codeforces handle', 'error');

  try {
    showStatus('Loading...', 'loading');
    getRecsBtn.disabled = true;

    await browser.storage.local.set({ lastHandle: handle });
    const userData = await getUserData(handle);
    const roundedRating = Math.floor(userData.rating / 100) * 100;
    
    userInfoText.textContent = `Handle: ${handle} | Rating: ${userData.rating} (Recommending for ~${roundedRating})`;
    userInfo.classList.remove('hidden');

    const problems = await getProblemset();
    const minYear = yearFilter.value === 'all' ? 0 : parseInt(yearFilter.value);
    const recommendations = generateRecommendations(problems, userData.solvedList, roundedRating, minYear);

    if (recommendations.length === 0) return showStatus('No new problems found. Try again later.', 'error');

    await saveToHistory(handle, recommendations);
    await loadAndRenderHistory(handle);
    showStatus('');

  } catch (error) {
    console.error(error);
    showStatus(error.message || 'An error occurred', 'error');
  } finally {
    await updateGetRecsButtonState();
  }
}

// *** MAJOR REWRITE: THE `getUserData` FUNCTION NOW HANDLES RATING UPDATES SEPARATELY ***
async function getUserData(handle, forceQuickCheck = false) {
  const cacheKey = `userData_${handle}`;
  const cachedData = (await browser.storage.local.get(cacheKey))[cacheKey] || {};
  
  const now = Date.now();
  const isRatingCacheValid = cachedData.ratingTimestamp && (now - cachedData.ratingTimestamp < FULL_RECHECK_DURATION);
  const isFullSubmissionCacheValid = cachedData.fullCheckTimestamp && (now - cachedData.fullCheckTimestamp < FULL_RECHECK_DURATION);
  const isQuickSubmissionCacheValid = cachedData.quickCheckTimestamp && (now - cachedData.quickCheckTimestamp < QUICK_RECHECK_DURATION);

  // --- Step 1: Update Rating if needed (every 24 hours) ---
  if (!isRatingCacheValid) {
    const infoData = await fetch(`${API_BASE}user.info?handles=${handle}`).then(res => res.json());
    if (infoData.status !== 'OK') throw new Error('User not found');
    cachedData.rating = infoData.result[0].rating || 0;
    cachedData.ratingTimestamp = now;
  }
  
  let solvedSet = new Set(cachedData.solvedList || []);

  // --- Step 2: Perform a FULL submission re-check if needed (every 24 hours) ---
  if (!isFullSubmissionCacheValid) {
    const allSubmissions = await fetch(`${API_BASE}user.status?handle=${handle}`).then(res => res.json());
    if (allSubmissions.status !== 'OK') throw new Error('Failed to fetch submissions');

    solvedSet = new Set(
      allSubmissions.result
        .filter(s => s.verdict === 'OK')
        .map(s => `${s.problem.contestId}${s.problem.index}`)
    );
    cachedData.fullCheckTimestamp = now;
  }
  
  // --- Step 3: Perform a QUICK submission re-check if needed (every 5 mins or forced) ---
  if (forceQuickCheck || !isQuickSubmissionCacheValid) {
    const recentSubmissions = await fetch(`${API_BASE}user.status?handle=${handle}&from=1&count=${QUICK_RECHECK_COUNT}`).then(res => res.json());
    if (recentSubmissions.status === 'OK') {
      recentSubmissions.result
        .filter(s => s.verdict === 'OK')
        .forEach(s => solvedSet.add(`${s.problem.contestId}${s.problem.index}`));
    }
    cachedData.quickCheckTimestamp = now;
  }
  
  // --- Step 4: Save updated data and return ---
  cachedData.solvedList = Array.from(solvedSet);
  await browser.storage.local.set({ [cacheKey]: cachedData });
  return cachedData;
}


async function updateSolvedStatus(handle, force = false) {
  try {
    // This now implicitly handles the smart rating update as well
    const userData = await getUserData(handle, force);
    const historyKey = `history_${handle}`;
    const data = (await browser.storage.local.get(historyKey))[historyKey] || {};
    
    let updated = false;
    Object.keys(data).forEach(key => {
      if (userData.solvedList.includes(key) && data[key].status === 'recommended') {
        data[key].status = 'solved';
        updated = true;
      }
    });
    
    if (updated) {
      await browser.storage.local.set({ [historyKey]: data });
    }
  } catch (error) {
    console.error('Error updating solved status:', error);
    throw error;
  }
}

// --- The functions below this point have no changes ---

async function loadAndRenderHistory(handle) {
  if (!handle) {
    userInfo.classList.add('hidden');
    todaysRecs.classList.add('hidden');
    historyList.innerHTML = '';
    return;
  }
  try {
    await updateSolvedStatus(handle);
    const userData = await getUserData(handle); // Get data to display rating
    userInfoText.textContent = `Handle: ${handle} | Rating: ${userData.rating}`;
    userInfo.classList.remove('hidden');

    const historyKey = `history_${handle}`;
    const allProblems = Object.values((await browser.storage.local.get(historyKey))[historyKey] || {});
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todaysProblems = allProblems.filter(p => p.recommendedOn === todayStr).sort((a, b) => a.rating - b.rating);
    
    if (todaysProblems.length > 0) {
      renderProblemList(todaysRecsList, todaysProblems);
      todaysRecs.classList.remove('hidden');
    } else {
      todaysRecs.classList.add('hidden');
    }
    
    if (allProblems.length === 0) {
      historyList.innerHTML = '<div class="empty-history">No recommendations yet</div>';
      return;
    }

    const grouped = {};
    allProblems.forEach(problem => {
      if (!grouped[problem.recommendedOn]) grouped[problem.recommendedOn] = [];
      grouped[problem.recommendedOn].push(problem);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));
    historyList.innerHTML = '';
    
    dates.forEach(date => {
      const dateGroup = document.createElement('div');
      dateGroup.className = 'history-date-group';
      const headerText = (date === todayStr) ? 'Today' : new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      dateGroup.innerHTML = `<div class="history-date-header">${headerText}</div>`;
      
      grouped[date].sort((a, b) => a.rating - b.rating).forEach(problem => {
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
    userInfo.classList.add('hidden'); // Hide user info on error
    showStatus(error.message, 'error');
  }
}

function renderProblemList(containerElement, problems) {
  containerElement.innerHTML = '';
  problems.forEach(problem => {
    const item = document.createElement('div');
    item.className = `problem-item ${problem.status === 'solved' ? 'solved' : ''}`;
    item.innerHTML = `
      <div class="problem-header">
        <a href="https://codeforces.com/problemset/problem/${problem.contestId}/${problem.index}" target="_blank" class="problem-name">${problem.name}</a>
        <span class="problem-rating">${problem.rating}</span>
      </div>
      <div class="problem-id">${problem.contestId}${problem.index}</div>
    `;
    containerElement.appendChild(item);
  });
}

async function handleClearHistory() {
  const handle = handleInput.value.trim();
  if (!handle) return showStatus('Please enter a handle first', 'error');
  if (!confirm(`Are you sure you want to clear all history for ${handle}?`)) return;
  
  const historyKey = `history_${handle}`;
  const cacheKey = `userData_${handle}`;
  await browser.storage.local.remove([historyKey, cacheKey]);
  
  await loadAndRenderHistory(handle);
  showStatus('History cleared');
  await updateGetRecsButtonState();
  setTimeout(() => showStatus(''), 2000);
}

async function getProblemset() {
  const cacheKey = 'problemsetCache';
  const cache = (await browser.storage.local.get(cacheKey))[cacheKey];
  if (cache?.problems && (Date.now() - cache.timestamp < FULL_RECHECK_DURATION)) {
    return cache.problems;
  }
  const response = await fetch(`${API_BASE}problemset.problems`);
  const data = await response.json();
  if (data.status !== 'OK') throw new Error('Failed to fetch problemset');
  await browser.storage.local.set({ [cacheKey]: { problems: data.result.problems, timestamp: Date.now() } });
  return data.result.problems;
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
  const history = (await browser.storage.local.get(historyKey))[historyKey] || {};
  const today = new Date().toISOString().split('T')[0];
  recommendations.forEach(problem => {
    const key = `${problem.contestId}${problem.index}`;
    history[key] = {
      contestId: problem.contestId,
      index: problem.index,
      name: problem.name,
      rating: problem.rating,
      status: 'recommended',
      recommendedOn: today
    };
  });
  await browser.storage.local.set({ [historyKey]: history });
}

async function updateGetRecsButtonState() {
  const handle = handleInput.value.trim();
  if (!handle) return getRecsBtn.disabled = false;
  const historyKey = `history_${handle}`;
  const history = (await browser.storage.local.get(historyKey))[historyKey] || {};
  const today = new Date().toISOString().split('T')[0];
  const todaysRecs = Object.values(history).filter(p => p.recommendedOn === today);
  if (todaysRecs.length === 0) return getRecsBtn.disabled = false;
  getRecsBtn.disabled = !todaysRecs.every(p => p.status === 'solved');
}

function showStatus(message, type = '') {
  status.textContent = message;
  status.className = `status ${type}`;
}