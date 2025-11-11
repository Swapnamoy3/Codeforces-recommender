class CodeforcesAPIService {
  constructor() {
    this.API_BASE = 'https://codeforces.com/api/';
  }

  async getUserInfo(handle) {
    const response = await fetch(`${this.API_BASE}user.info?handles=${handle}`);
    const data = await response.json();
    if (data.status !== 'OK') {
      throw new Error('User not found');
    }
    return data.result[0];
  }

  async getUserSubmissions(handle) {
    const response = await fetch(`${this.API_BASE}user.status?handle=${handle}`);
    const data = await response.json();
    if (data.status !== 'OK') {
      throw new Error('Failed to fetch submissions');
    }
    return data.result;
  }

  async getRecentSubmissions(handle, count) {
    const response = await fetch(`${this.API_BASE}user.status?handle=${handle}&from=1&count=${count}`);
    const data = await response.json();
    if (data.status !== 'OK') {
      // Don't throw an error here, as it's not critical
      return [];
    }
    return data.result;
  }

  async getProblemset() {
    const response = await fetch(`${this.API_BASE}problemset.problems`);
    const data = await response.json();
    if (data.status !== 'OK') {
      throw new Error('Failed to fetch problemset');
    }
    return data.result.problems;
  }

  async getContests() {
    const response = await fetch(`${this.API_BASE}contest.list?gym=false`);
    const data = await response.json();
    if (data.status !== 'OK') {
      throw new Error('Failed to fetch contest list');
    }
    return data.result;
  }
}
