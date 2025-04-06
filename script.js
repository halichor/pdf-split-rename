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

// Replace checkbox with buttons for Rename option
document.getElementById('retainButton').addEventListener('click', () => {
    // When "retain" is clicked, set retain button to active and rename button to inactive
    document.getElementById('renameButton').classList.remove('active');
    document.getElementById('retainButton').classList.add('active');

    document.getElementById('renamePattern').value = ''; // Clear rename pattern
    document.getElementById('renameOptions').style.display = 'none'; // Hide rename options
    updatePreview(); // Ensure preview is updated
});

document.getElementById('renameButton').addEventListener('click', () => {
    // When "rename" is clicked, set rename button to active and retain button to inactive
    document.getElementById('retainButton').classList.remove('active');
    document.getElementById('renameButton').classList.add('active');

    document.getElementById('renameOptions').style.display = 'block'; // Show rename options
    updatePreview(); // Ensure preview is updated
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

// Function to handle the page preview update
function updatePreview() {
    const pattern = document.getElementById('renamePattern').value;
    const alwaysNumber = document.getElementById('alwaysNumber').checked;
    const previewContainer = document.getElementById('previewFilenames');
    const pdfFile = document.getElementById('pdfFile').files[0];

    // Only proceed if the rename button is active
    const renameButtonActive = document.getElementById('renameButton').classList.contains('active');

    // If the rename button isn't active, hide the preview container
    if (!renameButtonActive) {
        previewContainer.style.display = 'none';
        return;
    }

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

                // Display the preview filenames using the old HTML structure
                previewContainer.innerHTML = `<strong>Preview Filenames:</strong><div class="filename-list"><ul>${previews.map(name => `<li>${name}</li>`).join('')}</ul></div>`;
                previewContainer.style.display = 'block'; // Show the preview container
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

function clearInput() {
    // Reset all text, file, and other inputs to their default state
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        if (input.type === 'file') {
            // Reset file input to default
            input.value = '';  
            // Reset the file name label in the UI
            const fileLabel = input.nextElementSibling;
            if (fileLabel && fileLabel.tagName.toLowerCase() === 'span') {
                fileLabel.textContent = 'No file selected';  // Default label text
            }
        } else if (input.type === 'text' || input.type === 'number') {
            // Clear text and number inputs
            input.value = ''; 
        } else if (input.type === 'checkbox') {
            // Reset checkboxes (e.g., "always number" checkbox)
            input.checked = false;
        }
    });

    // Reset buttons to reflect "retain" state
    document.getElementById('renameButton').classList.remove('active');
    document.getElementById('retainButton').classList.add('active');

    // Hide the rename options when "retain" is active
    document.getElementById('renameOptions').style.display = 'none';

    // Reset the filename display in the drop zone(s)
    const dropZoneFileNameDisplays = document.querySelectorAll('.drop-zone span');
    dropZoneFileNameDisplays.forEach(span => {
        span.textContent = 'No file selected';  // Reset text to default
    });

    // Clear the preview container
    const previewContainer = document.getElementById('previewFilenames');
    if (previewContainer) {
        previewContainer.innerHTML = '';  // Clear any preview content
        previewContainer.style.display = 'none';  // Hide the preview container
    }

    // Reset the download link section (hide it when no files are available)
    const downloadLinkContainer = document.getElementById('downloadLink');
    if (downloadLinkContainer) {
        downloadLinkContainer.innerHTML = ''; // Remove download button or content
    }

    // Clear any CSV field buttons and reset CSV data
    const csvFieldsContainer = document.getElementById('csvFields');
    csvFieldsContainer.innerHTML = '';  // Remove any CSV buttons

    // Reset CSV data and headers
    csvData = [];
    csvHeaders = [];

    // Reset any other UI elements related to files or input
    const fileNameDisplay = document.getElementById('fileNameDisplay'); // Adjust ID if needed
    if (fileNameDisplay) {
        fileNameDisplay.textContent = 'No file selected';  // Reset to default
    }
    
    // Reset the pages per split input to the default value (e.g., 1)
    const pagesPerSplitInput = document.getElementById('pagesPerSplit');
    if (pagesPerSplitInput) {
        pagesPerSplitInput.value = 1;  // Or whatever your default is
    }

    // Reset the rename pattern input
    const renamePatternInput = document.getElementById('renamePattern');
    if (renamePatternInput) {
        renamePatternInput.value = '';  // Clear the pattern
    }

    // Reset the always number checkbox
    const alwaysNumberCheckbox = document.getElementById('alwaysNumber');
    if (alwaysNumberCheckbox) {
        alwaysNumberCheckbox.checked = false;  // Uncheck by default
    }

    // Optionally, reset other elements if necessary (e.g., settings or other options)

    // Optionally focus the first input field after clearing
    inputs[0]?.focus();
}


// Function to handle input change and refresh preview list
function setupAutoRefreshForInputs() {
    const pagesPerSplitInput = document.getElementById('pagesPerSplit');
    const renamePatternInput = document.getElementById('renamePattern');
    const alwaysNumberInput = document.getElementById('alwaysNumber');
    const pdfFileInput = document.getElementById('pdfFile');

    // Add event listeners to the relevant inputs
    pagesPerSplitInput.addEventListener('input', updatePreview);  // Refresh on pages per split change
    renamePatternInput.addEventListener('input', updatePreview);  // Refresh on rename pattern change
    alwaysNumberInput.addEventListener('change', updatePreview);  // Refresh on always number toggle
    pdfFileInput.addEventListener('change', updatePreview);  // Refresh on file selection change
}

// Call the setup function when the page is ready
document.addEventListener('DOMContentLoaded', () => {
    setupAutoRefreshForInputs();
});


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

    // Check the active state of the buttons instead of checkbox
    const renameButtonActive = document.getElementById('renameButton').classList.contains('active');
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
        if (renameButtonActive) {
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

