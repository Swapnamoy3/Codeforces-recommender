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
