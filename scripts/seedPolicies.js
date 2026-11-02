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
        title: "Citizens' Budget of EFY 2018 (2025/2026)",
        category: "Economy & Finance",
        description: "Published by the Ministry of Finance, outlining macro-economic fiscal frameworks, revenue projections, and resource allocations.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/fa/3e/fa3e75a5-f3e7-4acb-a49f-73a425e1f512/citizen_budget_newsletter.pdf"
    },
    {
        title: "Citizens' Budget on Federal Budget for EFY 2017 (2024/2025)",
        category: "Economy & Finance",
        description: "Official breakdown of the federal fiscal plan, government expenditures, revenue targets, and debt management frameworks.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/35/09/35092630-f70a-4d08-beda-641a0a9854db/efy-2017_2024-25_citizens_budget-english_version.pdf"
    },
    {
        title: "Citizens' Budget for EFY 2015 (2022/2023)",
        category: "Economy & Finance",
        description: "Details national spending alignment with the 10-Year Development Plan and economic reform to control inflation and boost job growth.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/f6/c8/f6c8dcb5-00f4-4550-81f4-a30f1eb85129/efy_2015_2022-23_ethiopian_citizens_budget-english_version.pdf"
    },
    {
        title: "The Citizens' Guide to EFY 2014 (2021/2022) National Budget",
        category: "Economy & Finance",
        description: "Focuses on structural fiscal components, execution phases, and performance monitoring standards across federal and regional sectors.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/33/34/33341381-bb67-4c92-9432-6c7f4552af13/national_citizens_budget_for_efy_2014_2021-22-english_version.pdf"
    },
    {
        title: "Public Financial Management (PFM) Reform Strategy",
        category: "Economy & Finance",
        description: "Federal policy blueprint designed to modernize public expenditure controls, enhance tax transparency, and eliminate inefficiencies.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/2d/27/2d27b5bd-0071-4c40-b674-7661d5375d11/new_ethiopia_pfm_reform_strategy_1.pdf"
    },
    {
        title: "Ethiopian Social Accountability Program (ESAP) Implementation Guide",
        category: "Law & Governance",
        description: "Governance framework outlining mechanisms to strengthen community participation and improve basic public service delivery at woreda levels.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/ff/7d/ff7d8668-6dfa-4136-8ea9-7d213a924dca/final_sa_implementation_guide_mof-copcd_1_april_2022_copcd_clean.pdf"
    },
    {
        title: "FTA, Social Accountability, and GRM Linkages Implementation Guidelines",
        category: "Law & Governance",
        description: "Institutional guideline harmonizing fiscal transparency, social accountability tools, and grievance redress mechanisms.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/57/7f/577f169d-f82d-4486-b4db-689ef876d357/fta-sa_-_grm_linkage_guidelines_-_last_version.pdf"
    },
    {
        title: "Federal Government Budget Summary (Volume I - EFY 2018)",
        category: "Economy & Finance",
        description: "Official volume containing statutory allocations, institutional budget breakdowns, and capital investment schedules.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/1c/2a/1c2a6dc6-1155-4142-9530-3decca1d85a0/2018_fy_goe_budget_summary_volume_i-updated_merged_1.pdf"
    },
    {
        title: "National Social Protection Policy of Ethiopia",
        category: "Social Protection & Inclusion",
        description: "Core policy framework aimed at reducing poverty, managing economic risks, protecting vulnerable groups, and assuring equitable growth.",
        documentUrl: "https://www.cmpethiopia.org/content/download/2676/11160/file/National%20Social%20Protection%20Policy%20of%20Ethiopia.pdf"
    },
    {
        title: "Environmental Policy and Sustainable Development Standards",
        category: "Environment & Natural Resources",
        description: "Detailed legislative document covering national environmental policies, industrial pollution regulations, and impact assessment guidelines.",
        documentUrl: "https://www.open.edu/openlearncreate/mod/oucontent/view.php?id=79982&printable=1"
    }
]

/**
 * Replaces all policy records with the seed catalog, initializes engagement data, and closes its database connection.
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
        logger.log(`Successfully replaced policies with ${insertedPolicies.length} official Ethiopian records!`)
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
