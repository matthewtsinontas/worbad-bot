'use strict';
const fetch = require('node-fetch');

/**
 * Constants
 */
const { CHANNEL_ID, BOT_TOKEN } = process.env;
const SEP_KEY = "---";

/**
 * Utils
 */
const dateDiffInDays = (a, b) => {
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

const getMessages = async before => {
  const response = await fetch(`https://discord.com/api/v9/channels/${CHANNEL_ID}/messages?limit=100${before ? `&before=${before}` : ''}`, {
    headers: {
      Authorization: 'Bot ' + BOT_TOKEN
    }
  })
  return await response.json();
}

const flip = obj => {
  const newObj = {};

  Object.entries(obj).forEach(([k, v]) => {
    if (!newObj[v]) {
      newObj[v] = [];
    }
    newObj[v].push(k);
  });
  
  return newObj;
}

const flipScores = obj => Object.keys(obj).sort().reverse()

const getWinners = (results) => {
  let topScore = 6;
  let winners = [];

  results.forEach(res => {
    let [name, score] = res.split(SEP_KEY);
    score = parseInt(score, 10);

    if (score < topScore) {
      winners = [name],
      topScore = score;
    } else if (score === topScore) {
      winners.push(name);
    }
  })

  return { winners, topScore };
}

/**
 * Handler
 */
module.exports.run = async () => {
  const 
    firstWordle = new Date("19 June 2021"),
    todays = dateDiffInDays(firstWordle, new Date()),
    yesterday = todays - 1,
    msgs = [],
    results = {},
    participation = {},
    failed = {};

  let lastMsgId = "";
  let complete = false;
  
  while (!complete) {
    const nextSet = await getMessages(lastMsgId);
    msgs.push(...nextSet);
    if (nextSet.length < 100) {
      complete = true;
    } else {
      lastMsgId = nextSet[99].id;
    }
  }

  msgs.filter(m => m.content.startsWith("Wordle ")).forEach(m => {
    const { username } = m.author;
    const [_, number, scoreStr] = m.content.split("\n")[0].split(" ");
    const scoreValue = scoreStr[0];

    if (!results[number]) {
      results[number] = [];
    }

    if (!participation[username]) {
      participation[username] = 0;
    }

    if (scoreValue === "X") {
      if (!failed[username]) {
        failed[username] = 0;
      }
      failed[username]++;
    }

    participation[username]++;
    results[number].push(`${username}${SEP_KEY}${scoreValue}`);
  });

  const keys = Object.keys(results).sort();

  const scores = keys.reduce((scores, key) => {
    const next = { ...scores };

    const { winners } = getWinners(results[key])

    winners.forEach(w => {
      if (!next[w]) {
        next[w] = 0;
      }
      next[w]++;
    })
    
    return next;
  }, {});

  const leaderboardScores = flip(scores);
  const leaderboardPart = flip(participation);
  const leaderboardFail = flip(failed);

  const [firstScore, secondScore, thirdScore] = flipScores(leaderboardScores);
  const [firstPart, secondPart, thirdPart] = flipScores(leaderboardPart);
  const [firstFail] = flipScores(leaderboardFail);

  const { winners: ydayWinners, topScore: ydayScore } = getWinners(results[String(yesterday)]);

  const content = `A new Wordle is out! https://www.powerlanguage.co.uk/wordle/
  
  //imagine being bad by the way - ur bad

📊 Stats: 

  **Wordle ${yesterday}**

  Winner: **${ydayWinners.join(", ")}** with a score of **${ydayScore}**
  Participants: **${results[String(yesterday)].length} people**

  Total Wordles completed: **${keys.length}**
  Total attempts: **${Object.values(participation).reduce((prev, curr) => prev + curr)}**

🏆 Leaderboards:

  Winners:

    🥇 1st: ${firstScore}pts - **${leaderboardScores[firstScore].join(", ")}**
    🥈 2nd: ${secondScore}pts - **${leaderboardScores[secondScore].join(", ")}**
    🥉 3rd: ${thirdScore}pts - **${leaderboardScores[thirdScore].join(", ")}**

  Participants:

    🥇 1st: ${firstPart} puzzles - **${leaderboardPart[firstPart].join(", ")}**
    🥈 2nd: ${secondPart} puzzles - **${leaderboardPart[secondPart].join(", ")}**
    🥉 3rd: ${thirdPart} puzzles - **${leaderboardPart[thirdPart].join(", ")}**
  
  The bad bad bad bad bad award for most incorrect answers:

    💩 ${firstFail} incorrect answer(s) - **${leaderboardFail[firstFail].join(", ")}**

------

BEEP BOOP, I AM A ROBOT. If you have any suggestions on how I can suck less shoot them over to my wonderful creator @SnuglyNugly

`;

  const response = await fetch(`https://discord.com/api/v9/channels/${CHANNEL_ID}/messages`, {
    method: 'post',
    body: JSON.stringify({ content, tts: false }),
    headers: {
      Authorization: 'Bot ' + BOT_TOKEN,
      'Content-Type': 'application/json'
    }
  });

  return await response.json();
};

