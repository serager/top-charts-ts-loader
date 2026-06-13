import { google } from "googleapis"



const SHEET_ID = '15ad6G-j2aomIpgNYlEFB9bWEqoyCCMABdanOJhXN47g';
const RANGE = 'CISCCUP!B1:K15';
const TOPCHARTS_ENDPOINT = 'http://localhost:3000/events';


;(async () => {
  const auth = new google.auth.JWT({
    keyFile: '/Users/sradyukov/Developer/prime-victory-390119-d7acd0c67e64.json',
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  })
  const sheet = google.sheets("v4")

  const sheetData = await sheet.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    auth: auth,
    range: RANGE,
  })
  const rows = sheetData.data.values;
  if (rows) {
    const parsedRows = mapCiscCup(rows);
    console.log('parsed teams', parsedRows);
    await submitTopCharts(
      'TEST-CISCCUP-4',
      'TEST-CISCCUP-4',
      new Date(),
      parsedRows
    );
  }
})()


/**
 * Parse cisccup sheet to structs
 * @param rows
 */
function mapCiscCup(rows:any[][]):ParsedTeamRow[] {
    const [headRow, ...restRows] = rows;
     if (!headRow || headRow[0] != 'Team') {
        throw new Error('wrong sheet rows format: Not found Team header')
    }
    const [teamHeader, ...eventCodes] = headRow;

    const parsedRows:ParsedTeamRow[] = restRows.map((row) => {
        const [team, ...pointsArr] = row;

        const results = pointsArr.map((points, pointIdx) => {
            return {eventCode: eventCodes[pointIdx], points}
        })
        return {team, results}
    });
    return parsedRows;
}

type ParsedTeamRow = {team: string, results: ParsedTeamPoints[] }
type ParsedTeamPoints = { eventCode: string, points: string }


async function submitTopCharts(
  topic: string, 
  name: string, 
  date: Date,
  rows: ParsedTeamRow[]
) {
  const postEvents = rows.flatMap(teamRow => {
    return teamRow.results.map(teamResult => {
      const eventId = crypto.randomUUID();
      return {
        eventId,
        eventTime: date.toISOString(),
        eventName: teamResult.eventCode,
        topic: topic,
        participantId: teamRow.team,
        points: Number(teamResult.points.replace(",", "."))
      }
    })
  })
  try {
    const response = await fetch(TOPCHARTS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventTopic: {
          topic: topic,
          name: name,
          date: date.toISOString()
        },
        events: postEvents
      }),
    });

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Error posting data:', error);
  }
}