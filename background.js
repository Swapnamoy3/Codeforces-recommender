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
  }
  
  return true; // Indicates that the response is sent asynchronously
});
