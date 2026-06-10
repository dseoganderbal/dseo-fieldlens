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
                if (!document.getElementById('totalWorks')) return;
                if (!Array.isArray(data)) { data = []; }
                dashboardWorks = data.filter(w => pvYear === 'All' || !pvYear || w.pvyear === pvYear);
                renderDashboardAggregates(dashboardWorks);
            })
            .withFailureHandler(function (error) {
                if (!document.getElementById('totalWorks')) return;
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
    
    function displaySum(val) {
        if (!val) return '0.00';
        return parseFloat(val).toFixed(2);
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
            
            const parseVal = v => parseFloat(String(v || 0).replace(/,/g, '')) || 0;
            const wCost = parseVal(w.cost);
            const wAlloc = parseVal(w.allotted);
            const wClaim = parseVal(w.claim);
            
            totalClaim += wClaim;

            // Constituency
            let c = w.constituency;
            if (c === 'Ganderbal' || c === 'Kangan') {
                constStats[c].recv++;
                constStats[c].aa += wCost;
                constStats[c].alloc += wAlloc;
                constStats[c].claim += wClaim;
                if (isVerified) {
                    constStats[c].ver++;
                    constStats[c].ver_aa += wCost;
                    constStats[c].ver_alloc += wAlloc;
                    constStats[c].ver_claim += wClaim;
                } else {
                    constStats[c].pend_aa += wCost;
                    constStats[c].pend_alloc += wAlloc;
                    constStats[c].pend_claim += wClaim;
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
        document.getElementById('claimAmount').textContent = displaySum(totalClaim);

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
            cHtml += `<tr><td>${sno++}</td><td class="text-left">${c}</td><td>${st.recv}</td><td>${displaySum(st.aa)}</td><td>${st.ver}</td><td>${st.ver}</td></tr>`;
            cTotalRecv += st.recv; cTotalAA += st.aa; cTotalVer += st.ver;
        });
        cHtml += `<tr class="total-row"><td></td><td class="text-left">Total</td><td>${cTotalRecv}</td><td>${displaySum(cTotalAA)}</td><td>${cTotalVer}</td><td>${cTotalVer}</td></tr>`;
        document.getElementById('constituencyTableBody').innerHTML = cHtml;

        // Financial Table
        let fHtml = '';
        fHtml += `<tr class="sub-header-row"><th colspan="6">  Works Verified</th></tr>`;
        let fVerAA = 0, fVerAlloc = 0, fVerClaim = 0, fVerCount = 0;
        ['Ganderbal', 'Kangan'].forEach((c, idx) => {
            let st = constStats[c];
            fHtml += `<tr><td>${idx + 1}</td><td class="text-left">${c}</td><td>${st.ver}</td><td>${displaySum(st.ver_aa)}</td><td>${displaySum(st.ver_alloc)}</td><td>${displaySum(st.ver_claim)}</td></tr>`;
            fVerCount += st.ver; fVerAA += st.ver_aa; fVerAlloc += st.ver_alloc; fVerClaim += st.ver_claim;
        });
        fHtml += `<tr class="subtotal-row"><td></td><td class="text-left">Sub Total</td><td>${fVerCount}</td><td>${displaySum(fVerAA)}</td><td>${displaySum(fVerAlloc)}</td><td>${displaySum(fVerClaim)}</td></tr>`;

        fHtml += `<tr class="sub-header-row"><th colspan="6">  Verification Under Progress</th></tr>`;
        let fPendAA = 0, fPendAlloc = 0, fPendClaim = 0, fPendCount = 0;
        ['Ganderbal', 'Kangan'].forEach((c, idx) => {
            let st = constStats[c];
            let pendCount = st.recv - st.ver;
            fHtml += `<tr><td>${idx + 1}</td><td class="text-left">${c}</td><td>${pendCount}</td><td>${displaySum(st.pend_aa)}</td><td>${displaySum(st.pend_alloc)}</td><td>${displaySum(st.pend_claim)}</td></tr>`;
            fPendCount += pendCount; fPendAA += st.pend_aa; fPendAlloc += st.pend_alloc; fPendClaim += st.pend_claim;
        });
        fHtml += `<tr class="subtotal-row"><td></td><td class="text-left">Sub Total</td><td>${fPendCount}</td><td>${displaySum(fPendAA)}</td><td>${displaySum(fPendAlloc)}</td><td>${displaySum(fPendClaim)}</td></tr>`;
        fHtml += `<tr class="total-row"><td></td><td class="text-left">Grand Total</td><td>${fVerCount + fPendCount}</td><td>${displaySum(fVerAA + fPendAA)}</td><td>${displaySum(fVerAlloc + fPendAlloc)}</td><td>${displaySum(fVerClaim + fPendClaim)}</td></tr>`;
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
    function searchDepartmentTable() {
        const filter = document.getElementById('searchTable').value.toLowerCase();
        const rows = document.querySelectorAll('#departmentTable tbody tr');
        rows.forEach(row => {
            const cell = row.querySelector('td:nth-child(2)');
            row.style.display = cell && cell.textContent.toLowerCase().includes(filter) ? '' : 'none';
        });
    }
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
