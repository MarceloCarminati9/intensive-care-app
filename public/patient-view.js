// VERSÃO ATUALIZADA PARA EXIBIR DADOS DO LEITO

document.addEventListener('DOMContentLoaded', function() {
    // Pega o ID do paciente da URL. A chave deve ser 'patientId'.
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

    // Função principal que carrega todos os dados da página
    async function loadPageData() {
        if (!patientId) {
            patientNameHeader.textContent = "ERRO: ID do Paciente não encontrado na URL.";
            patientNameHeader.style.color = 'red';
            return;
        }

        try {
            // 1. Busca os dados principais do paciente (AGORA INCLUINDO DADOS DO LEITO)
            const patientResponse = await fetch(`/api/patients/${patientId}`);
            if (!patientResponse.ok) throw new Error('Paciente não encontrado ou erro no servidor.');
            const patientResult = await patientResponse.json();
            const patient = patientResult.data;

            // 2. Atualiza os cabeçalhos e os links de ação com os dados do paciente
            updateHeaders(patient); // Esta função foi atualizada
            updateActionLinks(patientId);

            // 3. Busca o histórico de evoluções e receitas em paralelo
            const [evolutionsResponse, prescriptionsResponse] = await Promise.all([
                fetch(`/api/patients/${patientId}/evolutions`),
                fetch(`/api/patients/${patientId}/prescriptions`)
            ]);

            const evolutionsResult = await evolutionsResponse.json();
            const prescriptionsResult = await prescriptionsResponse.json();

            // 4. Combina os históricos, adiciona um 'tipo' para cada um e renderiza
            const combinedHistory = [
                ...(evolutionsResult.data || []).map(item => ({ ...item, type: 'Evolução Médica' })),
                ...(prescriptionsResult.data || []).map(item => ({ ...item, type: 'Receituário' }))
            ];
            
            renderHistory(combinedHistory);

        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
            patientNameHeader.textContent = "Erro ao carregar dados";
            historyList.innerHTML = `<p style="color: red;">Não foi possível carregar o histórico. Detalhe: ${error.message}</p>`;
        }
    }

    // [MODIFICADO] Função para atualizar o cabeçalho com os dados do leito e unidade
    function updateHeaders(patient) {
        const patientBed = document.getElementById('patientBed');
        const patientAge = document.getElementById('patientAge');
        const patientCns = document.getElementById('patientCns');
        const patientDih = document.getElementById('patientDih');
        const patientHpp = document.getElementById('patientHpp');
        const patientHd = document.getElementById('patientHd');

        patientNameHeader.textContent = patient.name || 'Nome não encontrado';
        
        // Agora exibe a unidade e o leito
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

    function updateActionLinks(patientId) {
        if (goToEvolutionBtn) goToEvolutionBtn.href = `patient-evolution.html?id=${patientId}`; // Corrigido para 'id'
        if (goToPrescriptionBtn) goToPrescriptionBtn.href = `receita.html?patientId=${patientId}`; 
    }

    function renderHistory(history) {
        historyList.innerHTML = '';
        if (!history || history.length === 0) {
            historyList.innerHTML = '<p>Nenhum histórico de evoluções ou receitas encontrado.</p>';
            return;
        }

        history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        history.forEach(item => {
            const date = new Date(item.created_at);
            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const historyItemDiv = document.createElement('div');
            historyItemDiv.className = 'history-item';
            historyItemDiv.dataset.item = JSON.stringify(item); 

            historyItemDiv.innerHTML = `<div class="history-item-header"><strong>${item.type}</strong> - ${formattedDate} às ${formattedTime}</div>`;
            historyList.appendChild(historyItemDiv);
        });
    }

    function openHistoryViewer(item) {
        viewerTitle.textContent = `Visualizar ${item.type}`;
        
        let contentHtml = '';
        if (item.type === 'Receituário') {
            contentHtml = `
                <h4>Medicamento</h4>
                <p>${item.medicamento}</p>
                <h4>Posologia</h4>
                <p>${item.posologia}</p>
                <small>Emitido em: ${new Date(item.created_at).toLocaleString('pt-BR')}</small>
            `;
        } else {
            contentHtml = `<pre>${item.content || 'Visualização detalhada da evolução ainda não implementada.'}</pre>`;
        }

        viewerContent.innerHTML = contentHtml;
        historyViewerModal.classList.add('active');
    }

    // --- Lógica de Eventos ---
    historyList.addEventListener('click', function(event) {
        const clickedItemDiv = event.target.closest('.history-item');
        if (clickedItemDiv && clickedItemDiv.dataset.item) {
            const itemData = JSON.parse(clickedItemDiv.dataset.item);
            openHistoryViewer(itemData);
        }
    });

    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));
    
    if (printDocumentBtn) printDocumentBtn.addEventListener('click', () => {
        const contentToPrint = viewerContent.innerHTML;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>${viewerTitle.textContent}</title></head><body>${contentToPrint}</body></html>`);
        printWindow.document.close();
        printWindow.print();
    });

    // --- Inicialização ---
    loadPageData();
});