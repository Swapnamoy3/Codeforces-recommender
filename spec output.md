# Specification Output: Codeforces Problem Recommender Pro

This document details the refactoring and new features implemented in the Codeforces Problem Recommender Pro extension.

## 1. Project Refactoring: A Modern Architecture

The entire extension was refactored from a single procedural script (`popup.js`) into a modular, object-oriented architecture following a **Controller/Service/Repository** pattern. This new structure enhances maintainability, testability, and scalability.

The new modules are:

-   **`App.js` (Controller):** The central coordinator of the application. It initializes all other modules, binds UI events to their respective handlers, and manages the overall application flow.

-   **`UIManager.js` (View):** Responsible for all DOM manipulations. It receives data from the `AppState` and renders the UI accordingly. It is the only module that directly interacts with the HTML elements.

-   **`CodeforcesAPIService.js` (Service):** Handles all communication with the Codeforces API. It provides methods for each API endpoint, abstracting the `fetch` calls away from the rest of the application.

-   **`CodeforcesRepository.js` (Repository):** The single source of truth for all application data. It uses the `CodeforcesAPIService` to fetch data and `browser.storage.local` for caching. All caching logic is encapsulated within this module.

-   **`AppState.js` (State):** A reactive state container that holds the application's state. It implements the Observer pattern, allowing other modules (like the `UIManager`) to subscribe to state changes and react accordingly.

## 2. Feature 1: Pluggable Recommendation Engine

The recommendation logic was refactored to use the **Strategy pattern**, making it easy to switch between different recommendation algorithms.

-   **`RecommendationService.js`:** The "Context" for the strategy pattern. It has a `setStrategy` method to select a recommendation algorithm and a `generateRecommendations` method that delegates the work to the current strategy.

-   **`RatingBasedStrategy.js`:** The default strategy, which contains the original recommendation logic (filtering problems by the user's rounded rating).

-   **`TopicAnalysisStrategy.js`:** A placeholder for a future recommendation strategy.

This design allows for new recommendation algorithms to be added with minimal changes to the existing codebase.

## 3. Feature 2: Problem Timer with Reactive State

A problem timer was implemented using the **Observer pattern** for a reactive UI.

### How the Timer Works:

1.  **Starting the Timer:** When the user clicks the "Start Timer" button on a recommended problem, the `UIManager` dispatches an action to update the `AppState`. The `activeTimer` property in the state is set to an object containing the `problemId` and `startTime`.

2.  **Updating the Timer Display:** The `UIManager` is subscribed to the `AppState`. When the state changes, its `render` method is called. If the `activeTimer` is present in the state, the `UIManager` displays the timer and starts a `setInterval` to update the elapsed time every second.

3.  **Stopping the Timer:** The timer stops in one of two ways:
    -   **Manual Re-check:** When the user clicks the manual re-check button, the `CodeforcesRepository` fetches the latest submissions. If the solved problem matches the `problemId` in the `activeTimer` state, the `activeTimer` is set to `null`.
    -   **Automatic Re-check:** The same logic applies during the automatic re-check that happens when loading the history.

    When `activeTimer` becomes `null`, the `UIManager`'s `render` method is called again, and it automatically hides the timer display.

This reactive approach ensures that the UI is always a reflection of the application's state, without direct calls from the business logic to the UI.

## 4. Data Caching and Re-checking

The extension uses a sophisticated caching strategy to minimize API calls and provide a fast user experience.

### Caching Durations:

-   **Full Re-check (24 hours):** A full re-check of all a user's submissions and the entire problemset is performed every 24 hours.
-   **Quick Re-check (5 minutes):** A quick re-check of the user's most recent 20 submissions is performed every 5 minutes.

### Re-check Mechanisms:

-   **Automatic Re-check:** When the user's data is requested (e.g., when loading the history), the `CodeforcesRepository` checks the timestamps of the cached data. If the cache is stale (older than the defined durations), it automatically fetches fresh data from the API.

-   **Manual Re-check:** The user can force a quick re-check by clicking the refresh icon next to their handle. This is useful for immediately updating their solved status after solving a problem. This action triggers the `handleManualRecheck` function in `App.js`, which calls `repository.getUserData(handle, true)`, forcing a quick check.

This multi-layered caching and re-checking mechanism ensures that the data is kept reasonably up-to-date without overwhelming the Codeforces API.

---
# PART 2 & 3 Updates

## 5. Multi-Timer System & UI Bug Fix

The timer functionality was significantly enhanced to support multiple, independent timers, and a critical UI bug was resolved.

### Multi-Timer System:

-   **`AppState.js` Modification:** The state was changed from a single `activeTimer` object to an `activeTimers` map. This map's keys are `problemId`s, and its values are objects containing the `startTime`, allowing multiple timers to run concurrently.

-   **`App.js` Controller Logic:** The controller was updated to manage the `activeTimers` map. The `handleStartTimer` function now adds a new timer to the map only if one isn't already running for that problem. The `checkActiveTimers` logic was updated to correctly remove timers from the map when a problem is solved.

-   **`UIManager.js` Rendering:** The UI was refactored to render timers **within each problem's list item**. The global timer display was removed. The `createProblemElement` function now checks if a timer is active for the specific problem it's rendering and displays either the running timer or a "Start Timer" button.

### UI Bug Fix:

-   **Synchronized Rendering:** A bug was fixed where the "Today's Recommendations" list did not visually update when a problem was solved. The `UIManager`'s main `render()` method now acts as the single source of truth for all UI updates. It re-renders both the "Today's Recommendations" and the main "History" list from the same, consistent `AppState` object every time a change is detected, ensuring the UI is always in sync.

## 6. Persistent Timers & Enhanced Solved State UI

This major architectural change introduced a background script to ensure timers persist even when the popup is closed and to provide a richer user experience for solved problems.

### Persistent Timers via Background Script:

-   **`background.js`:** A new background script was created to be the **single source of truth for all timer data**. It manages the `activeTimers` object and persists it to `browser.storage.local` to survive browser restarts.

-   **Browser Alarms:** The unreliable `setInterval` was replaced with the `browser.alarms` API. A single, repeating alarm (`timerUpdate`) is created when timers are active, firing every second to ensure reliable updates.

-   **Popup/Background Communication:** A messaging system using `browser.runtime.sendMessage` and `browser.runtime.onMessage` was established. The popup sends commands like `startTimer` and `stopTimer` to the background, and the background sends `timerTick` and `syncState` messages back to keep the popup's UI updated.

-   **Refactored Popup Logic:** The popup's `App.js` and `AppState.js` were refactored. They no longer "own" the timer state but instead hold a local, synchronized copy. On initialization, the popup requests the current state from the background script and then listens for periodic updates.

### Enhanced Solved Problem UI:

-   **Data Structure Update:** The `history` object for each user was modified. When a problem is solved, it now stores the `solveTime` (in seconds) and a `solvedOn` timestamp.

-   **`UIManager.js` Rendering:** The UI was significantly improved.
    -   For solved problems, the "Start Timer" button is replaced with a green "✓ Solved" indicator.
    -   If a `solveTime` is available, it is displayed next to the solved indicator (e.g., "✓ Solved in: 01:15").
    -   This provides clear, persistent feedback on user performance.

These changes create a more robust, reliable, and user-friendly experience, making the extension a more powerful tool for Codeforces practice.
---

## 7. Bug Fix: Persistent Solve Time Storage

A bug was identified where the calculated `solveTime` for a problem was not being correctly saved, meaning the enhanced UI for solved problems could not display the final time. This was fixed by correcting the data flow between the controller (`App.js`) and the data layer (`CodeforcesRepository.js`).

### `CodeforcesRepository.js` (Data Layer Fix)

-   A new method, `markProblemAsSolved(handle, problemId, solveTime)`, was implemented in the repository.
-   This method is now the single point of truth for marking a problem as solved. It performs the following actions:
    1.  Retrieves the current user history from storage.
    2.  Finds the specific problem that was solved.
    3.  Updates the problem's `status` to `'solved'`.
    4.  **Crucially, it adds the `solveTime` (in seconds) and a `solvedOn` timestamp to the problem's data object.**
    5.  Saves the entire updated history object back to `browser.storage.local`.
-   A `console.log` was added for easier debugging during development.

### `App.js` (Controller & UI Refresh Fix)

-   The `stopTimersForSolvedProblems` method in the main controller was updated to orchestrate the fix.
-   When a solved problem is detected (by comparing the `activeTimers` list with the user's latest submissions), the controller now:
    1.  Calculates the `solveTime` in seconds by comparing the `startTime` with the current time.
    2.  Calls the new `this.repository.markProblemAsSolved(...)` method, passing the `solveTime`.
    3.  Uses a `historyUpdated` flag to determine if the UI needs to be refreshed.
-   After checking all active timers, if the `historyUpdated` flag is `true`, the controller calls `this.loadHistory(handle)`. This re-fetches the now-updated data from the repository and triggers a full re-render of the UI, ensuring that the "Solved in: HH:MM:SS" message appears immediately without requiring a manual refresh.
---

## 8. Feature: Incremental Daily Recommendations

To create a more engaging "progressive challenge," the recommendation workflow was overhauled. Instead of a single batch of three problems per day, the system now provides an initial batch of three, and once those are solved, the user can request additional problems one at a time for the rest of the day.

### `CodeforcesRepository.js` (Data Model Enhancement)

-   The `saveHistory` method was updated to accept a `recommendationOrder` parameter.
-   When a problem is saved to the user's history, it now includes the `recommendationOrder` property (e.g., `1` for the initial batch, `2` for the next, and so on). This is the key data point that drives the new logic.

### `App.js` (Controller Logic Update)

-   The `handleGetRecs` method was significantly updated to manage the new incremental logic:
    1.  It first analyzes the user's history to find problems recommended on the current day.
    2.  If no problems have been recommended today, it sets the number of problems to fetch to `3` and the `recommendationOrder` to `1`.
    3.  If problems already exist for today, it sets the number of problems to fetch to `1` and calculates the next `recommendationOrder` by finding the max existing order and adding 1.
    4.  It then calls the recommendation service with the correct `count` and saves the new problems with the correct `recommendationOrder`.
-   The `updateGetRecsButtonState` method was removed from `App.js` to avoid duplication, as this logic is correctly handled by `UIManager.js`.

### `RatingBasedStrategy.js` (Service-Level Change)

-   The `execute` method in the recommendation strategy was modified to accept a `count` parameter, with a default value of `3`.
-   The final step of the method now uses this `count` parameter (`.slice(0, count)`) to return the requested number of problems, making the service flexible for the controller's needs.

### `UIManager.js` (UI and Rendering Logic)

-   The `renderTodaysRecs` method was updated to improve the presentation of daily recommendations:
    1.  **Sorting:** Problems in the "Today's Recommendations" section are now sorted primarily by `recommendationOrder` in descending order, and secondarily by `rating` in ascending order. This ensures that newly requested single problems appear at the top.
    2.  **Visual Segmentation:** The method now inserts a header (e.g., "Recommendation Batch #2") before each group of problems with a new `recommendationOrder`. This creates a clear visual separation between the initial batch and subsequent single recommendations.
-   The existing `updateGetRecsButtonState` method in `UIManager` correctly handles enabling/disabling the "Get Recommendations" button. It is called automatically on every render, and it enables the button only if all of today's recommendations have been solved.