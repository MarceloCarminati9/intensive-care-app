// VERSÃO ATUALIZADA - COM LÓGICA DE AÇÕES NO HISTÓRICO

document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');

    // --- Elementos da Página ---
    const patientNameHeader = document.getElementById('patientNameHeader');
    const historyList = document.getElementById('historyList');

    // --- Links de Ação Rápida ---
    const goToEvolutionBtn = document.getElementById('goToEvolutionBtn');
    const goToPrescriptionBtn = document.getElementById('goToPrescriptionBtn');

    // --- Elementos do Modal ---
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    const printDocumentBtn = document.getElementById('printDocumentBtn');

    // [ALTERAÇÃO] Função para gerar o HTML do relatório de evolução (movida para cá para ser reutilizável)
    function generateEvolutionReportHTML(patientData, evolutionContent) {
        if (!patientData || !evolutionContent) return '<p>Dados insuficientes para gerar o relatório.</p>';
        const getField = (field) => evolutionContent[field] || 'N/A';
        const patientDIH = patientData.dih ? new Date(patientData.dih).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        
        let reportHTML = `<div class="report-id-section"><h4>Identificação do Paciente</h4> ... </div>`; // Estrutura simplificada
        reportHTML = `
            <div class="report-header"><h3>Evolução Médica Diária</h3><p>Intensive Care Brasil</p></div>
            <div class="report-id-section">
                <h4>Identificação do Paciente</h4>
                <div class="report-id-grid">
                    <p><strong>Nome:</strong> ${patientData.name || 'N/A'}</p>
                    <p><strong>Idade:</strong> ${patientData.age || 'N/A'} anos</p>
                    <p><strong>Leito:</strong> ${patientData.bed_number || 'N/A'}</p>
                    <p><strong>DIH:</strong> ${patientDIH}</p>
                </div>
            </div>
            <div class="report-section"><h4>Impressão 24h</h4><p>${getField('impressao24h')}</p></div>
            <div class="report-section"><h4>Condutas</h4><p>${getField('condutas')}</p></div>
            <div class="signature-area"><div class="signature-line">${getField('medico_responsavel')}<br>CRM: ${getField('crm_medico')}</div></div>
        `;
        return reportHTML;
    }
    
    // Função principal que carrega todos os dados da página
    async function loadPageData() {
        if (!patientId) {
            patientNameHeader.textContent = "ERRO: ID do Paciente não encontrado na URL.";
            patientNameHeader.style.color = 'red';
            if(goToEvolutionBtn) goToEvolutionBtn.classList.add('disabled');
            if(goToPrescriptionBtn) goToPrescriptionBtn.classList.add('disabled');
            return;
        }

        try {
            const patientResponse = await fetch(`/api/patients/${patientId}`);
            if (!patientResponse.ok) throw new Error('Paciente não encontrado ou erro no servidor.');
            const patientResult = await patientResponse.json();
            const patient = patientResult.data;

            updateHeaders(patient);
            updateActionLinks(patientId);

            const [evolutionsResponse, prescriptionsResponse] = await Promise.all([
                fetch(`/api/patients/${patientId}/evolutions`),
                fetch(`/api/patients/${patientId}/prescriptions`)
            ]);

            if (!evolutionsResponse.ok || !prescriptionsResponse.ok) {
                throw new Error('Falha ao buscar o histórico do paciente.');
            }

            const evolutionsResult = await evolutionsResponse.json();
            const prescriptionsResult = await prescriptionsResponse.json();

            const combinedHistory = [
                ...(evolutionsResult.data || []).map(item => ({ ...item, type: 'Evolução Médica' })),
                ...(prescriptionsResult.data || []).map(item => ({ ...item, type: 'Receituário' }))
            ];
            
            renderHistory(combinedHistory, patient); // Passa o objeto 'patient' para a função

        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
            patientNameHeader.textContent = "Erro ao carregar dados";
            historyList.innerHTML = `<p style="color: red;">Não foi possível carregar o histórico. Detalhe: ${error.message}</p>`;
        }
    }

    function updateHeaders(patient) {
        // (Sem alterações aqui, código existente)
        const patientBed = document.getElementById('patientBed');
        const patientAge = document.getElementById('patientAge');
        const patientCns = document.getElementById('patientCns');
        const patientDih = document.getElementById('patientDih');
        const patientHpp = document.getElementById('patientHpp');
        const patientHd = document.getElementById('patientHd');
        patientNameHeader.textContent = patient.name || 'Nome não encontrado';
        patientBed.textContent = `${patient.unit_name || 'Unidade não informada'} - Leito ${patient.bed_number || 'N/A'}`;
        patientAge.textContent = patient.age ? `${patient.age} anos` : 'N/A';
        patientCns.textContent = patient.cns || 'N/A';
        if (patient.dih) {
            const formattedDate = new Date(patient.dih).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            patientDih.textContent = formattedDate;
        } else {
            patientDih.textContent = 'N/A';
        }
        if (patient.hpp) patientHpp.textContent = patient.hpp;
        if (patient.hd) patientHd.textContent = patient.hd;
    }

    function updateActionLinks(pId) {
        if (goToEvolutionBtn) goToEvolutionBtn.href = `patient-evolution.html?patientId=${pId}`;
        if (goToPrescriptionBtn) goToPrescriptionBtn.href = `receita.html?patientId=${pId}`; 
    }

    // [ALTERAÇÃO PRINCIPAL] Função para renderizar o histórico na tela com botões
    // [SUBSTITUIR ESTA FUNÇÃO]
function renderHistory(history, patientData) {
    historyList.innerHTML = '';
    if (!history || history.length === 0) {
        historyList.innerHTML = '<p>Nenhum histórico de evoluções ou receitas encontrado.</p>';
        return;
    }

    history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    history.forEach(item => {
        const historyItemDiv = document.createElement('div');
        historyItemDiv.className = 'history-item';
        historyItemDiv.dataset.item = JSON.stringify(item); 
        historyItemDiv.dataset.patient = JSON.stringify(patientData);

        // --- INÍCIO DA LÓGICA DE EXIBIÇÃO DA EDIÇÃO ---
        const createdAt = new Date(item.created_at);
        const updatedAt = item.updated_at ? new Date(item.updated_at) : null;
        let editedText = '';

        // Compara se 'updated_at' existe e é significativamente diferente de 'created_at'
        // (usamos um buffer de 1 minuto para evitar mostrar "editado" em itens recém-criados)
        if (item.type === 'Evolução Médica' && updatedAt && (updatedAt.getTime() - createdAt.getTime() > 60000)) {
            const formattedEditDate = updatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedEditTime = updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            editedText = `<span class="edited-status">(editada em ${formattedEditDate} às ${formattedEditTime})</span>`;
        }
        
        const formattedCreationDate = createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedCreationTime = createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        // --- FIM DA LÓGICA DE EXIBIÇÃO DA EDIÇÃO ---

        let buttonsHTML = '';
        if (item.type === 'Evolução Médica') {
            buttonsHTML = `
                <button class="button-secondary" data-action="view">Visualizar/Imprimir</button>
                <button class="button-secondary" data-action="copy">Copiar para Nova</button>
                <button class="button-secondary" data-action="edit">Editar</button>
            `;
        } else if (item.type === 'Receituário') {
            buttonsHTML = `
                <button class="button-secondary" data-action="view">Visualizar/Imprimir</button>
            `;
        }

        historyItemDiv.innerHTML = `
            <div class="history-item-content">
                <div class="history-item-title">${item.type} - ${formattedCreationDate} às ${formattedCreationTime}${editedText}</div>
                <div class="history-item-actions">${buttonsHTML}</div>
            </div>
        `;
        historyList.appendChild(historyItemDiv);
    });
}
    // [ALTERAÇÃO PRINCIPAL] Lógica de Eventos para os novos botões
    historyList.addEventListener('click', function(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const historyItemDiv = button.closest('.history-item');
        const itemData = JSON.parse(historyItemDiv.dataset.item);
        const patientData = JSON.parse(historyItemDiv.dataset.patient);

        switch(action) {
            case 'view':
                viewerTitle.textContent = `Visualizar ${itemData.type}`;
                let contentHtml = '';
                if (itemData.type === 'Receituário') {
                    contentHtml = `
                        <div class="report-section"><h4>Medicamento</h4><p>${itemData.medicamento}</p></div>
                        <div class="report-section"><h4>Posologia</h4><p>${itemData.posologia}</p></div>
                    `;
                } else if (itemData.type === 'Evolução Médica') {
                    contentHtml = generateEvolutionReportHTML(patientData, itemData.content);
                }
                viewerContent.innerHTML = contentHtml;
                historyViewerModal.classList.add('active');
                break;
            
            case 'edit':
                window.location.href = `patient-evolution.html?patientId=${patientId}&evolutionId=${itemData.id}`;
                break;

            case 'copy':
                 window.location.href = `patient-evolution.html?patientId=${patientId}&copyFromId=${itemData.id}`;
                break;
        }
    });

    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));
    if (printDocumentBtn) {
        printDocumentBtn.addEventListener('click', () => {
            const printWindow = window.open('', '_blank');
            const styles = document.querySelector('link[href="patient-view-style.css"]').outerHTML;
            printWindow.document.write(`<html><head><title>Imprimir</title>${styles}</head><body>${viewerContent.innerHTML}</body></html>`);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        });
    }

    loadPageData();
});