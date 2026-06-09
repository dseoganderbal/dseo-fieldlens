    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    }
    function closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('overlay').classList.remove('show');
    }
    function toggleWorksMenu() {
        const submenu = document.getElementById('worksSubmenu');
        const chevron = document.getElementById('worksChevron');
        submenu.classList.toggle('open');
        chevron.classList.toggle('open');
    }
    function showCustomAlert(title, message, isConfirm, onConfirm, type) {
        isConfirm = isConfirm || false;
        onConfirm = onConfirm || null;
        type = type || 'info';
        const overlay = document.getElementById('customAlertOverlay');
        const modal = document.getElementById('customAlertModal');
        
        document.getElementById('customAlertTitle').textContent = title;
        document.getElementById('customAlertMessage').textContent = message;
        
        const iconDiv = document.getElementById('customAlertIcon');
        const confirmBtn = document.getElementById('customAlertConfirm');
        
        if (type === 'danger' || type === 'error') {
            iconDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger);"></i>';
            confirmBtn.className = 'btn btn-primary';
            confirmBtn.style.background = 'var(--danger)';
            confirmBtn.style.boxShadow = '0 4px 16px var(--danger-glow)';
        } else if (type === 'success') {
            iconDiv.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--success);"></i>';
            confirmBtn.className = 'btn btn-success';
            confirmBtn.style.background = '';
            confirmBtn.style.boxShadow = '';
        } else if (type === 'warning' || isConfirm) {
            iconDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i>';
            confirmBtn.className = 'btn btn-primary';
            confirmBtn.style.background = '';
            confirmBtn.style.boxShadow = '';
        } else {
            iconDiv.innerHTML = '<i class="fa-solid fa-circle-info" style="color:var(--primary);"></i>';
            confirmBtn.className = 'btn btn-primary';
            confirmBtn.style.background = '';
            confirmBtn.style.boxShadow = '';
        }

        const btnCancel = document.getElementById('customAlertCancel');
        
        if (isConfirm) {
            btnCancel.style.display = 'inline-flex';
            confirmBtn.textContent = 'Yes, Continue';
        } else {
            btnCancel.style.display = 'none';
            confirmBtn.textContent = 'OK';
        }

        customAlertCallback = onConfirm;
        
        confirmBtn.onclick = function() {
            closeCustomAlert();
            if (customAlertCallback) customAlertCallback();
        };

        overlay.classList.add('open');
        modal.classList.add('open');
    }
    function closeCustomAlert() {
        document.getElementById('customAlertOverlay').classList.remove('open');
        document.getElementById('customAlertModal').classList.remove('open');
    }
    function showPage(fileName) {
        if (window.innerWidth <= 992) {
            closeSidebar();
        }
        if (fileName === 'WorkEntry') {
            currentEditWorkcode = null;
        }

        // Update active menu state
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.submenu-item').forEach(el => {
            el.style.color = '';
            el.style.fontWeight = '';
        });

        let parentMenuId = '';
        if (fileName === 'Dashboard') parentMenuId = 'navDashboard';
        else if (fileName === 'PVReports') parentMenuId = 'pvReportsMenu';
        else if (fileName === 'ImageCompressor') parentMenuId = 'navImageCompressor';
        else if (fileName === 'PdfCompressor') parentMenuId = 'navPdfCompressor';
        else if (['WorkEntry', 'Verification', 'WorksList'].includes(fileName)) {
            parentMenuId = 'navWorks';
            document.querySelectorAll('.submenu-item').forEach(el => {
                if (el.getAttribute('onclick') && el.getAttribute('onclick').includes(fileName)) {
                    el.style.color = 'var(--text-primary)';
                    el.style.fontWeight = '700';
                }
            });
        }

        if (parentMenuId) {
            const menuEl = document.getElementById(parentMenuId);
            if (menuEl) menuEl.classList.add('active');
        }

        const contentDiv = document.getElementById('app-content');

        const renderPage = (htmlString) => {
            contentDiv.innerHTML = htmlString;
            contentDiv.style.display = 'block';
            if (fileName === 'Dashboard') {
                initDashboard();
            } else if (fileName === 'WorksList') {
                loadWorksData();
            } else if (fileName === 'PVReports') {
                loadPVReportsData();
            } else if (fileName === 'Profile') {
                loadUserProfile();
            } else if (fileName === 'UserManagement') {
                if (sessionStorage.getItem('cdf_user_role') !== 'Admin') {
                    showCustomAlert('Access Denied', 'Only administrators can access User Management.', false, null, 'danger');
                    return;
                }
                fetchUsers();
            } else if (fileName === 'ImageCompressor') {
                initImageCompressor();
            } else if (fileName === 'PdfCompressor') {
                initPdfCompressor();
            } else if (fileName === 'WorkEntry') {
                attachWeValidationListeners();
                if (!isMasterDataLoaded) {
                    loadMasterData();
                } else {
                    populateWeDropdowns();
                }

                if (currentEditWorkcode) {
                    document.getElementById('btnSubmitWe').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Work Entry';
                    document.getElementById('weWorkcode').value = 'Loading data...';
                    google.script.run
                        .withSuccessHandler(data => {
                            document.getElementById('weWorksYear').value = data['worksyear'] || '';
                            document.getElementById('wePvYear').value = data['pvyear'] || '';
                            document.getElementById('weWorkcode').value = data['code'] || '';
                            let dt = data['date'] || '';
                            if (dt.includes('-') && dt.split('-')[0].length === 2) {
                                const p = dt.split('-');
                                dt = `${p[2]}-${p[1]}-${p[0]}`;
                            }
                            document.getElementById('weDateReceipt').value = dt;
                            document.getElementById('weWorkName').value = data['name'] || '';
                            document.getElementById('weConstituency').value = data['constituency'] || '';
                            document.getElementById('weBlock').value = data['block'] || '';
                            document.getElementById('weLocation').value = data['location'] || '';
                            document.getElementById('weDepartment').value = data['dept'] || '';
                            document.getElementById('weAgency').value = data['agency'] || '';
                            document.getElementById('weAACost').value = data['cost'] || '';
                            document.getElementById('weAllottedCost').value = data['allotted'] || '';
                            document.getElementById('wePositionAA').value = data['position a/a'] || data['position of a/a'] || '';
                            document.getElementById('weClaim').value = data['claim'] || '';
                        })
                        .withFailureHandler(err => showCustomAlert('Alert', "Error loading data: " + err))
                        .getWorkEntry(sessionStorage.getItem("cdf_auth_token"), currentEditWorkcode);
                } else {
                    document.getElementById('btnSubmitWe').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Work Entry';
                    const today = new Date().toISOString().split('T')[0];
                    const dateField = document.getElementById('weDateReceipt');
                    if (dateField && !dateField.value) dateField.value = today;
                }
            }
        };

        if (pageCache[fileName]) {
            renderPage(pageCache[fileName]);
            return;
        }

        // Show beautiful loading spinner only if we need to fetch
        contentDiv.innerHTML = `
            <div class="page-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-label">Loading</div>
            </div>`;

        fetch('pages/' + fileName + '.html')
            .then(res => {
                if (!res.ok) throw new Error("Page not found");
                return res.text();
            })
            .then(htmlString => {
                pageCache[fileName] = htmlString;
                renderPage(htmlString);
            })
            .catch(error => {
                contentDiv.innerHTML = `
                    <div class="page-spinner">
                        <i class="fa-solid fa-circle-exclamation" style="font-size:32px;color:var(--danger);"></i>
                        <div class="spinner-label" style="color:var(--danger);">Failed to load page.<br><small>${error.message || ''}</small></div>
                    </div>`;
            });
    }
    function applyTheme(theme) {
        if (theme === 'default') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        // Update active indicator on all theme opts
        THEMES.forEach(t => {
            const el = document.getElementById(`topt-${t}`);
            if (el) el.classList.toggle('active', t === theme);
        });
        currentTheme = theme;
        localStorage.setItem('cdf-theme', theme);
    }
    function setTheme(theme) {
        applyTheme(theme);
        // Close popover after selection
        document.getElementById('themePopover').classList.remove('open');
    }
    function toggleThemePicker() {
        const popover = document.getElementById('themePopover');
        const btn = document.querySelector('#themePickerWrap .icon-btn');
        const isOpen = popover.classList.contains('open');

        if (isOpen) {
            popover.classList.remove('open');
            return;
        }

        // Position the fixed popover below the palette button
        const rect = btn.getBoundingClientRect();
        popover.style.top = (rect.bottom + 8) + 'px';
        popover.style.left = Math.max(8, rect.right - 208) + 'px'; // 208 = min-width + a bit
        popover.classList.add('open');
    }
