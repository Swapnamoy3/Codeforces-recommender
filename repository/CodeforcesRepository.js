class CodeforcesRepository {
  constructor(apiService) {
    this.apiService = apiService;
    this.FULL_RECHECK_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    this.QUICK_RECHECK_DURATION = 5 * 60 * 1000;      // 5 minutes
    this.QUICK_RECHECK_COUNT = 20;
  }

  async getUserData(handle, forceQuickCheck = false) {
    const cacheKey = `userData_${handle}`;
    const cachedData = (await browser.storage.local.get(cacheKey))[cacheKey] || {};
    
    const now = Date.now();
    const isRatingCacheValid = cachedData.ratingTimestamp && (now - cachedData.ratingTimestamp < this.FULL_RECHECK_DURATION);
    const isFullSubmissionCacheValid = cachedData.fullCheckTimestamp && (now - cachedData.fullCheckTimestamp < this.FULL_RECHECK_DURATION);
    const isQuickSubmissionCacheValid = cachedData.quickCheckTimestamp && (now - cachedData.quickCheckTimestamp < this.QUICK_RECHECK_DURATION);

    if (!isRatingCacheValid) {
      const userInfo = await this.apiService.getUserInfo(handle);
      cachedData.rating = userInfo.rating || 0;
      cachedData.ratingTimestamp = now;
    }
    
    let solvedSet = new Set(cachedData.solvedList || []);

    if (!isFullSubmissionCacheValid) {
      const allSubmissions = await this.apiService.getUserSubmissions(handle);
      solvedSet = new Set(
        allSubmissions
          .filter(s => s.verdict === 'OK')
          .map(s => `${s.problem.contestId}${s.problem.index}`)
      );
      cachedData.fullCheckTimestamp = now;
    }
    
    if (forceQuickCheck || !isQuickSubmissionCacheValid) {
      const recentSubmissions = await this.apiService.getRecentSubmissions(handle, this.QUICK_RECHECK_COUNT);
      recentSubmissions
        .filter(s => s.verdict === 'OK')
        .forEach(s => solvedSet.add(`${s.problem.contestId}${s.problem.index}`));
      cachedData.quickCheckTimestamp = now;
    }
    
    cachedData.solvedList = Array.from(solvedSet);
    await browser.storage.local.set({ [cacheKey]: cachedData });
    return cachedData;
  }

  async getProblemset() {
    const cacheKey = 'problemsetCache';
    const cache = (await browser.storage.local.get(cacheKey))[cacheKey];
    if (cache?.problems && (Date.now() - cache.timestamp < this.FULL_RECHECK_DURATION)) {
      return cache.problems;
    }
    const problems = await this.apiService.getProblemset();
    await browser.storage.local.set({ [cacheKey]: { problems: problems, timestamp: Date.now() } });
    return problems;
  }

  async getContestData() {
    const cacheKey = 'contestDataCache';
    const cache = (await browser.storage.local.get(cacheKey))[cacheKey];
    
    if (cache?.contestMap && (Date.now() - cache.timestamp < this.FULL_RECHECK_DURATION)) {
      return cache.contestMap;
    }
    
    const contests = await this.apiService.getContests();
    const contestMap = {};
    contests.forEach(contest => {
      if (contest.startTimeSeconds) {
        const year = new Date(contest.startTimeSeconds * 1000).getFullYear();
        contestMap[contest.id] = year;
      }
    });

    await browser.storage.local.set({ [cacheKey]: { contestMap: contestMap, timestamp: Date.now() } });
    return contestMap;
  }

  async getHistory(handle) {
    const historyKey = `history_${handle}`;
    return (await browser.storage.local.get(historyKey))[historyKey] || {};
  }

  async saveHistory(handle, recommendations) {
    const historyKey = `history_${handle}`;
    const history = await this.getHistory(handle);
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

  async updateSolvedStatus(handle) {
    const userData = await this.getUserData(handle);
    const history = await this.getHistory(handle);
    
    let updated = false;
    Object.keys(history).forEach(key => {
      if (userData.solvedList.includes(key) && history[key].status === 'recommended') {
        history[key].status = 'solved';
        updated = true;
      }
    });
    
    if (updated) {
      const historyKey = `history_${handle}`;
      await browser.storage.local.set({ [historyKey]: history });
    }
    return updated;
  }

  async clearHistory(handle) {
    const historyKey = `history_${handle}`;
    const cacheKey = `userData_${handle}`;
    await browser.storage.local.remove([historyKey, cacheKey]);
  }
}
