// background.js

let activeTimers = {};
let solvedProblems = {};

// Load state from storage on startup
browser.storage.local.get(['activeTimers', 'solvedProblems']).then(data => {
  activeTimers = data.activeTimers || {};
  solvedProblems = data.solvedProblems || {};
  updateAlarms();
});

function updateAlarms() {
  const hasTimers = Object.keys(activeTimers).length > 0;
  if (hasTimers) {
    browser.alarms.create('timerUpdate', { periodInMinutes: 1 / 60 });
  } else {
    browser.alarms.clear('timerUpdate');
  }
}

browser.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'timerUpdate') {
    browser.runtime.sendMessage({ command: 'timerTick', payload: { activeTimers } });
  }
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { command, payload } = message;

  if (command === 'startTimer') {
    if (!activeTimers[payload.problemId]) {
      activeTimers[payload.problemId] = { startTime: Date.now() };
      browser.storage.local.set({ activeTimers });
      updateAlarms();
    }
  } else if (command === 'stopTimer') {
    if (activeTimers[payload.problemId]) {
      const solveTime = Math.floor((Date.now() - activeTimers[payload.problemId].startTime) / 1000);
      delete activeTimers[payload.problemId];
      
      solvedProblems[payload.problemId] = {
        solveTime: solveTime,
        solvedOn: Date.now()
      };

      browser.storage.local.set({ activeTimers, solvedProblems });
      updateAlarms();
      
      // History update is now handled solely by the UI/App to prevent race conditions.
    }
  } else if (command === 'requestSync') {
    sendResponse({ activeTimers, solvedProblems });
  } else if (command === 'downloadData') {
    const json = JSON.stringify(payload.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    browser.downloads.download({
      url: url,
      filename: `codeforces-recommender-backup-${timestamp}.json`,
      saveAs: true
    });
  } else if (command === 'importData') {
    (async () => {
      try {
        await browser.storage.local.clear();
        
        // Normalize keys and values
        const normalizedData = {};
        for (const [key, value] of Object.entries(payload.data)) {
          let newKey = key;
          let newValue = value;

          if (key.startsWith('history_') || key.startsWith('userData_')) {
            newKey = key.toLowerCase();
          }
          if (key === 'lastHandle' && typeof value === 'string') {
            newValue = value.toLowerCase();
          }
          
          normalizedData[newKey] = newValue;
        }

        await browser.storage.local.set(normalizedData);
        
        // Update local variables in background to match new storage
        const data = await browser.storage.local.get(['activeTimers', 'solvedProblems']);
        activeTimers = data.activeTimers || {};
        solvedProblems = data.solvedProblems || {};
        updateAlarms();
        
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Import Successful',
          message: 'Your data has been successfully restored.'
        });

        sendResponse({ success: true });
      } catch (error) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Import Failed',
          message: error.message || 'Unknown error occurred.'
        });
        sendResponse({ success: false, error: error.message });
      }
    })();
  }
  
  return true; // Indicates that the response is sent asynchronously
});
