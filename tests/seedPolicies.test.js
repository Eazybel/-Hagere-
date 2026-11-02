const test = require("node:test")
const assert = require("node:assert/strict")
const { POLICY_SEED_DATA, seedPolicies } = require("../scripts/seedPolicies")

const expectedPolicyRecords = [
    {
        title: "Citizens' Budget of EFY 2018 (2025/2026)",
        description: "Published by the Ministry of Finance, outlining macro-economic fiscal frameworks, revenue projections, and resource allocations.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/fa/3e/fa3e75a5-f3e7-4acb-a49f-73a425e1f512/citizen_budget_newsletter.pdf"
    },
    {
        title: "Citizens' Budget on Federal Budget for EFY 2017 (2024/2025)",
        description: "Official breakdown of the federal fiscal plan, government expenditures, revenue targets, and debt management frameworks.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/35/09/35092630-f70a-4d08-beda-641a0a9854db/efy-2017_2024-25_citizens_budget-english_version.pdf"
    },
    {
        title: "Citizens' Budget for EFY 2015 (2022/2023)",
        description: "Details national spending alignment with the 10-Year Development Plan and economic reform to control inflation and boost job growth.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/f6/c8/f6c8dcb5-00f4-4550-81f4-a30f1eb85129/efy_2015_2022-23_ethiopian_citizens_budget-english_version.pdf"
    },
    {
        title: "The Citizens' Guide to EFY 2014 (2021/2022) National Budget",
        description: "Focuses on structural fiscal components, execution phases, and performance monitoring standards across federal and regional sectors.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/33/34/33341381-bb67-4c92-9432-6c7f4552af13/national_citizens_budget_for_efy_2014_2021-22-english_version.pdf"
    },
    {
        title: "Public Financial Management (PFM) Reform Strategy",
        description: "Federal policy blueprint designed to modernize public expenditure controls, enhance tax transparency, and eliminate inefficiencies.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/2d/27/2d27b5bd-0071-4c40-b674-7661d5375d11/new_ethiopia_pfm_reform_strategy_1.pdf"
    },
    {
        title: "Ethiopian Social Accountability Program (ESAP) Implementation Guide",
        description: "Governance framework outlining mechanisms to strengthen community participation and improve basic public service delivery at woreda levels.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/ff/7d/ff7d8668-6dfa-4136-8ea9-7d213a924dca/final_sa_implementation_guide_mof-copcd_1_april_2022_copcd_clean.pdf"
    },
    {
        title: "FTA, Social Accountability, and GRM Linkages Implementation Guidelines",
        description: "Institutional guideline harmonizing fiscal transparency, social accountability tools, and grievance redress mechanisms.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/57/7f/577f169d-f82d-4486-b4db-689ef876d357/fta-sa_-_grm_linkage_guidelines_-_last_version.pdf"
    },
    {
        title: "Federal Government Budget Summary (Volume I - EFY 2018)",
        description: "Official volume containing statutory allocations, institutional budget breakdowns, and capital investment schedules.",
        documentUrl: "https://www.mofed.gov.et/media/filer_public/1c/2a/1c2a6dc6-1155-4142-9530-3decca1d85a0/2018_fy_goe_budget_summary_volume_i-updated_merged_1.pdf"
    },
    {
        title: "National Social Protection Policy of Ethiopia",
        description: "Core policy framework aimed at reducing poverty, managing economic risks, protecting vulnerable groups, and assuring equitable growth.",
        documentUrl: "https://www.cmpethiopia.org/content/download/2676/11160/file/National%20Social%20Protection%20Policy%20of%20Ethiopia.pdf"
    },
    {
        title: "Environmental Policy and Sustainable Development Standards",
        description: "Detailed legislative document covering national environmental policies, industrial pollution regulations, and impact assessment guidelines.",
        documentUrl: "https://www.open.edu/openlearncreate/mod/oucontent/view.php?id=79982&printable=1"
    }
]

test("policy seeder replaces the catalog with the ten official PDF records", async () => {
    const calls = []
    let insertedPolicies
    const fakeMongoose = {
        async connect(uri, options) {
            calls.push(["connect", uri, options.serverSelectionTimeoutMS])
        },
        async disconnect() {
            calls.push(["disconnect"])
        }
    }

    const result = await seedPolicies({
        mongoose: fakeMongoose,
        mongoUri: "mongodb://seed-test/policies",
        Policy: {
            async deleteMany(filter) {
                calls.push(["deleteMany", filter])
            },
            async insertMany(documents, options) {
                calls.push(["insertMany", options])
                insertedPolicies = documents
                return documents
            }
        },
        logger: { log: message => calls.push(["log", message]) }
    })

    assert.deepEqual(POLICY_SEED_DATA.map(({ title, description, documentUrl }) => ({
        title, description, documentUrl
    })), expectedPolicyRecords)
    assert.equal(result.length, 10)
    assert.equal(insertedPolicies.length, 10)
    for (const [index, policy] of insertedPolicies.entries()) {
        assert.equal(policy.title, expectedPolicyRecords[index].title)
        assert.equal(policy.summary, expectedPolicyRecords[index].description)
        assert.equal(policy.documentUrl, expectedPolicyRecords[index].documentUrl)
        assert.match(policy.documentUrl, /^https:\/\/\S+$/)
        assert.equal(policy.status, "active")
        assert.equal(policy.totalVotes, 0)
        assert.deepEqual(policy.interactions.comments, [])
        assert.deepEqual(policy.interactions.votes, {
            agree: { count: 0, voters: [] },
            neutral: { count: 0, voters: [] },
            disagree: { count: 0, voters: [] }
        })
    }
    assert.deepEqual(calls, [
        ["connect", "mongodb://seed-test/policies", 15_000],
        ["deleteMany", {}],
        ["insertMany", { ordered: true }],
        ["log", "Successfully replaced policies with 10 official Ethiopian records!"],
        ["disconnect"]
    ])
})

test("policy seeder disconnects if inserting the replacement catalog fails", async () => {
    let disconnected = false
    const fakeMongoose = {
        async connect() {},
        async disconnect() {
            disconnected = true
        }
    }

    await assert.rejects(seedPolicies({
        mongoose: fakeMongoose,
        Policy: {
            async deleteMany() {},
            async insertMany() {
                throw new Error("insert failed")
            }
        },
        logger: { log() {} }
    }), /insert failed/)
    assert.equal(disconnected, true)
})
