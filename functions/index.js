const functions = require("firebase-functions");
const express = require("express");
const app = express();
const cors = require("cors");
const compression = require("compression");
const axios = require("axios");
const morgan = require("morgan");
const bringLimitBack = require('./lib')

//Middlewares
app.use(cors({ origin: true }));
app.use(compression());
app.use(morgan("tiny"));

//Routes
app.get("/v1/", (req, res) => {
    const { username=gaearon, limit=5 } = req.query;
    if (req.method !== "GET") {
      res.status(401).json({
        message: "Not allowed, please make a GET request"
      });
    }
    if (!username) {
      res.status(400).json({
        status: "failure",
        message: "please be sure to include a username parameter"
      });
    }
    /**
     * The "main" function makes serveral async get request to the Github v3 api. 
     * The purpose of the main function is to retrieve data on Github users followers (3 levels deep)
     */
    const main = async ()=>{
        try {
            //level one  -- Get followers of user
            const response = await axios.get(`https://api.github.com/users/${username}/followers`);
            const followers = response.data;
            const levelOneIdsList = bringLimitBack(followers.map(follower => follower.id), limit);
            const followerUrlsList = bringLimitBack(followers.map(follwer => follwer.followers_url), limit);

            //level two -- Get follower of followers (children)
            const levelTwoIdsList = [];
            const levelTwoUrlsList = [];
            for(const url of followerUrlsList) {
                const response = await axios.get(url.toString());
                const levelTwoFollower = response.data;
                const levelTwoIds = bringLimitBack(levelTwoFollower.map(follower => follower.id), limit);
                const LevelTwoFollowerUrls = bringLimitBack(levelTwoFollower.map(follwer => follwer.followers_url), limit);

                levelTwoIdsList.push(levelTwoIds);
                levelTwoUrlsList.push(LevelTwoFollowerUrls);   
            }

            //level three - Get followers of followers of followers (grand children)
            const levelThreeIdsList = [];
            const levelThreeUrlsList = [];
            for(const urlgroup of levelTwoUrlsList){
                for(url of urlgroup){
                    if(url !== []){
                        const response = await axios.get(url.toString());
                        const levelThreeFollower = response.data;
                        const levelThreeIds = bringLimitBack(levelThreeFollower.map(follower => follower.id), limit);
                        const LevelThreeFollowerUrls = bringLimitBack(levelThreeFollower.map(follwer => follwer.followers_url), limit);
        
                        levelThreeIdsList.push(levelThreeIds);
                        levelThreeUrlsList.push(LevelThreeFollowerUrls);
                    }
                }
            }
            return [levelOneIdsList, levelTwoIdsList, levelThreeIdsList];
        } catch (error) {
            console.error(error);
        }
        return [levelOneIdsList, levelTwoIdsList, levelThreeIdsList];
    };

    const display = async ()=>{
        const [ids, levelTwoIdsList, levelThreeIdsList] = await main();
        const itemList = [];
        ids.forEach((ids,index)=>{
            const item = {};
            item.id = ids;
            item.levelTwo = levelTwoIdsList[index];
            item.levelThree = levelThreeIdsList[index]
            itemList.push(item);
        });
        if(itemList.length<=0){
            res.status(500).json({
                message: "internal server error"
            });
        }else {
            res.status(200).json({
                Followers: itemList
            });
        }
    };
    display();
});
const api = functions.https.onRequest(app);
module.exports = {
  api
};
