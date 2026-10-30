require("dotenv").config({ quiet: true })

const mongoose = require("mongoose")
const Policy = require("../models/Policy")

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
