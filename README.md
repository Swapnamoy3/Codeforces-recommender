# Codeforces Problem Recommender Pro

A powerful browser extension designed to enhance your Codeforces problem-solving experience. This extension has been refactored into a modern, object-oriented architecture to improve maintainability, testability, and scalability, offering advanced problem recommendations and a robust multi-problem timer system.

## Features

### Modern Architecture
The extension is built upon a modular **Controller/Service/Repository** pattern, ensuring a clear separation of concerns:
-   **`App.js` (Controller):** Coordinates application flow, initializes modules, and handles UI event binding.
-   **`UIManager.js` (View):** Manages all DOM manipulations and renders the UI based on application state.
-   **`CodeforcesAPIService.js` (Service):** Handles all direct interactions with the Codeforces API.
-   **`CodeforcesRepository.js` (Repository):** The single source of truth for application data, managing caching and data persistence.
-   **`AppState.js` (State):** A reactive state container implementing the Observer pattern for dynamic UI updates.

### Pluggable Recommendation Engine
Utilizing the **Strategy pattern**, the extension offers a flexible recommendation system:
-   **`RecommendationService.js`:** The context for selecting and executing different recommendation algorithms.
-   **`RatingBasedStrategy.js`:** The default strategy, recommending problems based on the user's rating.
-   **`TopicAnalysisStrategy.js`:** A placeholder for future, more advanced recommendation algorithms.

### Multi-Problem Timer with Persistent State
Track your problem-solving time with an advanced timer system:
-   **Independent Timers:** Each recommended problem can have its own independent timer.
-   **Reactive UI:** Timer displays update in real-time within each problem's list item.
-   **Persistent Timers:** Timers continue running even when the extension popup is closed, managed by a background script and `browser.alarms`.
-   **Enhanced Solved State:** When a problem is solved, the UI clearly indicates its status, displaying the exact `solveTime` and `solvedOn` timestamp.

### Data Caching & Re-checking
A sophisticated caching mechanism minimizes API calls and ensures data freshness:
-   **Full Re-check (24 hours):** Comprehensive update of user submissions and problemset data.
-   **Quick Re-check (5 minutes):** Frequent update of recent user submissions.
-   **Automatic & Manual Re-check:** Data is automatically refreshed when stale, and users can force a manual re-check.

### Incremental Daily Recommendations
Engage with a progressive challenge system for daily practice:
-   **Initial Batch:** Receive an initial set of three recommended problems.
-   **Incremental Unlocks:** Once the initial problems are solved, request additional problems one at a time.
-   **Visual Segmentation:** The UI clearly separates recommendation batches, with newer problems appearing at the top.

## Installation

To install this extension in your browser:
1.  Download or clone this repository.
2.  Open your browser's extension management page (e.g., `chrome://extensions` for Chrome, `about:addons` for Firefox).
3.  Enable "Developer mode" (if applicable).
4.  Click "Load unpacked" (or similar) and select the directory where you downloaded the extension.

## Usage

1.  Open the extension popup.
2.  Enter your Codeforces handle.
3.  Click "Get Recommendations" to receive problems tailored to your rating.
4.  Start a timer for any problem you begin solving.
5.  The extension will automatically detect solved problems and stop the timer, displaying your solve time.

## Contributing

This project's modular design makes it easy to contribute. Feel free to fork the repository, implement new features (like the `TopicAnalysisStrategy`), fix bugs, or improve the UI.

---
