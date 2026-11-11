const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const publicDirectory = path.join(__dirname, "..", "public")
const readPublicFile = file => fs.readFileSync(path.join(publicDirectory, file), "utf8")

test("policy catalog cards defer all engagement until the user opens policy details", () => {
    for (const file of ["script.js", "feed.js"]) {
        const catalog = readPublicFile(file)
        assert.match(catalog, /Read Policy/)
        assert.doesNotMatch(catalog, /\/like|likesCount|\bUnlike\b|\bLike\b/)
        assert.doesNotMatch(catalog, /interactions\?\.votes|interactions\?\.comments|policyCommentCount/)
    }

    const policyPage = readPublicFile("policy.html")
    const policyClient = readPublicFile("policy.js")
    assert.match(policyPage, /id="comments" class="hidden/)
    assert.match(policyPage, /id="commentPostSection" class="hidden/)
    assert.match(policyClient, /commentsSection\.classList\.remove\("hidden"\)/)
    assert.match(policyClient, /commentPostSection\.classList\.remove\("hidden"\)/)
    assert.match(policyClient, /form id="formData"/)
})
