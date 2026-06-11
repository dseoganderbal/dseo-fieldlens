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

        // Clear existing fields and photos to prevent showing previous work's data while fetching
        const ueFields = ['ue_ReceiptDate', 'ue_NameOfWork', 'ue_WorksYear', 'ue_PVYear', 'ue_Constituency', 'ue_Block', 'ue_Location', 'ue_Department', 'ue_Agency', 'ue_AACost', 'ue_Allotted', 'ue_Claim', 'ue_Status', 'ue_PositionAA', 'ue_CompletionStatus', 'ue_LeftOut', 'ue_Signboard', 'ue_Quality', 'ue_VerifyRemarks', 'ue_DateVisit', 'ue_SubmissionDate', 'ue_GeoCoords', 'ue_Remarks'];
        ueFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const currentDocLink = document.getElementById('ue_CurrentDocLink');
        if (currentDocLink) currentDocLink.innerHTML = '';
        if (typeof removePhoto === 'function') {
            removePhoto(1, 'ue_');
            removePhoto(2, 'ue_');
        }

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

                const processEditPhotos = (photos) => {
                    if (photos && photos[0]) {
                        document.getElementById("ue_photoImg1").dataset.driveUrl = photos[0];
                        document.getElementById("ue_photoImg1").dataset.isNew = "false";
                        document.getElementById("ue_photoPreview1").style.display = "block";
                        document.getElementById("ue_photoPlaceholder1").style.display = "none";
                        showLoader("ue_photoImg1");
                        let img1 = document.getElementById("ue_photoImg1");
                        img1.onload = () => hideLoader("ue_photoImg1");
                        img1.onerror = () => hideLoader("ue_photoImg1");
                        img1.src = getThumbUrl(photos[0]);
                    } else {
                        removePhoto(1, "ue_");
                    }

                    if (photos && photos[1]) {
                        document.getElementById("ue_photoImg2").dataset.driveUrl = photos[1];
                        document.getElementById("ue_photoImg2").dataset.isNew = "false";
                        document.getElementById("ue_photoPreview2").style.display = "block";
                        document.getElementById("ue_photoPlaceholder2").style.display = "none";
                        showLoader("ue_photoImg2");
                        let img2 = document.getElementById("ue_photoImg2");
                        img2.onload = () => hideLoader("ue_photoImg2");
                        img2.onerror = () => hideLoader("ue_photoImg2");
                        img2.src = getThumbUrl(photos[1]);
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

        let img1El = document.getElementById('ue_photoImg1');
        let p1 = img1El.src;
        if (img1El.dataset.isNew === "true" && p1 && p1.startsWith("data:image")) {
            fileDataObj.photo1 = p1;
        } else if (p1 && p1 !== window.location.href) {
            fileDataObj.photo1 = img1El.dataset.driveUrl || p1;
        } else {
            fileDataObj.photo1 = '';
        }

        let img2El = document.getElementById('ue_photoImg2');
        let p2 = img2El.src;
        if (img2El.dataset.isNew === "true" && p2 && p2.startsWith("data:image")) {
            fileDataObj.photo2 = p2;
        } else if (p2 && p2 !== window.location.href) {
            fileDataObj.photo2 = img2El.dataset.driveUrl || p2;
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
