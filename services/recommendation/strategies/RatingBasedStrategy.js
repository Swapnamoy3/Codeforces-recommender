class RatingBasedStrategy {
  execute({ problems, solvedList, userRating, yearRange, contestData }, count = 3) {
    const roundedRating = Math.floor(userRating / 100) * 100;
    const targetMin = roundedRating;
    const targetMax = roundedRating + 200;
    
    const candidates = problems.filter(p => {
      if (!p.rating || p.rating < targetMin || p.rating > targetMax) return false;
      if (solvedList.includes(`${p.contestId}${p.index}`)) return false;
      
      if (p.contestId) {
        const contestYear = contestData[p.contestId];
        // Apply year range filter only if contest year is known
        if (contestYear) {
          if (yearRange.from && contestYear < yearRange.from) return false;
          if (yearRange.to && contestYear > yearRange.to) return false;
        }
      }
      
      return true;
    });
    
    return candidates.sort(() => Math.random() - 0.5).slice(0, count);
  }
}
