import { google } from "googleapis"



const SHEET_ID = '1w_EmVh1Zsol4GlO-wt6sqOYngDopQeRFxgU3qMAE7F8';
const RANGE = 'Pro!B2:H29';
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
    const parsedRows = mapCmfDrift(rows);
    console.log('parsed teams', parsedRows);
    await submitTopCharts(
      'TEST-2025-CMF-DRIFT-1',
      'TEST-2025-CMF-DRIFT-1',
      parsedRows
    );
  }
})()


/**
 * Parse cisccup sheet to structs
 * @param rows
 */
function mapCmfDrift(rows:any[][]):ParsedTeamRow[] {
    const [headRow1, headRow2, ...restRows] = rows;
     if (!headRow2 || headRow2[0] != 'Name') {
        throw new Error('wrong sheet rows format: Not found Name header')
    }
    const [e1, e2, ...eventDates] = headRow1;
    const [nameHeader, carHeader, ...eventCodes] = headRow2;

    const parsedRows:ParsedTeamRow[] = restRows.map((row) => {
        const [nameCol, carCol, ...pointsArr] = row;

        const results = pointsArr.map((points, pointIdx) => {
            return {eventCode: eventCodes[pointIdx], date: eventDates[pointIdx] ,points}
        })
        return {name: nameCol, car: carCol, results}
    });
    return parsedRows;
}

type ParsedTeamRow = {name: string, car: string, results: ParsedTeamPoints[] }
type ParsedTeamPoints = { eventCode: string, date: string, points: string }

function parseDate(date: string) {
  const [day, month, year] = date.split('.').map(Number)
  if (!day || !month || !year) {
    throw new Error('date parse error')
  }
  return new Date(2000+year, month-1, day).toISOString()
}

async function submitTopCharts(
  topic: string, 
  name: string, 
  rows: ParsedTeamRow[]
) {
  const postEvents = rows.flatMap(teamRow => {
    return teamRow.results.map(teamResult => {
      const eventId = crypto.randomUUID();
      return {
        eventId,
        eventTime: parseDate(teamResult.date),
        eventName: teamResult.eventCode,
        topic: topic,
        participantId: teamRow.name,
        points: Number(teamResult.points),
        meta: { car : teamRow.car }
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
          date: new Date().toISOString()
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