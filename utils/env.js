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
    SERVICE_ACCOUNT: z.string().min(1)
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
    console.error("Invalid environment configuration:")
    for (const issue of result.error.issues) {
        console.error(`- ${issue.path.join(".")}: ${issue.message}`)
    }
    process.exit(1)
}

let serviceAccountJson
try {
    serviceAccountJson = JSON.parse(result.data.SERVICE_ACCOUNT)
} catch {
    console.error("Invalid environment configuration:")
    console.error("- SERVICE_ACCOUNT: must contain valid JSON")
    process.exit(1)
}

const serviceAccountResult = serviceAccountSchema.safeParse(serviceAccountJson)

if (!serviceAccountResult.success) {
    console.error("Invalid environment configuration:")
    for (const issue of serviceAccountResult.error.issues) {
        console.error(`- SERVICE_ACCOUNT.${issue.path.join(".")}: ${issue.message}`)
    }
    process.exit(1)
}

module.exports = {
    ...result.data,
    SERVICE_ACCOUNT: {
        ...serviceAccountResult.data,
        private_key: serviceAccountResult.data.private_key.replace(/\\n/g, "\n")
    }
}
