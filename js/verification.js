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
                document.getElementById('vfAACost').value = '\u20B9 ' + String(data.cost || '0');
                document.getElementById('vfAllottedCost').value = '\u20B9 ' + String(data.allotted || '0');
                document.getElementById('vfClaim').value = '\u20B9 ' + String(data.claim || '0');
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

                const processVerifiedPhotos = (photos) => {
                    if (photos && photos[0]) {
                        document.getElementById("photoImg1").dataset.driveUrl = photos[0];
                        document.getElementById("photoImg1").dataset.isNew = "false";
                        document.getElementById("photoPreview1").style.display = "block";
                        document.getElementById("photoPlaceholder1").style.display = "none";
                        showLoader("photoImg1");
                        let img1 = document.getElementById("photoImg1");
                        img1.onload = () => hideLoader("photoImg1");
                        img1.onerror = () => hideLoader("photoImg1");
                        img1.src = getThumbUrl(photos[0]);
                    } else {
                        removePhoto(1);
                    }

                    if (photos && photos[1]) {
                        document.getElementById("photoImg2").dataset.driveUrl = photos[1];
                        document.getElementById("photoImg2").dataset.isNew = "false";
                        document.getElementById("photoPreview2").style.display = "block";
                        document.getElementById("photoPlaceholder2").style.display = "none";
                        showLoader("photoImg2");
                        let img2 = document.getElementById("photoImg2");
                        img2.onload = () => hideLoader("photoImg2");
                        img2.onerror = () => hideLoader("photoImg2");
                        img2.src = getThumbUrl(photos[1]);
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
        let img1El = document.getElementById("photoImg1");
        let p1 = img1El.src;
        if (img1El.dataset.isNew === "true" && p1 && p1.startsWith("data:image")) {
            files.photo1 = p1;
        } else if (p1 && p1 !== window.location.href) {
            files.photo1 = img1El.dataset.driveUrl || p1;
        } else {
            files.photo1 = '';
        }

        let img2El = document.getElementById("photoImg2");
        let p2 = img2El.src;
        if (img2El.dataset.isNew === "true" && p2 && p2.startsWith("data:image")) {
            files.photo2 = p2;
        } else if (p2 && p2 !== window.location.href) {
            files.photo2 = img2El.dataset.driveUrl || p2;
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

        function processTo43(dataUrl) {
            return new Promise(resolve => {
                if (!dataUrl || !dataUrl.startsWith('data:image')) {
                    resolve(dataUrl);
                    return;
                }
                const img = new Image();
                img.onload = () => {
                    const targetWidth = 1920;
                    const targetHeight = 1440;
                    const canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, targetWidth, targetHeight);

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
                    resolve(canvas.toDataURL('image/jpeg', 0.88));
                };
                img.onerror = () => resolve(dataUrl);
                img.src = dataUrl;
            });
        }

        const btn = document.getElementById('vfPrintBtn');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        btn.disabled = true;

        Promise.all([
            getBase64Image(p1).then(processTo43), 
            getBase64Image(p2).then(processTo43)
        ]).then(([b64_1, b64_2]) => {
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

            const filename = `${workcode}_Verification_Report.pdf`;
            const opt = {
                margin:       [0.5, 0.3],
                filename:     filename,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, allowTaint: true, scrollX: 0, scrollY: 0, x: 0, y: 0, windowWidth: 750 },
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
            };

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                html2pdf().set(opt).from(element).output('datauristring').then(function(pdfAsString) {
                    const base64Data = pdfAsString.split(',')[1];
                    return window.Capacitor.Plugins.Filesystem.writeFile({
                        path: filename,
                        data: base64Data,
                        directory: 'DOCUMENTS'
                    });
                }).then(() => {
                    showCustomAlert('Success', 'PDF downloaded to your Documents folder.', false, null, 'success');
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    document.getElementById('pdfTemplateWrapper').style.left = '-9999px';
                }).catch(err => {
                    console.error('PDF generation error', err);
                    showCustomAlert('Notice', 'Failed to generate/save PDF natively. Check console for details.', false, null, 'error');
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    document.getElementById('pdfTemplateWrapper').style.left = '-9999px';
                });
            } else {
                html2pdf().set(opt).from(element).save().then(() => {
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    document.getElementById('pdfTemplateWrapper').style.left = '-9999px';
                }).catch(err => {
                    console.error('PDF generation error', err);
                    showCustomAlert('Notice', 'Failed to generate PDF. Check console for details.', false, null, 'error');
                    btn.innerHTML = ogText;
                    btn.disabled = false;
                    document.getElementById('pdfTemplateWrapper').style.left = '-9999px';
                });
            }
        });
    }
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

        const processAndSet = (dataUrl) => {
            const imgEl = document.getElementById(`${prefix}photoImg${n}`);
            imgEl.src = dataUrl;
            imgEl.dataset.isNew = "true";
            document.getElementById(`${prefix}photoPreview${n}`).style.display = 'block';
            document.getElementById(`${prefix}photoPlaceholder${n}`).style.display = 'none';
            event.target.value = ''; // clear input
        };

        if (file.size > 500 * 1024) {
            showCustomAlert('Notice', 'Image size is more than 500KB. Compressing the image...', false, null, 'info');

            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1920;
                    const MAX_HEIGHT = 1440;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    let quality = 0.8;
                    let dataUrl = canvas.toDataURL('image/jpeg', quality);

                    while (dataUrl.length * 0.75 > 500 * 1024 && quality > 0.1) {
                        quality -= 0.1;
                        dataUrl = canvas.toDataURL('image/jpeg', quality);
                    }

                    processAndSet(dataUrl);
                    setTimeout(closeCustomAlert, 800);
                };
                img.onerror = () => {
                    showCustomAlert('Alert', 'Failed to process image.', false, null, 'error');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = e => processAndSet(e.target.result);
            reader.onerror = () => {
                showCustomAlert('Alert', 'Failed to read image.', false, null, 'error');
            };
            reader.readAsDataURL(file);
        }
    }
    function removePhoto(n, prefix) {
        prefix = prefix || '';
        const imgEl = document.getElementById(`${prefix}photoImg${n}`);
        if (imgEl) {
            imgEl.src = '';
            delete imgEl.dataset.driveUrl;
            delete imgEl.dataset.isNew;
        }
        document.getElementById(`${prefix}photoPreview${n}`).style.display = 'none';
        document.getElementById(`${prefix}photoPlaceholder${n}`).style.display = 'flex';
        const inputEl = document.getElementById(`${prefix}photoInput${n}`);
        if (inputEl) inputEl.value = '';
    }
