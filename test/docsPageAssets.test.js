const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const publicDirectory = path.join(__dirname, "..", "public")
const primaryPages = [
    "index.html",
    "feed.html",
    "news.html",
    "policy.html",
    "admin.html",
    "login.html",
    "adminAuth.html",
    "dashboard.html",
    "analytics.html"
]

test("documentation page exists with a complete HTML document structure", () => {
    const docsPath = path.join(publicDirectory, "docs.html")
    assert.equal(fs.existsSync(docsPath), true, "public/docs.html should exist")

    const html = fs.readFileSync(docsPath, "utf8")
    assert.match(html, /^<!doctype html>/i)
    assert.match(html, /<html\b[^>]*\blang="en"/i)
    assert.match(html, /<head\b[\s\S]*<\/head>/i)
    assert.match(html, /<meta\b[^>]*\bname="viewport"/i)
    assert.match(html, /<title>[^<]+<\/title>/i)
    assert.match(html, /<body\b[\s\S]*<\/body>/i)
    assert.match(html, /<main\b[\s\S]*<\/main>/i)
    for (const section of ["overview", "architecture", "structure", "api", "deployment"]) {
        assert.match(html, new RegExp(`<section\\b[^>]*\\bid="${section}"`))
    }
    assert.match(html, /aria-label="Documentation sections"/)
    assert.match(html, /id="docsSectionSelect"/)
})

test("all primary HTML pages link to the documentation page in their footer", () => {
    for (const page of primaryPages) {
        const html = fs.readFileSync(path.join(publicDirectory, page), "utf8")
        assert.match(
            html,
            /<footer\b[\s\S]*?<a href="docs\.html" class="[^"]*hover:text-amber-700 underline transition-colors[^"]*">Documentation<\/a>[\s\S]*?<\/footer>/i,
            `${page} should include a Documentation link in its footer`
        )
    }
})
