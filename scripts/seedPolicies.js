/**
 * @file seedPolicies.js
 * @description Replaces the policy catalog with official Ethiopian records and retries transient MongoDB DNS/network failures.
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
const POLICY_SEED_DATA = [
    {
        title: "Tourism Development Policy (English)",
        category: "Tourism & Hospitality",
        description: "Tourism is among the economic and social sectors that are registering rapid growth in the world, serving as a source of foreign exchange, promoting micro and small-scale enterprises, creating employment opportunities, and ensuring sustainable development by establishing coordination among government, private sector, and local communities.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638717/yedev5snr3za6hiuvl86.pdf"
    },
    {
        title: "Education and Training Policy of Ethiopia - Amharic version - 2023",
        category: "Education & Culture",
        description: "Ethiopia's Education and Training Policy is a comprehensive and coherent policy that aims to provide all Ethiopians with access to quality education based on equity, quality, and relevance principles, emphasizing non-formal education to equip adults for workforce participation.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638716/mletiua18iomq6sigevs.pdf"
    },
    {
        title: "National Energy Policy (English)",
        category: "Energy & Natural Resources",
        description: "Ethiopia's energy consumption is predominantly based on biomass energy sources (94%), with the remaining met by electricity and petroleum. Addresses critical issues in household fuel supply, deforestation, land degradation, and population growth pressures.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638704/ipcn9y1l6pznjuqnq1xo.pdf"
    },
    {
        title: "Water Policy (English)",
        category: "Agriculture & Environment",
        description: "Outlines Ethiopia's favorable climate and rainfall endowment, addressing the management of its estimated 122 billion cubic meters of annual surface runoff and transboundary river flows to ensure sustainable water resource utilization.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638705/u01t9jmz9msfmhukc7em.pdf"
    },
    {
        title: "The Education and Training Policy and its Implementation (English)",
        category: "Education & Culture",
        description: "Reviews the historical context of modern education in Ethiopia over the past century, focusing on reforming curriculum and training structures to directly address the practical needs of farmers, pastoralists, and overall national development.",
        documentUrl: "https://res.cloudinary.com/dgietnwua/image/upload/v1793638716/mletiua18iomq6sigevs.pdf"
    }
]

/**
 * Replaces all policy records with the seed catalog, initializes engagement data, and closes its database connection.
 * @param {object} [options] Injectable Mongoose instance, model, URI, logger, and sleep function.
 * @returns {Promise<object[]>} Inserted policy documents after successful seeding.
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

        // This is a deliberate full replacement; existing policy engagement data is discarded.
        await PolicyModel.deleteMany({})
        const policies = POLICY_SEED_DATA.map(({ title, category, description, documentUrl }) => ({
            title,
            category,
            summary: description,
            documentUrl,
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
        }))
        const insertedPolicies = await PolicyModel.insertMany(policies, { ordered: true })
        logger.log(`Successfully replaced policies with ${insertedPolicies.length} custom-hosted records!`)
        return insertedPolicies
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
