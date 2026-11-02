/**
 * @file voteState.mjs
 * @description Provides a reversible optimistic update for policy stance counters.
 * @module Client/VoteState
 * @requires No external dependencies
 */
const validStances = new Set(["agree", "neutral", "disagree"])

/**
 * Updates the selected stance count and returns a rollback callback for failed requests.
 * @param {{agree:number,neutral:number,disagree:number}} counts Mutable displayed stance counters.
 * @param {"agree"|"neutral"|"disagree"} stance Selected policy vote.
 * @returns {() => void} Restores the previous counters when the server rejects the vote.
 * @throws {TypeError} If stance is not a supported vote value.
 */
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
