let worksData = [];
    let wlFiltered = [];
    const WL_PAGE_SIZE = 10;
    let wlCurrentPage = 1;
    // Pages that show the "Add Work" button in the topbar   add new pages here as needed
    const PAGES_WITH_ADD_WORK = new Set(['WorksList']);

    /*    Sidebar    */
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

    /* CUSTOM ALERTS */
    let customAlertCallback = null;

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

    /*    Filter / Dashboard update    */
    let barChartInst = null;
    let donutChartInst = null;
    let dashboardWorks = [];

    function updateDashboard() {
        const worksYear = document.getElementById('worksYear').value;
        const pvYear = document.getElementById('pvYear').value;

        document.getElementById('totalWorks').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        document.getElementById('verifiedWorks').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        document.getElementById('pendingWorks').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        document.getElementById('claimAmount').innerHTML = '...';

        const loaders = `<tr><td colspan="7" style="text-align:center;padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;
        document.getElementById('constituencyTableBody').innerHTML = loaders;
        document.getElementById('financialTableBody').innerHTML = loaders;
        document.getElementById('blockTableBody').innerHTML = loaders;
        document.getElementById('departmentTableBody').innerHTML = loaders;

        google.script.run
            .withSuccessHandler(function (data) {
                if (!Array.isArray(data)) { data = []; }
                dashboardWorks = data.filter(w => pvYear === 'All' || !pvYear || w.pvyear === pvYear);
                renderDashboardAggregates(dashboardWorks);
            })
            .withFailureHandler(function (error) {
                console.error("Failed to load dashboard data", error);
                showCustomAlert('Notice', "Failed to load dashboard data. Please try again.");
                document.getElementById('totalWorks').innerHTML = '0';
                document.getElementById('verifiedWorks').innerHTML = '0';
                document.getElementById('pendingWorks').innerHTML = '0';
                document.getElementById('claimAmount').innerHTML = '0.0';
                const errorHtml = `<tr><td colspan="7" style="text-align:center;padding:20px;color:red;">Error loading data</td></tr>`;
                document.getElementById('constituencyTableBody').innerHTML = errorHtml;
                document.getElementById('financialTableBody').innerHTML = errorHtml;
                document.getElementById('blockTableBody').innerHTML = errorHtml;
                document.getElementById('departmentTableBody').innerHTML = errorHtml;
            })
            .getWorksData(sessionStorage.getItem("cdf_auth_token"), worksYear);
    }

    function renderDashboardAggregates(works) {
        let total = works.length;
        let verified = 0;
        let pending = 0;
        let totalClaim = 0.0;

        let constStats = { 'Ganderbal': { recv: 0, aa: 0, ver: 0, claim: 0, alloc: 0, ver_aa: 0, ver_alloc: 0, ver_claim: 0, pend_aa: 0, pend_alloc: 0, pend_claim: 0 }, 'Kangan': { recv: 0, aa: 0, ver: 0, claim: 0, alloc: 0, ver_aa: 0, ver_alloc: 0, ver_claim: 0, pend_aa: 0, pend_alloc: 0, pend_claim: 0 } };
        let blockStats = {};
        let deptStats = {};

        works.forEach(w => {
            const isVerified = (w.status === 'Completed');
            if (isVerified) verified++; else pending++;
            totalClaim += (w.claim || 0);

            // Constituency
            let c = w.constituency;
            if (c === 'Ganderbal' || c === 'Kangan') {
                constStats[c].recv++;
                constStats[c].aa += (w.cost || 0);
                constStats[c].alloc += (w.allotted || 0);
                constStats[c].claim += (w.claim || 0);
                if (isVerified) {
                    constStats[c].ver++;
                    constStats[c].ver_aa += (w.cost || 0);
                    constStats[c].ver_alloc += (w.allotted || 0);
                    constStats[c].ver_claim += (w.claim || 0);
                } else {
                    constStats[c].pend_aa += (w.cost || 0);
                    constStats[c].pend_alloc += (w.allotted || 0);
                    constStats[c].pend_claim += (w.claim || 0);
                }
            }

            // Block (BDO as agency)
            let b = w.agency;
            if (b && b.toUpperCase().includes('BDO')) {
                if (!blockStats[b]) blockStats[b] = { recv: 0, ver: 0, pend: 0 };
                blockStats[b].recv++;
                if (isVerified) blockStats[b].ver++; else blockStats[b].pend++;
            }

            // Dept
            let d = w.dept;
            if (d) {
                if (!deptStats[d]) deptStats[d] = { recv: 0, ver: 0, pend: 0 };
                deptStats[d].recv++;
                if (isVerified) deptStats[d].ver++; else deptStats[d].pend++;
            }
        });

        let pct = total === 0 ? 0 : Math.round((verified / total) * 100);

        // Update KPIs
        animateCount('totalWorks', total);
        animateCount('verifiedWorks', verified);
        animateCount('pendingWorks', pending);
        document.getElementById('claimAmount').textContent = totalClaim.toFixed(2);

        document.getElementById('totalWorksBar').style.width = '100%';
        document.getElementById('verifiedWorksBar').style.width = pct + '%';
        document.getElementById('pendingWorksBar').style.width = (100 - pct) + '%';

        // Update Donut & Progress bars
        document.getElementById('donutPercentText').textContent = pct + '%';
        document.getElementById('progressOverallVal').textContent = `${verified} / ${total}`;
        document.getElementById('progressOverallBar').style.width = pct + '%';
        document.getElementById('progressReportsVal').textContent = `${verified} Reports`;
        document.getElementById('progressReportsBar').style.width = pct + '%';
        document.getElementById('progressPendingVal').textContent = `${pending} Works`;
        let pendPct = total === 0 ? 0 : Math.round((pending / total) * 100);
        document.getElementById('progressPendingBar').style.width = pendPct + '%';

        // Update Charts
        if (barChartInst) {
            barChartInst.data.datasets[0].data = [constStats['Ganderbal'].recv, constStats['Kangan'].recv];
            barChartInst.data.datasets[1].data = [constStats['Ganderbal'].ver, constStats['Kangan'].ver];
            barChartInst.data.datasets[2].data = [constStats['Ganderbal'].recv - constStats['Ganderbal'].ver, constStats['Kangan'].recv - constStats['Kangan'].ver];
            barChartInst.update();
        }
        if (donutChartInst) {
            donutChartInst.data.datasets[0].data = [verified, pending];
            donutChartInst.update();
        }

        // Constituency Table
        let cHtml = '';
        let sno = 1;
        let cTotalRecv = 0, cTotalAA = 0, cTotalVer = 0;
        ['Ganderbal', 'Kangan'].forEach(c => {
            let st = constStats[c];
            cHtml += `<tr><td>${sno++}</td><td class="text-left">${c}</td><td>${st.recv}</td><td>${st.aa.toFixed(2)}</td><td>${st.ver}</td><td>${st.ver}</td></tr>`;
            cTotalRecv += st.recv; cTotalAA += st.aa; cTotalVer += st.ver;
        });
        cHtml += `<tr class="total-row"><td></td><td class="text-left">Total</td><td>${cTotalRecv}</td><td>${cTotalAA.toFixed(2)}</td><td>${cTotalVer}</td><td>${cTotalVer}</td></tr>`;
        document.getElementById('constituencyTableBody').innerHTML = cHtml;

        // Financial Table
        let fHtml = '';
        fHtml += `<tr class="sub-header-row"><th colspan="6">  Works Verified</th></tr>`;
        let fVerAA = 0, fVerAlloc = 0, fVerClaim = 0, fVerCount = 0;
        ['Ganderbal', 'Kangan'].forEach((c, idx) => {
            let st = constStats[c];
            fHtml += `<tr><td>${idx + 1}</td><td class="text-left">${c}</td><td>${st.ver}</td><td>${st.ver_aa.toFixed(3)}</td><td>${st.ver_alloc.toFixed(3)}</td><td>${st.ver_claim.toFixed(3)}</td></tr>`;
            fVerCount += st.ver; fVerAA += st.ver_aa; fVerAlloc += st.ver_alloc; fVerClaim += st.ver_claim;
        });
        fHtml += `<tr class="subtotal-row"><td></td><td class="text-left">Sub Total</td><td>${fVerCount}</td><td>${fVerAA.toFixed(3)}</td><td>${fVerAlloc.toFixed(3)}</td><td>${fVerClaim.toFixed(3)}</td></tr>`;

        fHtml += `<tr class="sub-header-row"><th colspan="6">  Verification Under Progress</th></tr>`;
        let fPendAA = 0, fPendAlloc = 0, fPendClaim = 0, fPendCount = 0;
        ['Ganderbal', 'Kangan'].forEach((c, idx) => {
            let st = constStats[c];
            let pendCount = st.recv - st.ver;
            fHtml += `<tr><td>${idx + 1}</td><td class="text-left">${c}</td><td>${pendCount}</td><td>${st.pend_aa.toFixed(3)}</td><td>${st.pend_alloc.toFixed(3)}</td><td>${st.pend_claim.toFixed(3)}</td></tr>`;
            fPendCount += pendCount; fPendAA += st.pend_aa; fPendAlloc += st.pend_alloc; fPendClaim += st.pend_claim;
        });
        fHtml += `<tr class="subtotal-row"><td></td><td class="text-left">Sub Total</td><td>${fPendCount}</td><td>${fPendAA.toFixed(3)}</td><td>${fPendAlloc.toFixed(3)}</td><td>${fPendClaim.toFixed(3)}</td></tr>`;
        fHtml += `<tr class="total-row"><td></td><td class="text-left">Grand Total</td><td>${fVerCount + fPendCount}</td><td>${(fVerAA + fPendAA).toFixed(3)}</td><td>${(fVerAlloc + fPendAlloc).toFixed(3)}</td><td>${(fVerClaim + fPendClaim).toFixed(3)}</td></tr>`;
        document.getElementById('financialTableBody').innerHTML = fHtml;

        // Block Table
        let bHtml = '';
        sno = 1;
        let bTotalRecv = 0, bTotalVer = 0, bTotalPend = 0;
        Object.keys(blockStats).forEach(b => {
            let st = blockStats[b];
            bHtml += `<tr><td>${sno++}</td><td class="text-left">${b}</td><td>${st.recv}</td><td>${st.ver}</td><td><span class="${st.pend > 0 ? 'highlight-cell' : ''}">${st.pend}</span></td><td>${st.ver}</td><td>0</td></tr>`;
            bTotalRecv += st.recv; bTotalVer += st.ver; bTotalPend += st.pend;
        });
        if (Object.keys(blockStats).length === 0) {
            bHtml = `<tr><td colspan="7" style="text-align:center;padding:20px;">No Data Available</td></tr>`;
        } else {
            bHtml += `<tr class="total-row"><td></td><td class="text-left">Total</td><td>${bTotalRecv}</td><td>${bTotalVer}</td><td>${bTotalPend}</td><td>${bTotalVer}</td><td>0</td></tr>`;
        }
        document.getElementById('blockTableBody').innerHTML = bHtml;

        // Dept Table
        let dHtml = '';
        sno = 1;
        let dTotalRecv = 0, dTotalVer = 0, dTotalPend = 0;
        Object.keys(deptStats).forEach(d => {
            let st = deptStats[d];
            let badge = st.pend === 0 && st.recv > 0 ? `<span class="badge badge-completed"><span class="badge-dot"></span>Completed</span>` : `<span class="badge badge-progress"><span class="badge-dot"></span>In Progress</span>`;
            dHtml += `<tr><td>${sno++}</td><td class="text-left">${d}</td><td>${st.recv}</td><td>${st.ver}</td><td>${st.pend}</td><td>${st.ver}</td><td>${badge}</td></tr>`;
            dTotalRecv += st.recv; dTotalVer += st.ver; dTotalPend += st.pend;
        });
        if (Object.keys(deptStats).length === 0) {
            dHtml = `<tr><td colspan="7" style="text-align:center;padding:20px;">No Data Available</td></tr>`;
        } else {
            dHtml += `<tr class="total-row"><td></td><td class="text-left">Total</td><td>${dTotalRecv}</td><td>${dTotalVer}</td><td>${dTotalPend}</td><td>${dTotalVer}</td><td></td></tr>`;
        }
        document.getElementById('departmentTableBody').innerHTML = dHtml;
    }

    function animateCount(id, target) {
        const el = document.getElementById(id);
        const start = parseInt(el.textContent) || 0;
        const duration = 600;
        const startTime = performance.now();

        function step(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(start + (target - start) * ease);
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    /*    Search    */
    function searchDepartmentTable() {
        const filter = document.getElementById('searchTable').value.toLowerCase();
        const rows = document.querySelectorAll('#departmentTable tbody tr');
        rows.forEach(row => {
            const cell = row.querySelector('td:nth-child(2)');
            row.style.display = cell && cell.textContent.toLowerCase().includes(filter) ? '' : 'none';
        });
    }

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
    function initDashboard() {
        if (typeof ChartDataLabels !== 'undefined') {
            Chart.register(ChartDataLabels);
        }

        // Wire year dropdown (element is inside Dashboard.html)
        const worksYearEl = document.getElementById('worksYear');
        if (worksYearEl) {
            worksYearEl.addEventListener('change', function () {
                const pvDropdown = document.getElementById('pvYear');
                pvDropdown.innerHTML = this.value === '2026-27'
                    ? '<option value="2026-27">2026 27</option><option value="All">All Works</option>'
                    : '<option value="2025-26">2025 26</option><option value="2026-27">2026 27</option><option value="All">All Works</option>';
                updateDashboard();
            });
        }

        const pvYearEl = document.getElementById('pvYear');
        if (pvYearEl) {
            pvYearEl.addEventListener('change', updateDashboard);
        }

        // Bar Chart
        const barCtx = document.getElementById('barChart');
        if (barCtx) {
            barChartInst = new Chart(barCtx.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['Ganderbal', 'Kangan'],
                    datasets: [
                        { label: 'Works Received', data: [0, 0], backgroundColor: 'rgba(99,102,241,0.7)', borderColor: '#6366f1', borderWidth: 2, borderRadius: 8, borderSkipped: false },
                        { label: 'Verified', data: [0, 0], backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 2, borderRadius: 8, borderSkipped: false },
                        { label: 'Pending', data: [0, 0], backgroundColor: 'rgba(245,158,11,0.7)', borderColor: '#f59e0b', borderWidth: 2, borderRadius: 8, borderSkipped: false }
                    ]
                },
                options: {
                    ...chartDefaults,
                    plugins: {
                        ...chartDefaults.plugins,
                        legend: { display: true, labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyleWidth: 8, padding: 16 } },
                        datalabels: {
                            color: '#94a3b8',
                            anchor: 'end',
                            align: 'top',
                            font: { family: 'Inter', weight: 'bold', size: 11 },
                            formatter: function (value) {
                                return value > 0 ? value : '';
                            }
                        }
                    },
                    layout: { padding: { top: 10 } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#64748b', font: { family: 'Inter', size: 12 } }, border: { display: false } },
                        y: { grace: '15%', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'Inter', size: 12 } }, border: { display: false } }
                    }
                }
            });
        }

        // Donut Chart
        const donutCtx = document.getElementById('donutChart');
        if (donutCtx) {
            donutChartInst = new Chart(donutCtx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    datasets: [{ data: [0, 1], backgroundColor: ['rgba(16,185,129,0.85)', 'rgba(245,158,11,0.35)'], borderColor: ['#10b981', '#f59e0b'], borderWidth: 2, hoverOffset: 6 }]
                },
                options: {
                    ...chartDefaults,
                    cutout: '72%',
                    plugins: {
                        ...chartDefaults.plugins,
                        datalabels: { display: false }
                    }
                }
            });
        }

        // Load data on init
        updateDashboard();
    }



    /*    Work Entry Page    */

    let masterData = [];
    let isMasterDataLoaded = false;

    function loadMasterData() {
        if (isMasterDataLoaded) {
            populateWeDropdowns();
            return;
        }

        google.script.run
            .withSuccessHandler(data => {
                masterData = data;
                isMasterDataLoaded = true;
                populateWeDropdowns();
            })
            .withFailureHandler(err => console.error("Failed to load master data", err))
            .getMasterData(sessionStorage.getItem("cdf_auth_token"));
    }

    function populateWeDropdowns() {
        const worksYearSel = document.getElementById('weWorksYear');
        const pvYearSel = document.getElementById('wePvYear');
        const constSel = document.getElementById('weConstituency');
        const deptSel = document.getElementById('weDepartment');

        if (!worksYearSel) return;

        const worksYears = [...new Set(masterData.map(r => r['Works Financial Year']).filter(Boolean))];
        const pvYears = [...new Set(masterData.map(r => r['PV Financial Year']).filter(Boolean))];
        const constituencies = [...new Set(masterData.map(r => r['Assembly Constituency']).filter(Boolean))];
        const depts = [...new Set(masterData.map(r => r['Name of Department']).filter(Boolean))];
        const blocks = [...new Set(masterData.map(r => r['Name of the Block']).filter(Boolean))];
        const agencies = [...new Set(masterData.map(r => r['Executing Agency']).filter(Boolean))];
        const positionsAA = [...new Set(masterData.map(r => r['Position of A/A'] || r['Position A/A']).filter(Boolean))];

        const fillOptions = (selectEl, options) => {
            selectEl.innerHTML = '<option value="">  Select  </option>';
            options.forEach(opt => selectEl.innerHTML += '<option value="' + opt + '">' + opt + '</option>');
        };

        fillOptions(worksYearSel, worksYears);
        fillOptions(pvYearSel, pvYears);
        fillOptions(constSel, constituencies);
        fillOptions(deptSel, depts);

        const blockSel = document.getElementById('weBlock');
        const agencySel = document.getElementById('weAgency');
        const positionSel = document.getElementById('wePositionAA');
        if (blockSel) fillOptions(blockSel, blocks);
        if (agencySel) fillOptions(agencySel, agencies);
        if (positionSel) fillOptions(positionSel, positionsAA);
    }



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

    function validateWeForm() {
        let valid = true;
        weRequiredFields.forEach(f => {
            const el = document.getElementById(f.id);
            const errEl = document.getElementById(f.errId);
            if (!el) return;
            const val = el.value.trim();
            if (!val) {
                el.classList.add('invalid');
                errEl.style.display = 'block';
                valid = false;
            } else {
                el.classList.remove('invalid');
                errEl.style.display = 'none';
            }
        });
        return valid;
    }

    // Clear validation on input
    function attachWeValidationListeners() {
        weRequiredFields.forEach(f => {
            const el = document.getElementById(f.id);
            if (!el) return;
            el.addEventListener('input', () => {
                el.classList.remove('invalid');
                document.getElementById(f.errId).style.display = 'none';
            });
            el.addEventListener('change', () => {
                el.classList.remove('invalid');
                document.getElementById(f.errId).style.display = 'none';
            });
        });
    }

    function fetchNewWorkcode() {
        const worksYear = document.getElementById('weWorksYear').value;
        const workcodeEl = document.getElementById('weWorkcode');
        if (!worksYear) {
            workcodeEl.value = '';
            return;
        }
        workcodeEl.value = 'Calculating...';
        google.script.run
            .withSuccessHandler(code => { workcodeEl.value = code; workcodeEl.classList.remove('invalid'); document.getElementById('err_weWorkcode').style.display = 'none'; })
            .withFailureHandler(err => { workcodeEl.value = 'Error'; console.error(err); })
            .getNewWorkcode(sessionStorage.getItem("cdf_auth_token"), worksYear);
    }

    function submitWeEntry() {
        if (!validateWeForm()) {
            const firstErr = document.querySelector('#workEntryForm .invalid');
            if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const btn = document.getElementById('btnSubmitWe');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        function formatDateDMY(dateStr) {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return dateStr;
        }

        const entry = {
            worksYear: document.getElementById('weWorksYear').value,
            pvYear: document.getElementById('wePvYear').value,
            workcode: document.getElementById('weWorkcode').value.trim(),
            dateReceipt: formatDateDMY(document.getElementById('weDateReceipt').value),
            workName: document.getElementById('weWorkName').value.trim(),
            constituency: document.getElementById('weConstituency').value,
            block: document.getElementById('weBlock').value,
            location: document.getElementById('weLocation').value.trim(),
            department: document.getElementById('weDepartment').value,
            agency: document.getElementById('weAgency').value,
            aaCost: parseFloat(document.getElementById('weAACost').value),
            allottedCost: parseFloat(document.getElementById('weAllottedCost').value),
            positionAA: document.getElementById('wePositionAA').value.trim(),
            claim: parseFloat(document.getElementById('weClaim').value)
        };

        const fileInput = document.getElementById('weDocument');
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                showCustomAlert('Alert', 'Document size cannot exceed 2 MB.');
                btn.innerHTML = ogText;
                btn.disabled = false;
                return;
            }
            const reader = new FileReader();
            reader.onload = function (e) {
                const data = e.target.result;
                const base64Data = data.split(',')[1];
                if (currentEditWorkcode) {
                    google.script.run
                        .withSuccessHandler(() => handleWeSuccess(entry, btn, ogText))
                        .withFailureHandler(err => handleWeError(err, btn, ogText))
                        .updateWorkEntry(currentEditWorkcode, entry, base64Data, file.name);
                } else {
                    google.script.run
                        .withSuccessHandler(() => handleWeSuccess(entry, btn, ogText))
                        .withFailureHandler(err => handleWeError(err, btn, ogText))
                        .submitWorkEntryData(sessionStorage.getItem("cdf_auth_token"), entry, base64Data, file.name);
                }
            };
            reader.readAsDataURL(file);
        } else {
            if (currentEditWorkcode) {
                google.script.run
                    .withSuccessHandler(() => handleWeSuccess(entry, btn, ogText))
                    .withFailureHandler(err => handleWeError(err, btn, ogText))
                    .updateWorkEntry(currentEditWorkcode, entry, null, null);
            } else {
                google.script.run
                    .withSuccessHandler(() => handleWeSuccess(entry, btn, ogText))
                    .withFailureHandler(err => handleWeError(err, btn, ogText))
                    .submitWorkEntryData(sessionStorage.getItem("cdf_auth_token"), entry, null, null);
            }
        }
    }

    function handleWeSuccess(entry, btn, ogText) {
        btn.innerHTML = ogText;
        btn.disabled = false;
        const toast = document.getElementById('successToast');
        document.getElementById('toastMsg').textContent = `"${entry.workcode}" - ${entry.workName.substring(0, 40)}...`;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 4000);
        resetWeForm();
    }

    function handleWeError(err, btn, ogText) {
        btn.innerHTML = ogText;
        btn.disabled = false;
        showCustomAlert('Alert', "Error saving work entry: " + (err.message || err));
    }

    function resetWeForm() {
        currentEditWorkcode = null;
        const form = document.getElementById('workEntryForm');
        if (form) form.reset();
        weRequiredFields.forEach(f => {
            const el = document.getElementById(f.id);
            const errEl = document.getElementById(f.errId);
            if (el) el.classList.remove('invalid');
            if (errEl) errEl.style.display = 'none';
        });
    }

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

    /* Page metadata is declared at the top of the script to avoid TDZ errors */

    // function updateTopbar(fileName) {
    //     // Title & subtitle are static in Index.html   only toggle context buttons
    //     document.getElementById('globalAddWorkBtn').style.display =
    //         PAGES_WITH_ADD_WORK.has(fileName) ? '' : 'none';
    // }

    let currentEditWorkcode = null;

    function deleteWork(code) {
        showCustomAlert('Delete Work', 'Are you sure you want to delete entry ' + code + '?', true, function() {
        google.script.run
            .withSuccessHandler(() => {
                showCustomAlert('Success', "Entry deleted successfully.", false, null, 'success');
                loadWorksData();
            })
            .withFailureHandler(err => showCustomAlert('Error', "Failed to delete: " + (err.message || err), false, null, 'danger'))
            .deleteWorkEntry(sessionStorage.getItem("cdf_auth_token"), code);
    }, 'danger');
    }

    function editWork(code) {
        currentEditWorkcode = code;
        openUnifiedEdit(code);
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

        // Show beautiful loading spinner
        contentDiv.innerHTML = `
            <div class="page-spinner">
                <div class="spinner-ring"></div>
                <div class="spinner-label">Loading </div>
            </div>`;

        // Update the persistent topbar immediately on navigation
        // updateTopbar(fileName);

        fetch('pages/' + fileName + '.html')
            .then(res => {
                if (!res.ok) throw new Error("Page not found");
                return res.text();
            })
            .then(htmlString => {
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
            })
            .catch(error => {
                contentDiv.innerHTML = `
                    <div class="page-spinner">
                        <i class="fa-solid fa-circle-exclamation" style="font-size:32px;color:var(--danger);"></i>
                        <div class="spinner-label" style="color:var(--danger);">Failed to load page.<br><small>${error.message || ''}</small></div>
                    </div>`;
            });
    }

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

    function loadWorksData() {

        const year = document.getElementById('wlFilterworksyear').value;
        //console.log("Loading works data for:", year);

        // Optional loading indicator
        document.getElementById('wlTableBody').innerHTML =
            `<tr>
            <td colspan="7" style="text-align:center;padding:20px;">
                Loading data...
            </td>
        </tr>`;

        google.script.run
            .withSuccessHandler(function (data) {

                // console.log("SUCCESS");
                // console.log(JSON.stringify(data));
                // console.log(typeof data);
                // console.log(Array.isArray(data));

                if (!Array.isArray(data)) {

                    console.error("Invalid data returned");

                    worksData = [];
                    wlFiltered = [];

                } else {

                    worksData = data;
                    wlFiltered = [...worksData];

                }

                wlCurrentPage = 1;

                wlRender();

            })
            .withFailureHandler(function (error) {

                console.error("FAILED");
                console.error(error);

                document.getElementById('wlTableBody').innerHTML =
                    `<tr>
                    <td colspan="7" style="text-align:center;color:red;padding:20px;">
                        Failed to load data
                    </td>
                </tr>`;

            })
            .getWorksData(sessionStorage.getItem("cdf_auth_token"), year);
    }


    //let wlFiltered = [...worksData];

    function wlFilterAndRender() {
        const wyear = document.getElementById('wlFilterworksyear').value;
        const q = (document.getElementById('wlSearch').value || '').toLowerCase();
        const ac = document.getElementById('wlFilterConstituency').value;
        const dept = document.getElementById('wlFilterDept').value;
        const stat = document.getElementById('wlFilterStatus').value;

        wlFiltered = worksData.filter(w => {
            //const matchWorksyear = !wyear || w.worksyear === wyear;
            const matchQ = !q || w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q) || w.agency.toLowerCase().includes(q);
            const matchAC = !ac || w.constituency === ac;
            const matchDept = !dept || w.dept === dept;
            const matchStat = !stat || w.status === stat;
            return matchQ && matchAC && matchDept && matchStat;
        });

        wlCurrentPage = 1;
        wlRender();
    }

    function wlRender() {
        const total = wlFiltered.length;
        const pages = Math.max(1, Math.ceil(total / WL_PAGE_SIZE));
        const start = (wlCurrentPage - 1) * WL_PAGE_SIZE;
        const slice = wlFiltered.slice(start, start + WL_PAGE_SIZE);

        const body = document.getElementById('wlTableBody');
        const empty = document.getElementById('wlEmpty');
        const showing = document.getElementById('wlShowing');

        if (slice.length === 0) {
            body.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            body.innerHTML = slice.map((w, i) => `
                    <tr>
                        <td><span class="wl-workcode">${w.code}</span></td>
                        <td><div class="wl-work-name">${w.name}</div>
                            <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
                                <i class="fa-solid fa-location-dot" style="font-size:10px;"></i> ${w.location} &bull; ${w.block}
                            </div>
                        </td>
                        <td style="font-size:12px;color:var(--text-secondary);">${w.constituency}</td>
                        <td><span class="wl-dept">${w.dept}</span></td>
                        <td><span class="wl-agency">${w.agency}</span></td>
                        <td class="wl-cost">&#8377; ${w.cost.toFixed(2)}<br><span>Claim: &#8377; ${w.claim.toFixed(2)}</span></td>
                        <td style="text-align:center;">${wlBadge(w.status)}</td>
                        <td class="action-cell">
                            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="openWorkDetails('${w.code}')"><i class="fa-solid fa-eye"></i></button>
                            ${sessionStorage.getItem('cdf_user_role') !== 'Viewer' ? `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" onclick="editWork('${w.code}')"><i class="fa-solid fa-pencil"></i></button>` : ''}
                            ${sessionStorage.getItem('cdf_user_role') === 'Admin' ? `<button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: red;" onclick="deleteWork('${w.code}')"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </td>
                    </tr>
                `).join('');
        }

        const endRow = Math.min(start + WL_PAGE_SIZE, total);
        showing.innerHTML = total === 0
            ? 'No entries found'
            : `Showing <strong>${start + 1}</strong> to <strong>${endRow}</strong> of <strong>${total}</strong> entries`;

        // Build pagination
        const pg = document.getElementById('wlPagination');
        pg.innerHTML = '';

        if (pages < 1) return;

        const createBtn = (html, isDisabled, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'pg-btn';
            btn.innerHTML = html;
            btn.disabled = isDisabled;
            if (!isDisabled && onClick) btn.onclick = onClick;
            return btn;
        };

        const createPageBtn = (p) => {
            const btn = document.createElement('button');
            btn.className = 'pg-btn' + (p === wlCurrentPage ? ' active' : '');
            btn.textContent = p;
            btn.onclick = () => { wlCurrentPage = p; wlRender(); };
            return btn;
        };

        const createEllipsis = () => {
            const span = document.createElement('span');
            span.innerHTML = '&hellip;';
            span.style.padding = '4px 8px';
            span.style.color = 'var(--text-muted)';
            span.style.display = 'inline-flex';
            span.style.alignItems = 'flex-end';
            return span;
        };

        // First
        pg.appendChild(createBtn('<i class="fa-solid fa-angles-left" style="font-size:11px;"></i>', wlCurrentPage === 1, () => { wlCurrentPage = 1; wlRender(); }));
        // Prev
        pg.appendChild(createBtn('<i class="fa-solid fa-chevron-left" style="font-size:11px;"></i>', wlCurrentPage === 1, () => { wlCurrentPage--; wlRender(); }));

        // Page numbers
        if (pages <= 7) {
            for (let p = 1; p <= pages; p++) pg.appendChild(createPageBtn(p));
        } else {
            if (wlCurrentPage <= 4) {
                for (let p = 1; p <= 5; p++) pg.appendChild(createPageBtn(p));
                pg.appendChild(createEllipsis());
                pg.appendChild(createPageBtn(pages));
            } else if (wlCurrentPage >= pages - 3) {
                pg.appendChild(createPageBtn(1));
                pg.appendChild(createEllipsis());
                for (let p = pages - 4; p <= pages; p++) pg.appendChild(createPageBtn(p));
            } else {
                pg.appendChild(createPageBtn(1));
                pg.appendChild(createEllipsis());
                pg.appendChild(createPageBtn(wlCurrentPage - 1));
                pg.appendChild(createPageBtn(wlCurrentPage));
                pg.appendChild(createPageBtn(wlCurrentPage + 1));
                pg.appendChild(createEllipsis());
                pg.appendChild(createPageBtn(pages));
            }
        }

        // Next
        pg.appendChild(createBtn('<i class="fa-solid fa-chevron-right" style="font-size:11px;"></i>', wlCurrentPage === pages, () => { wlCurrentPage++; wlRender(); }));
        // Last
        pg.appendChild(createBtn('<i class="fa-solid fa-angles-right" style="font-size:11px;"></i>', wlCurrentPage === pages, () => { wlCurrentPage = pages; wlRender(); }));
    }

    function wlBadge(status) {
        const map = {
            'In Progress': 'badge-progress',
            'Completed': 'badge-completed',
            'Pending': 'badge-pending',
        };
        const cls = map[status] || 'badge-progress';
        return `<span class="badge ${cls}"><span class="badge-dot"></span>${status}</span>`;
    }

    function exportWorksExcel() {
        if (!wlFiltered || wlFiltered.length === 0) {
            showCustomAlert('Alert', 'No works to export.');
            return;
        }
        
        const exportData = wlFiltered.map(w => ({
            "Workcode": w.code,
            "Name of Work": w.name,
            "Constituency": w.constituency,
            "Department": w.dept,
            "Executing Agency": w.agency,
            "Block": w.block,
            "Location": w.location,
            "AA Cost (Lakhs)": w.cost,
            "Allotted Amount (Lakhs)": w.allotted,
            "Claim (Lakhs)": w.claim,
            "Status": w.status,
            "Date": w.date
        }));

        let ws = XLSX.utils.json_to_sheet(exportData);
        let wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Works");
        XLSX.writeFile(wb, "CDF_Works_List.xlsx");
    }

    function exportDepartmentExcel() {
        const table = document.getElementById("departmentTable");
        if (!table) return;
        let wb = XLSX.utils.table_to_book(table, {sheet: "Departments"});
        XLSX.writeFile(wb, "Department_Status.xlsx");
    }

    /*                                           
       VERIFICATION PAGE
                                               */

    function fetchVerificationWork() {
        const code = document.getElementById('vfWorkcode').value.trim().toUpperCase();
        const notFound = document.getElementById('vfNotFound');
        const banner = document.getElementById('vfFoundBanner');
        const fields = document.getElementById('vfWorkFields');

        notFound.style.display = 'none';
        banner.style.display = 'none';
        fields.style.display = 'none';

        if (!code) return;

        document.getElementById('vfWorkcode').disabled = true;
        const btn = document.querySelector('.vf-lookup-bar .btn-primary');
        const origBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching...';
        btn.disabled = true;

        google.script.run
            .withSuccessHandler(function (data) {
                document.getElementById('vfWorkcode').disabled = false;
                btn.innerHTML = origBtnHtml;
                btn.disabled = false;

                if (!data || !data.code) {
                    notFound.style.display = 'flex';
                    return;
                }

                const parseFin = (val) => {
                    if (val === null || val === undefined || val === '') return 0;
                    const num = parseFloat(String(val).replace(/,/g, ''));
                    return isNaN(num) ? 0 : num;
                };

                // Fill disabled fields
                document.getElementById('vfDateReceipt').value = data.recieptdate || data.date || data['date of receipt'] || '';
                document.getElementById('vfWorkName').value = data.name || '';
                document.getElementById('vfConstituency').value = data.constituency || '';
                document.getElementById('vfDept').value = data.dept || '';
                document.getElementById('vfAgency').value = data.agency || '';
                document.getElementById('vfBlock').value = data.block || '';
                document.getElementById('vfLocation').value = data.location || '';
                document.getElementById('vfAACost').value = '\u20B9 ' + parseFin(data.cost).toFixed(2);
                document.getElementById('vfAllottedCost').value = '\u20B9 ' + parseFin(data.allotted).toFixed(2);
                document.getElementById('vfClaim').value = '\u20B9 ' + parseFin(data.claim).toFixed(2);
                document.getElementById('vfAdminApproval').value = data['position a/a'] || data['position aa'] || '';

                fields.style.display = 'grid';
                banner.style.display = 'flex';
                const safeName = data.name || '';
                document.getElementById('vfFoundMsg').textContent =
                    `Work "${data.code}" loaded - ${safeName.substring(0, 60)}${safeName.length > 60 ? '...' : ''}`;

                // Preload Section 2 verification fields
                const compStat = data['completion status'] || data['whether completed / in-completed'] || '';
                document.getElementById('vfCompletionStatus').value = compStat;

                document.getElementById('vfSignboard').value = data['signboard installed'] || data['sign board installed (yes/no)'] || '';
                document.getElementById('vfQuality').value = data['quality of work'] || '';

                let dv = data['date of visit'] || '';
                if (dv && dv.includes('-') && dv.split('-')[0].length === 2) {
                    const p = dv.split('-');
                    dv = `${p[2]}-${p[1]}-${p[0]}`;
                }
                document.getElementById('vfDateVisit').value = dv;

                document.getElementById('vfRemarks').value = data['verifying officer remarks'] || data['remarks of verifying officer/official'] || '';
                document.getElementById('vfLeftOut').value = data['left out items'] || data['if incomplete specify left out items'] || '';
                toggleLeftOut(); // Show/hide left out items based on completion status

                // Unlock Section 2, Work Document, Section 4 and Actions
                ['vfSection2', 'vfSectionDoc', 'vfSection3', 'vfActionsWrap'].forEach(id => {
                    document.getElementById(id).classList.remove('vf-locked');
                });

                // Show document if available
                const docUrl = data.document || data.Document || data.Doc || data.doc;
                if (docUrl) {
                    document.getElementById('vfWorkDocument').innerHTML = '<a href="' + docUrl + '" target="_blank" style="color:var(--primary);text-decoration:none;"><i class="fa-solid fa-file-pdf"></i> View Document</a>';
                } else {
                    document.getElementById('vfWorkDocument').innerHTML = '<span style="color:var(--text-muted);font-weight:400;">N/A</span>';
                }

                // Preload existing photos dynamically from Drive
                const getThumbUrl = (url) => {
                    if (!url) return '';
                    if (url.startsWith('data:image')) return url;
                    const match = url.match(/[-\w]{25,}/);
                    if (match) return 'https://drive.google.com/thumbnail?id=' + match[0] + '&sz=w800&t=' + Date.now();
                    return url;
                };
                
                const processVerifiedPhotos = (photos) => {
                    if (photos && photos[0]) {
                        document.getElementById("photoImg1").src = getThumbUrl(photos[0]);
                        document.getElementById("photoImg1").dataset.driveUrl = photos[0];
                        document.getElementById("photoPreview1").style.display = "block";
                        document.getElementById("photoPlaceholder1").style.display = "none";
                    } else {
                        removePhoto(1);
                    }

                    if (photos && photos[1]) {
                        document.getElementById("photoImg2").src = getThumbUrl(photos[1]);
                        document.getElementById("photoImg2").dataset.driveUrl = photos[1];
                        document.getElementById("photoPreview2").style.display = "block";
                        document.getElementById("photoPlaceholder2").style.display = "none";
                    } else {
                        removePhoto(2);
                    }
                };

                google.script.run
                    .withSuccessHandler(processVerifiedPhotos)
                    .withFailureHandler(() => processVerifiedPhotos(['', '']))
                    .getWorkPhotos(sessionStorage.getItem("cdf_auth_token"), code, data.worksyear || '');

                // Show Print button if status is In progress
                const vStatus = (data['verification status'] || data.status || '').toLowerCase();
                if (vStatus === 'in progress' || vStatus === 'completed') {
                    document.getElementById('vfPrintBtn').style.display = 'inline-flex';
                } else {
                    document.getElementById('vfPrintBtn').style.display = 'none';
                }
            })
            .withFailureHandler(function (err) {
                document.getElementById('vfWorkcode').disabled = false;
                btn.innerHTML = origBtnHtml;
                btn.disabled = false;
                notFound.style.display = 'flex';
            })
            .getWorkEntry(sessionStorage.getItem("cdf_auth_token"), code);
    }

    function toggleLeftOut() {
        const val = document.getElementById('vfCompletionStatus').value;
        const wrap = document.getElementById('vfLeftOutWrap');
        wrap.style.display = val === 'Incomplete' ? 'flex' : 'none';
    }

    function clearVerificationForm() {
        // Section 1
        document.getElementById('vfWorkcode').value = '';
        document.getElementById('vfNotFound').style.display = 'none';
        document.getElementById('vfFoundBanner').style.display = 'none';
        document.getElementById('vfWorkFields').style.display = 'none';
        ['vfDateReceipt', 'vfWorkName', 'vfConstituency', 'vfDept', 'vfAgency',
            'vfBlock', 'vfLocation', 'vfAACost', 'vfAllottedCost', 'vfClaim']
            .forEach(id => { document.getElementById(id).value = ''; });

        // Section 2
        ['vfAdminApproval', 'vfCompletionStatus', 'vfSignboard', 'vfLeftOut',
            'vfQuality', 'vfDateVisit', 'vfRemarks']
            .forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('vfLeftOutWrap').style.display = 'none';

        // Re-lock sections 2, 3, 4 and actions
        ['vfSection2', 'vfSectionDoc', 'vfSection3', 'vfActionsWrap'].forEach(id => {
            document.getElementById(id).classList.add('vf-locked');
        });
        document.getElementById('vfWorkDocument').innerHTML = '<span style="color:var(--text-muted);font-weight:400;">N/A</span>';

        // Hide Print Button
        document.getElementById('vfPrintBtn').style.display = 'none';

        // Clear images
        removePhoto(1);
        removePhoto(2);
    }

    function submitVerification() {
        // Basic validation
        const workcode = document.getElementById('vfWorkcode').value.trim();
        const fields2 = [
            { id: 'vfCompletionStatus', label: 'Completion Status' },
            { id: 'vfSignboard', label: 'Signboard Installed' },
            { id: 'vfQuality', label: 'Quality of Work' },
            { id: 'vfDateVisit', label: 'Date of Visit' }
        ];

        if (!workcode || document.getElementById('vfWorkFields').style.display === 'none') {
            showCustomAlert('Notice', 'Please fetch a valid work using the Workcode first.');
            document.getElementById('vfWorkcode').focus();
            return;
        }

        for (const f of fields2) {
            if (!document.getElementById(f.id).value.trim()) {
                showCustomAlert('Notice', 'Please fill in: ' + f.label);
                document.getElementById(f.id).focus();
                return;
            }
        }

        if (document.getElementById('vfCompletionStatus').value === 'Incomplete' &&
            !document.getElementById('vfLeftOut').value.trim()) {
            showCustomAlert('Notice', 'Please specify the left out items for incomplete work.');
            document.getElementById('vfLeftOut').focus();
            return;
        }

        const payload = {
            code: workcode,
            worksyear: workcode.split('-').slice(1, -1).join('-'),
            completionStatus: document.getElementById('vfCompletionStatus').value,
            signboard: document.getElementById('vfSignboard').value,
            quality: document.getElementById('vfQuality').value,
            verifyRemarks: document.getElementById('vfRemarks').value,
            leftOut: document.getElementById('vfLeftOut').value,
            verifyingOfficerName: sessionStorage.getItem('cdf_user_name')
        };

        if (payload.completionStatus !== 'Incomplete') {
            payload.leftOut = '';
        }

        const dtVal = document.getElementById('vfDateVisit').value;
        if (dtVal && dtVal.includes('-')) {
            const p = dtVal.split('-');
            payload.dateVisit = `${p[2]}-${p[1]}-${p[0]}`;
        } else {
            payload.dateVisit = dtVal;
        }

        // Always set overall status to "In Progress" as verification is just the first step
        payload.status = 'In Progress';

        const files = {};
        let p1 = document.getElementById("photoImg1").src;
        if (p1 && p1.startsWith("data:image")) {
            files.photo1 = p1;
        } else if (p1 && p1 !== window.location.href) {
            // Unchanged existing image
            files.photo1 = document.getElementById("photoImg1").dataset.driveUrl || p1;
        } else {
            files.photo1 = '';
        }

        let p2 = document.getElementById("photoImg2").src;
        if (p2 && p2.startsWith("data:image")) {
            files.photo2 = p2;
        } else if (p2 && p2 !== window.location.href) {
            files.photo2 = document.getElementById("photoImg2").dataset.driveUrl || p2;
        } else {
            files.photo2 = '';
        }

        const btn = document.getElementById('vfSaveBtn');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        google.script.run
            .withSuccessHandler(function () {
                btn.innerHTML = ogText;
                btn.disabled = false;
                const toast = document.getElementById('successToast');
                document.getElementById('toastMsg').textContent = `Verification for "${workcode}" saved successfully.`;
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 4000);
                
                // Show Print Button after successful save
                document.getElementById('vfPrintBtn').style.display = 'inline-flex';

                // Refresh list if needed
                if (worksData.length > 0) {
                    loadWorksData();
                }
            })
            .withFailureHandler(function (err) {
                btn.innerHTML = ogText;
                btn.disabled = false;
                showCustomAlert('Alert', "Failed to save verification: " + (err.message || err));
            })
            .updateUnifiedRecord(sessionStorage.getItem("cdf_auth_token"), payload, files);
    }

    function generatePDF() {
        const workcode = document.getElementById('vfWorkcode').value.trim();
        if (!workcode) return;

        // Fill template
        document.getElementById('pdfNameOfWork').textContent = document.getElementById('vfWorkName').value;
        document.getElementById('pdfLocation').textContent = document.getElementById('vfLocation').value;
        document.getElementById('pdfApprovedCost').textContent = document.getElementById('vfAACost').value;
        document.getElementById('pdfPositionAA').textContent = document.getElementById('vfAdminApproval').value;
        document.getElementById('pdfAllottedCost').textContent = document.getElementById('vfAllottedCost').value;
        document.getElementById('pdfClaimCost').textContent = document.getElementById('vfClaim').value;
        document.getElementById('pdfCompletionStatus').textContent = document.getElementById('vfCompletionStatus').value;
        
        let leftOut = document.getElementById('vfLeftOut').value;
        document.getElementById('pdfLeftOut').textContent = leftOut ? leftOut : '—';
        
        document.getElementById('pdfSignboard').textContent = document.getElementById('vfSignboard').value;
        document.getElementById('pdfQuality').textContent = document.getElementById('vfQuality').value || '—';
        const remarksVal = document.getElementById('vfRemarks').value;
        const remarksRow = document.getElementById('pdfRemarksRow');
        if (remarksVal && remarksVal.trim() !== '') {
            document.getElementById('pdfRemarksText').textContent = remarksVal.trim();
            remarksRow.style.display = 'table-row';
        } else {
            remarksRow.style.display = 'none';
        }

        // Date of visit formatting
        const dvInput = document.getElementById('vfDateVisit').value; // YYYY-MM-DD
        let formattedDate = '';
        if (dvInput) {
            const parts = dvInput.split('-');
            formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        document.getElementById('pdfDateVisit').textContent = formattedDate;

        // Photos
        const p1 = document.getElementById('photoImg1').src;
        const p1El = document.getElementById('pdfPhoto1');
        const p2 = document.getElementById('photoImg2').src;
        const p2El = document.getElementById('pdfPhoto2');
        const noPhotos = document.getElementById('pdfNoPhotos');

        function getBase64Image(url) {
            return new Promise(resolve => {
                if (!url || url.startsWith('data:image') || url.startsWith('blob:') || url === window.location.href) {
                    resolve(url && url !== window.location.href ? url : null);
                    return;
                }
                google.script.run
                    .withSuccessHandler(b64 => resolve(b64 || url))
                    .withFailureHandler(() => resolve(url))
                    .getDriveImageBase64(url);
            });
        }

        const btn = document.getElementById('vfPrintBtn');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;

        Promise.all([getBase64Image(p1), getBase64Image(p2)]).then(([b64_1, b64_2]) => {
            let hasPhoto = false;

            if (b64_1) {
                p1El.src = b64_1;
                p1El.style.display = 'block';
                hasPhoto = true;
            } else {
                p1El.style.display = 'none';
            }

            if (b64_2) {
                p2El.src = b64_2;
                p2El.style.display = 'block';
                hasPhoto = true;
            } else {
                p2El.style.display = 'none';
            }

            const photoTable = document.getElementById('pdfPhotoTable');
            if (hasPhoto) {
                noPhotos.style.display = 'none';
                if (photoTable) photoTable.style.display = 'table';
            } else {
                noPhotos.style.display = 'table';
                if (photoTable) photoTable.style.display = 'none';
            }

            // Generate PDF
            const element = document.getElementById('pdfTemplate');
            
            // Ensure template wrapper is visible to html2pdf (but off-screen)
            document.getElementById('pdfTemplateWrapper').style.left = '0';
            document.getElementById('pdfTemplateWrapper').style.zIndex = '-9999';

            const opt = {
                margin:       [0.5, 0.3],
                filename:     `${workcode}_Verification_Report.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, allowTaint: true, scrollX: 0, scrollY: 0, x: 0, y: 0, windowWidth: 750 },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opt).from(element).save().then(() => {
                btn.innerHTML = ogText;
                btn.disabled = false;
                document.getElementById('pdfTemplateWrapper').style.left = '-9999px';
            }).catch(err => {
                console.error('PDF generation error', err);
                showCustomAlert('Notice', 'Failed to generate PDF. Check console for details.');
                btn.innerHTML = ogText;
                btn.disabled = false;
                document.getElementById('pdfTemplateWrapper').style.left = '-9999px';
            });
        });
    }

    /*    Photo upload with geo-tag watermark    */

    let geoCoords = null;

    // Try to get location on page load / page switch
    function initGeo() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            pos => { geoCoords = pos.coords; },
            () => { geoCoords = null; },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }

    function triggerPhotoUpload(n, prefix) {
        prefix = prefix || '';
        document.getElementById(`${prefix}photoInput${n}`).click();
    }

    function handlePhotoSelect(event, n, prefix) {
        prefix = prefix || '';
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > 500 * 1024) {
            showCustomAlert('Alert', 'Image size cannot exceed 500 KB.');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                // Force exactly 1920x1440 resolution (4:3)
                const targetWidth = 1920;
                const targetHeight = 1440;
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                const iw = img.naturalWidth || img.width;
                const ih = img.naturalHeight || img.height;
                const imgRatio = iw / ih;
                const targetRatio = targetWidth / targetHeight;
                let sx = 0, sy = 0, sw = iw, sh = ih;

                if (imgRatio > targetRatio) {
                    sw = ih * targetRatio;
                    sx = (iw - sw) / 2;
                } else {
                    sh = iw / targetRatio;
                    sy = (ih - sh) / 2;
                }

                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
                document.getElementById(`${prefix}photoImg${n}`).src = dataUrl;
                document.getElementById(`${prefix}photoPreview${n}`).style.display = 'block';
                document.getElementById(`${prefix}photoPlaceholder${n}`).style.display = 'none';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    function removePhoto(n, prefix) {
        prefix = prefix || '';
        const imgEl = document.getElementById(`${prefix}photoImg${n}`);
        if (imgEl) {
            imgEl.src = '';
            delete imgEl.dataset.driveUrl;
        }
        document.getElementById(`${prefix}photoPreview${n}`).style.display = 'none';
        document.getElementById(`${prefix}photoPlaceholder${n}`).style.display = 'flex';
        const inputEl = document.getElementById(`${prefix}photoInput${n}`);
        if (inputEl) inputEl.value = '';
    }

    /*                                           
       PV REPORTS DATA & LOGIC
                                               */
    let pvReportsData = [];
    let pvrFiltered = [];
    let pvrCurrentPage = 1;

    function loadPVReportsData() {
        const year = document.getElementById('pvrFilterworksyear').value;
        const tb = document.getElementById('pvrTableBody');
        if (tb) tb.innerHTML = `<tr><td colspan="7" class="center" style="padding:20px;">Loading data...</td></tr>`;

        google.script.run
            .withSuccessHandler(function (data) {
                if (!Array.isArray(data)) {
                    pvReportsData = [];
                    pvrFiltered = [];
                } else {
                    // Filter only In Progress and Completed works
                    pvReportsData = data.filter(w => {
                        const s = (w.status || w.completionStatus || '').toLowerCase();
                        return s.includes('progress') || s.includes('completed');
                    });
                    pvrFiltered = [...pvReportsData];
                }
                pvrCurrentPage = 1;
                pvrFilterAndRender();
            })
            .withFailureHandler(function (err) {
                if (tb) tb.innerHTML = `<tr><td colspan="7" class="center" style="color:red;padding:20px;">Failed to load.</td></tr>`;
            })
            .getWorksData(sessionStorage.getItem("cdf_auth_token"), year);
    }

    function pvrFilterAndRender() {
        const q = (document.getElementById('pvrSearch').value || '').toLowerCase();
        const s = document.getElementById('pvrFilterStatus').value;

        pvrFiltered = pvReportsData.filter(w => {
            const matchesSearch = w.code.toLowerCase().includes(q) || w.name.toLowerCase().includes(q);
            const wStatus = w.status || w.completionStatus || '';
            const matchesStatus = s === '' || wStatus === s;
            return matchesSearch && matchesStatus;
        });

        pvrCurrentPage = 1;
        pvrRender();
    }

    function pvrRender() {
        const total = pvrFiltered.length;
        const pages = Math.max(1, Math.ceil(total / WL_PAGE_SIZE));
        const start = (pvrCurrentPage - 1) * WL_PAGE_SIZE;
        const slice = pvrFiltered.slice(start, start + WL_PAGE_SIZE);

        const tbody = document.getElementById('pvrTableBody');
        const empty = document.getElementById('pvrEmpty');
        const showing = document.getElementById('pvrShowing');
        if (!tbody || !empty || !showing) return;

        tbody.innerHTML = '';

        if (slice.length === 0) {
            document.getElementById('pvrTable').style.display = 'none';
            empty.style.display = 'flex';
            showing.innerHTML = 'Showing 0 to 0 of 0 entries';
        } else {
            document.getElementById('pvrTable').style.display = 'table';
            empty.style.display = 'none';

            slice.forEach((w) => {
                const tr = document.createElement('tr');
                
                const vStatus = w.status || w.completionStatus || 'Pending';
                
                const subNo = w.reportSubmissionNo || '<span style="color:var(--text-muted);font-size:12px;">N/A</span>';
                const subDate = w.submissionDate || '<span style="color:var(--text-muted);font-size:12px;">N/A</span>';

                tr.innerHTML = `
                    <td><span class="wl-workcode">${w.code}</span></td>
                    <td><div class="wl-work-name">${w.name}</div>
                        <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
                            <i class="fa-solid fa-location-dot" style="font-size:10px;"></i> ${w.location || '-'} &bull; ${w.block || '-'}
                        </div>
                    </td>
                    <td style="font-size:12px;color:var(--text-secondary);">${w.pvyear || '-'}</td>
                    <td style="text-align:center;">${wlBadge(vStatus)}</td>
                    <td style="font-size:12px;color:var(--text-secondary);">${subNo}</td>
                    <td style="font-size:12px;color:var(--text-secondary);">${subDate}</td>
                    <td class="action-cell">
                        <button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" title="View Signed Document" onclick="viewPVSignedDoc('${w.code}', '${w.worksyear || ''}')"><i class="fa-solid fa-eye"></i></button>
                        ${sessionStorage.getItem('cdf_user_role') !== 'Viewer' ? `<button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;" title="Submit/Edit PV Report" onclick="openPVRModal('${w.code}', '${w.worksyear || ''}')"><i class="fa-solid fa-file-signature"></i></button>` : ''}
                        ${sessionStorage.getItem('cdf_user_role') === 'Admin' ? `<button type="button" class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: red;" title="Delete Submission" onclick="deletePVR('${w.code}', '${w.worksyear || ''}', this)"><i class="fa-solid fa-trash"></i></button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });

            const endRow = Math.min(start + WL_PAGE_SIZE, total);
            showing.innerHTML = `Showing <strong>${start + 1}</strong> to <strong>${endRow}</strong> of <strong>${total}</strong> entries`;
        }

        // Build pagination
        const pg = document.getElementById('pvrPagination');
        pg.innerHTML = '';

        if (pages < 1) return;

        const createBtn = (html, isDisabled, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'pg-btn';
            btn.innerHTML = html;
            btn.disabled = isDisabled;
            if (!isDisabled && onClick) btn.onclick = onClick;
            return btn;
        };

        const createPageBtn = (p) => {
            const btn = document.createElement('button');
            btn.className = 'pg-btn' + (p === pvrCurrentPage ? ' active' : '');
            btn.textContent = p;
            btn.onclick = () => { pvrCurrentPage = p; pvrRender(); };
            return btn;
        };

        const createEllipsis = () => {
            const span = document.createElement('span');
            span.innerHTML = '&hellip;';
            span.style.padding = '4px 8px';
            span.style.color = 'var(--text-muted)';
            span.style.display = 'inline-flex';
            span.style.alignItems = 'flex-end';
            return span;
        };

        pg.appendChild(createBtn('<i class="fa-solid fa-angles-left" style="font-size:11px;"></i>', pvrCurrentPage === 1, () => { pvrCurrentPage = 1; pvrRender(); }));
        pg.appendChild(createBtn('<i class="fa-solid fa-chevron-left" style="font-size:11px;"></i>', pvrCurrentPage === 1, () => { pvrCurrentPage--; pvrRender(); }));

        if (pages <= 7) {
            for (let p = 1; p <= pages; p++) pg.appendChild(createPageBtn(p));
        } else {
            if (pvrCurrentPage <= 4) {
                for (let p = 1; p <= 5; p++) pg.appendChild(createPageBtn(p));
                pg.appendChild(createEllipsis());
                pg.appendChild(createPageBtn(pages));
            } else if (pvrCurrentPage >= pages - 3) {
                pg.appendChild(createPageBtn(1));
                pg.appendChild(createEllipsis());
                for (let p = pages - 4; p <= pages; p++) pg.appendChild(createPageBtn(p));
            } else {
                pg.appendChild(createPageBtn(1));
                pg.appendChild(createEllipsis());
                pg.appendChild(createPageBtn(pvrCurrentPage - 1));
                pg.appendChild(createPageBtn(pvrCurrentPage));
                pg.appendChild(createPageBtn(pvrCurrentPage + 1));
                pg.appendChild(createEllipsis());
                pg.appendChild(createPageBtn(pages));
            }
        }

        pg.appendChild(createBtn('<i class="fa-solid fa-chevron-right" style="font-size:11px;"></i>', pvrCurrentPage === pages, () => { pvrCurrentPage++; pvrRender(); }));
        pg.appendChild(createBtn('<i class="fa-solid fa-angles-right" style="font-size:11px;"></i>', pvrCurrentPage === pages, () => { pvrCurrentPage = pages; pvrRender(); }));
    }

    function openPVRModal(code, year) {
        document.getElementById('pvr_WorkCode').value = code;
        document.getElementById('pvr_WorksYear').value = year;
        
        // Find the work entry to prefill
        const w = pvReportsData.find(x => x.code === code);
        if (w) {
            document.getElementById('pvr_DispWorkCode').value = w.code || '';
            document.getElementById('pvr_DispName').value = w.name || '';
            document.getElementById('pvr_DispLoc').value = (w.location || '-') + ' / ' + (w.block || '-');
            document.getElementById('pvr_DispDept').value = (w.dept || '-') + ' / ' + (w.agency || '-');
            document.getElementById('pvr_DispCost').value = 'AA: ₹ ' + (w.cost || 0) + ' Lakhs, Claim: ₹ ' + (w.claim || 0) + ' Lakhs';

            document.getElementById('pvr_SubmissionNo').value = w.reportSubmissionNo || '';
            let dt = w.submissionDate || '';
            if (dt.includes('-') && dt.split('-')[0].length === 2) {
                dt = dt.split('-').reverse().join('-');
            }
            document.getElementById('pvr_SubmissionDate').value = dt;
        }

        document.getElementById('pvr_Document').value = '';
        
        document.getElementById('pvrModalOverlay').classList.add('open');
        document.getElementById('pvrModal').classList.add('open');

        // Check for existing document
        const docLinkDiv = document.getElementById('pvr_CurrentDocLink');
        docLinkDiv.style.display = 'block';
        docLinkDiv.innerHTML = '<span style="font-size:12px;color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Checking for existing document...</span>';
        
        google.script.run
            .withSuccessHandler(function(url) {
                if (url) {
                    docLinkDiv.innerHTML = `<span style="font-size:12px; padding:6px 10px; background:var(--bg-secondary); border-radius:4px; display:inline-block;"><i class="fa-solid fa-file-pdf" style="color:#e74c3c;"></i> <a href="${url}" target="_blank" style="color:var(--primary); text-decoration:none; font-weight:500; margin-left:4px;">View Current Signed Document</a></span>`;
                } else {
                    docLinkDiv.style.display = 'none';
                }
            })
            .withFailureHandler(function() {
                docLinkDiv.style.display = 'none';
            })
            .getSignedDocUrl(sessionStorage.getItem("cdf_auth_token"), code, year);
    }

    function closePVRModal() {
        document.getElementById('pvrModalOverlay').classList.remove('open');
        document.getElementById('pvrModal').classList.remove('open');
        document.getElementById('pvr_CurrentDocLink').style.display = 'none';
    }

    function submitPVReport() {
        const code = document.getElementById('pvr_WorkCode').value;
        const year = document.getElementById('pvr_WorksYear').value;
        const subNo = document.getElementById('pvr_SubmissionNo').value.trim();
        const subDate = document.getElementById('pvr_SubmissionDate').value;
        const docFile = document.getElementById('pvr_Document').files[0];

        if (!subNo || !subDate || !docFile) {
            showCustomAlert('Notice', 'Please fill in Report Submission No, Date, and select a PDF file.');
            return;
        }

        if (docFile.size > 1 * 1024 * 1024) {
            showCustomAlert('Alert', 'Signed Document size cannot exceed 1 MB.');
            return;
        }

        const btn = document.getElementById('btnSubmitPVR');
        const ogBtn = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
        btn.disabled = true;

        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            const b64 = dataUrl.split(',')[1];
            
            const payload = {
                code: code,
                worksyear: year,
                reportSubmissionNo: subNo,
                submissionDate: subDate
            };
            const fileData = {
                doc: b64,
                docName: docFile.name
            };

            google.script.run
                .withSuccessHandler(function() {
                    showCustomAlert('Notice', 'PV Report Submitted Successfully!');
                    closePVRModal();
                    btn.innerHTML = ogBtn;
                    btn.disabled = false;
                    loadPVReportsData();
                })
                .withFailureHandler(function(err) {
                    showCustomAlert('Alert', 'Error: ' + err);
                    btn.innerHTML = ogBtn;
                    btn.disabled = false;
                })
                .updatePVSubmission(sessionStorage.getItem("cdf_auth_token"), payload, fileData);
        };
        reader.readAsDataURL(docFile);
    }

    function deletePVR(code, year, btn) {
        const w = pvReportsData.find(x => x.code === code);
        const noTextData = (w && (!w.reportSubmissionNo || w.reportSubmissionNo.trim() === '') && (!w.submissionDate || w.submissionDate.trim() === ''));

        if (!noTextData) {
            confirmDeletePVR(code);
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }

        google.script.run
            .withSuccessHandler(function(url) {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                }
                if (url) {
                    confirmDeletePVR(code);
                } else {
                    showCustomAlert('No Submission Details', 'There are no PV report submission details or signed document recorded for ' + code + ' yet.', false, null, 'info');
                }
            })
            .withFailureHandler(function() {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                }
                confirmDeletePVR(code);
            })
            .getSignedDocUrl(sessionStorage.getItem("cdf_auth_token"), code, year);
    }

    function confirmDeletePVR(code) {
        showCustomAlert('Delete PV Report', 'Are you sure you want to delete the submission for ' + code + '?', true, function() {
            google.script.run
                .withSuccessHandler(function() {
                    showCustomAlert('Success', 'PV Submission deleted successfully.', false, null, 'success');
                    loadPVReportsData();
                })
                .withFailureHandler(function(err) {
                    showCustomAlert('Error', 'Error: ' + err, false, null, 'danger');
                })
                .deletePVSubmission(sessionStorage.getItem("cdf_auth_token"), code);
        }, 'danger');
    }

    function viewPVSignedDoc(code, year) {
        // Find the button to show loading
        const btn = event.currentTarget;
        const ogHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        google.script.run
            .withSuccessHandler(function(url) {
                btn.innerHTML = ogHtml;
                btn.disabled = false;
                if (url) {
                    window.open(url, '_blank');
                } else {
                    showCustomAlert('Alert', 'No Signed PDF Document found for ' + code);
                }
            })
            .withFailureHandler(function(err) {
                btn.innerHTML = ogHtml;
                btn.disabled = false;
                showCustomAlert('Alert', 'Error fetching document: ' + err);
            })
            .getSignedDocUrl(sessionStorage.getItem("cdf_auth_token"), code, year);
    }

    /*                                           
       THEME SWITCHER
                                               */

    const THEMES = ['default', 'dark', 'greenish', 'bluish', 'purplish'];
    let currentTheme = localStorage.getItem('cdf-theme') || 'default';

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
    applyTheme(currentTheme);

    /*                                           
       WORK DETAILS MODAL
                                               */
    function openWorkDetails(code) {
        const w = worksData.find(work => work.code === code);
        if (!w) return;

        const setText = (id, text) => {
            document.getElementById(id).innerHTML = text || '<span style="color:var(--text-muted);font-weight:400;">N/A</span>';
        };

        setText('wd_WorkCode', w.code);
        setText('wd_ReceiptDate', w.recieptdate);
        setText('wd_NameOfWork', w.name);
        setText('wd_WorksYear', w.worksyear);
        setText('wd_PVYear', w.pvyear);
        setText('wd_Constituency', w.constituency);
        setText('wd_Block', w.block);
        setText('wd_Location', w.location);
        setText('wd_Department', w.dept);
        setText('wd_Agency', w.agency);
        const formatFin = (val) => {
            if (val === null || val === undefined || val === '') return null;
            const strVal = String(val);
            const num = parseFloat(strVal);
            if (isNaN(num)) return null;
            const decimals = strVal.includes('.') ? strVal.split('.')[1].length : 0;
            return '\u20B9 ' + num.toFixed(Math.max(2, decimals));
        };

        setText('wd_AACost', formatFin(w.cost));
        setText('wd_Allotted', formatFin(w.allotted));
        setText('wd_Claim', formatFin(w.claim));
        setText('wd_Status', w.status);
        setText('wd_DateVisit', w.dateVisit);
        setText('wd_PositionAA', w.positionAA);
        setText('wd_CompletionStatus', w.completionStatus);
        setText('wd_LeftOut', w.leftOut);
        setText('wd_Signboard', w.signboard);
        setText('wd_Quality', w.quality);
        setText('wd_VerifyRemarks', w.verifyRemarks);
        setText('wd_SubmissionDate', w.submissionDate);
        setText('wd_Remarks', w.remarks);

        document.getElementById('wd_Documents').innerHTML = '<span style="color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Checking...</span>';

        google.script.run
            .withSuccessHandler(function (serverObj) {
                if (serverObj && (serverObj.document || serverObj.Document || serverObj.doc)) {
                    const docUrl = serverObj.document || serverObj.Document || serverObj.doc;
                    document.getElementById('wd_Documents').innerHTML = '<a href="' + docUrl + '" target="_blank" style="color:var(--primary);text-decoration:none;"><i class="fa-solid fa-file-pdf"></i> View Document</a>';
                } else {
                    document.getElementById('wd_Documents').innerHTML = '<span style="color:var(--text-muted);font-weight:400;">N/A</span>';
                }
            })
            .withFailureHandler(function () {
                document.getElementById('wd_Documents').innerHTML = '<span style="color:var(--text-muted);font-weight:400;">N/A</span>';
            })
            .getWorkEntry(sessionStorage.getItem("cdf_auth_token"), code);

        const leftOutWrap = document.getElementById('wd_LeftOutWrap');
        if (w.completionStatus === 'Incomplete') {
            leftOutWrap.style.display = 'flex';
        } else {
            leftOutWrap.style.display = 'none';
        }

        const getThumbUrl = (url) => {
            if (!url) return '';
            if (url.startsWith('data:image')) return url;
            const match = url.match(/[-\w]{25,}/);
            if (match) return 'https://drive.google.com/thumbnail?id=' + match[0] + '&sz=w800';
            return url;
        };

        const processWorksPhotos = (photos) => {
            if (photos && photos[0]) {
                document.getElementById("wd_photoImg1").src = getThumbUrl(photos[0]);
                document.getElementById("wd_photoImg1").dataset.driveUrl = photos[0];
                document.getElementById("wd_photoPreview1").style.display = "block";
                document.getElementById("wd_photoPlaceholder1").style.display = "none";
            } else {
                document.getElementById("wd_photoImg1").src = "";
                document.getElementById("wd_photoPreview1").style.display = "none";
                document.getElementById("wd_photoPlaceholder1").style.display = "flex";
            }
            if (photos && photos[1]) {
                document.getElementById("wd_photoImg2").src = getThumbUrl(photos[1]);
                document.getElementById("wd_photoImg2").dataset.driveUrl = photos[1];
                document.getElementById("wd_photoPreview2").style.display = "block";
                document.getElementById("wd_photoPlaceholder2").style.display = "none";
            } else {
                document.getElementById("wd_photoImg2").src = "";
                document.getElementById("wd_photoPreview2").style.display = "none";
                document.getElementById("wd_photoPlaceholder2").style.display = "flex";
            }
        };

        google.script.run
            .withSuccessHandler(processWorksPhotos)
            .withFailureHandler(() => processWorksPhotos(['', '']))
            .getWorkPhotos(sessionStorage.getItem("cdf_auth_token"), w.code, w.worksyear || '');

        document.getElementById('wdModal').classList.add('open');
        document.getElementById('wdModalOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeWorkDetails() {
        document.getElementById('wdModal').classList.remove('open');
        document.getElementById('wdModalOverlay').classList.remove('open');
        document.body.style.overflow = '';
    }

    function openUnifiedEdit(code) {
        if (!isMasterDataLoaded) {
            document.getElementById('ueModal').classList.add('open');
            document.getElementById('ueModalOverlay').classList.add('open');
            document.getElementById('btnUpdateUnified').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
            document.getElementById('btnUpdateUnified').disabled = true;

            google.script.run
                .withSuccessHandler(data => {
                    masterData = data;
                    isMasterDataLoaded = true;
                    _doOpenUnifiedEdit(code);
                })
                .withFailureHandler(err => console.error("Failed to load master data", err))
                .getMasterData(sessionStorage.getItem("cdf_auth_token"));
            return;
        }
        document.getElementById('ueModal').classList.add('open');
        document.getElementById('ueModalOverlay').classList.add('open');
        _doOpenUnifiedEdit(code);
    }

    function _doOpenUnifiedEdit(code) {
        const wdWorksYearSel = document.getElementById('ue_WorksYear');
        const wdPvYearSel = document.getElementById('ue_PVYear');
        const wdConstSel = document.getElementById('ue_Constituency');
        const wdBlockSel = document.getElementById('ue_Block');
        const wdDeptSel = document.getElementById('ue_Department');
        const wdAgencySel = document.getElementById('ue_Agency');
        const wdPosAASel = document.getElementById('ue_PositionAA');

        const worksYears = [...new Set(masterData.map(r => r['Works Financial Year']).filter(Boolean))];
        const pvYears = [...new Set(masterData.map(r => r['PV Financial Year']).filter(Boolean))];
        const constituencies = [...new Set(masterData.map(r => r['Assembly Constituency']).filter(Boolean))];
        const depts = [...new Set(masterData.map(r => r['Name of Department']).filter(Boolean))];
        const blocks = [...new Set(masterData.map(r => r['Name of the Block']).filter(Boolean))];
        const agencies = [...new Set(masterData.map(r => r['Executing Agency']).filter(Boolean))];
        const positionsAA = [...new Set(masterData.map(r => r['Position of A/A'] || r['Position A/A']).filter(Boolean))];

        const fillOptions = (selectEl, options) => {
            selectEl.innerHTML = '<option value="">- Select -</option>';
            options.forEach(opt => selectEl.innerHTML += '<option value="' + opt + '">' + opt + '</option>');
        };

        fillOptions(wdWorksYearSel, worksYears);
        fillOptions(wdPvYearSel, pvYears);
        fillOptions(wdConstSel, constituencies);
        fillOptions(wdBlockSel, blocks);
        fillOptions(wdDeptSel, depts);
        fillOptions(wdAgencySel, agencies);
        fillOptions(wdPosAASel, positionsAA);

        document.getElementById('ue_WorkCode').value = code;

        document.getElementById('btnUpdateUnified').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
        document.getElementById('btnUpdateUnified').disabled = true;

        const role = sessionStorage.getItem('cdf_user_role');
        const isDataAdmin = role === 'Data Administrator' || role === 'Data Entry';
        
        ['ue_Status', 'ue_DateVisit', 'ue_PositionAA', 'ue_CompletionStatus', 'ue_LeftOut', 'ue_Signboard', 'ue_Quality', 'ue_VerifyRemarks', 'ue_SubmissionDate', 'ue_GeoCoords'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = isDataAdmin;
                if (isDataAdmin) {
                    el.style.backgroundColor = 'var(--bg-hover)';
                    el.style.cursor = 'not-allowed';
                } else {
                    el.style.backgroundColor = '';
                    el.style.cursor = '';
                }
            }
        });

        const photosWrap = document.getElementById('ue_PhotosWrap');
        if (photosWrap) {
            photosWrap.style.pointerEvents = isDataAdmin ? 'none' : 'auto';
            photosWrap.style.opacity = isDataAdmin ? '0.6' : '1';
        }

        google.script.run
            .withSuccessHandler(data => {
                document.getElementById('btnUpdateUnified').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Record';
                document.getElementById('btnUpdateUnified').disabled = false;

                const setVal = (id, key) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    const val = data[key];
                    if (val === undefined || val === null) return;
                    if (el.tagName === 'SELECT') {
                        const target = String(val).trim().toLowerCase();
                        const options = Array.from(el.options);
                        const match = options.find(o => o.value.trim().toLowerCase() === target);
                        if (match) el.value = match.value;
                    } else {
                        el.value = val;
                    }
                };

                let dt = data['date'] || data['recieptdate'] || '';
                if (dt.includes('-') && dt.split('-')[0].length === 2) {
                    const p = dt.split('-'); dt = `${p[2]}-${p[1]}-${p[0]}`;
                }
                document.getElementById('ue_ReceiptDate').value = dt;

                let dtV = data['date of visit'] || '';
                if (dtV.includes('-') && dtV.split('-')[0].length === 2) {
                    const p = dtV.split('-'); dtV = `${p[2]}-${p[1]}-${p[0]}`;
                }
                document.getElementById('ue_DateVisit').value = dtV;

                let dtS = data['submission date'] || '';
                if (dtS.includes('-') && dtS.split('-')[0].length === 2) {
                    const p = dtS.split('-'); dtS = `${p[2]}-${p[1]}-${p[0]}`;
                }
                document.getElementById('ue_SubmissionDate').value = dtS;

                setVal('ue_NameOfWork', 'name');
                setVal('ue_WorksYear', 'worksyear');
                setVal('ue_PVYear', 'pvyear');
                setVal('ue_Constituency', 'constituency');
                setVal('ue_Block', 'block');
                setVal('ue_Location', 'location');
                setVal('ue_Department', 'dept');
                setVal('ue_Agency', 'agency');
                setVal('ue_AACost', 'cost');
                setVal('ue_Allotted', 'allotted');
                setVal('ue_Claim', 'claim');

                const stat = data['status'] || '';
                if (stat) document.getElementById('ue_Status').value = stat;

                const pos = data['position a/a'] || data['position of a/a'] || '';
                if (pos) document.getElementById('ue_PositionAA').value = pos;

                const comp = data['completion status'] || '';
                if (comp) {
                    document.getElementById('ue_CompletionStatus').value = comp;
                    document.getElementById('ue_LeftOutWrap').style.display = comp === 'Incomplete' ? 'block' : 'none';
                }

                setVal('ue_LeftOut', 'left out items');
                setVal('ue_Signboard', 'signboard installed');
                setVal('ue_Quality', 'quality of work');
                setVal('ue_VerifyRemarks', 'verifying officer remarks');
                setVal('ue_GeoCoords', 'geo coordinates');
                setVal('ue_Remarks', 'general remarks');

                const getThumbUrl = (url) => {
                    if (!url) return '';
                    if (url.startsWith('data:image')) return url;
                    const match = url.match(/[-\w]{25,}/);
                    if (match) return 'https://drive.google.com/thumbnail?id=' + match[0] + '&sz=w800';
                    return url;
                };

                const processEditPhotos = (photos) => {
                    if (photos && photos[0]) {
                        document.getElementById("ue_photoImg1").src = getThumbUrl(photos[0]);
                        document.getElementById("ue_photoImg1").dataset.driveUrl = photos[0];
                        document.getElementById("ue_photoPreview1").style.display = "block";
                        document.getElementById("ue_photoPlaceholder1").style.display = "none";
                    } else {
                        removePhoto(1, "ue_");
                    }

                    if (photos && photos[1]) {
                        document.getElementById("ue_photoImg2").src = getThumbUrl(photos[1]);
                        document.getElementById("ue_photoImg2").dataset.driveUrl = photos[1];
                        document.getElementById("ue_photoPreview2").style.display = "block";
                        document.getElementById("ue_photoPlaceholder2").style.display = "none";
                    } else {
                        removePhoto(2, "ue_");
                    }
                };

                google.script.run
                    .withSuccessHandler(processEditPhotos)
                    .withFailureHandler(() => processEditPhotos(['', '']))
                    .getWorkPhotos(sessionStorage.getItem("cdf_auth_token"), code, data.worksyear || '');

                const currentDocLink = document.getElementById('ue_CurrentDocLink');
                if (currentDocLink) {
                    const docUrl = data.Document || data.document || data.Doc || data.doc;
                    if (docUrl) {
                        currentDocLink.innerHTML = '<span style="font-size:13px; color:var(--text-muted); margin-bottom:4px; display:block;">Current Document:</span> <a href="' + docUrl + '" target="_blank" style="color:var(--primary);text-decoration:none; display:inline-block; margin-bottom:8px;"><i class="fa-solid fa-file-pdf"></i> View Existing Document</a>';
                        currentDocLink.style.display = 'block';
                    } else {
                        currentDocLink.innerHTML = '';
                        currentDocLink.style.display = 'none';
                    }
                }

                const fileInput = document.getElementById('ue_Document');
                if (fileInput) fileInput.value = '';

            })
            .withFailureHandler(function (err) { showCustomAlert('Alert', "Failed to load record: " + err); })
            .getWorkEntry(sessionStorage.getItem("cdf_auth_token"), code);
        document.body.style.overflow = 'hidden';
    }

    function submitUnifiedEdit() {
        const btn = document.getElementById('btnUpdateUnified');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        function formatDateDMY(dateStr) {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return dateStr;
        }

        const payload = {
            code: document.getElementById('ue_WorkCode').value,
            date: formatDateDMY(document.getElementById('ue_ReceiptDate').value),
            name: document.getElementById('ue_NameOfWork').value,
            worksyear: document.getElementById('ue_WorksYear').value,
            pvyear: document.getElementById('ue_PVYear').value,
            constituency: document.getElementById('ue_Constituency').value,
            block: document.getElementById('ue_Block').value,
            location: document.getElementById('ue_Location').value,
            dept: document.getElementById('ue_Department').value,
            agency: document.getElementById('ue_Agency').value,
            cost: document.getElementById('ue_AACost').value,
            allotted: document.getElementById('ue_Allotted').value,
            claim: document.getElementById('ue_Claim').value,
            status: document.getElementById('ue_Status').value,
            dateVisit: formatDateDMY(document.getElementById('ue_DateVisit').value),
            positionAA: document.getElementById('ue_PositionAA').value,
            completionStatus: document.getElementById('ue_CompletionStatus').value,
            leftOut: document.getElementById('ue_LeftOut').value,
            signboard: document.getElementById('ue_Signboard').value,
            quality: document.getElementById('ue_Quality').value,
            verifyRemarks: document.getElementById('ue_VerifyRemarks').value,
            submissionDate: formatDateDMY(document.getElementById('ue_SubmissionDate').value),
            geoCoords: document.getElementById('ue_GeoCoords').value,
            remarks: document.getElementById('ue_Remarks').value
        };

        if (payload.completionStatus !== 'Incomplete') {
            payload.leftOut = '';
        }

        const fileInput = document.getElementById('ue_Document');
        let fileDataObj = { doc: null, docName: null, photos: [] };
        let pendingFiles = 0;

        let p1 = document.getElementById('ue_photoImg1').src;
        if (p1 && p1.startsWith("data:image")) {
            fileDataObj.photo1 = p1;
        } else if (p1 && p1 !== window.location.href) {
            fileDataObj.photo1 = document.getElementById("ue_photoImg1").dataset.driveUrl || p1;
        } else {
            fileDataObj.photo1 = '';
        }

        let p2 = document.getElementById('ue_photoImg2').src;
        if (p2 && p2.startsWith("data:image")) {
            fileDataObj.photo2 = p2;
        } else if (p2 && p2 !== window.location.href) {
            fileDataObj.photo2 = document.getElementById("ue_photoImg2").dataset.driveUrl || p2;
        } else {
            fileDataObj.photo2 = '';
        }

        const submitToBackend = () => {
            google.script.run
                .withSuccessHandler(() => {
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    closeUnifiedEdit();
                    showCustomAlert('Notice', "Record updated successfully!");
                    loadWorksData();
                })
                .withFailureHandler(err => {
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    showCustomAlert('Alert', "Failed to update record: " + err);
                })
                .updateUnifiedRecord(sessionStorage.getItem("cdf_auth_token"), payload, fileDataObj);
        };

        const checkDone = () => { if (pendingFiles === 0) submitToBackend(); };

        if (fileInput && fileInput.files.length > 0) {
            if (fileInput.files[0].size > 2 * 1024 * 1024) {
                showCustomAlert('Alert', 'Document size cannot exceed 2 MB.');
                btn.innerHTML = ogText;
                btn.disabled = false;
                return;
            }
            pendingFiles++;
            const reader = new FileReader();
            reader.onload = e => {
                fileDataObj.doc = e.target.result.split(',')[1];
                fileDataObj.docName = fileInput.files[0].name;
                pendingFiles--;
                checkDone();
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            checkDone();
        }
    }

    function closeUnifiedEdit() {
        document.getElementById('ueModal').classList.remove('open');
        document.getElementById('ueModalOverlay').classList.remove('open');
        document.body.style.overflow = '';
        currentEditWorkcode = null;
    }

    /* --- Geo-Tagged Custom Camera Logic --- */
    let geoLocText = null;




    let usersListCache = [];

    function fetchUsers() {
        const token = sessionStorage.getItem('cdf_auth_token');
        if (!token) return;
        
        document.getElementById('usersTableBody').innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 32px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading users...</td></tr>';
        
        google.script.run
            .withSuccessHandler(function(users) {
                usersListCache = users;
                renderUsersTable();
            })
            .withFailureHandler(function(err) {
                showCustomAlert('Error', 'Failed to load users: ' + err.message, false, null, 'error');
            })
            .adminGetUsers(token);
    }

    function renderUsersTable() {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = '';
        
        if (usersListCache.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 32px;">No users found.</td></tr>';
            return;
        }
        
        usersListCache.forEach(u => {
            const roleClass = u.role.replace(/\s+/g, ''); // "Data Entry" -> "DataEntry"
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${u.id}</td>
                <td>${u.name}</td>
                <td><span class="um-role-badge um-role-${roleClass}">${u.role}</span></td>
                <td><span class="um-status-${u.status}">${u.status}</span></td>
                <td>
                    <div class="um-actions">
                        <button class="um-btn-icon" title="Edit User" onclick="editUser('${u.id}')"><i class="fa-solid fa-pen"></i></button>
                        <button class="um-btn-icon danger" title="Delete User" onclick="deleteUser('${u.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function openUserModal() {
        document.getElementById('umForm').reset();
        document.getElementById('umMode').value = 'add';
        document.getElementById('umUserId').disabled = false;
        document.getElementById('umModalTitle').innerText = 'Add New User';
        document.getElementById('umSubmitBtn').innerHTML = '<i class="fa-solid fa-user-plus"></i> Create User';
        
        document.getElementById('umModalOverlay').classList.add('open');
        document.getElementById('umModal').classList.add('open');
    }

    function closeUserModal() {
        document.getElementById('umModalOverlay').classList.remove('open');
        document.getElementById('umModal').classList.remove('open');
    }

    function editUser(id) {
        const user = usersListCache.find(u => u.id === id);
        if (!user) return;
        
        document.getElementById('umMode').value = 'edit';
        document.getElementById('umUserId').value = user.id;
        document.getElementById('umUserId').disabled = true; // Cannot change ID
        document.getElementById('umPassword').value = user.password;
        document.getElementById('umName').value = user.name;
        document.getElementById('umRole').value = user.role;
        document.getElementById('umStatus').value = user.status;
        
        document.getElementById('umModalTitle').innerText = 'Edit User';
        document.getElementById('umSubmitBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update User';
        
        document.getElementById('umModalOverlay').classList.add('open');
        document.getElementById('umModal').classList.add('open');
    }

    function saveUser() {
        const mode = document.getElementById('umMode').value;
        const userData = {
            id: document.getElementById('umUserId').value.trim(),
            password: document.getElementById('umPassword').value.trim(),
            name: document.getElementById('umName').value.trim(),
            role: document.getElementById('umRole').value,
            status: document.getElementById('umStatus').value
        };
        
        const token = sessionStorage.getItem('cdf_auth_token');
        const btn = document.getElementById('umSubmitBtn');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
        
        if (mode === 'add') {
            google.script.run
                .withSuccessHandler(function() {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    closeUserModal();
                    showCustomAlert('Success', 'User created successfully.', false, null, 'success');
                    fetchUsers();
                })
                .withFailureHandler(function(err) {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    showCustomAlert('Error', err.message, false, null, 'error');
                })
                .adminCreateUser(token, userData);
        } else {
            google.script.run
                .withSuccessHandler(function() {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    closeUserModal();
                    showCustomAlert('Success', 'User updated successfully.', false, null, 'success');
                    fetchUsers();
                })
                .withFailureHandler(function(err) {
                    btn.innerHTML = oldText;
                    btn.disabled = false;
                    showCustomAlert('Error', err.message, false, null, 'error');
                })
                .adminUpdateUser(token, userData);
        }
    }

    function deleteUser(id) {
        if (id === 'admin' || id === sessionStorage.getItem('cdf_user_name')) {
            showCustomAlert('Warning', 'You cannot delete the primary admin or your own account.', false, null, 'warning');
            return;
        }
        
        showCustomAlert('Confirm Deletion', 'Are you sure you want to permanently delete user "' + id + '"?', true, function() {
            const token = sessionStorage.getItem('cdf_auth_token');
            google.script.run
                .withSuccessHandler(function() {
                    showCustomAlert('Success', 'User deleted.', false, null, 'success');
                    fetchUsers();
                })
                .withFailureHandler(function(err) {
                    showCustomAlert('Error', err.message, false, null, 'error');
                })
                .adminDeleteUser(token, id);
        }, 'danger');
    }


function loadUserProfile() {
    const name = sessionStorage.getItem('cdf_user_name') || 'User';
    const role = sessionStorage.getItem('cdf_user_role') || 'Role';
    
    document.getElementById('profileAvatar').innerText = name.charAt(0).toUpperCase();
    document.getElementById('profileDisplayName').innerText = name;
    document.getElementById('profileDisplayRole').innerText = role;
    document.getElementById('profileNameInput').value = name;
    document.getElementById('profilePasswordInput').value = '';
    
    const token = sessionStorage.getItem('cdf_auth_token');
    google.script.run
        .withSuccessHandler(user => {
            if (user && user.id) {
                document.getElementById('profileUserId').innerText = user.id;
            }
        })
        .verifyToken(token);
}

function submitProfileUpdate() {
    const name = document.getElementById('profileNameInput').value.trim();
    const password = document.getElementById('profilePasswordInput').value.trim();
    
    if (!name || !password) {
        showCustomAlert('Error', 'Name and Password are required.', false, null, 'danger');
        return;
    }
    
    const token = sessionStorage.getItem('cdf_auth_token');
    const btn = document.getElementById('profileSubmitBtn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class=\"fa-solid fa-spinner fa-spin\"></i> Updating...';
    
    google.script.run
        .withSuccessHandler(response => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            
            if (response.success) {
                sessionStorage.setItem('cdf_user_name', response.user.name);
                showCustomAlert('Success', 'Profile updated successfully!', false, null, 'success');
                loadUserProfile();
                
                document.getElementById('globalUserAvatar').innerText = response.user.name.charAt(0).toUpperCase();
                document.querySelector('.user-name').innerText = response.user.name;
            } else {
                showCustomAlert('Error', response.message || 'Failed to update profile.', false, null, 'danger');
            }
        })
        .withFailureHandler(error => {
            btn.disabled = false;
            btn.innerHTML = originalText;
            showCustomAlert('Error', 'Server error. Please try again.', false, null, 'danger');
        })
        .updateMyProfile(token, { name: name, password: password });
}

/* =========================================
   IMAGE COMPRESSOR UTILITY
   ========================================= */
let icOriginalFile = null;
let icOriginalDataUrl = null;
let icCompressedBlob = null;
let icOriginalImageObj = null;

function initImageCompressor() {
    document.getElementById('icQuality').addEventListener('input', function() {
        document.getElementById('icQualityVal').textContent = this.value + '%';
    });
    document.getElementById('icScale').addEventListener('input', function() {
        document.getElementById('icScaleVal').textContent = this.value + '%';
    });

    const icUploadZone = document.getElementById('icUploadZone');
    icUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        icUploadZone.style.background = 'rgba(99, 102, 241, 0.2)';
    });
    icUploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        icUploadZone.style.background = 'rgba(99, 102, 241, 0.05)';
    });
    icUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        icUploadZone.style.background = 'rgba(99, 102, 241, 0.05)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            icProcessSelectedFile(e.dataTransfer.files[0]);
        }
    });
}

function icHandleFileSelect(event) {
    if (event.target.files && event.target.files.length > 0) {
        icProcessSelectedFile(event.target.files[0]);
    }
}

function icProcessSelectedFile(file) {
    if (!file.type.startsWith('image/')) {
        showCustomAlert('Error', 'Please select a valid image file (JPG, PNG, WEBP).');
        return;
    }
    icOriginalFile = file;
    
    document.getElementById('icUploadZone').style.display = 'none';
    document.getElementById('icPreviewZone').style.display = 'block';

    const reader = new FileReader();
    reader.onload = function(e) {
        icOriginalDataUrl = e.target.result;
        document.getElementById('icOriginalImg').src = icOriginalDataUrl;
        
        icOriginalImageObj = new Image();
        icOriginalImageObj.onload = function() {
            document.getElementById('icOriginalStats').innerHTML = 
                `<strong>${(icOriginalFile.size / 1024).toFixed(1)} KB</strong> <br> ${this.width} &times; ${this.height} px`;
            
            // Auto compress on load based on default target size
            icApplyCompression();
        };
        icOriginalImageObj.src = icOriginalDataUrl;
    };
    reader.readAsDataURL(file);
}

function icReset() {
    icOriginalFile = null;
    icOriginalDataUrl = null;
    icCompressedBlob = null;
    icOriginalImageObj = null;
    document.getElementById('icFileInput').value = '';
    document.getElementById('icUploadZone').style.display = 'flex';
    document.getElementById('icPreviewZone').style.display = 'none';
    document.getElementById('icOriginalImg').src = '';
    document.getElementById('icCompressedImg').src = '';
    document.getElementById('icTargetSize').value = '500';
}

function icApplyCompression() {
    if (!icOriginalImageObj) return;

    const targetSizeKB = parseFloat(document.getElementById('icTargetSize').value);
    
    if (!isNaN(targetSizeKB) && targetSizeKB > 0) {
        icAutoCompress(targetSizeKB);
    } else {
        const quality = parseInt(document.getElementById('icQuality').value) / 100;
        const scale = parseInt(document.getElementById('icScale').value) / 100;
        icCompressWithSettings(quality, scale);
    }
}

function icAutoCompress(targetKB) {
    const targetBytes = targetKB * 1024;
    
    const tryCompress = (q, s) => {
        return new Promise(resolve => {
            const canvas = document.createElement('canvas');
            canvas.width = icOriginalImageObj.width * s;
            canvas.height = icOriginalImageObj.height * s;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(icOriginalImageObj, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/jpeg', q);
        });
    };

    const btn = document.getElementById('icDownloadBtn');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compressing...';
    btn.disabled = true;

    setTimeout(async () => {
        let q = 0.95;
        let s = 1.0;
        let finalBlob = null;
        
        for (let step = 0; step < 12; step++) {
            const b = await tryCompress(q, s);
            if (b.size <= targetBytes || step === 11) {
                finalBlob = b;
                break;
            }
            if (q > 0.6) {
                q -= 0.15;
            } else if (s > 0.4) {
                s -= 0.15;
            } else {
                q -= 0.15;
            }
        }
        
        document.getElementById('icQuality').value = Math.max(1, Math.round(q * 100));
        document.getElementById('icQualityVal').textContent = Math.max(1, Math.round(q * 100)) + '%';
        document.getElementById('icScale').value = Math.max(10, Math.round(s * 100));
        document.getElementById('icScaleVal').textContent = Math.max(10, Math.round(s * 100)) + '%';
        
        icSetCompressedPreview(finalBlob);
        
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }, 50);
}

function icCompressWithSettings(quality, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = icOriginalImageObj.width * scale;
    canvas.height = icOriginalImageObj.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(icOriginalImageObj, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(blob => {
        icSetCompressedPreview(blob);
    }, 'image/jpeg', quality);
}

function icSetCompressedPreview(blob) {
    icCompressedBlob = blob;
    const url = URL.createObjectURL(blob);
    
    const imgEl = document.getElementById('icCompressedImg');
    imgEl.onload = function() {
        const reduction = ((icOriginalFile.size - blob.size) / icOriginalFile.size * 100).toFixed(1);
        let color = reduction > 0 ? 'var(--success)' : 'var(--danger)';
        let sign = reduction > 0 ? '-' : '+';
        
        document.getElementById('icCompressedStats').innerHTML = 
            `<strong>${(blob.size / 1024).toFixed(1)} KB</strong> <br><span style="color:${color}; font-size:12px;">(${sign}${Math.abs(reduction)}% vs Original)</span><br> 
            ${this.naturalWidth} &times; ${this.naturalHeight} px`;
    };
    imgEl.src = url;
}

function icDownload() {
    if (!icCompressedBlob) return;
    const extension = icOriginalFile.name.split('.').pop();
    const basename = icOriginalFile.name.replace('.' + extension, '');
    const newName = `${basename}_compressed.jpg`;
    
    const url = URL.createObjectURL(icCompressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

/* =========================================
   PDF COMPRESSOR UTILITY
   ========================================= */
let pcOriginalFile = null;
let pcOriginalDataUrl = null;
let pcCompressedBlob = null;
let pcPdfDocument = null;

function initPdfCompressor() {
    document.getElementById('pcQuality').addEventListener('input', function() {
        document.getElementById('pcQualityVal').textContent = this.value + '%';
    });

    const pcUploadZone = document.getElementById('pcUploadZone');
    pcUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        pcUploadZone.style.background = 'rgba(99, 102, 241, 0.2)';
    });
    pcUploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        pcUploadZone.style.background = 'rgba(99, 102, 241, 0.05)';
    });
    pcUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        pcUploadZone.style.background = 'rgba(99, 102, 241, 0.05)';
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            pcProcessSelectedFile(e.dataTransfer.files[0]);
        }
    });
}

function pcHandleFileSelect(event) {
    if (event.target.files && event.target.files.length > 0) {
        pcProcessSelectedFile(event.target.files[0]);
    }
}

function pcProcessSelectedFile(file) {
    if (file.type !== 'application/pdf') {
        showCustomAlert('Error', 'Please select a valid PDF file.');
        return;
    }
    pcOriginalFile = file;
    
    document.getElementById('pcUploadZone').style.display = 'none';
    document.getElementById('pcPreviewZone').style.display = 'block';
    
    document.getElementById('pcOriginalStats').innerHTML = 
        `<div><strong>File Name:</strong> ${file.name}</div>
         <div><strong>Original Size:</strong> ${(file.size / 1024).toFixed(1)} KB</div>`;
         
    document.getElementById('pcCompressedStats').innerHTML = 'Waiting for compression...';
    document.getElementById('pcProgressContainer').style.display = 'none';
    document.getElementById('pcActionButtons').style.display = 'none';

    // Parse the PDF using PDF.js
    const reader = new FileReader();
    reader.onload = async function(e) {
        const typedarray = new Uint8Array(e.target.result);
        try {
            pcPdfDocument = await pdfjsLib.getDocument(typedarray).promise;
            document.getElementById('pcOriginalStats').innerHTML += `<div><strong>Pages:</strong> ${pcPdfDocument.numPages}</div>`;
            
            // Trigger auto compress immediately
            pcApplyCompression();
        } catch (error) {
            showCustomAlert('Error', 'Failed to read PDF file. It might be corrupted or password protected.');
        }
    };
    reader.readAsArrayBuffer(file);
}

function pcReset() {
    pcOriginalFile = null;
    pcOriginalDataUrl = null;
    pcCompressedBlob = null;
    pcPdfDocument = null;
    document.getElementById('pcFileInput').value = '';
    document.getElementById('pcUploadZone').style.display = 'flex';
    document.getElementById('pcPreviewZone').style.display = 'none';
    document.getElementById('pcProgressContainer').style.display = 'none';
    document.getElementById('pcActionButtons').style.display = 'none';
}

async function pcApplyCompression() {
    if (!pcPdfDocument) return;

    const targetSizeKB = parseFloat(document.getElementById('pcTargetSize').value);
    
    document.getElementById('pcApplyBtn').disabled = true;
    document.getElementById('pcResetBtn').disabled = true;
    document.getElementById('pcProgressContainer').style.display = 'block';
    document.getElementById('pcActionButtons').style.display = 'none';
    
    if (!isNaN(targetSizeKB) && targetSizeKB > 0) {
        await pcAutoCompress(targetSizeKB);
    } else {
        const quality = parseInt(document.getElementById('pcQuality').value) / 100;
        const scale = parseFloat(document.getElementById('pcRenderDpi').value);
        await pcCompressWithSettings(quality, scale);
    }
    
    document.getElementById('pcApplyBtn').disabled = false;
    document.getElementById('pcResetBtn').disabled = false;
    document.getElementById('pcProgressContainer').style.display = 'none';
}

async function pcCompressWithSettings(quality, scale) {
    const { jsPDF } = window.jspdf;
    let doc = null;
    
    for (let i = 1; i <= pcPdfDocument.numPages; i++) {
        // Update Progress
        document.getElementById('pcProgressLabel').textContent = `Rasterizing Page ${i} of ${pcPdfDocument.numPages}...`;
        document.getElementById('pcProgressBar').style.width = `${(i / pcPdfDocument.numPages) * 100}%`;
        
        const page = await pcPdfDocument.getPage(i);
        const viewport = page.getViewport({ scale: scale });
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        
        // Convert canvas to JPEG data URL
        const imgData = canvas.toDataURL('image/jpeg', quality);
        
        // Setup jsPDF document
        if (i === 1) {
            // Check orientation (portrait or landscape)
            const orientation = viewport.width > viewport.height ? 'l' : 'p';
            doc = new jsPDF({
                orientation: orientation,
                unit: 'px',
                format: [viewport.width, viewport.height]
            });
        } else {
            const orientation = viewport.width > viewport.height ? 'l' : 'p';
            doc.addPage([viewport.width, viewport.height], orientation);
        }
        
        doc.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
    }
    
    document.getElementById('pcProgressLabel').textContent = `Building Final PDF...`;
    
    const pdfBlob = doc.output('blob');
    pcSetCompressedPreview(pdfBlob);
}

async function pcAutoCompress(targetKB) {
    const targetBytes = targetKB * 1024;
    
    // Base heuristic: 
    let scale = 1.5;
    let quality = 0.8;
    
    // Rough estimate: an A4 page rasterized at 1.5 scale and 0.8 quality is ~300KB
    const estimatedSize = pcPdfDocument.numPages * 300 * 1024;
    if (targetBytes < estimatedSize) {
        // We need to drop quality/scale drastically
        scale = 1.0;
        quality = 0.6;
    }
    
    document.getElementById('pcRenderDpi').value = scale.toFixed(1);
    document.getElementById('pcQuality').value = Math.round(quality * 100);
    document.getElementById('pcQualityVal').textContent = Math.round(quality * 100) + '%';
    
    await pcCompressWithSettings(quality, scale);
}

function pcSetCompressedPreview(blob) {
    pcCompressedBlob = blob;
    
    const reduction = ((pcOriginalFile.size - blob.size) / pcOriginalFile.size * 100).toFixed(1);
    let color = reduction > 0 ? 'var(--success)' : 'var(--danger)';
    let sign = reduction > 0 ? '-' : '+';
    
    document.getElementById('pcCompressedStats').innerHTML = 
        `<div><strong>Compressed Size:</strong> ${(blob.size / 1024).toFixed(1)} KB</div>
         <div><span style="color:${color}; font-size:14px;">(${sign}${Math.abs(reduction)}% vs Original)</span></div>`;
         
    document.getElementById('pcActionButtons').style.display = 'flex';
}

function pcDownload() {
    if (!pcCompressedBlob) return;
    const extension = pcOriginalFile.name.split('.').pop();
    const basename = pcOriginalFile.name.replace('.' + extension, '');
    const newName = `${basename}_compressed.pdf`;
    
    const url = URL.createObjectURL(pcCompressedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = newName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

