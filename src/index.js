const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const session = require("express-session");
const passport = require("passport");
const User = require("./User");
const { v4: uuidv4 } = require("uuid");
const OnshapeStrategy = require("passport-onshape").Strategy;

require("dotenv").config();

const app = express();

mongoose.connect(
  `${process.env.START_MONGODB}${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}${process.env.END_MONGODB}`,
  {},
  () => console.log("connected to mongoose successfully")
);

// Middleware
app.use(express.json());
// app.use(cors());

app.use(
  cors({
    origin: "http://localhost:3100",
    credentials: true,
  })
);

//

app.use((req, res, next) => {
  console.log("req", req.method, req.url);
  //   console.log("req", req.url);
  next();
});

app.set("trust proxy", 1);

const cookieName = "mimi";

app.use(
  session({
    name: cookieName,
    secret: "secretcode",
    resave: false,
    saveUninitialized: true,
    cookie: {
      sameSite: "none",
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // One Week
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// #4 Serialize and store in a cookie
// https://hazelcast.com/glossary/serialization/
// Passport uses the serializeUser function to persist user data (after successful authentication) into the session.
passport.serializeUser((user, done) => {
  return done(null, user._id);
});

// The function deserializeUser is used to retrieve user data from session.
passport.deserializeUser((id, done) => {
  User.findById(id, (err, doc) => {
    return done(null, doc);
  });
});

// #2 Configure the Onshape strategy for use by Passport
passport.use(
  new OnshapeStrategy(
    {
      clientID: process.env.ONSHAPE_OAUTH_CLIENT_ID,
      clientSecret: process.env.ONSHAPE_OAUTH_CLIENT_SECRET,
      callbackURL: process.env.ONSHAPE_OAUTH_CALLBACK_URL,
      authorizationURL: process.env.ONSHAPE_OAUTH_AUTHORIZATION_URL,
      tokenURL: process.env.ONSHAPE_OAUTH_TOKEN_URL,
      userProfileURL: process.env.ONSHAPE_OAUTH_USERPROFILE_URL,
    },
    function verify(accessToken, refreshToken, profile, cb) {
      console.log("accessToken", accessToken);
      console.log("refreshToken", refreshToken);
      console.log("profile", profile);
      profile.accessToken = accessToken;
      profile.refreshToken = refreshToken;
      console.log("profile", profile);
      // Gets called on successful authentification
      // Insert user into database
      User.findOne({ userId: profile.id }, async (err, doc) => {
        if (err) {
          return cb(err, null);
        }

        if (!doc) {
          const newUser = new User({
            userId: profile.id,
            username: profile.displayName,
            emails: profile.emails,
            accessToken: accessToken,
            refreshToken: refreshToken,
          });
          // TODO:Something below fails. The other path works.
          // Add user to database
          await newUser.save();
          cb(null, newUser);
        }
        cb(null, doc);
      });
    }
  )
);

// #1 Configure the Onshape strategy for use by Passport
app.get("/auth/onshape", passport.authenticate("onshape"));

app.use(
  "/auth/onshapeApp",
  (req, res) => {
    // console.log("XXX req.query.documentId:", req.query.documentId);
    // console.log("req.query.workspaceId:", req.query.workspaceId);
    // console.log("req.query.elementId:", req.query.elementId);
    const state = {
      documentId: req.query.documentId,
      workspaceId: req.query.workspaceId,
      elementId: req.query.elementId,
      userId: req.query.userId,
    };
    req.session.state = state;
    return passport.authenticate("onshape", { state: uuidv4(state) })(req, res);
  },
  (req, res) => {
    console.log(
      "this should NEVER run"
    ); /* redirected to Onshape for authentication */
  }
);

// app.use("/oauthSignin", storeExtraParams, function (req, res) {
//   // The request will be redirected to Onshape for authentication, so this
//   // function will not be called.
// });

// return passport.authenticate("onshape", { state: id })(req, res);

// var StateMap = {};
// function storeExtraParams(req: any, res: any) {
//   var docId = req.query.documentId;
//   var workId = req.query.workspaceId;
//   var elId = req.query.elementId;
//   var state = {
//     documentId: docId,
//     workspaceId: workId,
//     elementId: elId,
//   };
//   var stateString = JSON.stringify(state);
//   var uniqueID = "state" + passport.session();
//   // Save the d/w/e to Redis instead of a global
//   client.set(uniqueID, stateString);
//   var id = uuid.v4(state);
//   StateMap[id] = state;
//   return passport.authenticate("onshape", { state: id })(req, res);
// }

// #3 processes the authentication response and logs the user in, after Onshape redirects the user back to the app:
app.get(
  "/auth/onshape/callback",
  passport.authenticate("onshape", {
    failureRedirect: "https://legendary-axolotl-5825c7.netlify.app/login",
  }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect("https://legendary-axolotl-5825c7.netlify.app/");
  }
);

app.get("/test", (req, res) => {
  res.send("Hello World Test");
});

// This deserializes the user behind the scenes
app.get("/getUser", (req, res) => {
  console.log("getUser req.user", req.user);
  console.log("req.sessionID", req.sessionID);
  res.send(req.user);
});

app.get("/taco", (req, res) => {
  console.log("getUser req.user", req.user);
  console.log("req.sessionID", req.sessionID);
  res.send("tacos");
});

// logout does not clear the cookie
app.post("/auth/logout", (req, res, next) => {
  console.log("logout called");
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    // res.clearCookie(cookieName);
    res.send("done");
  });
});

app.get("/sandwich", async (req, res) => {
  const baloney = {
    did: req.query.documentId,
    wid: req.query.workspaceId,
    elementId: req.query.elementId,
    userId: req.query.userId,
    //   // partId: req.query.partId,
    //  accessToken: req.user.accessToken,
    //   // req.session.passport.user.id,
  };
  console.log("req.user", req.user);
  console.log("req.session", req.session);

  let authorization = "";
  User.findOne({ userId: req.query.userId }, function (err, doc) {
    if (err) {
      console.log(err);
    } else {
      console.log("Result : ", doc.accessToken);
      authorization = doc.accessToken;
    }
  });

  const headers = {
    headers: {
      Authorization: `Bearer ogWzRdsanW4UsZz7aa2xtQ==`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  // const headers = {
  //   headers: {
  //     Authorization: `Bearer ${authorization}`,
  //     "Content-Type": "application/json",
  //     Accept: "application/json",
  //   },
  // };

  const osEndpoint = `https://cad.onshape.com/api/users/${req.query.userId}/settings?includematerials=false`;

  const data = await axios
    .get(osEndpoint, headers)
    .then((response) => {
      // console.log(response.data)
      return response.data;
    })
    .catch((error) => {
      const msg = `There was an error in your call to ${osEndpoint}!: ${JSON.stringify(
        error.response.data
      )}`;
      console.error(msg);
      return { msg: msg };
    });

  // console.log("baloney", baloney);
  res.json(data);
});

app.listen(process.env.PORT, () => {
  console.log(`Server Started on port: ${process.env.PORT}`);
});
