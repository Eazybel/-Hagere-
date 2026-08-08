const auth=require("./firebaseInit")
onAuthStateChanged(auth, (user) => {
  if (user) {
    const uid = user.uid;
   console.log("User Registered")
  } else {
  console.log("User Not Registered")
  }
});