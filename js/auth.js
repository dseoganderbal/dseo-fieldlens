    function initializeApplication(user) {
        document.getElementById('appContainer').style.display = 'block';
        setTimeout(() => {
            document.getElementById('appContainer').style.opacity = '1';
        }, 50);
        
        document.getElementById('globalUserAvatar').innerText = user.name.charAt(0).toUpperCase();
        document.querySelector('.user-name').innerText = user.name;
        document.querySelector('.user-role').innerText = user.role;
        
        applyRoleRestrictions(user.role);
        showPage('Dashboard');
    }
    function applyRoleRestrictions(role) {
        // Reset UI to defaults (in case of re-login without page refresh)
        document.getElementById('navAdminLabel').style.display = 'none';
        document.getElementById('navUserManagement').style.display = 'none';
        document.getElementById('navUtilityLabel').style.display = 'none';
        document.getElementById('navImageCompressor').style.display = 'none';
        document.getElementById('navPdfCompressor').style.display = 'none';
        document.getElementById('workEntryMenu').style.display = 'flex';
        document.getElementById('verificationMenu').style.display = 'flex';
        document.getElementById('worksListMenu').style.display = 'flex';
        document.getElementById('navReportsLabel').style.display = 'block';
        document.getElementById('pvReportsMenu').style.display = 'flex';
        
        // Admin Features
        if (role === 'Admin') {
            document.getElementById('navAdminLabel').style.display = 'block';
            document.getElementById('navUserManagement').style.display = 'flex';
        }
        
        // Verifier Features
        if (role === 'Verifier') {
            document.getElementById('workEntryMenu').style.display = 'none'; // Cannot add works
            document.getElementById('worksListMenu').style.display = 'none'; // Only needs Verification
            document.getElementById('navReportsLabel').style.display = 'none'; // Hide reports section
            document.getElementById('pvReportsMenu').style.display = 'none'; // Hide PV Reports
        }
        
        // Viewer Features
        if (role === 'Viewer') {
            document.getElementById('workEntryMenu').style.display = 'none';
            document.getElementById('verificationMenu').style.display = 'none';
        }
        
        // Utility Features
        if (role !== 'Viewer') {
            document.getElementById('navUtilityLabel').style.display = 'block';
            document.getElementById('navImageCompressor').style.display = 'flex';
            document.getElementById('navPdfCompressor').style.display = 'flex';
        }
    }
    function logoutSession() {
        const token = sessionStorage.getItem('cdf_auth_token');
        if (token) {
            google.script.run.logoutUser(token);
        }
        sessionStorage.clear();
        
        // Show login, hide app
        const app = document.getElementById('appContainer');
        const login = document.getElementById('loginContainer');
        
        app.style.opacity = '0';
        setTimeout(() => {
            app.style.display = 'none';
            login.style.display = 'flex';
            setTimeout(() => {
                login.style.opacity = '1';
            }, 50);
        }, 500);
        
        // Clear login form fields and reset spinner
        document.getElementById('loginUserId').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginBtnText').style.display = 'block';
        if (document.getElementById('loginBtnArrow')) document.getElementById('loginBtnArrow').style.display = 'block';
        document.getElementById('loginSpinner').style.display = 'none';
        document.getElementById('loginBtn').disabled = false;
    }
