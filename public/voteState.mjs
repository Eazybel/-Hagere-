const validStances = new Set(["agree", "neutral", "disagree"])

export function applyOptimisticVote(counts, stance) {
    if (!validStances.has(stance)) {
        throw new TypeError("Invalid voting stance")
    }

    const previousCounts = { ...counts }
    counts[stance] += 1

    return () => {
        Object.assign(counts, previousCounts)
    }
}
