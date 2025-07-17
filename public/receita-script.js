document.addEventListener('DOMContentLoaded', function() {

    // --- Seleção dos Elementos do Formulário ---
    const form = document.getElementById('receitaForm');
    const patientNameDisplay = document.getElementById('patientName');
    const patientIdInput = document.getElementById('patientId'); // Input escondido para guardar o ID

    // --- Elementos dos campos da receita ---
    const medicamentoInput = document.getElementById('medicamento');
    const posologiaInput = document.getElementById('posologia');
    const viaInput = document.getElementById('via');
    const quantidadeInput = document.getElementById('quantidade');
    const submitButton = form.querySelector('button[type="submit"]');

    // Pega o ID do paciente da URL
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');

    // Função para carregar o nome do paciente ao abrir a página
    async function loadPatientInfo() {
        if (!patientId) {
            patientNameDisplay.textContent = 'ERRO: ID do Paciente não fornecido na URL.';
            patientNameDisplay.style.color = 'red';
            submitButton.disabled = true; // Desabilita o botão se não houver paciente
            return;
        }

        try {
            const response = await fetch(`/api/patients/${patientId}`);
            if (!response.ok) {
                throw new Error('Não foi possível encontrar o paciente.');
            }
            const result = await response.json();
            const patient = result.data;

            // Exibe o nome do paciente e armazena o ID no formulário
            patientNameDisplay.textContent = patient.name;
            patientIdInput.value = patientId;

        } catch (error) {
            console.error('Erro ao carregar informações do paciente:', error);
            patientNameDisplay.textContent = 'Erro ao carregar paciente.';
            patientNameDisplay.style.color = 'red';
            submitButton.disabled = true;
        }
    }

    // Função para lidar com o envio do formulário
    // CÓDIGO CORRIGIDO PARA O ARQUIVO: receita-script.js

form.addEventListener('submit', async function(event) {
    event.preventDefault(); // Impede que a página recarregue

    const data = {
        patient_id: patientIdInput.value,
        medicamento: medicamentoInput.value.trim(),
        posologia: posologiaInput.value.trim(),
        via: viaInput.value.trim(),
        quantidade: quantidadeInput.value.trim()
    };

    // Validação simples
    if (!data.patient_id || !data.medicamento || !data.posologia) {
        alert('Por favor, preencha todos os campos obrigatórios (Medicamento e Posologia).');
        return;
    }

    try {
        // ===== CORREÇÃO APLICADA AQUI =====
        // Alterado o endpoint de "/api/prescriptions" para a nova rota "/api/recipes"
        const response = await fetch('/api/recipes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        // ===== FIM DA CORREÇÃO =====

        const result = await response.json();

        if (!response.ok) {
            // Lança um erro se o backend retornar uma falha
            throw new Error(result.error || 'Falha no servidor ao salvar a receita.');
        }

        alert('Receita salva com sucesso!');
        // Redireciona de volta para a página de visualização do paciente
        window.location.href = `patient-view.html?patientId=${data.patient_id}`;

    } catch (error) {
        console.error('Erro ao enviar receita:', error);
        alert(`Erro: ${error.message}`);
    }
});

    // --- Inicialização ---
    // Chama a função para carregar os dados assim que a página estiver pronta
    loadPatientInfo();
});