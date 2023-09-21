//rebuild the database from scratch
import https from "https";
import { MongoClient } from "mongodb";
import secrets from "./secrets.json" assert { type: "json"};
const USER_ID = secrets.SLEEPER_USER_ID;

const FIRST_LEAGUE_YEAR = 2020;

const mongoUrl = process.env.MONGO_URL || "localhost";
const mongoPort = process.env.MONGO_PORT || "27017";
const url = `mongodb://${mongoUrl}:${mongoPort}`;
const client = new MongoClient(url, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
});

//util function
function getData(url) {
    return new Promise((resolve, rej) => {
        https.get(url, (res) => {
            let data = "";

            // A chunk of data has been received.
            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                resolve(JSON.parse(data));
            });
        });
    });
}

async function init() {
    //1. get status of the irl nfl
    const currentNflState = await getData(
        "https://api.sleeper.app/v1/state/nfl"
    );
    console.log("*** NFL STATE ***");
    console.log("Season: " + currentNflState.season);
    const CURRENT_NFL_SEASON = parseInt(currentNflState.season);
    console.log("Week: " + currentNflState.week);
    console.log("Season starts on: " + currentNflState.season_start_date);

    //2 need to get all historical leagues/seasons.
    console.log("\n*** HISTORICAL LEAGUES ***");

    //2.1 compile a list of all leagues between 2020 and the current year
    const historicalLeagueIds = [];
    //2.1.1 find the first league. started in 2020. league name cannot change so we search by that
    console.log(
        "Looking for the initial league from the " +
            FIRST_LEAGUE_YEAR +
            " season..."
    );
    const firstLeagueData = await getData(
        `https://api.sleeper.app/v1/user/${USER_ID}/leagues/nfl/${FIRST_LEAGUE_YEAR}`
    );
    const initialLeague = firstLeagueData.find((league) => {
        return league.name === "Dynasty league 2020";
    });
    if (!initialLeague) {
        console.log(
            "\n*** ERROR: could not find the initial league. Exiting. ***"
        );
        return;
    }
    const initialLeagueId = initialLeague.league_id;
    historicalLeagueIds.push(initialLeagueId);
    console.log("Found the league from year " + FIRST_LEAGUE_YEAR);

    //2.1.2 get the rest of the leagues thru the current irl year using the previous league's id

    let i = 1;
    while (FIRST_LEAGUE_YEAR + i <= CURRENT_NFL_SEASON) {
        console.log(
            "Looking for the next league from the " +
                (FIRST_LEAGUE_YEAR + i) +
                " season..."
        );
        let historicalLeagueData = await getData(
            `https://api.sleeper.app/v1/user/${USER_ID}/leagues/nfl/${
                FIRST_LEAGUE_YEAR + i
            }`
        );
        if (!historicalLeagueData) {
            console.log(
                "The leagues for the current NFL season, " +
                    (FIRST_LEAGUE_YEAR + i) +
                    ", have not yet been created."
            );
            break;
        }

        const theNextLeague = historicalLeagueData.find((league) => {
            return (
                league.previous_league_id ===
                historicalLeagueIds[historicalLeagueIds.length - 1]
            );
        });

        if (!theNextLeague) {
            console.log(
                "An error occurred finding the next league, for year " +
                    (FIRST_LEAGUE_YEAR + i)
            );
            break;
        }
        console.log("Found the league from year " + (FIRST_LEAGUE_YEAR + i));
        historicalLeagueIds.push(theNextLeague.league_id);
        i++;
    }

    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("client connected successfully");
    } catch (err) {
        console.log(err);
    }

    const sleeperDb = await client.db("sleeper");

    //3.1 load league data
    console.log("loading leagues data");
    for (let i = 0; i < historicalLeagueIds.length; i++) {
        const sleeperLeagueData = await getData(
            `https://api.sleeper.app/v1/league/${historicalLeagueIds[i]}`
        );
        await sleeperDb.collection("leagues").insertOne(sleeperLeagueData);
    }
    console.log("leagues data loading complete");

    //3.2 load roster data
    console.log("loading rosters data.");
    for (let i = 0; i < historicalLeagueIds.length; i++) {
        const sleeperRostersData = await getData(
            `https://api.sleeper.app/v1/league/${historicalLeagueIds[i]}/rosters`
        );
        for (let j = 0; j < sleeperRostersData.length; j++) {
            await sleeperDb
                .collection("rosters")
                .insertOne(sleeperRostersData[j]);
        }
    }
    console.log("roster data loading complete.");

    //3.3 load user data
    console.log("loading user data");
    for (let i = 0; i < historicalLeagueIds.length; i++) {
        const sleeperUsersData = await getData(
            `https://api.sleeper.app/v1/league/${historicalLeagueIds[i]}/users`
        );
        for (let j = 0; j < sleeperUsersData.length; j++) {
            sleeperUsersData[j].league_id = historicalLeagueIds[i];
            await sleeperDb.collection("users").insertOne(sleeperUsersData[j]);
        }
    }
    console.log("user data loading complete");

    //3.4 load matchups data
    //this one is alittle tougher because the api call requires you to specify a week number, so we need to know how many weeks were in any given season
    console.log("loading matchup data");
    for (let i = 0; i < historicalLeagueIds.length; i++) {
        const leagueId = historicalLeagueIds[i];
        const theLeague = await sleeperDb
            .collection("leagues")
            .findOne({ league_id: leagueId });
        const weeksInLeague =
            parseInt(theLeague.settings.playoff_week_start) - 1;
        for (let j = 1; j <= weeksInLeague; j++) {
            const weeklyMatchupData = await getData(
                `https://api.sleeper.app/v1/league/${leagueId}/matchups/${j}`
            );
            for(let k = 0; k < weeklyMatchupData.length; k++){
                weeklyMatchupData[k].week = j;
                weeklyMatchupData[k].league_id = leagueId;
                await sleeperDb.collection("matchups").insertOne(weeklyMatchupData[k]);
            }
        }
    }
    console.log("matchup data loading complete.")

    client.close();
}

init();
