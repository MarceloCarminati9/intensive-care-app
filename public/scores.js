document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');
    const resultBox = document.getElementById('resultBox');
    const resultText = document.getElementById('resultText');
    const resultTitle = document.getElementById('resultTitle');
    const subResult = document.getElementById('subResult');

    // Tab functionality
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const activeTabContent = document.getElementById(tab.dataset.tab);
            if (activeTabContent) {
                activeTabContent.classList.add('active');
            }
            resultBox.style.display = 'none';
        });
    });

    // --- SIRS / Sepsis Criteria Logic (NOVO) ---
    const sepsisForm = document.getElementById('sepsisForm');
    if (sepsisForm) {
        sepsisForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(e.target);
            let sirsCount = 0;
            const criteriaMet = [];

            const temp = parseFloat(data.get('temp'));
            const hr = parseInt(data.get('hr'));
            const rr = parseInt(data.get('rr'));
            const wbc = parseFloat(data.get('wbc'));
            
            if (temp > 38 || temp < 36) { sirsCount++; criteriaMet.push("Temperatura"); }
            if (hr > 90) { sirsCount++; criteriaMet.push("Frequência Cardíaca"); }
            if (rr > 20) { sirsCount++; criteriaMet.push("Frequência Respiratória"); }
            if (wbc > 12 || wbc < 4) { sirsCount++; criteriaMet.push("Leucócitos"); }

            const hasInfection = data.get('infection') === 'yes';
            const hasOrganDysfunction = data.get('organ_dysfunction') === 'yes';
            const isRefractoryHypotension = data.get('refractory_hypotension') === 'yes';

            let diagnosis = "Critérios para SIRS não preenchidos";
            const isSirsPositive = sirsCount >= 2;

            if (isSirsPositive) {
                if (hasInfection) {
                    if (hasOrganDysfunction) {
                        if (isRefractoryHypotension) {
                            diagnosis = "Choque Séptico";
                        } else {
                            diagnosis = "Sepse Grave";
                        }
                    } else {
                        diagnosis = "Sepse";
                    }
                } else {
                    diagnosis = "SIRS";
                }
            }
            
            resultTitle.textContent = "Resultado da Avaliação";
            resultText.innerHTML = diagnosis;
            subResult.textContent = `Critérios de SIRS preenchidos: ${sirsCount} de 4. (${criteriaMet.join(', ') || 'Nenhum'})`;
            resultBox.style.display = 'block';
        });

        const organDysfunctionSelect = document.querySelector('select[name="organ_dysfunction"]');
        const shockQuestionDiv = document.getElementById('shock_question');
        if (organDysfunctionSelect && shockQuestionDiv) {
            organDysfunctionSelect.addEventListener('change', (e) => {
                if (e.target.value === 'yes') {
                    shockQuestionDiv.style.display = 'block';
                } else {
                    shockQuestionDiv.style.display = 'none';
                }
            });
        }
    }

    // --- SOFA Score Logic (sem alterações) ---
    const sofaForm = document.getElementById('sofaForm');
    if (sofaForm) {
        sofaForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(e.target);
            let score = 0;
            const pao2_fio2 = parseFloat(data.get('pao2_fio2')), platelets = parseFloat(data.get('platelets')), bilirubin = parseFloat(data.get('bilirubin')), map = parseFloat(data.get('map')), vasopressors = parseInt(data.get('vasopressors')), gcs = parseInt(data.get('gcs')), creatinine = parseFloat(data.get('creatinine')), urine_output = parseFloat(data.get('urine_output'));
            if (pao2_fio2 < 100) score += 4; else if (pao2_fio2 < 200) score += 3; else if (pao2_fio2 < 300) score += 2; else if (pao2_fio2 < 400) score += 1;
            if (platelets < 20) score += 4; else if (platelets < 50) score += 3; else if (platelets < 100) score += 2; else if (platelets < 150) score += 1;
            if (bilirubin >= 12.0) score += 4; else if (bilirubin >= 6.0) score += 3; else if (bilirubin >= 2.0) score += 2; else if (bilirubin >= 1.2) score += 1;
            if (vasopressors === 3) score += 4; else if (vasopressors === 2) score += 3; else if (vasopressors === 1) score += 2; else if (map < 70) score += 1;
            if (gcs < 6) score += 4; else if (gcs <= 9) score += 3; else if (gcs <= 12) score += 2; else if (gcs <= 14) score += 1;
            if (creatinine >= 5.0 || urine_output < 200) score += 4; else if (creatinine >= 3.5 || urine_output < 500) score += 3; else if (creatinine >= 2.0) score += 2; else if (creatinine >= 1.2) score += 1;
            resultTitle.textContent = "SOFA Score";
            resultText.innerHTML = score;
            subResult.textContent = `Mortalidade aproximada: ${score > 11 ? '>80%' : (score > 9 ? '~50%' : (score > 7 ? '~33%' : '<10%'))}`;
            resultBox.style.display = 'block';
        });
    }
    
    // --- APACHE II Score Logic (sem alterações) ---
    const apacheForm = document.getElementById('apacheForm');
    if (apacheForm) {
        apacheForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = new FormData(e.target);
            let score = 0;
            const getPoints = (v, r) => { for (const i of r) { if ((i.min === -Infinity || v >= i.min) && (i.max === Infinity || v <= i.max)) return i.points; } return 0; };
            score += getPoints(parseInt(data.get('age')), [{min: -Infinity, max: 44, points: 0}, {min: 45, max: 54, points: 2}, {min: 55, max: 64, points: 3}, {min: 65, max: 74, points: 5}, {min: 75, max: Infinity, points: 6}]);
            score += (15 - parseInt(data.get('gcs')));
            score += getPoints(parseFloat(data.get('temp')), [{min: 38.5, max: 38.9, points: 1}, {min: 39, max: Infinity, points: 3}, {min: 36, max: 38.4, points: 0}, {min: 34, max: 35.9, points: 1}, {min: 32, max: 33.9, points: 2}, {min: 30, max: 31.9, points: 3}, {min: -Infinity, max: 29.9, points: 4}]);
            score += getPoints(parseFloat(data.get('map')), [{min: 160, max: Infinity, points: 4}, {min: 130, max: 159, points: 3}, {min: 110, max: 129, points: 2}, {min: 70, max: 109, points: 0}, {min: 50, max: 69, points: 2}, {min: -Infinity, max: 49, points: 4}]);
            score += getPoints(parseFloat(data.get('hr')), [{min: 180, max: Infinity, points: 4}, {min: 140, max: 179, points: 3}, {min: 110, max: 139, points: 2}, {min: 70, max: 109, points: 0}, {min: 55, max: 69, points: 2}, {min: 40, max: 54, points: 3}, {min: -Infinity, max: 39, points: 4}]);
            score += getPoints(parseFloat(data.get('rr')), [{min: 50, max: Infinity, points: 4}, {min: 35, max: 49, points: 3}, {min: 25, max: 34, points: 1}, {min: 12, max: 24, points: 0}, {min: 10, max: 11, points: 1}, {min: 6, max: 9, points: 2}, {min: -Infinity, max: 5, points: 4}]);
            let creatininePoints = getPoints(parseFloat(data.get('creatinine')), [{min: 3.5, max: Infinity, points: 4}, {min: 2.0, max: 3.4, points: 3}, {min: 1.5, max: 1.9, points: 2}, {min: 0.6, max: 1.4, points: 0}, {min: -Infinity, max: 0.5, points: 2}]);
            if (data.get('arf') === 'yes') { creatininePoints *= 2; } score += creatininePoints;
            const chronic = data.get('chronic_health'); if (chronic === 'non_op_emergency') score += 5; else if (chronic === 'elective_post_op') score += 2;
            const logit = -3.517 + (score * 0.146); const mortality = (1 / (1 + Math.exp(-logit))) * 100;
            resultTitle.textContent = "APACHE II Score";
            resultText.innerHTML = score;
            subResult.textContent = `Mortalidade hospitalar estimada: ${mortality.toFixed(1)}%`;
            resultBox.style.display = 'block';
        });
    }

    // --- SAPS 3 Score Logic (sem alterações) ---
    const saps3Form = document.getElementById('saps3Form');
    if (saps3Form) {
        saps3Form.addEventListener('submit', (e) => {
            e.preventDefault();
            let score = 0;
            const data = new FormData(e.target);
            const age = parseInt(data.get('s3_age')); if (age >= 85) score += 17; else if (age >= 80) score += 15; else if (age >= 75) score += 13; else if (age >= 70) score += 11; else if (age >= 60) score += 8; else if (age >= 40) score += 5;
            const comorbidities = parseInt(data.get('s3_comorbidities')); if (comorbidities === 1) score += 10; else if (comorbidities === 2) score += 10; else if (comorbidities === 3) score += 17;
            if (data.get('s3_location') === 'other') score += 8;
            const admissionReason = data.get('s3_admission_reason'); if (admissionReason === 'gastro') score += 10; else if (admissionReason === 'resp') score += 6;
            const surgical = data.get('s3_surgical'); if (surgical === 'unscheduled') score += 8; else if (surgical === 'scheduled') score += 6;
            if (data.get('s3_vasoactives') === 'yes') score += 8;
            const gcs = parseInt(data.get('s3_gcs')); if (gcs === 3) score += 26; else if (gcs <= 5) score += 16; else if (gcs <= 8) score += 9;
            const sbp = parseInt(data.get('s3_sbp')); if (sbp < 45) score += 18; else if (sbp < 65) score += 13; else if (sbp >= 195) score += 10;
            const hr = parseInt(data.get('s3_hr')); if (hr < 30) score += 11; else if (hr >= 160) score += 8;
            const temp = parseFloat(data.get('s3_temp')); if (temp < 33) score += 15;
            const pao2_fio2_s3 = parseFloat(data.get('s3_pao2_fio2')); if (pao2_fio2_s3 < 50) score += 15; else if (pao2_fio2_s3 < 150) score += 8;
            const wbc = parseFloat(data.get('s3_wbc')); if (wbc < 1.5) score += 14;
            const platelets_s3 = parseFloat(data.get('s3_platelets')); if (platelets_s3 < 25) score += 14; else if (platelets_s3 < 75) score += 6;
            const creatinine_s3 = parseFloat(data.get('s3_creatinine')); if (creatinine_s3 >= 3.0) score += 7;
            const bilirubin_s3 = parseFloat(data.get('s3_bilirubin')); if (bilirubin_s3 >= 6.0) score += 7;
            const ph = parseFloat(data.get('s3_ph')); if (ph < 7.15) score += 13;
            const logit = -23.6395 + (Math.log(score + 1) * 4.4955); const mortality = (1 / (1 + Math.exp(-logit))) * 100;
            resultTitle.textContent = "SAPS 3 Score";
            resultText.innerHTML = score;
            subResult.textContent = `Mortalidade hospitalar estimada (modelo América do Sul): ${mortality.toFixed(1)}%`;
            resultBox.style.display = 'block';
        });
    }
});