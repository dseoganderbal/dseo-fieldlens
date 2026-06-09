/**
 * Admin.js
 * Handles backend operations specifically for the Admin role,
 * such as User Management (Create, Read, Update, Delete users).
 */

/**
 * Helper to ensure the caller is an Admin.
 */
function enforceAdmin(token) {
    const user = verifyToken(token);
    if (!user) throw new Error('Unauthorized: Invalid or expired session.');
    if (user.role !== 'Admin') throw new Error('Forbidden: Only Admins can perform this action.');
    return user;
}

/**
 * Retrieves all users from the Users sheet.
 * @param {string} token - Session token
 * @returns {Array} List of user objects
 */
function adminGetUsers(token) {
    enforceAdmin(token);
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) {
        setupUsersDatabase();
        sheet = ss.getSheetByName(USERS_SHEET_NAME);
    }
    
    const data = sheet.getDataRange().getValues();
    const users = [];
    
    // Skip headers
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // skip completely empty rows
        
        users.push({
            id: row[0],
            password: row[1], // We return password to admin for resetting purposes if needed
            name: row[2],
            role: row[3],
            status: row[4]
        });
    }
    
    return users;
}

/**
 * Creates a new user in the database.
 * @param {string} token - Session token
 * @param {object} userData - { id, password, name, role, status }
 * @returns {boolean} true if successful
 */
function adminCreateUser(token, userData) {
    enforceAdmin(token);
    
    if (!userData.id || !userData.password || !userData.name || !userData.role) {
        throw new Error('Missing required user fields.');
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    // Check if ID already exists
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === userData.id) {
            throw new Error('User ID already exists.');
        }
    }
    
    sheet.appendRow([
        userData.id,
        userData.password,
        userData.name,
        userData.role,
        userData.status || 'Active'
    ]);
    
    return true;
}

/**
 * Updates an existing user.
 * @param {string} token - Session token
 * @param {object} userData - { id, password, name, role, status }
 * @returns {boolean} true if successful
 */
function adminUpdateUser(token, userData) {
    enforceAdmin(token);
    
    if (!userData.id) throw new Error('User ID is required for update.');
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === userData.id) {
            const rowIndex = i + 1;
            // Only update fields that are provided
            if (userData.password) sheet.getRange(rowIndex, 2).setValue(userData.password);
            if (userData.name) sheet.getRange(rowIndex, 3).setValue(userData.name);
            if (userData.role) sheet.getRange(rowIndex, 4).setValue(userData.role);
            if (userData.status) sheet.getRange(rowIndex, 5).setValue(userData.status);
            
            return true;
        }
    }
    
    throw new Error('User not found.');
}

/**
 * Deletes a user completely from the database.
 * @param {string} token - Session token
 * @param {string} targetUserId - The ID of the user to delete
 * @returns {boolean} true if successful
 */
function adminDeleteUser(token, targetUserId) {
    const adminUser = enforceAdmin(token);
    
    if (adminUser.id === targetUserId) {
        throw new Error('You cannot delete your own admin account.');
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === targetUserId) {
            sheet.deleteRow(i + 1);
            return true;
        }
    }
    
    throw new Error('User not found.');
}
