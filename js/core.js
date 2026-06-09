let worksData = [];
    let wlFiltered = [];
    const WL_PAGE_SIZE = 10;
    let wlCurrentPage = 1;
    // Pages that show the "Add Work" button in the topbar   add new pages here as needed
    const PAGES_WITH_ADD_WORK = new Set(['WorksList']);

    /*    Sidebar    */



    /* CUSTOM ALERTS */
    let customAlertCallback = null;



    /*    Filter / Dashboard update    */
    let barChartInst = null;
    let donutChartInst = null;
    let dashboardWorks = [];




    /*    Search    */

    /*    Chart defaults (no DOM   safe at parse time)    */
    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1a2035',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                titleColor: '#f1f5f9',
                bodyColor: '#94a3b8',
                padding: 12,
                cornerRadius: 10,
            }
        }
    };

    /*    Dashboard init   called after Dashboard.html is injected    */



    /*    Work Entry Page    */

    let masterData = [];
    let isMasterDataLoaded = false;





    // Required fields config
    const weRequiredFields = [
        { id: 'weWorksYear', errId: 'err_weWorksYear' },
        { id: 'wePvYear', errId: 'err_wePvYear' },
        { id: 'weWorkcode', errId: 'err_weWorkcode' },
        { id: 'weDateReceipt', errId: 'err_weDateReceipt' },
        { id: 'weWorkName', errId: 'err_weWorkName' },
        { id: 'weConstituency', errId: 'err_weConstituency' },
        { id: 'weBlock', errId: 'err_weBlock' },
        { id: 'weLocation', errId: 'err_weLocation' },
        { id: 'weDepartment', errId: 'err_weDepartment' },
        { id: 'weAgency', errId: 'err_weAgency' },
        { id: 'weAACost', errId: 'err_weAACost' },
        { id: 'weAllottedCost', errId: 'err_weAllottedCost' },
        { id: 'wePositionAA', errId: 'err_wePositionAA' },
        { id: 'weClaim', errId: 'err_weClaim' },
    ];


    // Clear validation on input






    /*                                           
       PAGE SYSTEM
                                               */
    // Load Dashboard by default when the app opens
    document.addEventListener('DOMContentLoaded', () => {
        const token = sessionStorage.getItem('cdf_auth_token');
        if (token) {
            // Check if token is still valid
            google.script.run
                .withSuccessHandler(function(user) {
                    if (user) {
                        document.getElementById('loginContainer').style.display = 'none';
                        initializeApplication(user);
                    } else {
                        sessionStorage.removeItem('cdf_auth_token');
                    }
                })
                .withFailureHandler(function() {
                    sessionStorage.removeItem('cdf_auth_token');
                })
                .verifyToken(token);
        }
    });




    // Moved from Login.html
    window.handleLoginSubmit = function() {
        const userId = document.getElementById('loginUserId').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!userId || !password) return;

        const btnText = document.getElementById('loginBtnText');
        const btnArrow = document.getElementById('loginBtnArrow');
        const spinner = document.getElementById('loginSpinner');
        const errorMsg = document.getElementById('loginErrorMsg');
        const submitBtn = document.getElementById('loginBtn');

        // UI Loading state
        btnText.style.display = 'none';
        btnArrow.style.display = 'none';
        spinner.style.display = 'block';
        submitBtn.disabled = true;
        errorMsg.style.display = 'none';

        google.script.run
            .withSuccessHandler(function (response) {
                if (response.success) {
                    sessionStorage.setItem('cdf_auth_token', response.token);
                    sessionStorage.setItem('cdf_user_name', response.user.name);
                    sessionStorage.setItem('cdf_user_role', response.user.role);

                    const rememberMe = document.getElementById('rememberMe').checked;
                    if (rememberMe) {
                        localStorage.setItem('cdf_saved_userid', userId);
                        localStorage.setItem('cdf_saved_password', password);
                    } else {
                        localStorage.removeItem('cdf_saved_userid');
                        localStorage.removeItem('cdf_saved_password');
                    }

                    document.getElementById('loginContainer').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('loginContainer').style.display = 'none';
                        initializeApplication(response.user);
                    }, 400);
                } else {
                    errorMsg.textContent = response.message || 'Authentication failed.';
                    errorMsg.style.display = 'block';
                    btnText.style.display = 'block';
                    btnArrow.style.display = 'block';
                    spinner.style.display = 'none';
                    submitBtn.disabled = false;
                }
            })
            .withFailureHandler(function (error) {
                errorMsg.textContent = 'Server error: ' + (error.message || error);
                errorMsg.style.display = 'block';
                btnText.style.display = 'block';
                btnArrow.style.display = 'block';
                spinner.style.display = 'none';
                submitBtn.disabled = false;
            })
            .loginUser(userId, password);
    };

    /* Page metadata is declared at the top of the script to avoid TDZ errors */

    // function updateTopbar(fileName) {
    //     // Title & subtitle are static in Index.html   only toggle context buttons
    //     document.getElementById('globalAddWorkBtn').style.display =
    //         PAGES_WITH_ADD_WORK.has(fileName) ? '' : 'none';
    // }

    let currentEditWorkcode = null;



    const pageCache = {};


    /*                                           
       WORKS LIST DATA & LOGIC
                                               */
    /*const worksData = [
        { code: 'CDF-2025-001', name: 'Construction of link road from Main Highway to Village Center', constituency: 'Ganderbal', dept: 'RDD', agency: 'BDO Ganderbal', block: 'Ganderbal', location: 'Dangerpora', cost: 15.50, allotted: 14.80, claim: 14.20, status: 'In Progress', date: '2025-04-02' },
        { code: 'CDF-2025-002', name: 'Upgradation of Sports Field at Govt High School', constituency: 'Kangan', dept: 'YSS', agency: 'BDO Kangan', block: 'Kangan', location: 'Kangan Town', cost: 8.25, allotted: 8.10, claim: 8.00, status: 'Completed', date: '2025-03-15' },
        { code: 'CDF-2025-003', name: 'Installation of Solar Street Lights in Ward 4', constituency: 'Ganderbal', dept: 'KPDCL', agency: 'BDO Ganderbal', block: 'Lar', location: 'Lar Village', cost: 12.00, allotted: 11.90, claim: 11.80, status: 'Pending', date: '2025-05-01' },
        { code: 'CDF-2025-004', name: 'Repair of Water Supply Scheme at Upper Reaches', constituency: 'Kangan', dept: 'I&FC', agency: 'BDO Gund', block: 'Gund', location: 'Gund', cost: 25.00, allotted: 24.80, claim: 24.50, status: 'In Progress', date: '2025-04-20' },
        { code: 'CDF-2025-005', name: 'Construction of Community Hall at Wakura', constituency: 'Ganderbal', dept: 'RDD', agency: 'BDO Wakura', block: 'Wakura', location: 'Wakura', cost: 32.00, allotted: 31.50, claim: 30.00, status: 'In Progress', date: '2025-04-10' },
        { code: 'CDF-2025-006', name: 'Fencing of Playground and Installation of Play Equipment', constituency: 'Kangan', dept: 'YSS', agency: 'BDO Kangan', block: 'Kangan', location: 'Kangan', cost: 6.80, allotted: 6.80, claim: 6.80, status: 'Completed', date: '2025-02-28' },
        { code: 'CDF-2025-007', name: 'Electrification of Upper Wakura Village', constituency: 'Ganderbal', dept: 'KPDCL', agency: 'BDO Wakura', block: 'Wakura', location: 'Upper Wakura', cost: 18.40, allotted: 18.10, claim: 17.90, status: 'In Progress', date: '2025-04-25' },
        { code: 'CDF-2025-008', name: 'Construction of Retaining Wall at Safapora', constituency: 'Ganderbal', dept: 'I&FC', agency: 'BDO Safapora', block: 'Safapora', location: 'Safapora', cost: 9.60, allotted: 9.20, claim: 9.00, status: 'Completed', date: '2025-03-05' },
        { code: 'CDF-2025-009', name: 'Repair and Renovation of Government Primary School Gund', constituency: 'Kangan', dept: 'RDD', agency: 'BDO Gund', block: 'Gund', location: 'Gund Village', cost: 11.25, allotted: 11.00, claim: 10.80, status: 'In Progress', date: '2025-05-08' },
        { code: 'CDF-2025-010', name: 'Laying of Drainage Pipes in BDO Lar Area', constituency: 'Ganderbal', dept: 'RDD', agency: 'BDO Lar', block: 'Lar', location: 'Lar', cost: 7.50, allotted: 7.30, claim: 7.20, status: 'Completed', date: '2025-03-22' },
        { code: 'CDF-2025-011', name: 'Construction of Multi-Purpose Room at Village Panchayat', constituency: 'Ganderbal', dept: 'RDD', agency: 'BDO Sherpathri', block: 'Sherpathri', location: 'Sherpathri', cost: 14.00, allotted: 13.70, claim: 13.50, status: 'In Progress', date: '2025-04-18' },
        { code: 'CDF-2025-012', name: 'Repair of Bridge at Gund Village', constituency: 'Kangan', dept: 'I&FC', agency: 'BDO Gund', block: 'Gund', location: 'Gund Bridge', cost: 28.00, allotted: 27.50, claim: 27.00, status: 'Pending', date: '2025-05-12' },
        { code: 'CDF-2025-013', name: 'Installation of Transformers in Kangan Block', constituency: 'Kangan', dept: 'KPDCL', agency: 'BDO Kangan', block: 'Kangan', location: 'Kangan East', cost: 22.00, allotted: 21.50, claim: 21.00, status: 'In Progress', date: '2025-04-30' },
        { code: 'CDF-2025-014', name: 'Fencing and Beautification of Parks in Ganderbal', constituency: 'Ganderbal', dept: 'YSS', agency: 'BDO Ganderbal', block: 'Ganderbal', location: 'City Park', cost: 5.00, allotted: 5.00, claim: 5.00, status: 'Completed', date: '2025-02-14' },
        { code: 'CDF-2025-015', name: 'Road Widening at Safapora Main Road', constituency: 'Ganderbal', dept: 'RDD', agency: 'BDO Safapora', block: 'Safapora', location: 'Safapora Chowk', cost: 19.50, allotted: 19.10, claim: 18.80, status: 'In Progress', date: '2025-05-03' },
    ];*/


    // document.addEventListener('DOMContentLoaded', () => {
    //     loadWorksData();
    // });



    //let wlFiltered = [...worksData];






    /*                                           
       VERIFICATION PAGE
                                               */






    /*    Photo upload with geo-tag watermark    */

    let geoCoords = null;

    // Try to get location on page load / page switch




    /*                                           
       PV REPORTS DATA & LOGIC
                                               */
    let pvReportsData = [];
    let pvrFiltered = [];
    let pvrCurrentPage = 1;










    /*                                           
       THEME SWITCHER
                                               */

    const THEMES = ['default', 'dark', 'greenish', 'bluish', 'purplish'];
    let currentTheme = localStorage.getItem('cdf-theme') || 'default';




    // Close picker when clicking outside (popover is now a body-level element,
    // so we must also allow clicks inside the popover itself)
    document.addEventListener('click', function (e) {
        const wrap = document.getElementById('themePickerWrap');
        const popover = document.getElementById('themePopover');
        if (wrap && !wrap.contains(e.target) && popover && !popover.contains(e.target)) {
            popover.classList.remove('open');
        }
    });

    // Apply saved theme on load
    document.addEventListener('DOMContentLoaded', () => {
        applyTheme(currentTheme);
    });

    /*                                           
       WORK DETAILS MODAL
                                               */






    /* --- Geo-Tagged Custom Camera Logic --- */
    let geoLocText = null;




    let usersListCache = [];











/* =========================================
   IMAGE COMPRESSOR UTILITY
   ========================================= */
let icOriginalFile = null;
let icOriginalDataUrl = null;
let icCompressedBlob = null;
let icOriginalImageObj = null;










/* =========================================
   PDF COMPRESSOR UTILITY
   ========================================= */
let pcOriginalFile = null;
let pcOriginalDataUrl = null;
let pcCompressedBlob = null;
let pcPdfDocument = null;










