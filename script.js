pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const pdfContainer = document.getElementById('pdfContainer');
const pdfInfo = document.getElementById('pdfInfo');
const pageCount = document.getElementById('pageCount');
const emptyState = document.getElementById('emptyState');
const loadingIndicator = document.getElementById('loadingIndicator');
const topActions = document.getElementById('topActions');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notificationText');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// PDF variables
let pdfDoc = null;
let remainingPages = [];
let originalPdfBytes = null;
let pdfFileName = 'modified-document.pdf';

// Show notification
function showNotification(message, isError = false) {
    notificationText.textContent = message;
    notification.style.background = isError
        ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
        : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
    notification.style.display = 'flex';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Update progress bar
function updateProgress(percent, message) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = message;
}

// Upload area events
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

// Handle file upload
async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        showNotification('Please select a PDF file', true);
        return;
    }

    // Store original filename
    pdfFileName = file.name.replace('.pdf', '') + '-modified.pdf';

    // Show loading indicator
    uploadArea.classList.add('hidden');
    emptyState.classList.add('hidden');
    loadingIndicator.classList.remove('hidden');

    const fileReader = new FileReader();

    fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);
        originalPdfBytes = typedarray;

        try {
            // Load PDF document
            const loadingTask = pdfjsLib.getDocument(typedarray);
            pdfDoc = await loadingTask.promise;

            // Initialize remaining pages
            remainingPages = Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1);

            // Update page count
            pageCount.textContent = `Total Pages: ${pdfDoc.numPages}`;

            // Render all pages
            await renderAllPages();

            // Show PDF container and action buttons
            loadingIndicator.classList.add('hidden');
            pdfContainer.classList.remove('hidden');
            pdfInfo.classList.remove('hidden');
            topActions.classList.remove('hidden');

            showNotification('PDF loaded successfully');
        } catch (error) {
            console.error('Error loading PDF:', error);
            showNotification('Error loading PDF. Please try again.', true);
            resetApp();
        }
    };

    fileReader.readAsArrayBuffer(file);
}

// Render all PDF pages
async function renderAllPages() {
    pdfContainer.innerHTML = '';

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        // Create page wrapper
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-wrapper';
        pageWrapper.dataset.pageNum = pageNum;

        // Calculate scale to fit container
        const containerWidth = 180; // Minimum width from grid
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        // Set canvas dimensions
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        // Create delete button
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
        deleteBtn.addEventListener('click', () => removePage(pageNum, pageWrapper));

        // Create page number indicator
        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = pageNum;

        // Append elements
        pageWrapper.appendChild(deleteBtn);
        pageWrapper.appendChild(canvas);
        pageWrapper.appendChild(pageNumber);
        pdfContainer.appendChild(pageWrapper);

        // Render PDF page
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };
        await page.render(renderContext).promise;
    }
}

// Remove a page
function removePage(pageNum, pageElement) {
    // Remove from remaining pages
    remainingPages = remainingPages.filter(p => p !== pageNum);

    // Animate removal
    pageElement.style.transform = 'scale(0.8) rotate(5deg)';
    pageElement.style.opacity = '0';

    setTimeout(() => {
        pageElement.remove();

        // Update page count
        pageCount.textContent = `Remaining Pages: ${remainingPages.length}`;

        // Show notification
        showNotification(`Page ${pageNum} removed`);

        // If no pages left, show empty state
        if (remainingPages.length === 0) {
            pdfContainer.classList.add('hidden');
            pdfInfo.classList.add('hidden');
            topActions.classList.add('hidden');
            emptyState.classList.remove('hidden');
        }
    }, 300);
}

// Reset the app
function resetApp() {
    pdfContainer.innerHTML = '';
    pdfContainer.classList.add('hidden');
    pdfInfo.classList.add('hidden');
    topActions.classList.add('hidden');
    emptyState.classList.remove('hidden');
    uploadArea.classList.remove('hidden');
    fileInput.value = '';
    pdfDoc = null;
    remainingPages = [];
    originalPdfBytes = null;
}

// Reset button event
resetBtn.addEventListener('click', resetApp);

// Download modified PDF
downloadBtn.addEventListener('click', async () => {
    if (!originalPdfBytes || remainingPages.length === 0) {
        showNotification('No pages to download', true);
        return;
    }

    try {
        // Show progress
        topActions.classList.add('hidden');
        progressContainer.classList.remove('hidden');
        updateProgress(10, 'Loading PDF...');

        // Load the PDF with PDF-lib
        const pdfDoc = await PDFLib.PDFDocument.load(originalPdfBytes);
        updateProgress(30, 'Processing pages...');

        // Create a new PDF document
        const newPdfDoc = await PDFLib.PDFDocument.create();

        // Copy the remaining pages to the new document
        const totalPages = remainingPages.length;
        for (let i = 0; i < totalPages; i++) {
            const pageNum = remainingPages[i];
            const [page] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
            newPdfDoc.addPage(page);

            // Update progress
            const progress = 30 + (60 * (i + 1) / totalPages);
            updateProgress(progress, `Processing page ${i + 1} of ${totalPages}...`);
        }

        updateProgress(90, 'Saving PDF...');

        // Save the new PDF
        const pdfBytes = await newPdfDoc.save();

        // Create a download link
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        updateProgress(100, 'Download complete!');

        // Hide progress after a delay
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            topActions.classList.remove('hidden');
            showNotification('PDF downloaded successfully');
        }, 1500);

    } catch (error) {
        console.error('Error preparing PDF:', error);
        showNotification('Error preparing PDF. Please try again.', true);
        progressContainer.classList.add('hidden');
        topActions.classList.remove('hidden');
    }
});

// Initialize empty state
emptyState.classList.remove('hidden');
