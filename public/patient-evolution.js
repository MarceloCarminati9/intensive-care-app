document.addEventListener('DOMContentLoaded', function() {
    
    // =================================================================================
    // INICIALIZAÇÃO E SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('id');

    const patientNameHeader = document.getElementById('patientNameHeader');
    const backToPatientViewLink = document.getElementById('backToPatientViewLink');
    const evolutionHistoryList = document.getElementById('evolutionHistoryList');
    const evolutionForm = document.getElementById('evolutionForm');
    const formTitle = document.getElementById('formTitle');
    const saveButton = document.getElementById('saveEvolutionButton');
    const cancelEditButton = document.getElementById('cancelEditButton');

    const printConfirmModal = document.getElementById('printConfirmModal');
    const printConfirmYes = document.getElementById('printConfirmYes');
    const printConfirmNo = document.getElementById('printConfirmNo');
    
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    const printDocumentBtn = document.getElementById('printDocumentBtn');
    
    let patient = null;
    let editingTimestamp = null;
    let lastSavedEvolution = null;

    if (!patientId) {
        patientNameHeader.textContent = "ID do Paciente não encontrado na URL.";
        return;
    }
    
    // =================================================================================
    // FUNÇÕES AUXILIARES DE FORMULÁRIO
    // =================================================================================
    const getCheckedValues = (name) => Array.from(evolutionForm.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
    const getRadioValue = (name) => evolutionForm.querySelector(`input[name="${name}"]:checked`)?.value || '';

    const setRadioValue = (name, value) => {
        if (value === undefined || value === null) return;
        const radio = evolutionForm.querySelector(`input[name="${name}"][value="${value}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };
    
    const setCheckboxValues = (name, values) => {
        evolutionForm.querySelectorAll(`input[name="${name}"]`).forEach(cb => cb.checked = false);
        if (!values || !Array.isArray(values)) return;
        values.forEach(value => {
            const cb = evolutionForm.querySelector(`input[name="${name}"][value="${value}"]`);
            if (cb) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };

    // =================================================================================
    // LÓGICA DE DADOS E RENDERIZAÇÃO
    // =================================================================================

    async function loadPatientAndHistory() {
        try {
            const response = await fetch(`/api/patients/${patientId}`);
            if (!response.ok) {
                throw new Error("Não foi possível carregar os dados do paciente.");
            }
            const result = await response.json();
            patient = result.data;

            patientNameHeader.textContent = patient.name;
            backToPatientViewLink.href = `patient-view.html?id=${patientId}`;
            
            renderEvolutionHistory();
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            document.querySelector('main').innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    function renderEvolutionHistory() {
        evolutionHistoryList.innerHTML = '';
        const evolutions = patient.history?.filter(item => item.type === 'Evolução Médica').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) || [];

        if (evolutions.length === 0) {
            evolutionHistoryList.innerHTML = '<p>Nenhuma evolução anterior encontrada para este paciente.</p>';
            return;
        }

        evolutions.forEach(evo => {
            const date = new Date(evo.timestamp);
            const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const previewText = evo.impressao24h ? evo.impressao24h.substring(0, 200) + (evo.impressao24h.length > 200 ? '...' : '') : 'Sem resumo.';

            const historyItemDiv = document.createElement('div');
            historyItemDiv.className = 'history-item';
            historyItemDiv.innerHTML = `
                <div class="history-item-header">
                    <span><strong>Evolução de ${formattedDate} às ${formattedTime}</strong></span>
                    <div class="history-item-actions">
                        <button type="button" class="button-secondary" data-action="print" data-timestamp="${evo.timestamp}">Visualizar/Imprimir</button>
                        <button type="button" class="button-secondary" data-action="edit" data-timestamp="${evo.timestamp}">Editar</button>
                        <button type="button" class="button-secondary" data-action="copy" data-timestamp="${evo.timestamp}">Copiar</button>
                        <button type="button" class="button-danger" data-action="delete" data-timestamp="${evo.timestamp}">Excluir</button>
                    </div>
                </div>
                <div class="history-item-preview">${previewText}</div>
            `;
            evolutionHistoryList.appendChild(historyItemDiv);
        });
    }

    function openHistoryViewer(data) {
        viewerTitle.textContent = `Evolução Médica - ${new Date(data.timestamp).toLocaleDateString('pt-BR')}`;
        
        const ef = data.exameFisico || {};
        const vent = data.suporteVentilatorio || {};
        const bh = data.balancoHidrico || {};
        const glasgowTotal = (parseInt(ef.glasgow_ocular) || 0) + (parseInt(ef.glasgow_verbal) || 0) + (parseInt(ef.glasgow_motor) || 0);

        viewerContent.innerHTML = `
            <div class="print-header">
                <h3>EVOLUÇÃO MÉDICA DIÁRIA</h3>
                <p><strong>Paciente:</strong> ${patient.name}</p>
                <p><strong>Data:</strong> ${new Date(data.timestamp).toLocaleString('pt-BR')}</p>
            </div>
            <div class="print-container">
                <div class="print-column">
                    <div class="print-section"><h4>Impressão das Últimas 24h</h4><p>${data.impressao24h || 'N/A'}</p></div>
                    <div class="print-section"><h4>Exame Físico</h4>
                        <p><strong>Neurológico:</strong> ${ef.glasgow_na ? 'N/A' : `Glasgow ${glasgowTotal} (O:${ef.glasgow_ocular} V:${ef.glasgow_verbal} M:${ef.glasgow_motor})`}. RASS: ${ef.rass_na ? 'N/A' : ef.rass}. Pupilas ${ef.pupilas_tamanho} e ${ef.pupilas_reatividade}.</p>
                        <p><strong>Respiratório:</strong> FR: ${ef.fr || 'N/A'}rpm. Ausculta: ${[...(ef.ap_base || []), ...(ef.ap_achados || [])].join(', ')}.</p>
                        <p><strong>Cardiovascular:</strong> Ausculta: ${ef.ac.join(', ')}. Pulsos ${[...(ef.pulso_amp || []), ...(ef.pulso_ritmo || [])].join('/')}. TEC: ${ef.tec}s.</p>
                        <p><strong>Abdome:</strong> ${ef.abd.join(', ')}.</p>
                        <p><strong>Outros:</strong> ${ef.exameFisicoOutros || 'N/A'}</p>
                    </div>
                     <div class="print-section"><h4>Diurese e Balanço Hídrico</h4><p>Diurese: ${bh.diurese}mL, BH: ${bh.bh}mL, Diálise: ${bh.dialise}.</p></div>
                </div>
                <div class="print-column">
                    <div class="print-section"><h4>Suporte Ventilatório</h4><p>${vent.tipo || 'N/A'} ${vent.tipo === 'CN' ? `(${vent.cn_lpm} L/min)` : ''} ${vent.tipo === 'VMI' ? `(Modo:${vent.vm_modo}, FiO2:${vent.vm_fio2}%, PEEP:${vent.vm_peep})` : ''}</p></div>
                    <div class="print-section"><h4>Drogas Vasoativas</h4><p>${data.drogas || 'N/A'}</p></div>
                    <div class="print-section"><h4>Sedoanalgesia</h4><p>${data.sedoanalgesia || 'N/A'}</p></div>
                    <div class="print-section"><h4>Antibioticoterapia</h4><p>${data.antibioticos || 'N/A'}</p></div>
                    <div class="print-section"><h4>Dieta</h4><p>${data.dieta || 'N/A'}</p></div>
                    <div class="print-section"><h4>Pendências e Condutas</h4>
                        <p><strong>Pendências:</strong> ${data.pendencias || 'N/A'}</p>
                        <p><strong>Condutas:</strong> ${data.condutas || 'N/A'}</p>
                    </div>
                </div>
            </div>
        `;
        historyViewerModal.classList.add('active');
    }

    // =================================================================================
    // LÓGICA DE COLETA E PREENCHIMENTO DO FORMULÁRIO
    // =================================================================================
    function collectFormData() {
        const formData = new FormData(evolutionForm);
        const data = {};
        for(const [key, value] of formData.entries()) {
            if (data[key]) {
                if (!Array.isArray(data[key])) data[key] = [data[key]];
                data[key].push(value);
            } else {
                data[key] = value;
            }
        }
        
        return {
            type: 'Evolução Médica',
            timestamp: editingTimestamp || new Date().toISOString(),
            impressao24h: data.impressao24h,
            exameFisico: {
                glasgow_na: data.glasgow_na === 'on', glasgow_ocular: data.glasgow_ocular, glasgow_verbal: data.glasgow_verbal, glasgow_motor: data.glasgow_motor,
                rass: data.rass, rass_na: data.rass_na === 'on',
                camicu: data.camicu, camicu_na: data.camicu_na === 'on',
                nihss: data.nihss, nihss_na: data.nihss_na === 'on',
                pupilas_tamanho: data.pupilas_tamanho, pupila_esq: data.pupila_esq, pupila_dir: data.pupila_dir, pupilas_reatividade: data.pupilas_reatividade,
                ap_base: data.ap_base ? (Array.isArray(data.ap_base) ? data.ap_base : [data.ap_base]) : [],
                ap_achados: data.ap_achados ? (Array.isArray(data.ap_achados) ? data.ap_achados : [data.ap_achados]) : [],
                ap_local: data.ap_local,
                fr: data.fr,
                ac: data.ac ? (Array.isArray(data.ac) ? data.ac : [data.ac]) : [],
                ac_outro_text: data.ac_outro_text,
                pulso_amp: data.pulso_amp ? (Array.isArray(data.pulso_amp) ? data.pulso_amp : [data.pulso_amp]) : [],
                pulso_ritmo: data.pulso_ritmo ? (Array.isArray(data.pulso_ritmo) ? data.pulso_ritmo : [data.pulso_ritmo]) : [],
                tec: data.tec,
                abd: data.abd ? (Array.isArray(data.abd) ? data.abd : [data.abd]) : [],
                exameFisicoOutros: data.exameFisicoOutros
            },
            suporteVentilatorio: {
                tipo: data.ventilacao, cn_lpm: data.cn_lpm, vm_modo: data.vm_modo, vm_fio2: data.vm_fio2, vm_peep: data.vm_peep, vm_vt: data.vm_vt, vm_psup: data.vm_psup, vm_fr: data.vm_fr, vm_ppico: data.vm_ppico, vm_dp: data.vm_dp
            },
            balancoHidrico: {
                diurese: data.diurese, bh: data.balancoHidrico, dialise: data.dialise, uf: data.dialise_uf
            },
            drogas: data.drogas, sedoanalgesia: data.sedoanalgesia, antibioticos: data.antibioticos, culturas: data.culturas, dispositivos: data.dispositivos, imagem: data.imagem, pareceres: data.pareceres, pendencias: data.pendencias, condutas: data.condutas, dieta: data.dieta
        };
    }

    function populateForm(data) {
        evolutionForm.reset();
        const setTextValue = (name, value) => { if (evolutionForm[name]) evolutionForm[name].value = value || ''; };
        const setChecked = (id, value) => { if (document.getElementById(id)) document.getElementById(id).checked = value; };

        setTextValue('impressao24h', data.impressao24h);
        if (data.exameFisico) {
            const ef = data.exameFisico;
            setChecked('glasgow_na', ef.glasgow_na); setTextValue('glasgow_ocular', ef.glasgow_ocular); setTextValue('glasgow_verbal', ef.glasgow_verbal); setTextValue('glasgow_motor', ef.glasgow_motor);
            setTextValue('rass', ef.rass); setChecked('rass_na', ef.rass_na);
            setRadioValue('camicu', ef.camicu); setChecked('camicu_na', ef.camicu_na);
            setTextValue('nihss', ef.nihss); setChecked('nihss_na', ef.nihss_na);
            setRadioValue('pupilas_tamanho', ef.pupilas_tamanho); setTextValue('pupila_esq', ef.pupila_esq); setTextValue('pupila_dir', ef.pupila_dir); setRadioValue('pupilas_reatividade', ef.pupilas_reatividade);
            setRadioValue('ap_local', ef.ap_local);
            setTextValue('fr', ef.fr);
            setTextValue('ac_outro_text', ef.ac_outro_text);
            setTextValue('tec', ef.tec);
            setTextValue('exameFisicoOutros', ef.exameFisicoOutros);
            setCheckboxValues('ap_base', ef.ap_base);
            setCheckboxValues('ap_achados', ef.ap_achados);
            setCheckboxValues('ac', ef.ac);
            setCheckboxValues('pulso_amp', ef.pulso_amp);
            setCheckboxValues('pulso_ritmo', ef.pulso_ritmo);
            setCheckboxValues('abd', ef.abd);
        }
        if (data.suporteVentilatorio) {
             setRadioValue('ventilacao', data.suporteVentilatorio.tipo);
             Object.keys(data.suporteVentilatorio).forEach(key => setTextValue(key, data.suporteVentilatorio[key]));
        }
        if (data.balancoHidrico) {
            setTextValue('diurese', data.balancoHidrico.diurese);
            setTextValue('balancoHidrico', data.balancoHidrico.bh);
            setRadioValue('dialise', data.balancoHidrico.dialise);
            setTextValue('dialise_uf', data.balancoHidrico.uf);
        }
        setTextValue('drogas', data.drogas); setTextValue('sedoanalgesia', data.sedoanalgesia); setTextValue('antibioticos', data.antibioticos); setTextValue('culturas', data.culturas); setTextValue('dispositivos', data.dispositivos); setTextValue('imagem', data.imagem); setTextValue('pareceres', data.pareceres); setTextValue('pendencias', data.pendencias); setTextValue('condutas', data.condutas); setTextValue('dieta', data.dieta);
        
        evolutionForm.querySelectorAll('input[type="checkbox"], input[type="radio"], select').forEach(el => el.dispatchEvent(new Event('change')));
    }

    // =================================================================================
    // LÓGICA DE EVENTOS E UI
    // =================================================================================
    function resetFormAndState() {
        evolutionForm.reset();
        editingTimestamp = null;
        formTitle.textContent = "Nova Evolução Médica";
        saveButton.textContent = "Salvar Nova Evolução";
        cancelEditButton.classList.add('hidden');
        evolutionForm.querySelectorAll('input[type="checkbox"], input[type="radio"], select').forEach(el => {
            if(el.type === 'radio' && el.defaultChecked) el.checked = true;
            el.dispatchEvent(new Event('change'));
        });
    }

    function setupAllEventListeners() {
        evolutionForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const evolutionData = collectFormData();
            
            try {
                const response = await fetch(`/api/patients/${patientId}/evolutions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(evolutionData),
                });
                if (!response.ok) throw new Error('Falha ao salvar evolução.');
                lastSavedEvolution = await response.json();
                await loadPatientAndHistory();
                resetFormAndState();
                printConfirmModal.classList.add('active');
            } catch (error) {
                console.error("Erro ao salvar:", error);
                alert("Não foi possível salvar a evolução.");
            }
        });

        cancelEditButton.addEventListener('click', resetFormAndState);

        evolutionHistoryList.addEventListener('click', async function(event) {
            const button = event.target.closest('button[data-action]');
            if (!button) return;
            const action = button.dataset.action;
            const timestamp = button.dataset.timestamp;
            const data = patient.history.find(item => item.timestamp === timestamp);
            if (!data) return;

            if (action === 'edit') {
                populateForm(data);
                editingTimestamp = data.timestamp;
                formTitle.textContent = `Editando Evolução de ${new Date(timestamp).toLocaleDateString('pt-BR')}`;
                saveButton.textContent = "Atualizar Evolução";
                cancelEditButton.classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (action === 'delete') {
                if (confirm('Tem certeza que deseja excluir esta evolução?')) {
                    try {
                        const response = await fetch(`/api/patients/${patientId}/evolutions/${timestamp}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error('Falha ao deletar no servidor.');
                        await loadPatientAndHistory();
                    } catch (error) {
                        alert("Erro ao deletar evolução.");
                    }
                }
            } else if (action === 'copy') {
                resetFormAndState();
                populateForm(data);
                alert('Dados copiados. Salve para criar uma nova evolução.');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (action === 'print') {
                openHistoryViewer(data);
                setTimeout(() => window.print(), 300);
            }
        });
        
        printConfirmYes.addEventListener('click', () => {
            if (lastSavedEvolution?.data) openHistoryViewer(lastSavedEvolution.data);
            setTimeout(() => window.print(), 300);
            printConfirmModal.classList.remove('active');
        });
        printConfirmNo.addEventListener('click', () => printConfirmModal.classList.remove('active'));
        if(closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));

        // UI Condicional do Formulário
        document.getElementById('glasgow_na').addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.getElementById('glasgow_details').querySelectorAll('select').forEach(i => { 
                i.disabled = isChecked; 
                if(isChecked) { i.value = '0'; i.dispatchEvent(new Event('change')); }
            });
        });
        document.getElementById('rass_na').addEventListener('change', (e) => { document.getElementById('rass').disabled = e.target.checked; if(e.target.checked) document.getElementById('rass').value = ''; });
        document.getElementById('nihss_na').addEventListener('change', (e) => { document.getElementById('nihss').disabled = e.target.checked; if(e.target.checked) document.getElementById('nihss').value = ''; });
        document.querySelectorAll('input[name="pupilas_tamanho"]').forEach(radio => radio.addEventListener('change', e => document.getElementById('anisocoria_details').classList.toggle('hidden', e.target.value !== 'Anisocóricas')));
        document.querySelectorAll('.ap_conditional_check').forEach(cb => cb.addEventListener('change', () => document.getElementById('ap_details').classList.toggle('hidden', !document.querySelector('.ap_conditional_check:checked'))));
        document.getElementById('ac_outro_check').addEventListener('change', (e) => document.getElementById('ac_outro_text').classList.toggle('hidden', !e.target.checked));
        document.querySelectorAll('input[name="dialise"]').forEach(radio => radio.addEventListener('change', e => document.querySelector('input[name="dialise_uf"]').classList.toggle('hidden', e.target.value !== 'Sim')));
        document.querySelectorAll('input[name="ventilacao"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.querySelectorAll('[data-ventilacao]').forEach(el => el.classList.add('hidden'));
                const optionsToShow = document.querySelector(`[data-ventilacao="${e.target.value}"]`);
                if(optionsToShow) optionsToShow.classList.remove('hidden');
            });
        });
        document.querySelectorAll('.glasgow-grid select').forEach(select => {
            select.addEventListener('change', () => {
                let total = 0;
                document.querySelectorAll('.glasgow-grid select').forEach(s => {
                    total += parseInt(s.value) || 0;
                });
                evolutionForm.glasgow_total.value = total > 0 ? total : '';
            });
        });
    }
    
    // =================================================================================
    // INICIALIZAÇÃO FINAL
    // =================================================================================
    loadPatientAndHistory();
    setupAllEventListeners();
});