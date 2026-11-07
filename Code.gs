/**
 * セレクト君 同期用スクリプト（Google スプレッドシートに貼り付けて使います）
 * 1. 下の KEY を好きな合言葉に変える（アプリの設定にも同じ合言葉を入れます）
 * 2. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *    実行するユーザー：自分　／　アクセスできるユーザー：全員
 * 3. 表示された「ウェブアプリのURL」（…/exec）をアプリの設定に入れる
 */
const KEY = 'ここに合言葉';

const DATA_FILE = 'select-kun-data.json';   // 全データ（スプレッドシートと同じフォルダに作られます）
const PHOTO_FOLDER = 'select-kun-photos';   // 写真の保存フォルダ
const SHEET_NAME = 'オススメ一覧';           // 見る用の一覧シート

function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) {
  var p = {};
  try { p = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(p);
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function handle_(p) {
  if (!p.key || p.key !== KEY) return out_({ ok: false, error: '合言葉が違います' });
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    switch (p.action) {
      case 'ping':     return out_({ ok: true });
      case 'load':     return out_({ ok: true, data: readData_(), photos: listPhotos_() });
      case 'save':     writeData_(p.data); writeSheet_(p.data); return out_({ ok: true });
      case 'putPhoto': putPhoto_(p.id, p.data); return out_({ ok: true });
      case 'photo':    return out_({ ok: true, data: getPhoto_(p.id) });
      case 'delPhoto': delPhoto_(p.id); return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- 保存場所 ---------- */
function folder_() {
  var ss = SpreadsheetApp.getActive();
  var parents = DriveApp.getFileById(ss.getId()).getParents();
  return parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
}
function photoFolder_() {
  var f = folder_(), it = f.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : f.createFolder(PHOTO_FOLDER);
}

/* ---------- データ ---------- */
function readData_() {
  var it = folder_().getFilesByName(DATA_FILE);
  if (!it.hasNext()) return null;
  return JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
}
function writeData_(d) {
  var json = JSON.stringify(d), f = folder_(), it = f.getFilesByName(DATA_FILE);
  if (it.hasNext()) it.next().setContent(json);
  else f.createFile(DATA_FILE, json, MimeType.PLAIN_TEXT);
}

/* ---------- 写真 ---------- */
function photoFile_(id) {
  var it = photoFolder_().getFilesByName(id + '.jpg');
  return it.hasNext() ? it.next() : null;
}
function listPhotos_() {
  var ids = [], it = photoFolder_().getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (!f.isTrashed()) ids.push(f.getName().replace(/\.jpg$/, ''));
  }
  return ids;
}
function putPhoto_(id, dataUrl) {
  if (!id || !dataUrl || photoFile_(id)) return;
  var b64 = String(dataUrl).split(',')[1];
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', id + '.jpg');
  photoFolder_().createFile(blob);
}
function getPhoto_(id) {
  var f = photoFile_(id);
  return f ? 'data:image/jpeg;base64,' + Utilities.base64Encode(f.getBlob().getBytes()) : null;
}
function delPhoto_(id) {
  var f = photoFile_(id);
  if (f) f.setTrashed(true);
}

/* ---------- 見る用の一覧シート ---------- */
var PREFS_ = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
  '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
var DOW_ = ['日','月','火','水','木','金','土','祝'];
function writeSheet_(d) {
  if (!d || !d.spots) return;
  var genres = d.genres || [];
  var gName = function (id) { for (var i = 0; i < genres.length; i++) if (genres[i].id === id) return genres[i].name; return '未分類'; };
  var gIdx = function (id) { for (var i = 0; i < genres.length; i++) if (genres[i].id === id) return i; return 999; };
  var pIdx = function (p) { var i = PREFS_.indexOf(p || ''); return i < 0 ? 99 : i; };
  var spots = d.spots.slice().sort(function (a, b) {
    return gIdx(a.genre) - gIdx(b.genre) || pIdx(a.pref) - pIdx(b.pref) || String(a.name).localeCompare(String(b.name), 'ja');
  });
  var rows = [['ジャンル', '都道府県', '名前', '行けた', '行った日', '評価', '住所', '電話', '営業日', '営業時間', '休日', '金額', 'Web', 'コメント', '緯度', '経度', 'Googleマップ', '写真']];
  spots.forEach(function (s) {
    var days = (s.days || []).map(function (v, i) { return v ? DOW_[i] : ''; }).filter(String).join('・');
    rows.push([gName(s.genre), s.pref || '', s.name || '', s.visited ? '行けた' : 'まだ', s.vdate || '', s.star ? '★'.repeat(s.star) : '',
      s.addr || '', s.tel ? "'" + s.tel : '', days, s.hours || '', s.holiday || '', s.price || '', s.url || '', s.comment || '',
      s.lat == null ? '' : s.lat, s.lng == null ? '' : s.lng,
      s.lat == null ? '' : 'https://www.google.com/maps/search/?api=1&query=' + s.lat + ',' + s.lng,
      (s.photos || []).length || '']);
  });
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.clear();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#dcefe8');
}
