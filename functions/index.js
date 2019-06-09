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
    const { username=gaearon, limit=5, self, password} = req.query;
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
            const response = await axios({
                method: 'Get',
                url:`https://api.github.com/users/${username}/followers`,
                auth: {
                    username: self.toString(),
                    password: password.toString()
                }
            });
            const followers = response.data;
            const levelOneIdsList = bringLimitBack(followers.map(follower => follower.id), limit);
            const followerUrlsList = bringLimitBack(followers.map(follwer => follwer.followers_url), limit);

            //level two -- Get follower of followers (children)
            const levelTwoIdsList = [];
            const levelTwoUrlsList = [];
            for(const url of followerUrlsList) {
                const response = await axios({
                    method: 'Get',
                    url: url.toString(),
                    auth: {
                        username: self.toString(),
                        password: password.toString()
                    }
                });
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
                        const response = await axios({
                            method: 'Get',
                            url: url.toString(),
                            auth: {
                                username: self.toString(),
                                password: password.toString()
                            }
                        });
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
 
    /**
     * The display function parses the data that was collected in the main function and formats it for sending as a JSON object.
     */
    const display = async ()=>{
        const [ids, levelTwoIdsList, levelThreeIdsList] = await main();   
        
        //We use count to handle state for injecting level 3 followers inside level 2 object
        let count = 0;
        const level3 = () =>{
            count++;
            return levelThreeIdsList[count-1]
        }
        // level 2 returns a map of data for level 2 followers.
        const level2 = (index)=>{
            const lev2 = [];
            levelTwoIdsList[index].forEach((value)=>{
                let obj = {}
                obj.levelTwoFollowerId = value;
                obj.level3 = level3();
                lev2.push(obj)
            })
            return lev2
        }
        // genFollower returns the JSON array with all of our data.
        const genFollower = ()=>{
            const followers = []
            ids.forEach((id, index)=>{
                let follower = {};
                follower.id=id;
                follower.levelTwoFollowers = level2(index)
                followers.push(follower)
            })
            return followers
        }
      
        res.status(200).json({
            followers: genFollower()
        });
        
    };
    display();
});
const api = functions.https.onRequest(app);
module.exports = {
  api
};
