// VERSÃO FINAL COM HISTÓRICO DE INTERNAÇÕES - 14/07/2025

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.DATABASE_URL) {
    console.error("ERRO CRÍTICO: A variável de ambiente DATABASE_URL não foi definida.");
    process.exit(1); 
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

const apiRouter = express.Router();

// --- ROTAS DE UNIDADES E LEITOS ---
// (Nenhuma alteração nesta seção)
apiRouter.get('/units', async (req, res) => {
    try {
        const sql = `
            SELECT u.id, u.name, u.total_beds, COUNT(b.id) FILTER (WHERE b.status = 'occupied') as occupied_beds
            FROM units u
            LEFT JOIN beds b ON u.id = b.unit_id
            GROUP BY u.id
            ORDER BY u.name;
        `;
        const { rows } = await pool.query(sql);
        res.json({ data: rows });
    } catch (err) {
        console.error("Erro em GET /units:", err);
        res.status(500).json({ error: 'Erro no servidor ao buscar unidades.' });
    }
});

apiRouter.post('/units', async (req, res) => {
    const { name, total_beds } = req.body;
    if (!name || !total_beds || total_beds <= 0) {
        return res.status(400).json({ error: 'Nome e número de leitos (maior que zero) são obrigatórios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const unitResult = await client.query('INSERT INTO units (name, total_beds) VALUES ($1, $2) RETURNING id', [name, total_beds]);
        const unitId = unitResult.rows[0].id;
        for (let i = 1; i <= total_beds; i++) {
            await client.query('INSERT INTO beds (unit_id, bed_number, status) VALUES ($1, $2, $3)', [unitId, String(i), 'free']);
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'Unidade e leitos criados com sucesso!', unitId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro em POST /units:", err);
        res.status(500).json({ error: 'Erro no servidor ao criar unidade.' });
    } finally {
        client.release();
    }
});

apiRouter.delete('/units/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Ao deletar uma unidade, as foreign keys na tabela 'admissions' para os leitos serão setadas para NULL
        await client.query('DELETE FROM beds WHERE unit_id = $1', [id]);
        await client.query('DELETE FROM units WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Unidade e leitos associados deletados com sucesso!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro em DELETE /units/:id:', err);
        res.status(500).json({ error: 'Erro no servidor ao deletar unidade.' });
    } finally {
        client.release();
    }
});

apiRouter.get('/units-with-free-beds', async (req, res) => {
    try {
        const sql = `
            SELECT
                u.id, u.name,
                json_agg(json_build_object('id', b.id, 'bed_number', b.bed_number)) 
                FILTER (WHERE b.id IS NOT NULL AND b.status = 'free') as free_beds
            FROM units u
            LEFT JOIN beds b ON u.id = b.unit_id
            GROUP BY u.id
            ORDER BY u.name;
        `;
        const { rows } = await pool.query(sql);
        res.json({ data: rows });
    } catch (err) {
        console.error("Erro em GET /units-with-free-beds:", err);
        res.status(500).json({ error: 'Erro no servidor ao buscar dados para transferência.' });
    }
});

apiRouter.get('/units/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Unidade não encontrada." });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error("Erro em GET /units/:id:", err);
        res.status(500).json({ error: 'Erro no servidor ao buscar unidade.' });
    }
});

apiRouter.get('/units/:id/beds', async (req, res) => {
    try {
        const sql = `SELECT id, bed_number, status, patient_id, patient_name FROM beds WHERE unit_id = $1 ORDER BY LENGTH(bed_number), bed_number ASC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        console.error("Erro em GET /units/:id/beds:", err);
        res.status(500).json({ error: 'Erro no servidor ao buscar leitos.' });
    }
});


// --- ROTAS DE PACIENTES (ATUALIZADAS PARA A NOVA ESTRUTURA) ---

// ATUALIZADO: Cadastrar um novo paciente
apiRouter.post('/patients', async (req, res) => {
    const { bed_id, name, mother_name, dob, cns, dih, hd_primary_desc, hd_primary_cid, secondary_diagnoses, hpp, allergies } = req.body;
    if (!bed_id || !name || !dob || !dih) { return res.status(400).json({ error: 'Dados essenciais (leito, nome, data de nascimento, data de internação) são obrigatórios.' }); }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Cria o registro permanente do paciente
        const patientSql = `INSERT INTO patients (name, mother_name, dob, cns, hpp, allergies, current_bed_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id;`;
        const patientParams = [name, mother_name, dob, cns, hpp, allergies, bed_id];
        const patientResult = await client.query(patientSql, patientParams);
        const newPatientId = patientResult.rows[0].id;

        // 2. Cria o primeiro registro de internação para este paciente
        const admissionSql = `
            INSERT INTO admissions (patient_id, bed_id, admission_date, hd_primary_desc, hd_primary_cid, secondary_diagnoses)
            VALUES ($1, $2, $3, $4, $5, $6);
        `;
        const admissionParams = [newPatientId, bed_id, dih, hd_primary_desc, hd_primary_cid, JSON.stringify(secondary_diagnoses || [])];
        await client.query(admissionSql, admissionParams);

        // 3. Ocupa o leito
        const bedSql = `UPDATE beds SET status = 'occupied', patient_id = $1, patient_name = $2 WHERE id = $3;`;
        await client.query(bedSql, [newPatientId, name, bed_id]);
        
        await client.query('COMMIT');
        res.status(201).json({ message: 'Paciente admitido com sucesso!', patientId: newPatientId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao admitir paciente:', err);
        res.status(500).json({ error: 'Erro no servidor ao admitir paciente.' });
    } finally {
        client.release();
    }
});

// ATUALIZADO: Buscar os dados de um paciente e sua ÚLTIMA internação
apiRouter.get('/patients/:id', async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.id, p.name, p.mother_name, p.dob, p.cns, p.hpp, p.allergies, p.current_bed_id,
                b.bed_number, 
                u.name as unit_name,
                a.admission_date as dih, -- Pega a data de internação da última admissão
                a.discharge_date,
                a.discharge_reason,
                a.hd_primary_desc,
                a.hd_primary_cid,
                a.secondary_diagnoses
            FROM 
                patients p
            LEFT JOIN (
                -- Subquery para encontrar a última admissão de cada paciente
                SELECT DISTINCT ON (patient_id) *
                FROM admissions
                ORDER BY patient_id, admission_date DESC
            ) a ON p.id = a.patient_id
            LEFT JOIN beds b ON p.current_bed_id = b.id
            LEFT JOIN units u ON b.unit_id = u.id
            WHERE p.id = $1;
        `;
        const { rows } = await pool.query(sql, [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Paciente não encontrado." });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error("Erro ao buscar paciente:", err);
        res.status(500).json({ error: 'Erro no servidor ao buscar paciente.' });
    }
});


// Rota de busca não precisa de alterações, já está correta
apiRouter.get('/patients/search', async (req, res) => {
    const { q } = req.query; 
    if (!q || q.length < 3) { return res.status(400).json({ error: 'O termo de busca deve ter pelo menos 3 caracteres.' }); }
    try {
        const searchTerm = `%${q}%`;
        const query = `
            SELECT 
                p.id, p.name, p.dob, p.cns,
                CASE WHEN p.current_bed_id IS NULL THEN 'discharged' ELSE 'admitted' END as status,
                u.name AS unit_name,
                b.bed_number
            FROM patients p
            LEFT JOIN beds b ON p.current_bed_id = b.id
            LEFT JOIN units u ON b.unit_id = u.id
            WHERE p.name ILIKE $1 OR p.cns::text ILIKE $2
            ORDER BY p.name ASC LIMIT 10;`;
        const result = await pool.query(query, [searchTerm, searchTerm]);
        res.json({ data: result.rows });
    } catch (error) {
        console.error('Erro na busca de pacientes:', error.message);
        res.status(500).json({ error: 'Erro interno do servidor ao buscar pacientes.' });
    }
});

// ATUALIZADO: Dar alta a um paciente
apiRouter.post('/patients/:id/discharge', async (req, res) => {
    const { id } = req.params;
    const { bedId, reason, date } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Atualiza o registro da internação ATIVA com os dados da alta
        const admissionUpdateSql = `
            UPDATE admissions 
            SET discharge_date = $1, discharge_reason = $2 
            WHERE patient_id = $3 AND discharge_date IS NULL;`;
        await client.query(admissionUpdateSql, [date, reason, id]);
        
        // 2. Tira o paciente do leito na tabela de pacientes
        await client.query(`UPDATE patients SET current_bed_id = NULL WHERE id = $1`, [id]);
        
        // 3. Libera o leito na tabela de leitos
        await client.query(`UPDATE beds SET status = 'free', patient_id = NULL, patient_name = NULL WHERE id = $1`, [bedId]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Alta registrada com sucesso!' });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Erro ao dar alta:", err);
        res.status(500).json({ error: 'Erro no servidor ao registrar alta.' });
    } finally {
        client.release();
    }
});

// ATUALIZADO: Transferir um paciente
apiRouter.post('/patients/:id/transfer', async (req, res) => {
    const { id } = req.params;
    const { oldBedId, newBedId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Atualiza a tabela de pacientes com o novo leito
        await client.query(`UPDATE patients SET current_bed_id = $1 WHERE id = $2`, [newBedId, id]);
        
        // 2. Atualiza o registro da internação ATIVA com o novo leito
        await client.query(`UPDATE admissions SET bed_id = $1 WHERE patient_id = $2 AND discharge_date IS NULL`, [newBedId, id]);
        
        // 3. Libera o leito antigo
        await client.query(`UPDATE beds SET status = 'free', patient_id = NULL, patient_name = NULL WHERE id = $1`, [oldBedId]);
        
        // 4. Ocupa o novo leito
        const patientResult = await client.query('SELECT name FROM patients WHERE id = $1', [id]);
        const patientName = patientResult.rows[0].name;
        await client.query(`UPDATE beds SET status = 'occupied', patient_id = $1, patient_name = $2 WHERE id = $3`, [id, patientName, newBedId]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Paciente transferido com sucesso!' });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Erro na transferência:", err);
        res.status(500).json({ error: 'Erro no servidor ao transferir paciente.' });
    } finally {
        client.release();
    }
});

// NOVO: Rota para reinternar um paciente
apiRouter.post('/patients/:id/readmit', async (req, res) => {
    const { id } = req.params;
    const { bed_id, dih, hd_primary_desc, hd_primary_cid, secondary_diagnoses } = req.body;

    if (!bed_id || !dih) {
        return res.status(400).json({ error: 'O ID do novo leito e a nova data de internação são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Cria um NOVO registro de internação
        const admissionSql = `
            INSERT INTO admissions (patient_id, bed_id, admission_date, hd_primary_desc, hd_primary_cid, secondary_diagnoses)
            VALUES ($1, $2, $3, $4, $5, $6);
        `;
        const admissionParams = [id, bed_id, dih, hd_primary_desc, hd_primary_cid, JSON.stringify(secondary_diagnoses || [])];
        await client.query(admissionSql, admissionParams);

        // 2. Atualiza o status geral do paciente com o novo leito
        const patientUpdateSql = `UPDATE patients SET current_bed_id = $1 WHERE id = $2 RETURNING name;`;
        const patientResult = await client.query(patientUpdateSql, [bed_id, id]);
        const patientName = patientResult.rows[0].name;

        // 3. Ocupa o novo leito
        const bedUpdateSql = `UPDATE beds SET status = 'occupied', patient_id = $1, patient_name = $2 WHERE id = $3;`;
        await client.query(bedUpdateSql, [id, patientName, bed_id]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Paciente reinternado com sucesso!' });

    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Erro na reinternação:", err);
        res.status(500).json({ error: 'Erro no servidor ao reinternar o paciente.' });
    } finally {
        client.release();
    }
});

// --- ROTAS DE HISTÓRICO ---
// (Nenhuma alteração nesta seção)
apiRouter.post('/patients/:id/evolutions', async (req, res) => {
    const { id } = req.params;
    const evolutionData = req.body;
    if (!id || !evolutionData) { return res.status(400).json({ error: 'ID do paciente e dados da evolução são obrigatórios.' }); }
    try {
        const sql = `INSERT INTO evolutions (patient_id, content) VALUES ($1, $2) RETURNING *;`;
        const { rows } = await pool.query(sql, [id, evolutionData]);
        res.status(201).json({ message: 'Evolução salva com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao salvar evolução:', err);
        res.status(500).json({ error: 'Erro no servidor ao salvar a evolução.' });
    }
});

apiRouter.post('/prescriptions', async (req, res) => {
    const { patient_id, medicamento, posologia, via_administracao, quantidade } = req.body;
    if (!patient_id || !medicamento || !posologia) { return res.status(400).json({ message: 'Campos obrigatórios (paciente, medicamento, posologia) estão faltando.' }); }
    try {
        const sql = `INSERT INTO prescriptions (patient_id, medicamento, posologia, via_administracao, quantidade) VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
        const { rows } = await pool.query(sql, [patient_id, medicamento, posologia, via_administracao, quantidade]);
        res.status(201).json({ message: 'Receita salva com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao salvar receita:', err);
        res.status(500).json({ error: 'Falha ao salvar a receita no servidor.' });
    }
});

apiRouter.get('/patients/:id/evolutions', async (req, res) => {
    try {
        const sql = `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY created_at DESC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        console.error('Erro ao buscar evoluções:', err);
        res.status(500).json({ error: 'Erro no servidor ao buscar evoluções.' });
    }
});

apiRouter.get('/patients/:id/prescriptions', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        console.error('Erro ao buscar receitas:', err);
        res.status(500).json({ error: 'Falha ao buscar receitas.' });
    }
});

apiRouter.get('/evolutions/:evolutionId', async (req, res) => {
    try {
        const { evolutionId } = req.params;
        const { rows } = await pool.query(`SELECT * FROM evolutions WHERE id = $1`, [evolutionId]);
        if (rows.length === 0) return res.status(404).json({ message: "Evolução não encontrada." });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error('Erro ao buscar evolução específica:', err);
        res.status(500).json({ error: 'Erro no servidor ao buscar a evolução.' });
    }
});

apiRouter.put('/evolutions/:evolutionId', async (req, res) => {
    const { evolutionId } = req.params;
    const evolutionData = req.body;
    if (!evolutionData) return res.status(400).json({ error: 'Dados da evolução são obrigatórios.' });
    try {
        const sql = `UPDATE evolutions SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`;
        const { rows } = await pool.query(sql, [evolutionData, evolutionId]);
        if (rows.length === 0) return res.status(404).json({ message: "Evolução não encontrada para atualizar." });
        res.status(200).json({ message: 'Evolução atualizada com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao atualizar evolução:', err);
        res.status(500).json({ error: 'Erro no servidor ao atualizar a evolução.' });
    }
});

apiRouter.delete('/evolutions/:evolutionId', async (req, res) => {
    const { evolutionId } = req.params;
    try {
        const sql = `UPDATE evolutions SET deleted_at = NOW() WHERE id = $1 RETURNING *;`;
        const { rows } = await pool.query(sql, [evolutionId]);
        if (rows.length === 0) return res.status(404).json({ message: "Evolução não encontrada para excluir." });
        res.status(200).json({ message: 'Evolução marcada como excluída com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao marcar evolução como excluída:', err);
        res.status(500).json({ error: 'Erro no servidor ao excluir a evolução.' });
    }
});


app.use('/api', apiRouter);

// Rota final para servir o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});