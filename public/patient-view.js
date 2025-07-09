document.addEventListener('DOMContentLoaded', function() {
    // Pega o ID do paciente da URL. Usaremos 'patientId' para manter o padrão.
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');

    // --- Elementos da Página ---
    const patientNameHeader = document.getElementById('patientNameHeader');
    const patientDetailsHeader = document.getElementById('patientDetailsHeader');
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
            patientNameHeader.textContent = "ID do Paciente não encontrado na URL.";
            return;
        }

        try {
            // 1. Busca os dados principais do paciente
            const patientResponse = await fetch(`/api/patients/${patientId}`);
            if (!patientResponse.ok) throw new Error('Paciente não encontrado.');
            const patientResult = await patientResponse.json();
            const patient = patientResult.data;

            // 2. Atualiza os cabeçalhos e os links de ação com os dados do paciente
            updateHeaders(patient);
            updateActionLinks(patientId);

            // 3. Busca o histórico de evoluções e receitas em paralelo
            const [evolutionsResponse, prescriptionsResponse] = await Promise.all([
                fetch(`/api/patients/${patientId}/evolutions`),
                fetch(`/api/patients/${patientId}/prescriptions`) // Essa rota será criada no backend
            ]);

            const evolutionsResult = await evolutionsResponse.json();
            const prescriptionsResult = await prescriptionsResponse.json();

            // 4. Combina os históricos, adiciona um 'tipo' para cada um e renderiza
            const combinedHistory = [
                ...evolutionsResult.data.map(item => ({ ...item, type: 'Evolução Médica' })),
                ...prescriptionsResult.data.map(item => ({ ...item, type: 'Receituário' }))
            ];
            
            renderHistory(combinedHistory);

        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
            patientNameHeader.textContent = "Erro ao carregar dados";
            historyList.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    // Funções auxiliares para organizar o código
    function updateHeaders(patient) {
        patientNameHeader.textContent = patient.name;
        patientDetailsHeader.textContent = `Leito ${patient.bed_id || 'N/A'} - ${patient.age || 'N/A'} anos - CNS: ${patient.cns || 'N/A'}`;
    }

    function updateActionLinks(patientId) {
        // Atualiza o href dos botões para incluir o ID do paciente
        if (goToEvolutionBtn) {
            goToEvolutionBtn.href = `evolucao-medica.html?patientId=${patientId}`;
        }
        if (goToPrescriptionBtn) {
            // Corrigido para apontar para a página que criamos
            goToPrescriptionBtn.href = `receita.html?patientId=${patientId}`; 
        }
    }

    function renderHistory(history) {
        historyList.innerHTML = ''; // Limpa a lista
        if (!history || history.length === 0) {
            historyList.innerHTML = '<p>Nenhum histórico de evoluções ou receitas encontrado.</p>';
            return;
        }

        // Ordena o histórico combinado pela data de criação, do mais novo para o mais antigo
        history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        history.forEach(item => {
            const date = new Date(item.created_at);
            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const historyItemDiv = document.createElement('div');
            historyItemDiv.className = 'history-item';
            // Armazena os dados do item para uso no modal
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
        } else { // Para Evolução Médica e outros tipos
            // A lógica de visualização da evolução será implementada aqui no futuro
            contentHtml = `<pre>${item.content || 'Conteúdo não disponível.'}</pre>`;
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
    
    // ATENÇÃO: A função de impressão precisa ser mais elaborada para imprimir só o modal.
    // Esta é uma implementação simples.
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