function initImageCompressor() {
    document.getElementById('icQuality').addEventListener('input', function() {
        document.getElementById('icQualityVal').textContent = this.value + '%';
        document.getElementById('icTargetSize').value = '';
    });
    document.getElementById('icScale').addEventListener('input', function() {
        document.getElementById('icScaleVal').textContent = this.value + '%';
        document.getElementById('icTargetSize').value = '';
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
function initPdfCompressor() {
    document.getElementById('pcQuality').addEventListener('input', function() {
        document.getElementById('pcQualityVal').textContent = this.value + '%';
        document.getElementById('pcTargetSize').value = '';
    });
    document.getElementById('pcRenderDpi').addEventListener('change', function() {
        document.getElementById('pcTargetSize').value = '';
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
