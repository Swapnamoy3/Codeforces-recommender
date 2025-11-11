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
