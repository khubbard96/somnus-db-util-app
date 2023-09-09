//rebuild the database from scratch
const https = require("https");
const USER_ID = ""

const FIRST_LEAGUE_YEAR = 2020;

//util function
function getData(url) {
  return new Promise((resolve, rej) => {
    https.get(url, (res) => {
      let data = "";

      // A chunk of data has been received.
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {resolve(JSON.parse(data))});
    });
  });
}

async function init() {
  //1. get status of the irl nfl
  const currentNflState = await getData("https://api.sleeper.app/v1/state/nfl");
  console.log("*** NFL STATE ***");
  console.log("Season: " + currentNflState.season);
  const CURRENT_NFL_SEASON = parseInt(currentNflState.season);
  console.log("Week: " + currentNflState.week);
  console.log("Season starts on: " + currentNflState.season_start_date);

  //2 need to get all historical leagues/seasons.
  console.log("\n*** HISTORICAL LEAGUES ***")

  //2.1 compile a list of all leagues between 2020 and the current year
  const historicalLeagueIds = [];
  //2.1.1 find the first league. started in 2020. league name cannot change so we search by that
  console.log("Looking for the initial league from the " + FIRST_LEAGUE_YEAR + " season...")
  const firstLeagueData = await getData(`https://api.sleeper.app/v1/user/${USER_ID}/leagues/nfl/${FIRST_LEAGUE_YEAR}`);
  const initialLeague = firstLeagueData.find((league)=>{
    return league.name === "Dynasty league 2020"
  });
  if(!initialLeague) {
    console.log("\n*** ERROR: could not find the initial league. Exiting. ***")
    return;
  }
  const initialLeagueId = initialLeague.league_id;
  historicalLeagueIds.push(initialLeagueId);
  console.log("Found the league from year " + FIRST_LEAGUE_YEAR);

  //2.1.2 get the rest of the leagues thru the current irl year using the previous league's id

  let i = 1;
  while(FIRST_LEAGUE_YEAR + i <= CURRENT_NFL_SEASON) {
    console.log("Looking for the next league from the " + (FIRST_LEAGUE_YEAR + i) + " season...")
    let historicalLeagueData = await getData(`https://api.sleeper.app/v1/user/${USER_ID}/leagues/nfl/${FIRST_LEAGUE_YEAR + i}`);
    if(!historicalLeagueData) {
        console.log("The leagues for the current NFL season, " + (FIRST_LEAGUE_YEAR + i) + ", have not yet been created.")
        break;
    }

    const theNextLeague = historicalLeagueData.find((league)=>{
        return league.previous_league_id === historicalLeagueIds[historicalLeagueIds.length - 1];
    })

    if(!theNextLeague) {
        console.log("An error occurred finding the next league, for year " + (FIRST_LEAGUE_YEAR + i));
        break;
    }
    console.log("Found the league from year " + (FIRST_LEAGUE_YEAR + i))
    historicalLeagueIds.push(theNextLeague.league_id)
    i++;
  }


  //3. get info about fantasy leagues (each year is considered an individual league, linked together via previous_league_id)
  const leagueYear = await getData(`https://api.sleeper.app/v1/league/${historicalLeagueIds[historicalLeagueIds.length - 1]}`);
  console.log("\n*** CURRENT LEAGUE STATE ***");
  console.log("League season: " + leagueYear.season);
  console.log("This league matches current NFL year: " + (leagueYear.season == currentNflState.season))
  console.log("League status: " + leagueYear.status)
}

init();
