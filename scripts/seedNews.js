require("dotenv").config({ quiet: true })

const mongoose = require("mongoose")
const News = require("../models/News")
const Policy = require("../models/Policy")

const DNS_CONNECT_RETRIES = 2
const DNS_RETRY_DELAY_MS = 2000

const NEWS_SEED_DATA = [
    {
        title: "Government Launches Expanded 'Digital Ethiopia' Framework for Regional Innovation Hubs",
        content: "The Ministry of Innovation and Technology (MInT) has officially announced the expansion phase of the Digital Transformation Framework. The initiative aims to enhance digital public infrastructure, extend Fayda Digital ID integration across public services, and establish regional tech incubators to accelerate youth employment in software and emerging tech sectors.",
        imageUrl: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80",
        author: "Government Communication Service",
        comments: [
            {
                userName: "Abebe Tadesse",
                comment: "Great move for local software developers! Will regional hubs have direct cloud grants?"
            },
            {
                userName: "Marta Haile",
                comment: "Digital ID integration will simplify business registration significantly."
            }
        ]
    },
    {
        title: "House of People's Representatives Approves Revised Proclamation on Urban Infrastructure Development",
        content: "In a landmark parliamentary session, lawmakers passed the updated Urban Infrastructure and Sustainable Development Proclamation. The policy outlines major funding allocations for eco-friendly public transportation, modernized municipal sanitation, and affordable housing projects across major primary and secondary cities.",
        imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
        author: "Ministry of Urban and Infrastructure",
        comments: [
            {
                userName: "Dawit Kebede",
                comment: "Hope the implementation starts quickly in Soddo and Hawassa."
            }
        ]
    },
    {
        title: "National Green Legacy Initiative Reaches Major Urban Forestry Benchmark",
        content: "The Green Legacy Initiative steering committee released its updated environmental impact assessment, showing a 15% increase in urban canopy coverage across primary municipal zones. New policy mandates now require commercial real estate projects to allocate at least 20% of plot space to indigenous green areas.",
        imageUrl: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1200&q=80",
        author: "Ministry of Agriculture & Environment",
        comments: [
            {
                userName: "Segenet Worku",
                comment: "Mandating green space in commercial zones is a essential policy decision."
            }
        ]
    },
    {
        title: "Public Consultation Opens for Draft National Renewable Energy Tariff Policy",
        content: "The Ministry of Water and Energy has formally opened a 30-day public consultation window for the proposed Renewable Energy Framework. Citizens, clean energy startups, and private operators are invited to submit feedback and section-by-section comments via the official Hagere portal.",
        imageUrl: "https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80",
        author: "Ministry of Water and Energy",
        comments: [
            {
                userName: "Ephrem Yilma",
                comment: "Is there a tariff exemption for solar micro-grid installations in rural areas?"
            }
        ]
    }
]

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
        for (let attempt = 0; ; attempt += 1) {
            try {
                await mongooseInstance.connect(mongoUri)
                break
            } catch (error) {
                if (!isTransientDnsSrvError(error) || attempt >= DNS_CONNECT_RETRIES) {
                    if (isTransientDnsSrvError(error)) {
                        throw new Error(
                            `MongoDB Atlas SRV DNS lookup failed after ${DNS_CONNECT_RETRIES} retries. Check the network's DNS resolver or set MONGODB_URI to a reachable MongoDB connection string.`,
                            { cause: error }
                        )
                    }
                    throw error
                }
                logger.warn?.(`MongoDB SRV DNS lookup failed; retrying (${attempt + 1}/${DNS_CONNECT_RETRIES})...`)
                await sleep(DNS_RETRY_DELAY_MS)
            }
        }
        connected = true

        const policy = await PolicyModel.findOne().select("_id")
        const newsDocuments = NEWS_SEED_DATA.map(entry => ({
            ...entry,
            relatedPolicy: policy?._id || null,
            comments: entry.comments.map(comment => ({
                ...comment,
                user: new mongooseInstance.Types.ObjectId()
            }))
        }))

        await NewsModel.deleteMany({})
        const insertedNews = await NewsModel.insertMany(newsDocuments)
        logger.log(`Successfully seeded ${insertedNews.length} policy news posts!`)
        return insertedNews
    } finally {
        if (connected) await mongooseInstance.disconnect()
    }
}

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

if (require.main === module) {
    seedNews().catch(error => {
        console.error("Policy news seeding failed:", error.stack || error)
        if (error.cause && isTransientDnsSrvError(error.cause)) {
            console.error("This is a DNS/network resolution error, not a MongoDB password error. Retry when DNS is available, or configure MONGODB_URI with a reachable MongoDB URI.")
        }
        process.exitCode = 1
    })
}

module.exports = {
    NEWS_SEED_DATA,
    DNS_CONNECT_RETRIES,
    DNS_RETRY_DELAY_MS,
    isTransientDnsSrvError,
    seedNews
}
