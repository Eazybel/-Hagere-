require("dotenv").config({ quiet: true })

const { z } = require("zod")

const serviceAccountSchema = z.object({
    type: z.literal("service_account"),
    project_id: z.string().min(1),
    private_key: z.string().min(1),
    client_email: z.string().email(),
    client_id: z.string().min(1)
}).passthrough()

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535),
    CONNECTION_STRING: z.string().min(1).refine(
        value => value.startsWith("mongodb://") || value.startsWith("mongodb+srv://"),
        "must be a MongoDB connection string"
    ),
    CLOUDINARY_CLOUD_NAME: z.string().min(1),
    CLOUDINARY_KEY: z.string().min(1),
    CLOUDINARY_SECRET: z.string().min(1),
    FIREBASE_API: z.string().min(1),
    SERVICE_ACCOUNT: z.string().min(1),
    ADMIN_FIREBASE_PROJECT_ID: z.string().min(1),
    ADMIN_SERVICE_ACCOUNT: z.string().min(1),
    ADMIN_UIDS: z.string().min(1).transform(value => [...new Set(
        value.split(",").map(uid => uid.trim()).filter(Boolean)
    )]).refine(uids => uids.length > 0, "must contain at least one UID")
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
    console.error("Invalid environment configuration:")
    for (const issue of result.error.issues) {
        console.error(`- ${issue.path.join(".")}: ${issue.message}`)
    }
    process.exit(1)
}

function parseServiceAccount(value, variableName) {
    let serviceAccountJson
    try {
        serviceAccountJson = JSON.parse(value)
    } catch {
        console.error("Invalid environment configuration:")
        console.error(`- ${variableName}: must contain valid JSON`)
        process.exit(1)
    }

    const serviceAccountResult = serviceAccountSchema.safeParse(serviceAccountJson)
    if (!serviceAccountResult.success) {
        console.error("Invalid environment configuration:")
        for (const issue of serviceAccountResult.error.issues) {
            console.error(`- ${variableName}.${issue.path.join(".")}: ${issue.message}`)
        }
        process.exit(1)
    }

    return {
        ...serviceAccountResult.data,
        private_key: serviceAccountResult.data.private_key.replace(/\\n/g, "\n")
    }
}

const serviceAccount = parseServiceAccount(result.data.SERVICE_ACCOUNT, "SERVICE_ACCOUNT")
const adminServiceAccount = parseServiceAccount(result.data.ADMIN_SERVICE_ACCOUNT, "ADMIN_SERVICE_ACCOUNT")

if (adminServiceAccount.project_id !== result.data.ADMIN_FIREBASE_PROJECT_ID) {
    console.error("Invalid environment configuration:")
    console.error("- ADMIN_FIREBASE_PROJECT_ID: must match ADMIN_SERVICE_ACCOUNT.project_id")
    process.exit(1)
}

if (adminServiceAccount.project_id === serviceAccount.project_id) {
    console.error("Invalid environment configuration:")
    console.error("- ADMIN_SERVICE_ACCOUNT: must belong to a separate Firebase project")
    process.exit(1)
}

module.exports = {
    ...result.data,
    SERVICE_ACCOUNT: serviceAccount,
    ADMIN_SERVICE_ACCOUNT: adminServiceAccount
}
