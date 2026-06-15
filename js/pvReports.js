let pvrFinalDocBlob = null;

    function loadPVReportsData() {
        if (typeof window.checkForUpdatesAndRefresh === 'function') {
            window.checkForUpdatesAndRefresh(() => loadPVReportsData());
        }

        const year = document.getElementById('pvrFilterworksyear').value;
        const tb = document.getElementById('pvrTableBody');
        if (tb) tb.innerHTML = `<tr><td colspan="7" class="center" style="padding:20px;">Loading data...</td></tr>`;

        google.script.run
            .withSuccessHandler(function (data) {
                if (!document.getElementById('pvrTableBody')) return;
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
                if (!document.getElementById('pvrTableBody')) return;
                const tb = document.getElementById('pvrTableBody');
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
    function populatePVRDropdown(selectedValue) {
        const sel = document.getElementById('pvr_SubmittedTo');
        sel.innerHTML = '<option value="">Select Option</option>';
        if (typeof masterData !== 'undefined' && masterData.length > 0) {
            const options = [...new Set(masterData.map(r => r['Report Submitted To']).filter(Boolean))];
            options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt;
                sel.appendChild(o);
            });
            if (selectedValue) {
                sel.value = selectedValue;
            }
        }
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
            document.getElementById('pvr_DispAACost').value = '₹ ' + (w.cost || 0);
            document.getElementById('pvr_DispClaim').value = '₹ ' + (w.claim || 0);

            document.getElementById('pvr_SubmissionNo').value = w.reportSubmissionNo || '';
            let dt = w.submissionDate || '';
            if (dt.includes('-') && dt.split('-')[0].length === 2) {
                dt = dt.split('-').reverse().join('-');
            }
            document.getElementById('pvr_SubmissionDate').value = dt;
        }

        let existingSubmittedTo = w ? (w.reportSubmittedTo || '') : '';

        if (typeof isMasterDataLoaded !== 'undefined' && !isMasterDataLoaded) {
            document.getElementById('pvr_SubmittedTo').innerHTML = '<option value="">Loading options...</option>';
            google.script.run
                .withSuccessHandler(function(data) {
                    masterData = data;
                    isMasterDataLoaded = true;
                    populatePVRDropdown(existingSubmittedTo);
                })
                .getMasterData(sessionStorage.getItem("cdf_auth_token"));
        } else {
            populatePVRDropdown(existingSubmittedTo);
        }

        document.getElementById('pvr_Document').value = '';
        pvrFinalDocBlob = null;
        document.getElementById('pvrPreviewSide').style.display = 'none';
        document.getElementById('pvrModal').classList.remove('pvr-wide');
        
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
        const submittedTo = document.getElementById('pvr_SubmittedTo').value;
        const docFile = document.getElementById('pvr_Document').files[0];

        if (!subNo || !subDate || !submittedTo || (!pvrFinalDocBlob && !document.getElementById('pvr_Document').files[0])) {
            showCustomAlert('Notice', 'Please fill in Report Submission No, Date, Submitted To, and select a PDF file.');
            return;
        }

        let uploadBlob = pvrFinalDocBlob || document.getElementById('pvr_Document').files[0];

        if (uploadBlob.size > 500 * 1024) {
            showCustomAlert('Alert', 'Signed Document size cannot exceed 500 Kb. Please try compressing manually.');
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
                submissionDate: subDate,
                reportSubmittedTo: submittedTo
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
        reader.readAsDataURL(uploadBlob);
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

    async function handlePVRDocumentChange(event) {
        pvrFinalDocBlob = null;
        document.getElementById('pvrPreviewSide').style.display = 'none';
        document.getElementById('pvrModal').classList.remove('pvr-wide');
        
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            
            if (file.type !== 'application/pdf') {
                showCustomAlert('Error', 'Please select a valid PDF file.');
                event.target.value = '';
                return;
            }

            if (file.size > 500 * 1024) {
                showCustomAlert('Info', 'File size is more than 500kb. Now compressing...', false, null, 'info');
                await pvrAutoCompressPdf(file);
            } else {
                pvrFinalDocBlob = file;
            }
        }
    }

    async function pvrAutoCompressPdf(file) {
        const btn = document.getElementById('btnSubmitPVR');
        const ogBtnHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compressing...';
        btn.disabled = true;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const typedarray = new Uint8Array(arrayBuffer);
            const pdfDoc = await pdfjsLib.getDocument(typedarray).promise;

            const profiles = [
                { scale: 1.5, quality: 0.9 },
                { scale: 1.5, quality: 0.7 },
                { scale: 1.0, quality: 0.8 },
                { scale: 1.0, quality: 0.6 },
                { scale: 0.8, quality: 0.5 }
            ];

            let finalBlob = null;
            for (const profile of profiles) {
                finalBlob = await pvrCompressWithProfile(pdfDoc, profile.scale, profile.quality);
                if (finalBlob.size <= 500 * 1024) {
                    break;
                }
            }

            pvrFinalDocBlob = finalBlob;

            document.getElementById('pvrModal').classList.add('pvr-wide');
            document.getElementById('pvrPreviewSide').style.display = 'flex';
            
            const reduction = ((file.size - finalBlob.size) / file.size * 100).toFixed(1);
            document.getElementById('pvrPreviewStats').innerHTML = `
                Compressed Size: ${(finalBlob.size / 1024).toFixed(1)} KB <br>
                <span style="font-size:12px; font-weight:normal; color:var(--text-muted);">(Reduced by ${reduction}%)</span>
            `;
            
            const page1 = await pdfDoc.getPage(1);
            const viewport = page1.getViewport({ scale: 1.0 });
            const canvas = document.getElementById('pvrPreviewCanvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page1.render({ canvasContext: ctx, viewport: viewport }).promise;

            const url = URL.createObjectURL(finalBlob);
            const dl = document.getElementById('pvrDownloadLink');
            dl.href = url;
            dl.style.display = 'inline-flex';

            setTimeout(closeCustomAlert, 1500);

        } catch (err) {
            showCustomAlert('Error', 'Failed to compress PDF. Please use the standalone PDF Compressor.');
            document.getElementById('pvr_Document').value = '';
        } finally {
            btn.innerHTML = ogBtnHtml;
            btn.disabled = false;
        }
    }

    async function pvrCompressWithProfile(pdfDoc, scale, quality) {
        const { jsPDF } = window.jspdf;
        let doc = null;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            const imgData = canvas.toDataURL('image/jpeg', quality);
            
            const orientation = viewport.width > viewport.height ? 'l' : 'p';
            if (i === 1) {
                doc = new jsPDF({ orientation: orientation, unit: 'px', format: [viewport.width, viewport.height] });
            } else {
                doc.addPage([viewport.width, viewport.height], orientation);
            }
            doc.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
        }

        return doc.output('blob');
    }
