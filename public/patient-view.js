// VERSÃO COMPLETA E CORRIGIDA (1 de 2)

document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    // [CORREÇÃO] Garantindo que sempre lemos 'patientId' da URL.
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
            // Desabilita os botões se não houver ID
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
            // Atualiza os links de ação com o ID do paciente
            updateActionLinks(patientId);

            // Busca o histórico de evoluções e receitas em paralelo
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
            
            renderHistory(combinedHistory);

        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
            patientNameHeader.textContent = "Erro ao carregar dados";
            historyList.innerHTML = `<p style="color: red;">Não foi possível carregar o histórico. Detalhe: ${error.message}</p>`;
        }
    }

    // Função para atualizar o cabeçalho com os dados do paciente
    function updateHeaders(patient) {
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
        
        // As informações de HPP e HD podem vir do objeto 'history' da tabela de admissão.
        // Por enquanto, deixaremos como estava, buscando da tabela 'patients'.
        if (patient.hpp) patientHpp.textContent = patient.hpp;
        if (patient.hd) patientHd.textContent = patient.hd;
    }

    // Função para criar os links corretos e consistentes
    function updateActionLinks(pId) {
        // [CORREÇÃO] Ambos os links agora usam 'patientId', garantindo consistência.
        if (goToEvolutionBtn) goToEvolutionBtn.href = `patient-evolution.html?patientId=${pId}`;
        if (goToPrescriptionBtn) goToPrescriptionBtn.href = `receita.html?patientId=${pId}`; 
    }

    // Função para renderizar o histórico na tela
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

    // Função para abrir o modal de visualização
    function openHistoryViewer(item) {
        viewerTitle.textContent = `Visualizar ${item.type}`;
        
        let contentHtml = '';
        if (item.type === 'Receituário') {
            contentHtml = `
                <h4>Medicamento</h4><p>${item.medicamento}</p>
                <h4>Posologia</h4><p>${item.posologia}</p>
                <h4>Via de Administração</h4><p>${item.via_administracao || 'N/A'}</p>
                <h4>Quantidade</h4><p>${item.quantidade || 'N/A'}</p>
                <br><small>Emitido em: ${new Date(item.created_at).toLocaleString('pt-BR')}</small>
            `;
        } else if (item.type === 'Evolução Médica') {
            // Aqui você pode montar um HTML formatado para a evolução
            // Por enquanto, vamos exibir o JSON bruto para visualização
            contentHtml = `<pre>${JSON.stringify(item.content, null, 2)}</pre>`;
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
    
    if (printDocumentBtn) {
        printDocumentBtn.addEventListener('click', () => {
            const contentToPrint = viewerContent.innerHTML;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>${viewerTitle.textContent}</title>
                        <link rel="stylesheet" href="patient-view-style.css">
                    </head>
                    <body>
                        <div class="print-header"><h3>${viewerTitle.textContent}</h3></div>
                        ${contentToPrint}
                    </body>
                </html>`
            );
            printWindow.document.close();
            setTimeout(() => { printWindow.print(); }, 500);
        });
    }

    // --- Inicialização ---
    loadPageData();
});