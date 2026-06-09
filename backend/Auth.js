/**
 * Auth.js
 * Handles authentication, token generation, and the Users database setup.
 */

// Global constant for the Users sheet name
const USERS_SHEET_NAME = 'Users';

/**
 * Ensures the Users sheet exists. If not, creates it and adds a default admin.
 */
function setupUsersDatabase() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(USERS_SHEET_NAME);
    
    if (!sheet) {
        sheet = ss.insertSheet(USERS_SHEET_NAME);
        // Set up headers
        sheet.appendRow(['UserID', 'Password', 'Name', 'Role', 'Status']);
        sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#f3f4f6');
        
        // Add default admin (UserID: admin, Password: admin123)
        sheet.appendRow(['admin', 'admin123', 'Super Administrator', 'Admin', 'Active']);
        
        // Resize columns for better visibility
        sheet.setColumnWidth(1, 150);
        sheet.setColumnWidth(2, 150);
        sheet.setColumnWidth(3, 250);
        sheet.setColumnWidth(4, 150);
        sheet.setColumnWidth(5, 100);
        
        // Protect the sheet so only script owner can edit it directly
        const protection = sheet.protect().setDescription('Protect Users Sheet');
        protection.setWarningOnly(true); // Optional: change to restricting editors if needed
    }
}

/**
 * Attempts to log in a user.
 * @param {string} userId - The user's ID
 * @param {string} password - The user's password
 * @returns {object} { success: boolean, token?: string, user?: object, message?: string }
 */
function loginUser(userId, password) {
    if (!userId || !password) {
        return { success: false, message: 'User ID and Password are required.' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(USERS_SHEET_NAME);
    
    // Auto-setup if the sheet is missing
    if (!sheet) {
        setupUsersDatabase();
        sheet = ss.getSheetByName(USERS_SHEET_NAME);
    }
    
    const data = sheet.getDataRange().getValues();
    // Start from row 1 to skip headers
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const dbUserId = row[0];
        const dbPass = row[1];
        const dbName = row[2];
        const dbRole = row[3];
        const dbStatus = row[4];
        
        // Exact match
        if (dbUserId === userId) {
            if (dbPass !== password) {
                return { success: false, message: 'Invalid password.' };
            }
            if (dbStatus !== 'Active') {
                return { success: false, message: 'Account is inactive. Please contact the administrator.' };
            }
            
            // Generate a secure, pseudo-random token
            const token = Utilities.getUuid();
            
            // Cache the token for 12 hours (43200 seconds is max, but CacheService maximum is 21600 (6 hours).
            // We will use 6 hours (21600 seconds) as the absolute maximum.
            const userObj = {
                id: dbUserId,
                name: dbName,
                role: dbRole
            };
            
            const cache = CacheService.getScriptCache();
            cache.put(token, JSON.stringify(userObj), 21600); // 6 hours
            
            return {
                success: true,
                token: token,
                user: userObj
            };
        }
    }
    
    return { success: false, message: 'User ID not found.' };
}

/**
 * Validates a given session token against the cache.
 * @param {string} token - The session token from the client
 * @returns {object|null} The user object if valid, otherwise null
 */
function verifyToken(token) {
    if (!token) return null;
    
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get(token);
    
    if (cachedData) {
        return JSON.parse(cachedData);
    }
    return null;
}

/**
 * Logs a user out by removing their token from the cache.
 * @param {string} token - The session token
 * @returns {boolean} true
 */
function logoutUser(token) {
    if (token) {
        const cache = CacheService.getScriptCache();
        cache.remove(token);
    }
    return true;
}

/**
 * Updates the profile (name and password) of the currently authenticated user.
 * @param {string} token - The session token
 * @param {object} payload - { name: string, password: string }
 * @returns {object} { success: boolean, message: string, user: object }
 */
function updateMyProfile(token, payload) {
    if (!token) throw new Error('Unauthorized');
    
    // verifyToken returns the user object from cache
    const user = verifyToken(token);
    if (!user || !user.id) throw new Error('Unauthorized: Session expired. Please log in again.');
    
    if (!payload.name || !payload.password) {
        throw new Error('Name and password are required.');
    }
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(USERS_SHEET_NAME);
    if (!sheet) throw new Error('Database error.');
    
    const data = sheet.getDataRange().getValues();
    
    // Find user by ID and update
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === user.id) {
            sheet.getRange(i + 1, 2).setValue(payload.password);
            sheet.getRange(i + 1, 3).setValue(payload.name);
            
            user.name = payload.name;
            const cache = CacheService.getScriptCache();
            cache.put(token, JSON.stringify(user), 21600);
            
            return {
                success: true,
                message: 'Profile updated successfully.',
                user: user
            };
        }
    }
    
    throw new Error('User not found in database.');
}
