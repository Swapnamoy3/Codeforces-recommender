class RecommendationService {
  constructor() {
    this.strategy = null;
  }

  setStrategy(strategy) {
    this.strategy = strategy;
  }

  generateRecommendations(params) {
    if (!this.strategy) {
      throw new Error('Recommendation strategy not set');
    }
    return this.strategy.execute(params);
  }
}
