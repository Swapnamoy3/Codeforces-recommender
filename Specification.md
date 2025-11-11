
# PART 1
---

### **Specification Document: Refactoring and Feature Enhancement for Codeforces Problem Recommendation Extension**

#### **1. Project Overview**

This project involves refactoring a procedural browser extension into a modern, object-oriented architecture. The goal is to improve maintainability, testability, and scalability. After the refactor, two new key features will be added: an advanced, pluggable recommendation engine and a problem-solving timer. The server-side component mentioned in previous discussions is **out of scope** for this task.

**Current State:** A single `popup.js` file with global functions handling API calls, caching, business logic, and DOM manipulation.
**Target State:** A modular, class-based application with clear separation of concerns.

---

#### **2. Core Architectural Goal: The Refactor**

The primary objective is to restructure the application into distinct, single-responsibility modules. The target architecture should follow a Controller/Service/Repository pattern.

**2.1. Required Modules and Their Responsibilities:**

*   **`App.js` (Controller):**
    *   Acts as the central coordinator.
    *   Initializes all other modules.
    *   Binds event listeners from the UI to handler methods.
    *   Orchestrates the flow of data between the repository, services, and the UI.

*   **`UIManager.js` (View Layer):**
    *   Contains all references to DOM elements.
    *   Is solely responsible for all DOM manipulations (e.g., `.textContent`, `.innerHTML`, `.classList`).
    *   Provides methods to render data (e.g., `renderHistory(data)`, `showStatus(message, type)`).
    *   Contains methods to attach event listeners, with the callbacks provided by `App.js`.

*   **`services/CodeforcesAPIService.js`:**
    *   Handles all direct `fetch` calls to the Codeforces API (`https://codeforces.com/api/`).
    *   Each API endpoint should have its own method (e.g., `getUserInfo`, `getSubmissions`).
    *   Methods should handle the response, check for `status: "OK"`, and return the `result` property or throw an error on failure. It should not contain any caching logic.

*   **`repository/CodeforcesRepository.js`:**
    *   Acts as the single source of truth for all application data.
    *   It will use `CodeforcesAPIService` to fetch fresh data and `browser.storage.local` for caching.
    *   All caching logic (e.g., `FULL_RECHECK_DURATION`, `QUICK_RECHECK_DURATION`) must be encapsulated within this repository.
    *   The rest of the application (e.g., the `App` controller) must only request data from this repository, never from the API service or storage directly.
    *   Implement methods like `getUserData(handle, forceCheck)`, `getProblemset()`, and `getContestData()`.

**2.2. Refactoring Steps:**

1.  Create the file and directory structure as described above.
2.  Migrate all `fetch` calls from the original script into `CodeforcesAPIService.js`.
3.  Migrate all DOM-related code (`document.getElementById`, `.innerHTML`, etc.) into `UIManager.js`.
4.  Consolidate all data fetching, caching, and `browser.storage` logic from the original `getUserData`, `getProblemset`, etc., functions into `CodeforcesRepository.js`.
5.  Rewrite the event handlers (`handleGetRecs`, `handleClearHistory`, etc.) inside the `App.js` controller. These methods should now be lean, delegating tasks to the repository and UI manager.
6.  Create a `popup.js` entry point that simply instantiates and initializes the `App` class.

---

#### **3. Feature 1: Pluggable Recommendation Engine (Strategy Pattern)**

**Goal:** Replace the hardcoded recommendation logic with a flexible system that allows different recommendation algorithms to be used interchangeably.

**3.1. Technical Requirements:**

1.  **Create `services/RecommendationService.js`:**
    *   This class will be the "Context" for the pattern.
    *   It must have a `setStrategy(strategy)` method to accept a strategy object.
    *   It must have a `generateRecommendations(params)` method that calls the `execute` method on the currently set strategy object, passing along the necessary parameters.

2.  **Create the `services/recommendation/strategies/` directory:**
    *   Inside, create `**RatingBasedStrategy.js**`. This class will contain the *current* recommendation logic (filtering problems by the user's rounded rating ± a range). It must have a single public method: `execute({ problems, solvedList, userRating, minYear, contestData })`.
    *   Create a placeholder file `**TopicAnalysisStrategy.js**`. It should have the same class structure and an `execute` method that currently returns an empty array `[]`. This will be implemented in the future.

3.  **Integration:**
    *   In `App.js`, instantiate the `RecommendationService` and the `RatingBasedStrategy`.
    *   Use `setStrategy` to set the `RatingBasedStrategy` as the default.
    *   When the "Get Recommendations" button is clicked, the controller should call `recommendationService.generateRecommendations(...)` to get the problem list.

---

#### **4. Feature 2: Problem Timer with Reactive State (Observer Pattern)**

**Goal:** Implement a timer that can be started for a recommended problem and stops on a successful submission. The UI for the timer should update reactively based on changes to a central state object.

**4.1. Technical Requirements:**

1.  **Create `state/AppState.js`:**
    *   This class will manage the application's state.
    *   It must hold a private state object with initial values, e.g., `{ handle: null, userData: null, activeTimer: null }`. The `activeTimer` property, when not null, should be an object like `{ problemId: '123A', startTime: 167... }`.
    *   It must have a `setState(newState)` method that merges the `newState` object with the current state. After updating, it must notify all subscribers.
    *   It must have a `subscribe(callback)` method that adds a function to a list of subscribers.
    *   It must have a `getState()` method that returns a copy of the current state.

2.  **Integrate `AppState` with `UIManager` and `App`:**
    *   The `App` controller will instantiate `AppState` and pass the instance to the `UIManager` constructor.
    *   The `UIManager` will `subscribe` to `AppState` in its constructor. The callback provided should be its own main `render` method.
    *   The `UIManager`'s `render` method will be responsible for drawing the *entire* UI based on the data it gets from `appState.getState()`. This includes showing/hiding/updating the timer display based on the `activeTimer` property in the state.

3.  **Implement Timer Logic:**
    *   **Starting the Timer:** Add a "Start Timer" button to each recommended problem in the UI. When clicked, the event handler in `App.js` should call `appState.setState({ activeTimer: { ... } })`. It should NOT call a UI method directly.
    *   **Updating the Timer Display:** The `UIManager`'s `render` method, triggered by the state change, will create the timer display and use a `setInterval` to update the elapsed time. The `setInterval` should be cleared and reset every time `render` is called to avoid memory leaks.
    *   **Stopping the Timer:** The `handleManualRecheck` and submission-checking logic in the `CodeforcesRepository` should now also check if the newly solved problem matches the `problemId` in `appState.getState().activeTimer`. If it does, the `App` controller should be notified (e.g., via a return value or event), and it will then call `appState.setState({ activeTimer: null })`. The UI will react automatically and hide the timer.

---
---
---

# PART 2
---
Excellent feedback. These are crucial usability improvements. The current implementation has a single global timer, but you're describing a system that needs to manage multiple, independent timers—one for each problem. We also need to fix the UI update bug for "Today's" recommendations.

Here is the updated specification document that addresses these three points directly. Give this to the AI.

---

### **Specification Update: Multi-Timer System and UI Bug Fix**

This document details required modifications to the **Problem Timer** feature and a bug fix for the **UI rendering logic**.

#### **1. Multi-Timer System (Feature Modification)**

**Current Behavior:** The application supports only one global timer. Clicking "Start Timer" on any problem overwrites the existing timer. The timer display is in a single, fixed location.

**Required Behavior:**
1.  Each recommended problem must be able to have its own independent timer.
2.  Clicking "Start Timer" on a problem that already has a running timer should have no effect.
3.  The timer display for a specific problem must appear within that problem's list item, not in a global location.
4.  A user can have multiple timers running simultaneously for different problems.

**Implementation Plan:**

**1.1. Modify `AppState.js` State Structure:**
*   The state property `activeTimer` must be changed to `activeTimers`.
*   Instead of being a single object or `null`, `activeTimers` must be an **object that acts as a map**.
*   The keys of this map will be the `problemId` (e.g., `'158A'`), and the values will be an object containing the `startTime`.

    **Example State:**
    ```javascript
    // Before (Old Structure)
    {
      activeTimer: { problemId: '158A', startTime: 167... }
    }

    // After (New Structure)
    {
      activeTimers: {
        '158A': { startTime: 167... }, // Timer running for problem 158A
        '71A': { startTime: 167... }   // Timer running for problem 71A
      }
    }
    ```

**1.2. Update `App.js` Controller Logic:**
*   Modify the "Start Timer" event handler.
*   When the handler is called for a given `problemId`:
    1.  Get the current `activeTimers` map from `appState.getState()`.
    2.  Check if `activeTimers[problemId]` already exists. **If it does, do nothing and return.**
    3.  If it does not exist, create a new `activeTimers` map by copying the old one and adding the new entry: `newTimers[problemId] = { startTime: Date.now() }`.
    4.  Call `appState.setState({ activeTimers: newTimers })`.

*   Modify the "Stop Timer" logic (after a problem is solved).
    1.  When a solved problem with `solvedProblemId` is detected, get the current `activeTimers` map.
    2.  Check if `activeTimers[solvedProblemId]` exists. If it doesn't, do nothing.
    3.  If it does, create a new `activeTimers` map by copying the old one and **deleting the key** for `solvedProblemId`.
    4.  Call `appState.setState({ activeTimers: newTimers })`.

**1.3. Update `UIManager.js` Rendering Logic:**
*   Modify the `render` method and any sub-methods that render problem lists (`renderTodaysRecs`, `renderHistory`).
*   When rendering each individual problem item, the function must now get the `activeTimers` map from the state: `const timers = appState.getState().activeTimers;`.
*   For each problem with `problemId`, it must check if `timers[problemId]` exists.
    *   If it exists, a timer display must be rendered **inside that specific problem's HTML element**. The timer's elapsed time should be calculated based on `timers[problemId].startTime`. The "Start Timer" button for this problem should be disabled or hidden.
    *   If it does not exist, the timer display for that problem must be hidden or removed.

---

#### **2. UI Bug Fix: Synchronize "Today's Recommendations" and "History" Status**

**Current Behavior:** When a problem from the "Today's Recommendations" list is solved, the checkmark/solved status appears on the item in the main "History" list, but not on the corresponding item in the "Today's Recommendations" list at the top.

**Required Behavior:** The solved status must be reflected consistently across the entire UI. When a problem is marked as solved, it must appear as solved in **both** the "Today's Recommendations" section and the main "History" list simultaneously.

**Implementation Plan:**

**2.1. Unify the Rendering Logic in `UIManager.js`:**
*   The root cause is likely that the `renderTodaysRecsList` and `renderHistoryList` functions are separate and not re-rendering in sync.
*   The main `render()` method in `UIManager.js` should be the single source of truth for all UI updates.
*   When `appState` notifies the `UIManager` of any change (e.g., history data was updated with a new solved status), the `render()` method should be responsible for re-drawing **both** the "Today's" section and the "History" section.

**2.2. Ensure Consistent Data Source:**
*   Both the "Today's" list and the "History" list should be generated from the **same, up-to-date data source** from the `AppState`.
*   In the `render()` method:
    1.  Get the full history object from `appState.getState().history`.
    2.  Filter this single source of truth to get today's problems.
    3.  Pass today's problems to a function that renders the "Today's Recommendations" list.
    4.  Pass the full history object to a function that renders the main history list.

By re-rendering both sections from the same state object every time a change occurs, the UI will always be consistent.

---
---
---


# PART 3
---
Of course. These are excellent points that address the extension's lifecycle and user experience. You've identified two major issues:

1.  **Lack of Persistence:** The timer state is lost when the popup closes because its JavaScript context is destroyed.
2.  **Poor UX for Solved Problems:** The feedback for a solved problem is unclear, and the valuable timing data is discarded.

We need to make the timer persistent by using a **background script** and improve the UI by storing and displaying the final solve time.

Here is the updated specification document. This is a significant architectural change, so the instructions are detailed.

---

### **Specification Update: Persistent Timers and Enhanced Solved State UI**

This document outlines the implementation of a persistent timer system using a background script and major UX improvements for displaying solved problems.

#### **1. Persistent Timers via Background Script (Architectural Change)**

**Goal:** Timers must continue running even when the extension popup is closed. The state must be persisted and synchronized between the popup and a background process.

**Implementation Plan:**

**1.1. Create a Background Script (`background.js`):**
*   This script will be the **single source of truth for all timer data**. The popup's `AppState` will now be a temporary, synchronized copy.
*   In the `manifest.json`, define the background script:
    ```json
    "background": {
      "scripts": ["background.js"],
      "persistent": false
    },
    "permissions": ["storage", "alarms"]
    ```
*   The background script will manage the `activeTimers` object. It will store this object in `browser.storage.local` whenever it changes to ensure it survives browser restarts.

**1.2. Manage Timers with Browser Alarms:**
*   A `setInterval` in a non-persistent background script is unreliable. We must use the `browser.alarms` API to reliably update the UI.
*   In `background.js`, create a single, repeating alarm that fires every second when at least one timer is running.
    ```javascript
    // In background.js
    function updateAlarms(activeTimers) {
      const hasTimers = Object.keys(activeTimers).length > 0;
      if (hasTimers) {
        browser.alarms.create('timerUpdate', { periodInMinutes: 1 / 60 });
      } else {
        browser.alarms.clear('timerUpdate');
      }
    }
    ```
*   Create a listener for this alarm. When `browser.alarms.onAlarm` fires, the background script will send a message to the popup (if it's open) with the latest timer data.

**1.3. Establish Communication Between Popup and Background:**
*   The popup and background script will communicate using the `browser.runtime.sendMessage` and `browser.runtime.onMessage` APIs.
*   **Popup -> Background:** The popup will send messages to start or stop a timer.
    *   `{ command: 'startTimer', payload: { problemId } }`
    *   `{ command: 'stopTimer', payload: { problemId, solveTime } }`
*   **Background -> Popup:** The background will send messages to the popup to provide the initial state and to send periodic updates.
    *   `{ command: 'syncState', payload: { activeTimers, solvedProblems } }`
    *   `{ command: 'timerTick', payload: { activeTimers } }` (Sent every second via the alarm)

**1.4. Refactor `App.js` and `AppState.js` (Popup Script):**
*   The popup's `AppState` no longer owns the timer state. It simply holds a local copy.
*   On popup initialization (`App.init`), it must send a message to the background script like `{ command: 'requestSync' }`.
*   The background script will respond with the current `activeTimers` and `solvedProblems` data, which the popup will use to initialize its `AppState`.
*   The `App.js` controller will now use `browser.runtime.sendMessage` to start/stop timers instead of modifying its local state directly.
*   The `App.js` will set up a `browser.runtime.onMessage` listener to handle `timerTick` and `syncState` messages from the background, updating its local `AppState` accordingly. This will trigger the reactive UI updates.

---

#### **2. Enhanced Solved Problem UI & Data Storage**

**Goal:** When a problem is solved, clearly indicate its solved status, display the final solve time, and persist this information.

**Implementation Plan:**

**2.1. Modify the Data Structure for Solved Problems:**
*   The `history` object stored for each user in `browser.storage.local` needs to be updated.
*   When a problem's status changes from `'recommended'` to `'solved'`, two new properties must be added:
    *   `solveTime`: The elapsed time in seconds (or a formatted string like "HH:MM:SS").
    *   `solvedOn`: The timestamp when the problem was solved.

    **Example History Item:**
    ```javascript
    // In browser.storage.local -> history_handle -> problemKey
    {
      // ... existing properties (contestId, index, name, rating)
      status: 'solved',
      recommendedOn: '2023-10-27',
      solveTime: 3615, // e.g., 1 hour, 0 minutes, 15 seconds
      solvedOn: 1698436800000
    }
    ```

**2.2. Update the "Stop Timer" Logic:**
*   When a solved problem is detected (in `App.js`, after getting data from the repository), the controller must:
    1.  Get the `activeTimers` state.
    2.  If a timer was running for the solved problem, calculate the `solveTime` (`Date.now() - startTime`).
    3.  Send a `stopTimer` message to the background script.
    4.  **Crucially, update the problem's entry in the user's history in `browser.storage.local`**, adding the `solveTime` and `solvedOn` properties. This action will be done in the repository, triggered by the controller.

**2.3. Update `UIManager.js` Rendering Logic:**
*   Modify the function that renders problem items (for both "Today's" and "History" lists).
*   For each problem, it must now check the `status`.
    *   **If `status === 'solved'`:**
        1.  **Do not show the "Start Timer" button.**
        2.  Render a clear visual indicator, such as a green checkmark icon (`✓`) and a "Solved" label.
        3.  If the problem has a `solveTime` property, display it prominently (e.g., `Solved in: 01:00:15`).
    *   **If `status === 'recommended'`:**
        1.  Check the `activeTimers` map. If a timer is running, display the running time.
        2.  If no timer is running, display the "Start Timer" button.

This new architecture ensures timers are robust and survive the popup closing. The UI changes provide much clearer feedback to the user, making the extension feel more polished and useful by preserving their performance data.

---