/**
 * @file seedNews.js
 * @description Idempotently seeds Ethiopian policy news, resolves related policy references, and retries transient MongoDB connectivity failures.
 * @module Scripts/NewsSeeder
 * @requires mongoose, dotenv, and News and Policy models
 */
require("dotenv").config({ quiet: true })

const mongoose = require("mongoose")
const News = require("../models/News")
const Policy = require("../models/Policy")

const DNS_CONNECT_RETRIES = 2
const DNS_RETRY_DELAY_MS = 2000
const MONGO_CONNECT_TIMEOUT_MS = 15_000

const NEWS_SEED_DATA = [
    {
        title: "Citizen's Guide to the EFY 2018 Federal Budget",
        content: "The annual citizen budget is designed to make public revenue and spending easier to understand. Readers can use it to follow the budget cycle, compare allocations across sectors, and ask how national priorities are reflected in services in their community. The Ministry of Finance publishes budget information and related public documents.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Addis_Mercato%2C_Ad%C3%ADs_Abeba%2C_Etiop%C3%ADa%2C_2024-01-19%2C_DD_26.jpg/960px-Addis_Mercato%2C_Ad%C3%ADs_Abeba%2C_Etiop%C3%ADa%2C_2024-01-19%2C_DD_26.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Addis_Mercato,_Ad%C3%ADs_Abeba,_Etiop%C3%ADa,_2024-01-19,_DD_26.jpg",
        imageCredit: "Diego Delso, CC BY-SA 4.0",
        author: "Ministry of Finance",
        relatedPolicyTitle: "Citizens' Budget of EFY 2018 (2025/2026)",
        comments: [
            {
                userName: "Abebe Tadesse",
                comment: "A plain-language budget guide makes it easier for communities to follow public spending."
            },
            {
                userName: "Marta Haile",
                comment: "It would be helpful to compare planned allocations with local service delivery."
            }
        ]
    },
    {
        title: "PFM Reform Strategy: Following the Public Finance Cycle",
        content: "Ethiopia's Public Financial Management reform strategy sets out a framework for strengthening how public resources are planned, budgeted, spent, recorded, and audited. Its reform areas give institutions and citizens a shared vocabulary for discussing transparency, accountability, and the quality of public financial information.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/10/Dizi_Highlands%2C_Sth_Ethiopia_%2850647997717%29.jpg/960px-Dizi_Highlands%2C_Sth_Ethiopia_%2850647997717%29.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Dizi_Highlands,_Sth_Ethiopia_(50647997717).jpg",
        imageCredit: "Rod Waddington, CC BY-SA 2.0",
        author: "Ministry of Finance",
        relatedPolicyTitle: "Public Financial Management (PFM) Reform Strategy",
        comments: [
            {
                userName: "Dawit Kebede",
                comment: "Clear reporting is important for accountability at every level of government."
            }
        ]
    },
    {
        title: "How Social Accountability Connects Citizens and Service Providers",
        content: "The Ethiopian Social Accountability Program implementation guide describes a structured way for communities and service providers to review public services together. The approach supports evidence-based dialogue, follow-up on agreed actions, and stronger participation in local planning and service improvement.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Ethiopian_Coffee_Ceremony_Set.jpg/960px-Ethiopian_Coffee_Ceremony_Set.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Ethiopian_Coffee_Ceremony_Set.jpg",
        imageCredit: "Khajitdadddy, CC BY-SA 4.0",
        author: "Ministry of Finance",
        relatedPolicyTitle: "Ethiopian Social Accountability Program (ESAP) Implementation Guide",
        comments: [
            {
                userName: "Segenet Worku",
                comment: "Community meetings work best when public offices report back on agreed actions."
            }
        ]
    },
    {
        title: "National Energy Policy: Balancing Access, Reliability, and Sustainability",
        content: "Ethiopia's National Energy Policy provides a framework for developing energy resources and expanding access to reliable energy. Public discussion of energy policy can consider affordability, rural and urban access, the role of renewable resources, and how infrastructure decisions affect households and productive sectors.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Omo_Gibe_III%2C_Wolayita_3.jpg/960px-Omo_Gibe_III%2C_Wolayita_3.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Omo_Gibe_III,_Wolayita_3.jpg",
        imageCredit: "Mimi Abebayehu, CC BY-SA 4.0",
        author: "Ministry of Water and Energy",
        relatedPolicyTitle: "National Energy Policy (English)",
        comments: [
            {
                userName: "Ephrem Yilma",
                comment: "Reliable electricity is essential for health services, schools, and small businesses."
            },
            {
                userName: "Rahel Bekele",
                comment: "How can remote communities be included in energy-access planning?"
            }
        ]
    },
    {
        title: "National Employment Policy: Connecting Skills and Decent Work",
        content: "The National Employment Policy and Strategy addresses employment promotion and the conditions that support productive work. Its themes provide a basis for discussing skills development, job opportunities for young people, inclusive access to work, and coordination between public institutions, employers, and training providers.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Ethiopia-farmers-harvest-teff.jpg/960px-Ethiopia-farmers-harvest-teff.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Ethiopia-farmers-harvest-teff.jpg",
        imageCredit: "Esayas Ayele, CC BY-SA 4.0",
        author: "Ministry of Labor and Skills",
        relatedPolicyTitle: "National Employment Policy and Strategy of Ethiopia",
        comments: [
            {
                userName: "Mekdes Girma",
                comment: "Training should connect to the skills employers and local economies need."
            }
        ]
    },
    {
        title: "Education and Training Policy: A Framework for Lifelong Learning",
        content: "Ethiopia's Education and Training Policy sets broad direction for education and skills formation. The policy invites discussion about equitable access, learning quality, teacher support, technical and vocational pathways, and how education can respond to changing community needs.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/School_in_Semien_Mountains%2C_Ethiopia.jpg/960px-School_in_Semien_Mountains%2C_Ethiopia.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:School_in_Semien_Mountains,_Ethiopia.jpg",
        imageCredit: "Zelalemgizachew, CC BY-SA 4.0",
        author: "Ministry of Education",
        relatedPolicyTitle: "Education and Training Policy of Ethiopia - Amharic version - 2023",
        comments: [
            {
                userName: "Henok Alemu",
                comment: "Equal access and strong learning outcomes need to be considered together."
            }
        ]
    },
    {
        title: "Tourism Development Policy: Supporting Communities and Heritage",
        content: "The National Tourism Development Policy offers a framework for developing tourism while recognizing Ethiopia's cultural and natural heritage. Citizens can consider how tourism planning supports local livelihoods, protects historic and natural sites, improves infrastructure, and shares benefits with host communities.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0b/Bete_Giyorgis_03.jpg/960px-Bete_Giyorgis_03.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Bete_Giyorgis_03.jpg",
        imageCredit: "Bernard Gagnon, CC BY-SA 3.0",
        author: "Ministry of Tourism",
        relatedPolicyTitle: "Tourism Development Policy (English)",
        comments: [
            {
                userName: "Selamawit Tadesse",
                comment: "Local communities should have a meaningful role in tourism decisions."
            }
        ]
    },
    {
        title: "Water Resources Management: Planning for Shared and Sustainable Use",
        content: "The Water Resources Management Policy frames the planning and use of Ethiopia's water resources. Policy discussions include watershed protection, reliable water supply, irrigation, coordination among users, and the need to manage water in ways that support communities and future generations.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/ET_Afar_asv2018-01_img48_Dallol.jpg/960px-ET_Afar_asv2018-01_img48_Dallol.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:ET_Afar_asv2018-01_img48_Dallol.jpg",
        imageCredit: "A.Savin, Free Art License",
        author: "Ministry of Water and Energy",
        relatedPolicyTitle: "Water Policy (English)",
        comments: [
            {
                userName: "Tewodros Mulu",
                comment: "Coordination across communities is important for managing shared water resources."
            }
        ]
    },
    {
        title: "National Population Policy: Linking Demographic Trends and Services",
        content: "The National Population Policy of Ethiopia provides a framework for considering population dynamics alongside social and economic development. Its themes support discussion of health, education, livelihoods, population data, and the planning needed to make public services accessible as communities change.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Ethiopian_Landscape_Near_Lalibela_%283352783606%29.jpg/960px-Ethiopian_Landscape_Near_Lalibela_%283352783606%29.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Ethiopian_Landscape_Near_Lalibela_(3352783606).jpg",
        imageCredit: "A. Davey, CC BY 2.0",
        author: "Ministry of Planning and Development",
        relatedPolicyTitle: "National Population Policy of Ethiopia",
        comments: [
            {
                userName: "Yohannes Fikru",
                comment: "Local plans need reliable data and input from the people they serve."
            }
        ]
    },
    {
        title: "National Policy on Ethiopian Women: Advancing Equality and Participation",
        content: "The National Policy on Ethiopian Women establishes a framework for addressing women's participation and equality. Public discussion can examine how policy commitments translate into access to education and economic opportunity, representation in decision-making, and protection from barriers that limit full participation.",
        imageUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/Women_Vendors_in_New_Christian_Market_-_Harar_-_Ethiopia_%288750529478%29.jpg/960px-Women_Vendors_in_New_Christian_Market_-_Harar_-_Ethiopia_%288750529478%29.jpg",
        imageSource: "https://commons.wikimedia.org/wiki/File:Women_Vendors_in_New_Christian_Market_-_Harar_-_Ethiopia_(8750529478).jpg",
        imageCredit: "Adam Jones, CC BY-SA 2.0",
        author: "Ministry of Women and Social Affairs",
        relatedPolicyTitle: "National Policy on Ethiopian Women",
        comments: [
            {
                userName: "Marta Haile",
                comment: "Implementation and accountability matter as much as policy commitments."
            }
        ]
    }
]

/**
 * Upserts seeded posts while preserving existing comments and closing owned connections.
 * @param {object} [options] Injectable models, connection URI, logger, and delay for tests/operations.
 * @returns {Promise<object[]>} Bulk-write operation list after successful completion.
 * @throws {Error} On persistent connection, policy lookup, or write failures.
 */
async function seedNews({
    mongoose: mongooseInstance = mongoose,
    News: NewsModel = News,
    Policy: PolicyModel = Policy,
    mongoUri = process.env.MONGODB_URI
        || process.env.CONNECTION_STRING
        || "mongodb://127.0.0.1:27017/hagere",
    logger = console,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
} = {}) {
    let connected = false
    try {
        // Retry transient Atlas DNS/network failures because these can be temporary in developer/host environments.
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
                            `MongoDB Atlas SRV DNS lookup failed after ${DNS_CONNECT_RETRIES} retries. Check the network's DNS resolver or set MONGODB_URI to a reachable MongoDB connection string.`,
                            { cause: error }
                        )
                    }
                    if (isTransientMongoNetworkError(error)) {
                        throw new Error(
                            `MongoDB could not reach a cluster node after ${DNS_CONNECT_RETRIES} retries. Check Atlas Network Access (allowlist this machine's public IP), outbound TCP port 27017, and the cluster's status.`,
                            { cause: error }
                        )
                    }
                    throw error
                }
                const reason = isTransientDnsSrvError(error) ? "SRV DNS" : "network connection"
                logger.warn?.(`MongoDB ${reason} failed; retrying (${attempt + 1}/${DNS_CONNECT_RETRIES})...`)
                await sleep(DNS_RETRY_DELAY_MS)
            }
        }
        connected = true

        // --- STEP 1: RESOLVE OPTIONAL POLICY RELATIONS, PRESERVE EXISTING COMMENTS, AND UPSERT POSTS ---
        const relatedTitles = [...new Set(NEWS_SEED_DATA.map(entry => entry.relatedPolicyTitle))]
        const policies = await PolicyModel.find({ title: { $in: relatedTitles } }).select("_id title")
        const policyIdsByTitle = new Map(policies.map(policy => [policy.title, policy._id]))
        const newsDocuments = NEWS_SEED_DATA.map(entry => ({
            ...entry,
            relatedPolicy: policyIdsByTitle.get(entry.relatedPolicyTitle) || null,
            relatedPolicyTitle: undefined,
            comments: entry.comments.map(comment => ({
                ...comment,
                user: new mongooseInstance.Types.ObjectId()
            }))
        }))
        const operations = newsDocuments.map(({
            title,
            content,
            imageUrl,
            imageSource,
            imageCredit,
            author,
            relatedPolicy,
            comments
        }) => ({
            updateOne: {
                filter: { title },
                update: {
                    $set: { content, imageUrl, imageSource, imageCredit, author, relatedPolicy },
                    $setOnInsert: { title, comments }
                },
                upsert: true
            }
        }))
        await NewsModel.bulkWrite(operations, { ordered: true })
        logger.log(`Successfully seeded ${operations.length} policy news posts!`)
        return operations
    } finally {
        if (connected) await mongooseInstance.disconnect()
    }
}

/** @param {Error} error Error or nested cause from MongoDB. @returns {boolean} Whether it represents transient SRV DNS resolution. */
function isTransientDnsSrvError(error) {
    for (let current = error; current; current = current.cause) {
        if (["ESERVFAIL", "ENOTFOUND", "EAI_AGAIN"].includes(current.code)) return true
        if (typeof current.message === "string"
            && /querySrv\s+(ESERVFAIL|ENOTFOUND|EAI_AGAIN)\b/i.test(current.message)) {
            return true
        }
    }
    return false
}

/** @param {Error} error Error or nested cause from MongoDB. @returns {boolean} Whether it represents a transient network/selection failure. */
function isTransientMongoNetworkError(error) {
    for (let current = error; current; current = current.cause) {
        if (["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "ECONNRESET"].includes(current.code)) {
            return true
        }
        if (/(?:MongoNetwork|ServerSelectionError)/i.test(current.name || "")) return true
        if (typeof current.message === "string"
            && (/server selection timed out/i.test(current.message)
                || /connect (ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|ECONNRESET)\b/i.test(current.message))) {
            return true
        }
    }
    return false
}

/** @param {Error} error MongoDB connection error. @returns {boolean} Whether retrying may recover. */
function isTransientConnectionError(error) {
    return isTransientDnsSrvError(error) || isTransientMongoNetworkError(error)
}

if (require.main === module) {
    seedNews().catch(error => {
        console.error("Policy news seeding failed:", error.stack || error)
        if (error.cause && isTransientDnsSrvError(error.cause)) {
            console.error("This is a DNS/network resolution error, not a MongoDB password error. Retry when DNS is available, or configure MONGODB_URI with a reachable MongoDB URI.")
        } else if (error.cause && isTransientMongoNetworkError(error.cause)) {
            console.error("The cluster hostname resolved, but TCP connections timed out. Check Atlas Network Access, your current public IP allowlist entry, and outbound firewall access to port 27017.")
        }
        process.exitCode = 1
    })
}

module.exports = {
    NEWS_SEED_DATA,
    DNS_CONNECT_RETRIES,
    DNS_RETRY_DELAY_MS,
    isTransientDnsSrvError,
    isTransientMongoNetworkError,
    isTransientConnectionError,
    seedNews
}
