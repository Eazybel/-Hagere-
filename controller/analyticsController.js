function buildAnalyticsPipeline() {
    const voteCounts = {
        agree: { $ifNull: ["$interactions.votes.agree.count", 0] },
        neutral: { $ifNull: ["$interactions.votes.neutral.count", 0] },
        disagree: { $ifNull: ["$interactions.votes.disagree.count", 0] }
    }

    return [
        {
            $project: {
                title: 1,
                category: 1,
                createdAt: 1,
                voteCounts: { $add: [voteCounts.agree, voteCounts.neutral, voteCounts.disagree] },
                agreeVotes: voteCounts.agree,
                neutralVotes: voteCounts.neutral,
                disagreeVotes: voteCounts.disagree,
                commentCount: {
                    $size: { $ifNull: ["$interactions.comments", []] }
                }
            }
        },
        {
            $facet: {
                overview: [
                    {
                        $group: {
                            _id: null,
                            totalPolicies: { $sum: 1 },
                            totalVotes: { $sum: "$voteCounts" },
                            agreeVotes: { $sum: "$agreeVotes" },
                            neutralVotes: { $sum: "$neutralVotes" },
                            disagreeVotes: { $sum: "$disagreeVotes" },
                            totalComments: { $sum: "$commentCount" }
                        }
                    },
                    { $project: { _id: 0 } }
                ],
                topPolicies: [
                    { $sort: { voteCounts: -1, createdAt: -1 } },
                    { $limit: 5 },
                    {
                        $project: {
                            _id: 1,
                            title: 1,
                            category: 1,
                            totalVotes: "$voteCounts"
                        }
                    }
                ]
            }
        }
    ]
}

function createAnalyticsController({ Policy, User }) {
    return async (req, res, next) => {
        try {
            const [aggregation, activeCitizens] = await Promise.all([
                Policy.aggregate(buildAnalyticsPipeline()),
                User.countDocuments({ isActive: true })
            ])

            const overview = aggregation[0]?.overview[0] || {
                totalPolicies: 0,
                totalVotes: 0,
                agreeVotes: 0,
                neutralVotes: 0,
                disagreeVotes: 0,
                totalComments: 0
            }

            return res.status(200).json({
                generatedAt: new Date().toISOString(),
                overview: {
                    ...overview,
                    activeCitizens
                },
                topPolicies: aggregation[0]?.topPolicies || []
            })
        } catch (error) {
            return next(error)
        }
    }
}

module.exports = { buildAnalyticsPipeline, createAnalyticsController }
