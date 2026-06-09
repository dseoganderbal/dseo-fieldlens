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
                if (!document.getElementById('wlTableBody')) return;
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
                if (!document.getElementById('wlTableBody')) return;
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
            if (match) return 'https://lh3.googleusercontent.com/d/' + match[0];
            return url;
        };

        const showLoader = (imgId) => {
            let imgEl = document.getElementById(imgId);
            if (!imgEl) return;
            let parent = imgEl.parentElement;
            let loader = parent.querySelector('.photo-loader-overlay');
            if (!loader) {
                loader = document.createElement('div');
                loader.className = 'photo-loader-overlay';
                loader.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                loader.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.7);display:flex;justify-content:center;align-items:center;font-size:24px;color:var(--primary);z-index:5;border-radius:12px;';
                parent.appendChild(loader);
            }
            loader.style.display = 'flex';
        };

        const hideLoader = (imgId) => {
            let imgEl = document.getElementById(imgId);
            if (imgEl && imgEl.parentElement.querySelector('.photo-loader-overlay')) {
                imgEl.parentElement.querySelector('.photo-loader-overlay').style.display = 'none';
            }
        };

        const processWorksPhotos = (photos) => {
            if (photos && photos[0]) {
                document.getElementById("wd_photoImg1").dataset.driveUrl = photos[0];
                document.getElementById("wd_photoPreview1").style.display = "block";
                document.getElementById("wd_photoPlaceholder1").style.display = "none";
                showLoader("wd_photoImg1");
                let img1 = document.getElementById("wd_photoImg1");
                img1.onload = () => hideLoader("wd_photoImg1");
                img1.onerror = () => hideLoader("wd_photoImg1");
                img1.src = getThumbUrl(photos[0]);
            } else {
                document.getElementById("wd_photoImg1").src = "";
                document.getElementById("wd_photoPreview1").style.display = "none";
                document.getElementById("wd_photoPlaceholder1").style.display = "flex";
            }
            if (photos && photos[1]) {
                document.getElementById("wd_photoImg2").dataset.driveUrl = photos[1];
                document.getElementById("wd_photoPreview2").style.display = "block";
                document.getElementById("wd_photoPlaceholder2").style.display = "none";
                showLoader("wd_photoImg2");
                let img2 = document.getElementById("wd_photoImg2");
                img2.onload = () => hideLoader("wd_photoImg2");
                img2.onerror = () => hideLoader("wd_photoImg2");
                img2.src = getThumbUrl(photos[1]);
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
