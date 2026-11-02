/**
 * @file cleanupDummyPolicies.js
 * @description Previews selected policy records and deletes them only after explicit ID and confirmation arguments.
 * @module Scripts/PolicyCleanup
 * @requires mongoose, dotenv, and the Policy model
 */
require("dotenv").config({ quiet: true })

const mongoose = require("mongoose")
const Policy = require("../models/Policy")

/**
 * Validates exact policy IDs, previews matching records, and optionally deletes them.
 * @returns {Promise<void>} Resolves after preview/deletion and database disconnection.
 * @throws {Error} If arguments, confirmation, environment, or database operations are invalid.
 */
async function main() {
    const idsArgument = process.argv.find(argument => argument.startsWith("--ids="))
    const ids = idsArgument
        ? [...new Set(idsArgument.slice("--ids=".length).split(",").map(id => id.trim()).filter(Boolean))]
        : []
    const execute = process.argv.includes("--execute")
    const confirmed = process.argv.includes("--confirm=delete-selected-policies")

    if (!ids.length || ids.some(id => !/^[a-f\d]{24}$/i.test(id))) {
        throw new Error(
            "Provide exact policy IDs: node scripts/cleanupDummyPolicies.js --ids=<id1>,<id2>"
        )
    }
    if (execute && !confirmed) {
        throw new Error(
            "Deletion requires --confirm=delete-selected-policies. Run without --execute first to preview."
        )
    }
    if (!process.env.CONNECTION_STRING) {
        throw new Error("CONNECTION_STRING is required")
    }

    // --- STEP 1: CONNECT, PREVIEW ONLY THE EXPLICITLY SELECTED RECORDS, THEN REQUIRE CONFIRMATION ---
    await mongoose.connect(process.env.CONNECTION_STRING)
    try {
        const selectedPolicies = await Policy.find({
            _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) }
        }).select("_id title").lean()

        console.log(JSON.stringify(selectedPolicies, null, 2))
        if (!execute) {
            console.log("Dry run only. No documents were deleted.")
            return
        }

        // Delete only the records that appeared in the explicit-ID preview above.
        const result = await Policy.deleteMany({
            _id: { $in: selectedPolicies.map(policy => policy._id) }
        })
        console.log(`Deleted ${result.deletedCount} explicitly selected policy document(s).`)
    } finally {
        await mongoose.disconnect()
    }
}

main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
})
