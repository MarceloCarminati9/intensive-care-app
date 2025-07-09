document.addEventListener('DOMContentLoaded', function() {
    
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('id');

    // Elementos da Página
    const patientNameHeader = document.getElementById('patientNameHeader');
    const patientDetailsHeader = document.getElementById('patientDetailsHeader');
    const historyList = document.getElementById('historyList');
    
    // Links de Ação Rápida
    const goToEvolutionBtn = document.getElementById('goToEvolutionBtn');
    const goToPrescriptionBtn = document.getElementById('goToPrescriptionBtn');
    // Adicionaremos os outros botões no futuro
    
    // Elementos do Modal Visualizador
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    const printDocumentBtn = document.getElementById('printDocumentBtn');

    let patient = null;

    if (!patientId) {
        patientNameHeader.textContent = "ID do Paciente não encontrado na URL.";
        return;
    }

    async function loadPatientAndHistory() {
        try {
            // Usando o caminho relativo para a API
            const response = await fetch(`/api/patients/${patientId}`);
            if (!response.ok) {
                throw new Error("Não foi possível carregar os dados do paciente.");
            }
            const result = await response.json();
            patient = result.data;

            patientNameHeader.textContent = patient.name;
            patientDetailsHeader.textContent = `Leito ${patient.bedNumber || 'N/A'} - ${patient.age || 'N/A'} anos - CNS: ${patient.cns || 'N/A'}`;

            renderHistory();
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            document.querySelector('main').innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    function renderHistory() {
        historyList.innerHTML = '';
        if (!patient.history || patient.history.length === 0) {
            historyList.innerHTML = '<p>Nenhum histórico encontrado.</p>';
            return;
        }
        patient.history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        patient.history.forEach(item => {
            const date = new Date(item.timestamp);
            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const historyItemDiv = document.createElement('div');
            historyItemDiv.className = 'history-item';
            historyItemDiv.dataset.timestamp = item.timestamp;
            historyItemDiv.innerHTML = `<div class="history-item-header"><strong>${item.type}</strong> - ${formattedDate} às ${formattedTime}</div>`;
            historyList.appendChild(historyItemDiv);
        });
    }

    function openHistoryViewer(data) {
        historyViewerModal.classList.add('active');
        viewerTitle.textContent = `Visualizar ${data.type}`;
        // A lógica para exibir o conteúdo da receita será adicionada quando a criarmos
        viewerContent.innerHTML = `<p>Visualização para ${data.type} de ${new Date(data.timestamp).toLocaleDateString('pt-BR')}.</p>`;
    }

    // --- Lógica de Eventos ---

    historyList.addEventListener('click', function(event) {
        const clickedItem = event.target.closest('.history-item');
        if (clickedItem && clickedItem.dataset.timestamp) {
            const historyData = patient.history.find(item => item.timestamp === clickedItem.dataset.timestamp);
            if (historyData) {
                openHistoryViewer(historyData);
            }
        }
    });

    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));
    if (printDocumentBtn) printDocumentBtn.addEventListener('click', () => window.print());

    // --- Lógica de Navegação ---
    if (goToEvolutionBtn) {
        goToEvolutionBtn.addEventListener('click', function(event) {
            event.preventDefault();
            window.location.href = `patient-evolution.html?id=${patientId}`;
        });
    }
    
    // ATIVANDO O LINK PARA A PÁGINA DE RECEITAS
    if (goToPrescriptionBtn) {
        goToPrescriptionBtn.addEventListener('click', function(event) {
            event.preventDefault();
            window.location.href = `patient-prescription.html?id=${patientId}`;
        });
    }

    // --- Inicialização ---
    loadPatientAndHistory();
});