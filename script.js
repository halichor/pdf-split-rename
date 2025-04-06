
const modal = document.getElementById('modal');
const modalText = document.getElementById('modalText');
const modalClose = document.getElementById('modalClose');
modalClose.onclick = () => modal.close();

function showModal(message) {
    modalText.textContent = message;
    modal.showModal();
}

let csvData = [];
let csvHeaders = [];

function handleFileDrop(dropZone, input, fileNameId, type) {
    dropZone.addEventListener('click', () => input.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (validateFileType(file, type)) {
            input.files = e.dataTransfer.files;
            input.dispatchEvent(new Event('change'));
        } else {
            showModal(`Please upload a valid ${type.toUpperCase()} file.`);
        }
    });
    input.addEventListener('change', () => {
        const file = input.files[0];
        if (validateFileType(file, type)) {
            document.getElementById(fileNameId).textContent = file.name;
        } else {
            showModal(`Please upload a valid ${type.toUpperCase()} file.`);
            input.value = '';
            document.getElementById(fileNameId).textContent = 'No file selected';
        }
    });
}

function validateFileType(file, type) {
    if (!file) return false;
    const validTypes = {
        pdf: 'application/pdf',
        csv: 'text/csv'
    };
    return file.type === validTypes[type] || (type === 'csv' && file.name.endsWith('.csv'));
}

handleFileDrop(document.getElementById('pdfDrop'), document.getElementById('pdfFile'), 'pdfFileName', 'pdf');
handleFileDrop(document.getElementById('csvDrop'), document.getElementById('csvFile'), 'csvFileName', 'csv');

document.getElementById('renameFiles').addEventListener('change', (e) => {
    const visible = e.target.checked;
    document.getElementById('renameOptions').style.display = visible ? 'block' : 'none';
    if (visible) updatePreview();
});

document.getElementById('renamePattern').addEventListener('input', updatePreview);
document.getElementById('alwaysNumber').addEventListener('change', updatePreview);

document.getElementById('csvFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                csvData = results.data;
                csvHeaders = results.meta.fields || [];
                renderCSVButtons();
                updatePreview();
            }
        });
    }
});

function renderCSVButtons() {
    const container = document.getElementById('csvFields');

    // Create a div for the header
    const headerDiv = document.createElement('div');
    headerDiv.innerHTML = '<strong>Insert CSV Fields:</strong>';
    container.appendChild(headerDiv);

    // Create a div for the buttons
    const buttonsDiv = document.createElement('div');
    buttonsDiv.classList.add('csv-fields-container');
    container.appendChild(buttonsDiv);

    // Create buttons for each CSV field
    csvHeaders.forEach(col => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `{${col}}`;
        button.onclick = () => {
            const input = document.getElementById('renamePattern');
            const cursorPos = input.selectionStart;
            const text = input.value;
            input.value = text.slice(0, cursorPos) + `{${col}}` + text.slice(cursorPos);
            input.focus();
            input.selectionStart = input.selectionEnd = cursorPos + `{${col}}`.length;
            updatePreview();
        };
        buttonsDiv.appendChild(button);
    });
}

function updatePreview() {
    const pattern = document.getElementById('renamePattern').value;
    const alwaysNumber = document.getElementById('alwaysNumber').checked;
    const previewContainer = document.getElementById('previewFilenames');
    const pdfFile = document.getElementById('pdfFile').files[0];

    if (!pattern || !pdfFile) {
        previewContainer.innerHTML = '';
        console.log('No pattern or PDF file selected.');
        return;
    }

    console.log('Attempting to load PDF...');

    // Load the PDF and calculate the number of pages
    const pdfBytes = pdfFile ? pdfFile.arrayBuffer() : null;
    if (!pdfBytes) {
        previewContainer.innerHTML = 'Error: Could not read the PDF file.';
        console.error('Error: Could not read the PDF file.');
        return;
    }

    // Ensure the PDF arrayBuffer() resolves properly
    pdfBytes.then(bytes => {
        console.log('Successfully read PDF file, starting to load the PDF document.');

        // Try to load the PDF document
        PDFLib.PDFDocument.load(bytes)
            .then((pdfDoc) => {
                const totalPages = pdfDoc.getPageCount();
                const pagesPerSplit = parseInt(document.getElementById('pagesPerSplit').value, 10);

                if (isNaN(pagesPerSplit) || pagesPerSplit < 1) {
                    previewContainer.innerHTML = 'Invalid pages per split value.';
                    console.log('Invalid pages per split value:', pagesPerSplit);
                    return;
                }

                // Calculate the total number of split files
                const fileCount = Math.ceil(totalPages / pagesPerSplit);

                console.log('Total Pages:', totalPages);
                console.log('File Count (number of splits):', fileCount);

                // Generate preview filenames based on the split count
                const previews = Array.from({ length: fileCount }, (_, idx) => {
                    const data = csvData[idx] || {}; // Use CSV data if available, else an empty object
                    return formatFilename(pattern, data, idx, fileCount, alwaysNumber);
                });

                // Display the preview filenames
                previewContainer.innerHTML = `<strong>Preview Filenames:</strong><ul>${previews.map(name => `<li>${name}</li>`).join('')}</ul>`;
            })
            .catch((err) => {
                console.error("Error loading PDF:", err);
                previewContainer.innerHTML = 'Error processing the PDF file.';
            });
    }).catch(error => {
        console.error('Error reading the PDF file:', error);
        previewContainer.innerHTML = 'Error: Could not read the PDF file.';
    });
}

function formatFilename(pattern, data, index, totalCount, alwaysNumber) {
    let filename = pattern;
    const digits = totalCount.toString().length;
    const num = String(index + 1).padStart(digits, '0');

    // If alwaysNumber is checked, replace {num_count} with the number
    if (alwaysNumber || pattern.includes('{num_count}')) {
        filename = filename.replace(/{num_count}/g, num);
    }

    // Replace other CSV placeholders like {name}, {id}, etc.
    if (data) {
        for (const key in data) {
            const regex = new RegExp(`{${key}}`, 'g');
            filename = filename.replace(regex, data[key]);
        }
    }

    return filename + ".pdf";
}


async function processFiles() {
    const pdfInput = document.getElementById('pdfFile').files[0];
    if (!pdfInput) return showModal('Upload a PDF file first.');
    const pdfBytes = await pdfInput.arrayBuffer();
    const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    const pagesPerSplit = parseInt(document.getElementById('pagesPerSplit').value);
    if (!pagesPerSplit || pagesPerSplit < 1) return showModal('Please enter a valid number of pages per split.');

    const rename = document.getElementById('renameFiles').checked;
    const pattern = document.getElementById('renamePattern').value;
    const alwaysNumber = document.getElementById('alwaysNumber').checked;

    const zip = new JSZip();
    const fileCount = Math.ceil(totalPages / pagesPerSplit);
    let splitIndex = 0;

    for (let startPage = 0; startPage < totalPages; startPage += pagesPerSplit) {
        const newPdf = await PDFLib.PDFDocument.create();
        const endPage = Math.min(startPage + pagesPerSplit, totalPages);
        const pagesToCopy = await newPdf.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, j) => startPage + j));
        pagesToCopy.forEach(page => newPdf.addPage(page));
        const splitPdfBytes = await newPdf.save();

        let filename = `file_${splitIndex + 1}.pdf`;
        if (rename) {
            const data = csvData[splitIndex] || {};
            filename = formatFilename(pattern, data, splitIndex, fileCount, alwaysNumber);
        }
        zip.file(filename, splitPdfBytes);
        splitIndex++;
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    // Update the download section to include a button
    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download ZIP';
    downloadButton.onclick = () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = 'output_files.zip'; // Set the default filename for the ZIP file
        a.click();
    };

    // Append the download button to the downloadLink container
    const downloadLinkContainer = document.getElementById('downloadLink');
    downloadLinkContainer.innerHTML = ''; // Clear any previous content
    downloadLinkContainer.appendChild(downloadButton);
}

