class CodeforcesAPIService {
  constructor() {
    this.API_BASE = 'https://codeforces.com/api/';
  }

  async _fetchWithCheck(url, errorMessage) {
    try {
      const response = await fetch(url);
      
      if (response.status === 429) {
        throw new Error('Codeforces API rate limit exceeded. Please wait a moment.');
      }
      
      if (response.status >= 500) {
        throw new Error('Codeforces is currently down or experiencing issues.');
      }

      if (!response.ok) {
        throw new Error(`${errorMessage} (HTTP ${response.status})`);
      }

      const data = await response.json();
      
      if (data.status !== 'OK') {
        // "comment" field usually contains the error details from CF
        throw new Error(data.comment || errorMessage); 
      }
      
      return data.result;
    } catch (error) {
       // If it's already an Error with a message, rethrow. Otherwise make generic.
       throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  async getUserInfo(handle) {
    const result = await this._fetchWithCheck(
      `${this.API_BASE}user.info?handles=${handle}`, 
      'User not found or API error'
    );
    return result[0];
  }

  async getUserSubmissions(handle) {
    return this._fetchWithCheck(
      `${this.API_BASE}user.status?handle=${handle}`,
      'Failed to fetch submissions'
    );
  }

  async getRecentSubmissions(handle, count) {
    try {
      return await this._fetchWithCheck(
        `${this.API_BASE}user.status?handle=${handle}&from=1&count=${count}`,
        'Failed to fetch recent submissions'
      );
    } catch (error) {
      // Non-critical background update, duplicate existing behavior of returning empty array on failure
      // but log it for debugging
      console.warn('Quick recheck validation failed:', error);
      return [];
    }
  }

  async getProblemset() {
    return (await this._fetchWithCheck(
      `${this.API_BASE}problemset.problems`,
      'Failed to fetch problemset'
    )).problems;
  }

  async getContests() {
    // API returns 'result' which is the array
    return this._fetchWithCheck(
      `${this.API_BASE}contest.list?gym=false`,
      'Failed to fetch contest list'
    );
  }
}
