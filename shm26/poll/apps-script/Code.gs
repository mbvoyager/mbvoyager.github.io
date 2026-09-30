/**
 * Backend of the anonymous poll at https://mbvoyager.github.io/shm26/poll/
 *
 * Every answer is stored as one row (timestamp, day, answer) in the sheet "votes".
 * The sheet "daily" keeps one row per day (Europe/Berlin) with the number of answers
 * per option. doGet returns these counts as JSON for the results page.
 *
 * Setup, once (about five minutes):
 *  1. Create a new Google Sheet, e.g. "SHM26 poll".
 *  2. In the sheet: Extensions > Apps Script. Replace the content of Code.gs with
 *     this file and save.
 *  3. Deploy > New deployment > type "Web app".
 *     Execute as: Me. Who has access: Anyone. Deploy and authorise the access to the sheet.
 *  4. Copy the web-app URL (ends with /exec) into shm26/poll/config.js ("endpoint").
 *  5. Commit and push. Open https://mbvoyager.github.io/shm26/poll/results/ to check.
 *
 * After editing this script, use Deploy > Manage deployments > Edit > Version: New version,
 * so that the web-app URL stays the same.
 * Test answers can be deleted in the sheet "votes"; afterwards run rebuildDaily() once
 * from the editor to recompute the sheet "daily".
 *
 * Privacy: for "Anyone" deployments, Apps Script receives neither the IP address nor the
 * identity of a visitor. Only the time of submission and the chosen answer are stored.
 */

var POLL_ID = 'shm26-ai-share';
var OPTIONS = ['0', '25', '50', '75', '100'];
var TIME_ZONE = 'Europe/Berlin';
var VOTES = 'votes';
var DAILY = 'daily';

function doPost(e) {
  var data;
  try {
    data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'invalid request' });
  }
  if (data.poll !== POLL_ID) {
    return json_({ ok: false, error: 'unknown poll' });
  }
  var answer = String(data.answer);
  if (OPTIONS.indexOf(answer) === -1) {
    return json_({ ok: false, error: 'invalid answer' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var now = new Date();
    var day = Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var votes = sheet_(ss, VOTES, ['timestamp', 'day', 'answer_percent']);
    votes.appendRow([now, "'" + day, Number(answer)]);
    addToDaily_(ss, day, answer);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var body = JSON.stringify(summary_());
  var cb = params.callback;
  if (cb && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/** Recomputes the sheet "daily" from the sheet "votes" (e.g. after deleting test answers). */
function rebuildDaily() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var daily = dailySheet_(ss);
  if (daily.getLastRow() > 1) {
    daily.getRange(2, 1, daily.getLastRow() - 1, OPTIONS.length + 2).clearContent();
  }
  var votes = ss.getSheetByName(VOTES);
  if (!votes || votes.getLastRow() < 2) return;
  var rows = votes.getRange(2, 1, votes.getLastRow() - 1, 3).getValues();
  rows.forEach(function (r) {
    var answer = String(r[2]);
    if (OPTIONS.indexOf(answer) !== -1) addToDaily_(ss, dayString_(r[1] || r[0]), answer);
  });
}

function addToDaily_(ss, day, answer) {
  var daily = dailySheet_(ss);
  var row = findDayRow_(daily, day);
  if (row === -1) {
    var fresh = ["'" + day];
    OPTIONS.forEach(function () { fresh.push(0); });
    fresh.push(0);
    daily.appendRow(fresh);
    row = daily.getLastRow();
  }
  var col = OPTIONS.indexOf(answer) + 2;
  var totalCol = OPTIONS.length + 2;
  var cell = daily.getRange(row, col);
  cell.setValue((Number(cell.getValue()) || 0) + 1);
  var total = daily.getRange(row, totalCol);
  total.setValue((Number(total.getValue()) || 0) + 1);
}

function summary_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var daily = ss.getSheetByName(DAILY);
  var total = {};
  OPTIONS.forEach(function (o) { total[o] = 0; });
  var days = [];
  if (daily && daily.getLastRow() > 1) {
    var values = daily.getRange(2, 1, daily.getLastRow() - 1, OPTIONS.length + 2).getValues();
    values.forEach(function (r) {
      if (r[0] === '' || r[0] === null) return;
      var counts = {};
      var n = 0;
      OPTIONS.forEach(function (o, i) {
        var c = Number(r[i + 1]) || 0;
        counts[o] = c;
        total[o] += c;
        n += c;
      });
      days.push({ day: dayString_(r[0]), counts: counts, total: n });
    });
  }
  days.sort(function (a, b) { return a.day < b.day ? -1 : a.day > b.day ? 1 : 0; });
  var grand = 0;
  OPTIONS.forEach(function (o) { grand += total[o]; });
  return {
    ok: true,
    poll: POLL_ID,
    options: OPTIONS.map(Number),
    total: total,
    n: grand,
    days: days,
    generated: new Date().toISOString()
  };
}

function dailySheet_(ss) {
  var header = ['day'];
  OPTIONS.forEach(function (o) { header.push(o + ' %'); });
  header.push('total');
  return sheet_(ss, DAILY, header);
}

function sheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function findDayRow_(sheet, day) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var values = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (dayString_(values[i][0]) === day) return i + 2;
  }
  return -1;
}

function dayString_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TIME_ZONE, 'yyyy-MM-dd');
  return String(v).replace(/^'/, '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
