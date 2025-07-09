document.addEventListener('DOMContentLoaded', () => {
    const reportForm = document.getElementById('dailyReportForm');
    const reportOutput = document.getElementById('reportOutput');
    const reportText = document.getElementById('reportText');
    const copyBtn = document.getElementById('copyBtn');
    const printBtn = document.getElementById('printBtn'); // Referência ao novo botão

    // --- LÓGICA PARA CAMPOS CONDICIONAIS (sem alterações) ---
    const setupConditionalField = (selectId, detailsId, triggerValue) => {
        const selectElement = document.getElementById(selectId);
        const detailsElement = document.getElementById(detailsId);
        if (selectElement && detailsElement) {
            selectElement.addEventListener('change', () => {
                detailsElement.style.display = (selectElement.value === triggerValue) ? 'block' : 'none';
            });
        }
    };
    const tevSelect = document.getElementById('tev_select');
    if (tevSelect) {
        tevSelect.addEventListener('change', () => {
            const selectedValue = tevSelect.value;
            document.getElementById('tev_mechanical_details').style.display = (selectedValue === 'Mecânica') ? 'block' : 'none';
            document.getElementById('tev_pharmacological_details').style.display = (selectedValue === 'Farmacológica') ? 'block' : 'none';
        });
    }
    setupConditionalField('lpp_select', 'lpp_details', 'Sim');
    setupConditionalField('lamg_select', 'lamg_details', 'Sim');
    setupConditionalField('cornea_select', 'cornea_details', 'Sim');
    setupConditionalField('avoidable_days_select', 'avoidable_days_details', 'Sim');

    // --- LÓGICA PARA GERAR RELATÓRIO (sem alterações) ---
    reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const sections = {
            'IDENTIFICAÇÃO': [], 'DIAGNÓSTICOS E ALERGIAS': [], 'NEUROLÓGICO': [],
            'RESPIRATÓRIO / VENTILAÇÃO': [], 'CARDIOVASCULAR / HEMODINÂMICA': [],
            'RENAL / HIDRATAÇÃO': [], 'INFECCIOSO': [], 'GASTROINTESTINAL / NUTRIÇÃO': [],
            'METABÓLICO / LABORATÓRIO': [], 'PROFILAXIAS': [], 'PENDÊNCIAS E PLANO DO DIA': []
        };
        const inputs = reportForm.querySelectorAll('[data-label]');
        inputs.forEach(input => {
            const label = input.dataset.label;
            const value = input.value.trim();
            const sectionTitle = input.closest('.form-section')?.querySelector('h3')?.textContent.toUpperCase();
            if (value && sectionTitle && sections[sectionTitle]) {
                if (!label.startsWith('↳')) { 
                    sections[sectionTitle].push(`${label}: ${value}`);
                } else {
                    const lastItemIndex = sections[sectionTitle].length - 1;
                    if(lastItemIndex >= 0 && !sections[sectionTitle][lastItemIndex].includes(`(${value})`)) {
                       const detailText = (input.type === 'number') ? `${value} dias` : value;
                       sections[sectionTitle][lastItemIndex] += ` (${detailText})`;
                    }
                }
            }
        });
        let fullReport = `RELATÓRIO DIÁRIO DO PACIENTE - ${new Date().toLocaleDateString('pt-BR')}\n`;
        fullReport += "========================================\n\n";
        for (const section in sections) {
            if (sections[section].length > 0) {
                fullReport += `--- ${section} ---\n`;
                fullReport += sections[section].join('\n');
                fullReport += `\n\n`;
            }
        }
        reportText.textContent = fullReport.trim();
        reportOutput.style.display = 'block';
        window.scrollTo(0, document.body.scrollHeight);
    });

    // --- LÓGICA DOS BOTÕES DE AÇÃO ---
    // Botão de Copiar (sem alterações)
    copyBtn.addEventListener('click', () => {
        if (navigator.clipboard && reportText.textContent) {
            navigator.clipboard.writeText(reportText.textContent)
                .then(() => {
                    copyBtn.textContent = 'Copiado com Sucesso!';
                    setTimeout(() => { copyBtn.textContent = 'Copiar Relatório'; }, 2000);
                })
                .catch(err => {
                    console.error('Erro ao copiar texto: ', err);
                    alert('Não foi possível copiar o texto.');
                });
        }
    });

    // Botão de Imprimir (NOVO)
    printBtn.addEventListener('click', () => {
        window.print();
    });
});