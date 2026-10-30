const test=require("node:test")
const assert=require("node:assert/strict")
const path=require("node:path")
const express=require("express")
const request=require("supertest")
const {createUserController}=require("../controller/userController")

function createRegistrationApp(decodedToken){
    const savedUsers=[]
    class User{
        constructor(fields){
            Object.assign(this,fields)
            this._id=`user-${savedUsers.length+1}`
            this.id=this._id
        }

        async save(){
            savedUsers.push(this)
        }

        static async findOne({email}){
            return savedUsers.find(user=>user.email===email) || null
        }
    }

    const app=express()
    app.use(express.json())
    app.post("/newUserRegister",createUserController({
        User,
        verifyIdToken:async token=>{
            assert.equal(token,"test-id-token")
            return decodedToken
        }
    }))
    return {app,savedUsers}
}

test("citizen registration binds the saved profile to the verified Firebase email",async()=>{
    const {app,savedUsers}=createRegistrationApp({
        uid:"citizen-1",
        email:"Citizen@Example.test",
        email_verified:true,
        name:"Verified Citizen",
        picture:"https://images.example.test/citizen.jpg"
    })

    const response=await request(app)
        .post("/newUserRegister")
        .set("Authorization","Bearer test-id-token")
        .send({
            name:"Forged Name",
            email:"other@example.test",
            avatar:"https://images.example.test/forged.jpg"
        })

    assert.equal(response.status,201)
    assert.deepEqual(savedUsers.map(({name,email,avatar})=>({name,email,avatar})),[{
        name:"Verified Citizen",
        email:"citizen@example.test",
        avatar:"https://images.example.test/citizen.jpg"
    }])
})

test("citizen registration rejects missing credentials and unverified email",async()=>{
    const {app}=createRegistrationApp({
        email:"citizen@example.test",
        email_verified:false,
        name:"Test Citizen"
    })

    const missingToken=await request(app).post("/newUserRegister").send({})
    assert.equal(missingToken.status,401)

    const unverified=await request(app)
        .post("/newUserRegister")
        .set("Authorization","Bearer test-id-token")
        .send({name:"Test Citizen"})
    assert.equal(unverified.status,403)
    assert.equal(unverified.body.error,"Verified citizen account required")
})

test("auth pages load their sign-in modules and the modules use the expected Firebase projects",async()=>{
    const app=express()
    app.use(express.static(path.join(__dirname,"..","public")))
    const [citizenPage,adminPage,citizenScript,adminScript]=await Promise.all([
        request(app).get("/login.html"),
        request(app).get("/adminAuth.html"),
        request(app).get("/login.js"),
        request(app).get("/adminAuth.js")
    ])

    assert.equal(citizenPage.status,200)
    assert.match(citizenPage.text,/src="\.\/login\.js"/)
    assert.equal(adminPage.status,200)
    assert.match(adminPage.text,/src="\.\/adminAuth\.js"/)
    assert.equal(citizenScript.status,200)
    assert.match(citizenScript.text,/signInWithPopup/)
    assert.match(citizenScript.text,/newUserRegister/)
    assert.equal(adminScript.status,200)
    assert.match(adminScript.text,/projectId:"hagere-admin"/)
    assert.match(adminScript.text,/\/admin\/policyCount/)
})
