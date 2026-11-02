/**
 * @file seedPolicies.js
 * @description Idempotently upserts the Ethiopian policy catalog and retries transient MongoDB DNS/network failures.
 * @module Scripts/PolicySeeder
 * @requires mongoose, dotenv, Policy model, and connectivity classifiers from seedNews
 */
require("dotenv").config({ quiet: true })

const mongoose = require("mongoose")
const Policy = require("../models/Policy")
const {
    DNS_CONNECT_RETRIES,
    DNS_RETRY_DELAY_MS,
    isTransientConnectionError,
    isTransientDnsSrvError,
    isTransientMongoNetworkError
} = require("./seedNews")

const MONGO_CONNECT_TIMEOUT_MS = 15_000
const MOFED_SOURCE = "https://www.mofed.gov.et/"
const POLICY_LIBRARY_SOURCE = "https://www.abyssinialaw.com/online-resources/policies-and-strategies"

const POLICY_SEED_DATA = [
    {
        title: "Citizens' Budget (EFY 2018 / 2025–2026)",
        category: "Economy & Finance",
        description: "A citizen-facing overview of Ethiopia's federal budget for Ethiopian Fiscal Year 2018 (2025–2026). It explains how public revenue is raised and allocated, how the annual budget relates to national priorities, and how residents can follow public spending and ask questions about services in their communities.",
        documentUrl: MOFED_SOURCE
    },
    {
        title: "Public Financial Management (PFM) Reform Strategy",
        category: "Economy & Finance",
        description: "Ethiopia's PFM reform strategy provides a framework for improving the institutions and processes used to plan, budget, execute, account for, and audit public resources. It supports more transparent and reliable financial information, stronger expenditure control, and accountability for the use of public funds across government.",
        documentUrl: MOFED_SOURCE
    },
    {
        title: "Ethiopian Social Accountability Program (ESAP) Implementation Guide",
        category: "Law & Governance",
        description: "This implementation guide describes a structured process for communities, service users, and public service providers to assess services and discuss improvements. It supports informed citizen participation, constructive dialogue based on community experience, agreed follow-up actions, and accountability in local service delivery.",
        documentUrl: MOFED_SOURCE
    },
    {
        title: "National Energy Policy of Ethiopia",
        category: "Energy & Natural Resources",
        description: "Ethiopia's National Energy Policy establishes direction for developing the energy sector and expanding access to reliable and affordable energy. Its framework informs decisions about energy resources, infrastructure, renewable energy, efficient use, and the role of energy access in social and economic development.",
        documentUrl: POLICY_LIBRARY_SOURCE
    },
    {
        title: "National Employment Policy and Strategy of Ethiopia",
        category: "Labor & Employment",
        description: "The National Employment Policy and Strategy sets out a framework for promoting productive employment and improving access to decent work. It addresses employment creation, skills development, coordination between education and the labor market, and inclusion of groups facing barriers to employment.",
        documentUrl: POLICY_LIBRARY_SOURCE
    },
    {
        title: "Education and Training Policy",
        category: "Education & Culture",
        description: "Ethiopia's Education and Training Policy provides national direction for education and skills formation. It frames priorities such as equitable access, quality and relevance of learning, teacher development, technical and vocational training, and the contribution of education to individual and national development.",
        documentUrl: POLICY_LIBRARY_SOURCE
    },
    {
        title: "National Tourism Development Policy",
        category: "Tourism & Hospitality",
        description: "The National Tourism Development Policy guides the development of Ethiopia's tourism sector and the use of its cultural and natural heritage. It provides a basis for planning sustainable tourism, improving visitor services and infrastructure, supporting local participation, and expanding livelihood opportunities connected to tourism.",
        documentUrl: POLICY_LIBRARY_SOURCE
    },
    {
        title: "Water Resources Management Policy",
        category: "Agriculture & Environment",
        description: "Ethiopia's Water Resources Management Policy provides principles for coordinated and sustainable planning and use of water resources. It addresses water supply, watershed management, irrigation, water quality, and cooperation among users so that development needs can be balanced with the long-term stewardship of shared resources.",
        documentUrl: POLICY_LIBRARY_SOURCE
    },
    {
        title: "National Population Policy of Ethiopia",
        category: "Social Protection & Inclusion",
        description: "The National Population Policy provides a framework for considering population dynamics alongside social and economic development. Its themes include the relationship between population trends and public services, health and education, population data, and the planning needed to support the well-being of communities.",
        documentUrl: POLICY_LIBRARY_SOURCE
    },
    {
        title: "National Policy on Ethiopian Women",
        category: "Social Protection & Inclusion",
        description: "The National Policy on Ethiopian Women provides a framework for promoting women's equality, participation, and access to development opportunities. It addresses barriers to participation and supports consideration of women's needs in public planning, education, employment, and decision-making.",
        documentUrl: POLICY_LIBRARY_SOURCE
    }
]

/**
 * Upserts seeded policies by title, initializes engagement only on insert, and closes its database connection.
 * @param {object} [options] Injectable Mongoose instance, model, URI, logger, and sleep function.
 * @returns {Promise<object[]>} Bulk-write operations after successful seeding.
 * @throws {Error} For persistent DNS/network or database write failures.
 */
async function seedPolicies({
    mongoose: mongooseInstance = mongoose,
    Policy: PolicyModel = Policy,
    mongoUri = process.env.MONGODB_URI
        || process.env.CONNECTION_STRING
        || "mongodb://127.0.0.1:27017/hagere",
    logger = console,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
} = {}) {
    let connected = false
    try {
        // Atlas SRV DNS and network failures are retried; permanent failures are surfaced with remediation guidance.
        for (let attempt = 0; ; attempt += 1) {
            try {
                await mongooseInstance.connect(mongoUri, {
                    serverSelectionTimeoutMS: MONGO_CONNECT_TIMEOUT_MS
                })
                break
            } catch (error) {
                if (!isTransientConnectionError(error) || attempt >= DNS_CONNECT_RETRIES) {
                    if (isTransientDnsSrvError(error)) {
                        throw new Error(
                            `MongoDB Atlas SRV DNS lookup failed after ${DNS_CONNECT_RETRIES} retries. Check the DNS resolver or set MONGODB_URI to a reachable MongoDB connection string.`,
                            { cause: error }
                        )
                    }
                    if (isTransientMongoNetworkError(error)) {
                        throw new Error(
                            `MongoDB could not reach a cluster node after ${DNS_CONNECT_RETRIES} retries. Check Atlas Network Access, the cluster status, and outbound TCP port 27017.`,
                            { cause: error }
                        )
                    }
                    throw error
                }
                logger.warn?.(`MongoDB connection failed; retrying (${attempt + 1}/${DNS_CONNECT_RETRIES})...`)
                await sleep(DNS_RETRY_DELAY_MS)
            }
        }
        connected = true

        // --- STEP 1: UPSERT BY TITLE AND INITIALIZE ENGAGEMENT ONLY FOR NEW POLICY DOCUMENTS ---
        const operations = POLICY_SEED_DATA.map(({ title, category, description, documentUrl }) => ({
            updateOne: {
                filter: { title },
                update: {
                    $set: { title, category, summary: description, documentUrl },
                    $setOnInsert: {
                        status: "active",
                        totalVotes: 0,
                        viewCount: 0,
                        likes: [],
                        interactions: {
                            votes: {
                                agree: { count: 0, voters: [] },
                                neutral: { count: 0, voters: [] },
                                disagree: { count: 0, voters: [] }
                            },
                            comments: []
                        }
                    }
                },
                upsert: true
            }
        }))
        await PolicyModel.bulkWrite(operations, { ordered: true })
        logger.log(`Successfully seeded ${operations.length} Ethiopian policy records!`)
        return operations
    } finally {
        if (connected) await mongooseInstance.disconnect()
    }
}

if (require.main === module) {
    seedPolicies().catch(error => {
        console.error("Policy seeding failed:", error.stack || error)
        if (error.cause && isTransientDnsSrvError(error.cause)) {
            console.error("This is a DNS/network resolution error, not a MongoDB password error.")
        } else if (error.cause && isTransientMongoNetworkError(error.cause)) {
            console.error("Check the cluster allowlist, network access, and outbound firewall access to port 27017.")
        }
        process.exitCode = 1
    })
}

module.exports = { POLICY_SEED_DATA, seedPolicies }
