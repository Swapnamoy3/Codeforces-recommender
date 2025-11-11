class RatingBasedStrategy {
  execute({ problems, solvedList, userRating, minYear, contestData }, count = 3) {
    const roundedRating = Math.floor(userRating / 100) * 100;
    const targetMin = roundedRating;
    const targetMax = roundedRating + 200;
    
    const candidates = problems.filter(p => {
      if (!p.rating || p.rating < targetMin || p.rating > targetMax) return false;
      if (solvedList.includes(`${p.contestId}${p.index}`)) return false;
      
      if (minYear > 0 && p.contestId) {
        const contestYear = contestData[p.contestId];
        if (!contestYear || contestYear < minYear) {
          return false;
        }
      }
      
      return true;
    });
    
    return candidates.sort(() => Math.random() - 0.5).slice(0, count);
  }
}
