/**
 * Private storage endpoint for the AULA-IA Cloudflare Worker.
 * Configure SPREADSHEET_ID and AULA_STORAGE_SECRET in Script Properties.
 * Schema.gs declares the only tables and columns this endpoint can access.
 */
var AULA_STORAGE_VERSION_ = 1;
var AULA_MAX_CELL_CHARS_ = 45000;
var AULA_UUID_ = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function doGet() {
  return storageJson_({ ok: false, version: 1, error: { code: 'METHOD_NOT_ALLOWED', message: 'Utiliza el servicio desde AULA-IA.' } });
}

function doPost(event) {
  var requestId = '';
  try {
    var text = event && event.postData && event.postData.contents;
    if (typeof text !== 'string' || !text || text.length > 1000000) storageFail_('INVALID_REQUEST');
    var request;
    try { request = JSON.parse(text); } catch (_) { storageFail_('INVALID_REQUEST'); }
    if (!storageRecord_(request)) storageFail_('INVALID_REQUEST');
    if (typeof request.requestId === 'string' && AULA_UUID_.test(request.requestId)) requestId = request.requestId;
    var settings = storageSettings_();
    if (!storageSecretEqual_(request.secret, settings.secret)) storageFail_('UNAUTHORIZED');
    if (request.action !== 'storage' || request.version !== AULA_STORAGE_VERSION_ || !requestId) storageFail_('INVALID_REQUEST');
    var definition = storageDefinition_(request.table);
    storageValidateRequest_(request, definition);
    var result = storageWithLock_(function () {
      var spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
      var sheet = spreadsheet.getSheetByName(definition.tab);
      if (!sheet) storageFail_('NOT_CONFIGURED');
      storageValidateHeaders_(sheet, definition);
      return storageExecute_(request, definition, sheet, settings.spreadsheetId);
    });
    return storageJson_({ ok: true, version: 1, requestId: requestId, result: result });
  } catch (error) {
    var code = error && error.aulaStorageCode || 'STORAGE_FAILED';
    return storageJson_({ ok: false, version: 1, requestId: requestId, error: { code: code, message: storageMessage_(code) } });
  }
}

/** Run once in the Apps Script editor; creates APP_ tabs without touching legacy tabs. */
function setupStorage() {
  var settings = storageSettings_();
  return storageWithLock_(function () {
    var spreadsheet = SpreadsheetApp.openById(settings.spreadsheetId);
    var tables = Object.keys(AULA_SCHEMA);
    var prepared = [];
    tables.forEach(function (table) {
      var definition = storageDefinition_(table);
      var sheet = spreadsheet.getSheetByName(definition.tab);
      if (!sheet) sheet = spreadsheet.insertSheet(definition.tab);
      if (sheet.getLastRow() === 0) {
        storageEnsureGrid_(sheet, 1, definition.columns.length + 1);
        SpreadsheetApp.flush();
        storageWriteRaw_(settings.spreadsheetId, definition.tab, 1, definition.columns.concat(['_requestId']));
      } else {
        storageValidateHeaders_(sheet, definition);
      }
      prepared.push(definition.tab);
    });
    return { ok: true, version: 1, tables: prepared };
  });
}

function storageSettings_() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  var secret = properties.getProperty('AULA_STORAGE_SECRET');
  if (!spreadsheetId || !secret || secret.length < 32) storageFail_('NOT_CONFIGURED');
  return { spreadsheetId: spreadsheetId, secret: secret };
}

function storageSecretEqual_(provided, expected) {
  if (typeof provided !== 'string' || provided.length > 512) return false;
  var difference = provided.length ^ expected.length;
  for (var index = 0; index < Math.max(provided.length, expected.length); index += 1) {
    difference |= (provided.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function storageWithLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) storageFail_('BUSY');
  try { return callback(); } finally { lock.releaseLock(); }
}

function storageDefinition_(table) {
  if (typeof AULA_SCHEMA !== 'object' || typeof table !== 'string' || !storageOwn_(AULA_SCHEMA, table)) storageFail_('INVALID_REQUEST');
  var definition = AULA_SCHEMA[table];
  if (!definition || !/^APP_[A-Z0-9_]+$/.test(definition.tab) || !Array.isArray(definition.columns) || !definition.columns.length || definition.columns.indexOf('_requestId') !== -1) storageFail_('NOT_CONFIGURED');
  return definition;
}

function storageValidateHeaders_(sheet, definition) {
  var expected = definition.columns.concat(['_requestId']);
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() !== expected.length) storageFail_('HEADER_MISMATCH');
  var actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  if (actual.some(function (value, index) { return value !== expected[index]; })) storageFail_('HEADER_MISMATCH');
}

function storageValidateRequest_(request, definition) {
  if (['find', 'insert', 'upsert', 'insertIfAbsent', 'countBy'].indexOf(request.operation) === -1) storageFail_('INVALID_REQUEST');
  storageValidateFields_(request.filters || {}, definition, false, true);
  if (request.values !== undefined) storageValidateFields_(request.values, definition, false);
  if (request.updates !== undefined) storageValidateFields_(request.updates, definition, true);
  if (['insert', 'upsert', 'insertIfAbsent'].indexOf(request.operation) !== -1 && !storageRecord_(request.values)) storageFail_('INVALID_REQUEST');
  if (request.operation === 'countBy' && definition.columns.indexOf(request.field) === -1) storageFail_('INVALID_REQUEST');
  var options = request.options;
  if (options !== undefined) {
    if (!storageRecord_(options) || Object.keys(options).some(function (key) { return ['limit', 'orderBy', 'descending', 'columns'].indexOf(key) === -1; })) storageFail_('INVALID_REQUEST');
    if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 10000)) storageFail_('INVALID_REQUEST');
    if (options.orderBy !== undefined && definition.columns.indexOf(options.orderBy) === -1) storageFail_('INVALID_REQUEST');
    if (options.descending !== undefined && typeof options.descending !== 'boolean') storageFail_('INVALID_REQUEST');
    if (options.columns !== undefined && (!Array.isArray(options.columns) || options.columns.some(function (column) { return definition.columns.indexOf(column) === -1; }))) storageFail_('INVALID_REQUEST');
  }
}

function storageValidateFields_(fields, definition, allowOperations, allowId) {
  if (!storageRecord_(fields)) storageFail_('INVALID_REQUEST');
  Object.keys(fields).forEach(function (field) {
    if (definition.columns.indexOf(field) === -1 || (field === 'id' && !allowId)) storageFail_('INVALID_REQUEST');
    var value = fields[field];
    if (allowOperations && storageRecord_(value)) {
      if (value.op === 'increment' && definition.types[field] === 'number' && typeof value.value === 'number' && Number.isFinite(value.value) && Object.keys(value).every(function (key) { return key === 'op' || key === 'value'; })) return;
      if (value.op === 'timestamp' && definition.types[field] === 'string' && Object.keys(value).length === 1) return;
      storageFail_('INVALID_REQUEST');
    }
    storageValidateValue_(value, definition.types[field]);
  });
}

function storageValidateValue_(value, type) {
  if (value === null) return;
  if (typeof value !== type || (type === 'number' && !Number.isFinite(value)) || (type === 'string' && value.length > AULA_MAX_CELL_CHARS_)) storageFail_('INVALID_REQUEST');
}

function storageReadRows_(sheet, definition) {
  var count = sheet.getLastRow() - 1;
  if (count <= 0) return [];
  return sheet.getRange(2, 1, count, definition.columns.length + 1).getValues().map(function (cells, index) {
    if (cells.every(function (value) { return value === ''; })) return null;
    var row = {};
    definition.columns.forEach(function (column, columnIndex) {
      var value = cells[columnIndex];
      if (value === '' && definition.types[column] !== 'string') value = null;
      row[column] = value instanceof Date ? value.toISOString() : value;
    });
    var history = [];
    var encodedHistory = cells[definition.columns.length];
    if (encodedHistory) {
      try { history = JSON.parse(encodedHistory); } catch (_) { storageFail_('STORAGE_FAILED'); }
      if (!Array.isArray(history)) storageFail_('STORAGE_FAILED');
    }
    return { row: row, sheetRow: index + 2, history: history };
  }).filter(function (entry) { return entry !== null; });
}

function storageExecute_(request, definition, sheet, spreadsheetId) {
  var entries = storageReadRows_(sheet, definition);
  if (request.operation === 'find' || request.operation === 'countBy') {
    var matches = entries.map(function (entry) { return entry.row; }).filter(function (row) { return storageMatches_(row, request.filters || {}); });
    if (request.operation === 'countBy') {
      var counts = Object.create(null);
      matches.forEach(function (row) { var key = String(row[request.field]); counts[key] = (counts[key] || 0) + 1; });
      return Object.keys(counts).sort().map(function (category) { return { category: category, count: counts[category] }; });
    }
    var options = request.options || {};
    if (options.orderBy) matches.sort(function (a, b) {
      var left = a[options.orderBy]; var right = b[options.orderBy];
      var order = left === right ? 0 : left < right ? -1 : 1;
      return options.descending ? -order : order;
    });
    if (options.limit !== undefined) matches = matches.slice(0, options.limit);
    if (options.columns) matches = matches.map(function (row) {
      var selected = {}; options.columns.forEach(function (column) { selected[column] = row[column]; }); return selected;
    });
    return matches;
  }

  var replay;
  entries.some(function (entry) {
    var historyIndex = entry.history.findIndex(function (item) { return item.id === request.requestId; });
    if (historyIndex === -1) return false;
    if (historyIndex !== entry.history.length - 1 || entry.history[historyIndex].operation !== request.operation) storageFail_('RETRY_REPLACED');
    replay = request.operation === 'insertIfAbsent' ? { row: entry.row, inserted: entry.history[historyIndex].inserted === true } : entry.row;
    return true;
  });
  if (replay) return replay;

  var now = new Date().toISOString();
  // SQL defaults participate in unique keys too: S1 requests omit session,
  // and the initial diagnostic omits phase. Normalize before finding a row.
  var valuesWithDefaults = {};
  Object.keys(definition.defaults || {}).forEach(function (field) {
    var value = definition.defaults[field];
    valuesWithDefaults[field] = storageRecord_(value) && value.op === 'timestamp' ? now : value;
  });
  Object.keys(request.values).forEach(function (field) { valuesWithDefaults[field] = request.values[field]; });
  var uniqueKeys = storageUniqueKeys_(definition);
  var collision = entries.find(function (entry) {
    return uniqueKeys.some(function (keys) { return keys.every(function (key) { return valuesWithDefaults[key] !== undefined && entry.row[key] === valuesWithDefaults[key]; }); });
  });
  if (collision && request.operation === 'insert') storageFail_('DUPLICATE_RECORD');
  if (collision && request.operation === 'insertIfAbsent') return { row: collision.row, inserted: false };
  if (request.operation !== 'insert' && !uniqueKeys.length) storageFail_('INVALID_REQUEST');

  var row = {};
  definition.columns.forEach(function (field) {
    if (collision) row[field] = collision.row[field];
    else if (storageOwn_(definition.defaults || {}, field)) {
      var defaultValue = definition.defaults[field];
      row[field] = storageRecord_(defaultValue) && defaultValue.op === 'timestamp' ? now : defaultValue;
    } else row[field] = null;
  });
  if (!collision) {
    Object.keys(request.values).forEach(function (field) { row[field] = request.values[field]; });
    if (definition.columns.indexOf('id') !== -1) row.id = entries.reduce(function (maximum, entry) { return Math.max(maximum, Number(entry.row.id) || 0); }, 0) + 1;
  } else {
    Object.keys(request.updates || {}).forEach(function (field) {
      var update = request.updates[field];
      row[field] = storageRecord_(update) ? update.op === 'timestamp' ? now : Number(row[field] || 0) + update.value : update;
    });
  }
  definition.columns.forEach(function (field) {
    storageValidateValue_(row[field], definition.types[field]);
    if ((definition.required || []).indexOf(field) !== -1 && (row[field] === null || row[field] === undefined)) storageFail_('INVALID_REQUEST');
  });
  var history = collision ? collision.history.slice() : [];
  history.push({ id: request.requestId, operation: request.operation, inserted: !collision });
  var historyJson = JSON.stringify(history);
  if (historyJson.length > AULA_MAX_CELL_CHARS_) storageFail_('HISTORY_FULL');
  var cells = definition.columns.map(function (field) { return row[field] === null ? '' : row[field]; }).concat([historyJson]);
  var targetRow = collision ? collision.sheetRow : sheet.getLastRow() + 1;
  storageEnsureGrid_(sheet, targetRow, cells.length);
  storageWriteRaw_(spreadsheetId, definition.tab, targetRow, cells);
  return request.operation === 'insertIfAbsent' ? { row: row, inserted: true } : row;
}

function storageUniqueKeys_(definition) {
  var keys = definition.unique || [];
  return keys.length && typeof keys[0] === 'string' ? [keys] : keys;
}

function storageMatches_(row, filters) {
  return Object.keys(filters).every(function (field) { return row[field] === filters[field]; });
}

function storageEnsureGrid_(sheet, requiredRows, requiredColumns) {
  var columns = sheet.getMaxColumns();
  var rows = sheet.getMaxRows();
  var expanded = false;
  if (requiredColumns > columns) { sheet.insertColumnsAfter(columns, requiredColumns - columns); expanded = true; }
  if (requiredRows > rows) { sheet.insertRowsAfter(rows, requiredRows - rows); expanded = true; }
  if (expanded) SpreadsheetApp.flush();
}

/** RAW preserves arbitrary text exactly; '=SUM(...)' is never evaluated. */
function storageWriteRaw_(spreadsheetId, tab, row, cells) {
  var range = "'" + tab.replace(/'/g, "''") + "'!A" + row + ':' + storageColumnName_(cells.length) + row;
  Sheets.Spreadsheets.Values.update({ values: [cells] }, spreadsheetId, range, { valueInputOption: 'RAW' });
}

function storageColumnName_(column) {
  var result = '';
  while (column > 0) { column -= 1; result = String.fromCharCode(65 + column % 26) + result; column = Math.floor(column / 26); }
  return result;
}

function storageRecord_(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function storageOwn_(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
function storageFail_(code) { var error = new Error(code); error.aulaStorageCode = code; throw error; }
function storageMessage_(code) {
  var messages = {
    UNAUTHORIZED: 'No se pudo autorizar el acceso al almacenamiento.',
    INVALID_REQUEST: 'La solicitud de almacenamiento no es válida.',
    NOT_CONFIGURED: 'El almacenamiento todavía no está configurado.',
    HEADER_MISMATCH: 'La estructura de una hoja requiere revisión del responsable.',
    BUSY: 'Hay otros registros en proceso. Intenta nuevamente en un momento.',
    RETRY_REPLACED: 'Este envío fue sustituido por una actualización posterior. Recarga el registro antes de reenviarlo.',
    DUPLICATE_RECORD: 'El registro ya existe.',
    HISTORY_FULL: 'El historial del registro requiere revisión del responsable.',
    STORAGE_FAILED: 'No fue posible completar el almacenamiento. Conserva tu respuesta e intenta nuevamente.'
  };
  return messages[code] || messages.STORAGE_FAILED;
}
function storageJson_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
