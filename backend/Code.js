const SPREADSHEET_ID = '1NsKxQSep98Fqi2bof4tR5rymXDU_4Ercr4JmUZuCaj4';
function doGet(e) {
  return ContentService.createTextOutput("Backend is running.")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const args = payload.args || [];
    
    // We map action names to functions in this script
    if (typeof this[action] === 'function') {
      const result = this[action].apply(this, args);
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        data: result
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      throw new Error("Action not found: " + action);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(sheetName);
}

/**
 * Enforces authentication and authorization for backend APIs.
 * @param {string} token - Session token
 * @param {Array<string>} [allowedRoles] - Optional list of allowed roles. If empty, any logged-in user is allowed.
 * @returns {object} The user object
 */
function enforceAuth(token, allowedRoles) {
  const user = verifyToken(token);
  if (!user) throw new Error('Unauthorized: Invalid or expired session. Please log in again.');

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      throw new Error(`Forbidden: Your role (${user.role}) is not authorized to perform this action.`);
    }
  }
  return user;
}

// -------------------------------------------------------------
// MAIN API ENDPOINTS (PROTECTED)
// -------------------------------------------------------------

function getWorksData(token, year) {
  enforceAuth(token); // All logged in users can view works

  try {

    year = String(year || '2025-26');
    const sheetName = year.startsWith('Works-') ? year : 'Works-' + year;

    const sheet = SpreadsheetApp
      .openById(SPREADSHEET_ID)
      .getSheetByName(sheetName);

    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getDisplayValues();

    if (data.length < 2) {
      return [];
    }

    const headers = data[0];

    const rows = data.slice(1);

    const result = rows.map(row => {

      let obj = {};

      headers.forEach((h, i) => {
        obj[h] = row[i];
      });

      return {
        worksyear: obj.worksyear || '',
        pvyear: obj.pvyear || '',
        recieptdate: obj.recieptdate || '',
        code: obj.code || '',
        name: obj.name || '',
        constituency: obj.constituency || '',
        dept: obj.dept || '',
        agency: obj.agency || '',
        block: obj.block || '',
        location: obj.location || '',
        cost: parseFloat(obj.cost) || 0,
        allotted: parseFloat(obj.allotted) || 0,
        claim: parseFloat(obj.claim) || 0,
        status: obj.status || '',
        date: obj.date || '',

        positionAA: obj["Position A/A"] || '',
        completionStatus: obj["Whether completed / In-completed"] || '',
        leftOut: obj["If Incomplete specify left out items"] || '',
        signboard: obj["Sign board Installed (Yes/No)"] || '',
        quality: obj["Quality of Work"] || '',
        verifyRemarks: obj["Remarks of Verifying Officer/Official"] || '',
        dateVisit: obj["Date of Visit"] || '',
        submissionDate: obj["Date of Submission of Report"] || '',
        reportSubmissionNo: obj["Report Submission No"] || '',
        remarks: obj.remarks || '',
        photos: obj.Photos || obj.photos || obj.Photo || obj.photo || '',
        document: obj.Document || obj.document || obj.Doc || obj.doc || ''
      };

    });

    return JSON.parse(JSON.stringify(result));

  } catch (e) {

    Logger.log(e);

    return [];

  }

}

// Function to dynamically load HTML partials is no longer needed in backend, 
// frontend will fetch them directly from GitHub Pages.
// Removed loadPartialHTML()

/* =========================
   WORK ENTRY API
========================= */

function getNewWorkcode(token, worksYear) {
  enforceAuth(token, ['Admin', 'Data Administrator', 'Data Entry']);
  if (!worksYear) return '';

  try {
    const sheetName = worksYear.startsWith('Works-') ? worksYear : 'Works-' + worksYear;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    // If sheet doesn't exist, this is the first entry
    if (!sheet) {
      return `CDF-${worksYear}-0001`;
    }

    const data = sheet.getDataRange().getDisplayValues();
    if (data.length < 2) {
      return `CDF-${worksYear}-0001`;
    }

    // Find the 'code' column index
    const headers = data[0];
    let codeColIdx = -1;
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].toLowerCase() === 'code') {
        codeColIdx = i;
        break;
      }
    }

    if (codeColIdx === -1) {
      return `CDF-${worksYear}-0001`;
    }

    let maxSeq = 0;
    for (let i = 1; i < data.length; i++) {
      const codeStr = data[i][codeColIdx];
      if (codeStr && codeStr.includes(`CDF-${worksYear}-`)) {
        const parts = codeStr.split('-');
        if (parts.length > 0) {
          const seq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(seq) && seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const paddedSeq = nextSeq.toString().padStart(4, '0');
    return `CDF-${worksYear}-${paddedSeq}`;

  } catch (e) {
    Logger.log(e);
    return `CDF-${worksYear}-0001`;
  }
}

function submitWorkEntryData(token, entry, fileData, fileName) {
  enforceAuth(token, ['Admin', 'Data Administrator', 'Data Entry']);
  try {
    let docUrl = '';

    // 1. Upload File if present
    if (fileData && fileName) {
      const rootFolderId = '1XBjKGDNYY-6MUF95kSHp2kH0HeksbNka';
      const rootFolder = DriveApp.getFolderById(rootFolderId);

      const yearFolderName = entry.worksYear;
      let yearFolder;
      const folders = rootFolder.getFoldersByName(yearFolderName);

      if (folders.hasNext()) {
        yearFolder = folders.next();
      } else {
        yearFolder = rootFolder.createFolder(yearFolderName);
      }

      const extension = fileName.split('.').pop() || 'pdf';
      const newDocName = `${entry.workcode}_Document.${extension}`;
      const blob = Utilities.newBlob(Utilities.base64Decode(fileData), 'application/pdf', newDocName);
      const file = yearFolder.createFile(blob);
      docUrl = file.getUrl();
    }

    // 2. Append to Google Sheet
    const sheetName = entry.worksYear.startsWith('Works-') ? entry.worksYear : 'Works-' + entry.worksYear;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      // Create new sheet with headers if it doesn't exist
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        'worksyear', 'pvyear', 'date', 'code', 'name',
        'constituency', 'dept', 'agency', 'block', 'location',
        'cost', 'allotted', 'Position A/A', 'claim', 'status', 'Document'
      ]);
    }

    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];

    // Build row based on headers
    const newRow = new Array(headers.length).fill('');

    // Map of our form keys to possible header names
    const headerMapping = {
      worksyear: ['worksyear'],
      pvyear: ['pvyear'],
      date: ['date', 'recieptdate'], // we store receipt date here
      code: ['code'],
      name: ['name'],
      constituency: ['constituency'],
      dept: ['dept'],
      agency: ['agency'],
      block: ['block'],
      location: ['location'],
      cost: ['cost', 'aacost'],
      allotted: ['allotted', 'allottedcost', 'allotted cost'],
      positionAA: ['position a/a', 'position aa', 'position of a/a'],
      claim: ['claim'],
      status: ['status'],
      Document: ['document', 'doc']
    };

    const entryData = {
      worksyear: entry.worksYear,
      pvyear: entry.pvYear,
      date: entry.dateReceipt,
      code: entry.workcode,
      name: entry.workName,
      constituency: entry.constituency,
      dept: entry.department,
      agency: entry.agency,
      block: entry.block,
      location: entry.location,
      cost: entry.aaCost,
      allotted: entry.allottedCost,
      positionAA: entry.positionAA,
      claim: entry.claim,
      status: 'Pending',
      Document: docUrl
    };

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().trim();
      // Find matching key in entryData
      for (const [key, possibleHeaders] of Object.entries(headerMapping)) {
        if (possibleHeaders.includes(h)) {
          newRow[i] = entryData[key];
          break;
        }
      }
    }

    sheet.appendRow(newRow);

    return true;

  } catch (e) {
    Logger.log(e);
    throw new Error(e.message);
  }
}

function getMasterData(token) {
  enforceAuth(token);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Master');
    if (!sheet) return [];

    const data = sheet.getDataRange().getDisplayValues();
    if (data.length < 2) return [];

    const headers = data[0].map(h => h.trim());
    const result = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      let obj = {};
      let isEmpty = true;
      for (let j = 0; j < headers.length; j++) {
        if (headers[j]) {
          const val = row[j] ? row[j].trim() : '';
          obj[headers[j]] = val;
          if (val !== '') isEmpty = false;
        }
      }
      if (!isEmpty) {
        result.push(obj);
      }
    }

    return result;
  } catch (e) {
    Logger.log(e);
    return [];
  }
}

function testDriveApp() {
  try {
    const rootFolderId = '1XBjKGDNYY-6MUF95kSHp2kH0HeksbNka';
    const folder = DriveApp.getFolderById(rootFolderId);
    console.log("SUCCESS! Folder name: " + folder.getName());
  } catch (e) {
    console.log("ERROR: " + e.toString());
  }
}

/* =========================
   WORK ENTRY CRUD API
========================= */

function getSheetFromWorkcode(workcode) {
  if (!workcode) return null;
  const parts = workcode.split('-');
  if (parts.length < 3) return null;
  const worksYear = parts.slice(1, -1).join('-');
  return 'Works-' + worksYear;
}

function getWorkEntry(token, workcode) {
  enforceAuth(token);
  try {
    const sheetName = getSheetFromWorkcode(workcode);
    if (!sheetName) throw new Error("Invalid workcode format");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found for this workcode");

    const data = sheet.getDataRange().getDisplayValues();
    if (data.length < 2) throw new Error("No data in sheet");

    const headers = data[0].map(h => h.trim().toLowerCase());
    const codeIdx = headers.indexOf('code');
    if (codeIdx === -1) throw new Error("Code column not found");

    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIdx] === workcode) {
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }

        try {
          const rootFolderId = '1XBjKGDNYY-6MUF95kSHp2kH0HeksbNka';
          const rootFolder = DriveApp.getFolderById(rootFolderId);
          const worksYear = obj.worksyear || getSheetFromWorkcode(workcode).replace('Works-', '');
          const folders = rootFolder.getFoldersByName(worksYear);
          if (folders.hasNext()) {
            const yearFolder = folders.next();
            const files = yearFolder.searchFiles("title contains '" + workcode + "_Document'");
            if (files.hasNext()) {
              obj.document = files.next().getUrl();
            }
          }
        } catch (e) {
          // Ignore Drive search errors, return obj anyway
        }

        return obj;
      }
    }
    throw new Error("Workcode not found");
  } catch (e) {
    Logger.log(e);
    throw new Error(e.message);
  }
}

function extractDriveFileId(url) {
  if (!url) return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function ensureHeaders(sheet) {
  const requiredHeaders = [
    'worksyear', 'pvyear', 'code', 'name',
    'constituency', 'dept', 'agency', 'block', 'location',
    'cost', 'allotted', 'Position A/A', 'claim', 'status',
    'Date of Visit', 'Whether completed / In-completed', 'If Incomplete specify left out items', 'Sign board installed (Yes/No)',
    'Quality of Work', 'Remarks of Verifying Officer/Official', 'Name of Verifying Officer', 'Report Submission No', 'Date of Submission of Report',
    'remarks'
  ];
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(requiredHeaders);
    return sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
  }
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0] || [];
  const existingLower = currentHeaders.map(h => String(h).toLowerCase().trim());
  let currentLen = currentHeaders.length;

  for (const req of requiredHeaders) {
    if (!existingLower.includes(req.toLowerCase().trim())) {
      sheet.getRange(1, currentLen + 1).setValue(req);
      currentHeaders.push(req);
      currentLen++;
    }
  }
  return currentHeaders;
}

function deleteWorkEntry(token, workcode) {
  enforceAuth(token, ['Admin']);
  try {
    const sheetName = getSheetFromWorkcode(workcode);
    if (!sheetName) throw new Error("Invalid workcode format");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found");

    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0].map(h => h.trim().toLowerCase());
    const codeIdx = headers.indexOf('code');
    if (codeIdx === -1) throw new Error("Code column not found");

    const docIdx = headers.indexOf('document');

    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIdx] === workcode) {

        const worksYear = data[i][headers.indexOf('worksyear')] || sheetName.replace('Works-', '');

        // Trash Document (from column if exists)
        if (docIdx !== -1 && data[i][docIdx]) {
          const id = extractDriveFileId(data[i][docIdx]);
          if (id) try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { }
        } else {
          // Fallback to searching Google Drive by name
          try {
            const rootFolderId = '1XBjKGDNYY-6MUF95kSHp2kH0HeksbNka';
            const rootFolder = DriveApp.getFolderById(rootFolderId);
            const folders = rootFolder.getFoldersByName(worksYear);
            if (folders.hasNext()) {
              const yearFolder = folders.next();
              const files = yearFolder.searchFiles("title contains '" + workcode + "_Document'");
              while (files.hasNext()) {
                files.next().setTrashed(true);
              }
            }
          } catch (e) { }
        }

        // Legacy Photo column cleanup removed

        // Trash Photos (new method - search drive dynamically)
        try {
          const imgRootFolderId = '1WFWIunPB8zqDqGr0-RZ8fVGFU3EK1bD_';
          const rootFolder = DriveApp.getFolderById(imgRootFolderId);
          const folders = rootFolder.getFoldersByName(worksYear);
          if (folders.hasNext()) {
             const yearFolder = folders.next();
             const files1 = yearFolder.searchFiles("title contains 'Photo_1_" + workcode + "'");
             while (files1.hasNext()) try { files1.next().setTrashed(true); } catch(e) {}
             const files2 = yearFolder.searchFiles("title contains 'Photo_2_" + workcode + "'");
             while (files2.hasNext()) try { files2.next().setTrashed(true); } catch(e) {}
          }
        } catch(e) {}

        // Trash Signed Document
        try {
          const signedRootFolderId = '1W_W-h2L93U2sY-Vx-hFZjJx9Zbv2hR-F';
          const rootFolder = DriveApp.getFolderById(signedRootFolderId);
          const folders = rootFolder.getFoldersByName(worksYear);
          if (folders.hasNext()) {
            const yearFolder = folders.next();
            const files = yearFolder.searchFiles("title contains '" + workcode + "_SignedDocument'");
            while (files.hasNext()) {
              try { files.next().setTrashed(true); } catch (e) { }
            }
          }
        } catch (e) { }

        sheet.deleteRow(i + 1);
        return true;
      }
    }
    throw new Error("Workcode not found");
  } catch (e) {
    Logger.log(e);
    throw new Error(e.message);
  }
}

function updateUnifiedRecord(token, payload, files) {
  enforceAuth(token, ['Admin', 'Data Administrator', 'Data Entry', 'Verifier']);
  try {
    const sheetName = getSheetFromWorkcode(payload.code);
    if (!sheetName) throw new Error("Invalid workcode format");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found");

    ensureHeaders(sheet); // Make sure verification columns exist

    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0];
    const codeIdx = headers.findIndex(h => h.trim().toLowerCase() === 'code');
    if (codeIdx === -1) throw new Error("Code column not found");

    let targetRowIdx = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIdx] === payload.code) {
        targetRowIdx = i;
        break;
      }
    }

    if (targetRowIdx === -1) throw new Error("Workcode not found");

    const docIdx = headers.findIndex(h => h.trim().toLowerCase() === 'document');
    let docUrl = docIdx !== -1 ? data[targetRowIdx][docIdx] : '';

    // Legacy photo index check removed

    const docRootFolderId = '1XBjKGDNYY-6MUF95kSHp2kH0HeksbNka';
    const docRootFolder = DriveApp.getFolderById(docRootFolderId);
    const imgRootFolderId = '1WFWIunPB8zqDqGr0-RZ8fVGFU3EK1bD_';
    const imgRootFolder = DriveApp.getFolderById(imgRootFolderId);

    const yearFolderName = payload.worksyear;

    let docYearFolder;
    const docFolders = docRootFolder.getFoldersByName(yearFolderName);
    if (docFolders.hasNext()) docYearFolder = docFolders.next();
    else docYearFolder = docRootFolder.createFolder(yearFolderName);

    let imgYearFolder;
    const imgFolders = imgRootFolder.getFoldersByName(yearFolderName);
    if (imgFolders.hasNext()) imgYearFolder = imgFolders.next();
    else imgYearFolder = imgRootFolder.createFolder(yearFolderName);

    // Upload Document
    if (files.doc && files.docName) {
      if (docUrl) {
        const oldId = extractDriveFileId(docUrl);
        if (oldId) try { DriveApp.getFileById(oldId).setTrashed(true); } catch (e) { }
      } else {
        // Fallback: search and trash existing document
        try {
          const oldFiles = docYearFolder.searchFiles("title contains '" + payload.code + "_Document'");
          while (oldFiles.hasNext()) {
            oldFiles.next().setTrashed(true);
          }
        } catch (e) { }
      }

      const extension = files.docName.split('.').pop() || 'pdf';
      const newDocName = `${payload.code}_Document.${extension}`;
      const blob = Utilities.newBlob(Utilities.base64Decode(files.doc), 'application/pdf', newDocName);
      docUrl = docYearFolder.createFile(blob).getUrl();
    }

    // Upload Photos
    const handlePhoto = (pData, photoNamePrefix) => {
      if (pData === undefined) return;
      const targetName = `${photoNamePrefix}_${payload.code}.jpg`;
      
      // If empty string, user removed the photo
      if (pData === '') {
        try {
          const oldFiles = imgYearFolder.searchFiles("title contains '" + targetName + "'");
          while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);
        } catch(e) {}
      } 
      // If new upload
      else if (pData.startsWith('data:image')) {
        try {
          const oldFiles = imgYearFolder.searchFiles("title contains '" + targetName + "'");
          while (oldFiles.hasNext()) oldFiles.next().setTrashed(true);
        } catch(e) {}
        
        const b64 = pData.split(',')[1];
        const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', targetName);
        imgYearFolder.createFile(blob);
      }
      // If it starts with http, it is unchanged.
    };

    if (files.hasOwnProperty('photo1')) handlePhoto(files.photo1, 'Photo_1');
    if (files.hasOwnProperty('photo2')) handlePhoto(files.photo2, 'Photo_2');

    const headerMapping = {
      worksyear: ['worksyear'],
      pvyear: ['pvyear'],
      date: ['date', 'recieptdate'],
      name: ['name'],
      constituency: ['constituency'],
      dept: ['dept'],
      agency: ['agency'],
      block: ['block'],
      location: ['location'],
      cost: ['cost', 'aacost'],
      allotted: ['allotted', 'allottedcost', 'allotted cost'],
      positionAA: ['position a/a', 'position aa', 'position of a/a'],
      claim: ['claim'],
      Document: ['document', 'doc'],
      status: ['status'],
      dateVisit: ['date of visit'],
      completionStatus: ['completion status', 'whether completed / in-completed'],
      leftOut: ['left out items', 'if incomplete specify left out items'],
      signboard: ['signboard installed', 'sign board installed (yes/no)'],
      quality: ['quality of work'],
      verifyRemarks: ['verifying officer remarks', 'remarks of verifying officer/official'],
      verifyingOfficerName: ['name of verifying officer', 'verifying officer name'],
      submissionDate: ['submission date', 'date of submission of report'],
      geoCoords: ['geo coordinates'],
      remarks: ['general remarks', 'remarks']
    };

    const entryData = {
      ...payload,
      Document: docUrl
    };

    const targetRange = sheet.getRange(targetRowIdx + 1, 1, 1, headers.length);
    const targetRow = targetRange.getValues()[0];

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].toLowerCase().trim();
      for (const [key, possibleHeaders] of Object.entries(headerMapping)) {
        if (possibleHeaders.includes(h)) {
          if (entryData[key] !== undefined) {
            targetRow[i] = entryData[key];
          }
          break;
        }
      }
    }

    targetRange.setValues([targetRow]);
    return true;

  } catch (e) {
    Logger.log(e);
    throw new Error(e.message);
  }
}

function verifyPhotosExist(urlStr) {
  if (!urlStr) return "";
  const urls = urlStr.split(',').map(u => u.trim()).filter(Boolean);
  const valid = [];
  urls.forEach(url => {
    const id = extractDriveFileId(url);
    if (id) {
      try {
        const file = DriveApp.getFileById(id);
        if (!file.isTrashed()) valid.push(url);
      } catch (e) {
        Logger.log("verifyPhotosExist permission error for ID " + id + ": " + e.toString());
        // Keep the URL so the client can at least attempt to load it, and we can see what fails
        valid.push(url);
      }
    } else {
      valid.push(url); // Not a drive url, keep it
    }
  });
  return valid.join(',');
}

function getDriveImageBase64(url) {
  try {
    var match = url.match(/[-\w]{25,}/);
    var blob;
    if (match) {
      var fileId = match[0];
      var file = DriveApp.getFileById(fileId);
      blob = file.getBlob();
    } else {
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      blob = response.getBlob();
    }

    var contentType = blob.getContentType();
    var b64 = Utilities.base64Encode(blob.getBytes());
    return 'data:' + contentType + ';base64,' + b64;
  } catch (e) {
    Logger.log("getDriveImageBase64 Error: " + e.toString());
    throw new Error(e.toString());
  }
}

/* =========================
   PV REPORTS API
========================= */

function updatePVSubmission(token, payload, fileData) {
  enforceAuth(token, ['Admin', 'Data Administrator', 'Data Entry']);
  try {
    const sheetName = getSheetFromWorkcode(payload.code);
    if (!sheetName) throw new Error("Invalid workcode format");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found");

    ensureHeaders(sheet);

    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0].map(h => h.trim().toLowerCase());
    const codeIdx = headers.indexOf('code');
    if (codeIdx === -1) throw new Error("Code column not found");

    let targetRowIdx = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIdx] === payload.code) {
        targetRowIdx = i;
        break;
      }
    }

    if (targetRowIdx === -1) throw new Error("Workcode not found");

    // Save file to drive
    const rootFolderId = '1W_W-h2L93U2sY-Vx-hFZjJx9Zbv2hR-F';
    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const yearFolderName = payload.worksyear || sheetName.replace('Works-', '');

    let yearFolder;
    const folders = rootFolder.getFoldersByName(yearFolderName);
    if (folders.hasNext()) {
      yearFolder = folders.next();
    } else {
      yearFolder = rootFolder.createFolder(yearFolderName);
    }

    // Trash old file
    const oldFiles = yearFolder.searchFiles("title contains '" + payload.code + "_SignedDocument'");
    while (oldFiles.hasNext()) {
      try { oldFiles.next().setTrashed(true); } catch (e) { }
    }

    // Upload new file
    if (fileData && fileData.doc) {
      const extension = fileData.docName ? fileData.docName.split('.').pop() : 'pdf';
      const newDocName = `${payload.code}_SignedDocument.${extension}`;
      const blob = Utilities.newBlob(Utilities.base64Decode(fileData.doc), 'application/pdf', newDocName);
      yearFolder.createFile(blob);
    }

    // Update sheet columns
    const updateHeader = (colName, value) => {
      let idx = headers.indexOf(colName.toLowerCase());
      if (idx !== -1) {
        sheet.getRange(targetRowIdx + 1, idx + 1).setValue(value);
      }
    };

    updateHeader('report submission no', payload.reportSubmissionNo);
    updateHeader('date of submission of report', payload.submissionDate);

    return true;
  } catch (e) {
    Logger.log(e);
    throw new Error(e.message);
  }
}

function deletePVSubmission(token, workcode) {
  enforceAuth(token, ['Admin']);
  try {
    const sheetName = getSheetFromWorkcode(workcode);
    if (!sheetName) throw new Error("Invalid workcode format");

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("Sheet not found");

    const data = sheet.getDataRange().getDisplayValues();
    const headers = data[0].map(h => h.trim().toLowerCase());
    const codeIdx = headers.indexOf('code');
    if (codeIdx === -1) throw new Error("Code column not found");

    let targetRowIdx = -1;
    let worksyear = '';
    for (let i = 1; i < data.length; i++) {
      if (data[i][codeIdx] === workcode) {
        targetRowIdx = i;
        worksyear = data[i][headers.indexOf('worksyear')] || sheetName.replace('Works-', '');
        break;
      }
    }

    if (targetRowIdx === -1) throw new Error("Workcode not found");

    // Trash file
    try {
      const rootFolderId = '1W_W-h2L93U2sY-Vx-hFZjJx9Zbv2hR-F';
      const rootFolder = DriveApp.getFolderById(rootFolderId);
      const folders = rootFolder.getFoldersByName(worksyear);
      if (folders.hasNext()) {
        const yearFolder = folders.next();
        const files = yearFolder.searchFiles("title contains '" + workcode + "_SignedDocument'");
        while (files.hasNext()) {
          try { files.next().setTrashed(true); } catch (e) { }
        }
      }
    } catch (e) { }

    // Clear sheet columns
    const clearHeader = (colName) => {
      let idx = headers.indexOf(colName.toLowerCase());
      if (idx !== -1) {
        sheet.getRange(targetRowIdx + 1, idx + 1).setValue('');
      }
    };

    clearHeader('report submission no');
    clearHeader('date of submission of report');

    return true;
  } catch (e) {
    Logger.log(e);
    throw new Error(e.message);
  }
}

function getSignedDocUrl(token, workcode, worksyear) {
  enforceAuth(token);
  try {
    const rootFolderId = '1W_W-h2L93U2sY-Vx-hFZjJx9Zbv2hR-F';
    const rootFolder = DriveApp.getFolderById(rootFolderId);

    if (!worksyear || worksyear === 'undefined') {
      const sheetName = getSheetFromWorkcode(workcode);
      if (sheetName) worksyear = sheetName.replace('Works-', '');
    }

    if (!worksyear) return null;

    const folders = rootFolder.getFoldersByName(worksyear);
    if (folders.hasNext()) {
      const yearFolder = folders.next();
      const files = yearFolder.searchFiles("title contains '" + workcode + "_SignedDocument'");
      if (files.hasNext()) {
        return files.next().getUrl();
      }
    }
    return null;
  } catch (e) {
    Logger.log(e);
    return null;
  }
}

function getWorkPhotos(token, workcode, worksyear) {
  enforceAuth(token);
  try {
    const imgRootFolderId = '1WFWIunPB8zqDqGr0-RZ8fVGFU3EK1bD_';
    const rootFolder = DriveApp.getFolderById(imgRootFolderId);

    if (!worksyear || worksyear === 'undefined') {
      const sheetName = getSheetFromWorkcode(workcode);
      if (sheetName) worksyear = sheetName.replace('Works-', '');
    }

    if (!worksyear) return ['', ''];

    const folders = rootFolder.getFoldersByName(worksyear);
    if (folders.hasNext()) {
      const yearFolder = folders.next();
      
      let p1 = '';
      let p2 = '';
      
      const files1 = yearFolder.searchFiles("title contains 'Photo_1_" + workcode + "' and trashed = false");
      if (files1.hasNext()) p1 = files1.next().getUrl();
      
      const files2 = yearFolder.searchFiles("title contains 'Photo_2_" + workcode + "' and trashed = false");
      if (files2.hasNext()) p2 = files2.next().getUrl();
      
      return [p1, p2];
    }
    return ['', ''];
  } catch (e) {
    Logger.log(e);
    return ['', ''];
  }
}