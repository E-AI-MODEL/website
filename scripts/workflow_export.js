// Export knoppen. The complete workflow is preserved on every screen width.
(function installWorkflowExports() {
    const pngButton = document.getElementById('export-png-btn');
    const pdfButton = document.getElementById('export-pdf-btn');
    let busy = false;

    function startDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        // WebKit may read the URL after the click handler has returned.
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    }

    async function exportWorkflow(format) {
        if (busy) return;
        if (typeof window.html2canvas !== 'function' ||
            (format === 'pdf' && !window.jspdf?.jsPDF)) {
            alert('Exportbibliotheek niet geladen. Gebruik Afdrukken in je browser of probeer later opnieuw.');
            return;
        }
        const source = document.getElementById('final-summary-container');
        if (!source || !document.querySelector('#final-summary-visual h4')) {
            alert('Kies eerst minimaal een taak.');
            return;
        }
        busy = true;
        pngButton.disabled = pdfButton.disabled = true;
        try {
            if (document.fonts?.ready) await document.fonts.ready;
            const bounds = source.getBoundingClientRect();
            // A task stays on one page where it fits; arrows are gap elements.
            const cardEnds = [...source.querySelectorAll('#final-summary-visual > div')]
                .filter(node => node.querySelector('h4'))
                .map(node => node.getBoundingClientRect().bottom - bounds.top + 5);
            const canvas = await window.html2canvas(source, {
                backgroundColor: '#ffffff', scale: 2, logging: false
            });
            if (!canvas.width || !canvas.height) throw new Error('Empty export canvas');
            if (format === 'png') {
                const blob = await new Promise((resolve, reject) => canvas.toBlob(
                    result => result ? resolve(result) : reject(new Error('PNG encoding failed')),
                    'image/png'
                ));
                startDownload(blob, 'eai-workflow.png');
                return;
            }
            const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pixelsPerPage = Math.max(1, Math.floor(canvas.width * pageHeight / pageWidth));
            const scale = canvas.width / bounds.width;
            const breaks = cardEnds.map(y => Math.round(y * scale));
            let offset = 0;
            let pageIndex = 0;
            while (offset < canvas.height) {
                const limit = Math.min(canvas.height, offset + pixelsPerPage);
                const fitting = breaks.filter(y => y > offset + pixelsPerPage * 0.25 && y <= limit);
                const end = limit === canvas.height || fitting.length === 0 ? limit : fitting.at(-1);
                const part = document.createElement('canvas');
                part.width = canvas.width;
                part.height = end - offset;
                const context = part.getContext('2d');
                if (!context) throw new Error('No drawing context');
                context.drawImage(canvas, 0, offset, part.width, part.height, 0, 0, part.width, part.height);
                if (pageIndex > 0) pdf.addPage();
                pdf.addImage(part, 'PNG', 0, 0, pageWidth, part.height * pageWidth / part.width);
                offset = end;
                pageIndex++;
            }
            startDownload(pdf.output('blob'), 'eai-workflow.pdf');
        } catch (error) {
            console.warn('Workflow export failed:', error);
            alert('Exporteren is niet gelukt. Probeer opnieuw of gebruik Afdrukken in je browser.');
        } finally {
            busy = false;
            pngButton.disabled = pdfButton.disabled = false;
        }
    }
    pngButton.addEventListener('click', () => exportWorkflow('png'));
    pdfButton.addEventListener('click', () => exportWorkflow('pdf'));
})();
