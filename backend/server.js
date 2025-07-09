// VERSÃO ATUALIZADA COM A FUNCIONALIDADE DE TRANSFERÊNCIA

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
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(express.json());
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

const apiRouter = express.Router();

// --- Rotas de Unidades e Leitos ---

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
        console.error('Erro ao buscar unidades:', err);
        res.status(500).json({ error: 'Erro no servidor ao buscar unidades.' });
    }
});

// [NOVO] GET /api/units-with-free-beds - Rota para popular o modal de transferência
apiRouter.get('/units-with-free-beds', async (req, res) => {
    try {
        const sql = `
            SELECT
                u.id,
                u.name,
                json_agg(
                    json_build_object('id', b.id, 'bed_number', b.bed_number)
                ) FILTER (WHERE b.id IS NOT NULL) as free_beds
            FROM units u
            LEFT JOIN beds b ON u.id = b.unit_id AND b.status = 'free'
            GROUP BY u.id
            ORDER BY u.name;
        `;
        const { rows } = await pool.query(sql);
        res.json({ data: rows });
    } catch (err) {
        console.error('Erro ao buscar unidades com leitos livres:', err);
        res.status(500).json({ error: 'Erro no servidor ao buscar dados para transferência.' });
    }
});

apiRouter.get('/units/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Unidade não encontrada." });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error(`Erro ao buscar unidade ${req.params.id}:`, err);
        res.status(500).json({ error: 'Erro no servidor ao buscar unidade.' });
    }
});

apiRouter.get('/units/:id/beds', async (req, res) => {
    try {
        const sql = `SELECT id, bed_number, status, patient_id, patient_name FROM beds WHERE unit_id = $1 ORDER BY LENGTH(bed_number), bed_number ASC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        console.error(`Erro ao buscar leitos para unidade ${req.params.id}:`, err);
        res.status(500).json({ error: 'Erro no servidor ao buscar leitos.' });
    }
});

// --- Rotas de Pacientes ---

apiRouter.post('/patients', async (req, res) => {
    const { name, dob, age, cns, dih, unitId, bedId } = req.body;
    if (!name || !unitId || !bedId) {
        return res.status(400).json({ error: 'Nome, ID da unidade e ID do leito são obrigatórios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const patientSql = 'INSERT INTO patients (name, dob, age, cns, dih, unit_id, bed_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name';
        const patientResult = await client.query(patientSql, [name, dob, age, cns, dih, unitId, bedId]);
        const newPatient = patientResult.rows[0];

        const bedSql = 'UPDATE beds SET status = $1, patient_id = $2, patient_name = $3 WHERE id = $4';
        await client.query(bedSql, ['occupied', newPatient.id, newPatient.name, bedId]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Paciente cadastrado com sucesso!', data: newPatient });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao cadastrar novo paciente:', err);
        res.status(500).json({ error: 'Erro no servidor ao cadastrar paciente.' });
    } finally {
        client.release();
    }
});

apiRouter.get('/patients/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Paciente não encontrado." });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error(`Erro ao buscar paciente ${req.params.id}:`, err);
        res.status(500).json({ error: 'Erro no servidor ao buscar paciente.' });
    }
});

apiRouter.post('/patients/:id/discharge', async (req, res) => {
    const { id } = req.params;
    const { bedId, reason, datetime } = req.body;

    if (!bedId) {
        return res.status(400).json({ error: 'O ID do leito é obrigatório para processar a alta.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const bedSql = 'UPDATE beds SET status = $1, patient_id = $2, patient_name = $3 WHERE id = $4';
        await client.query(bedSql, ['free', null, null, bedId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Alta registrada com sucesso!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao dar alta no paciente:', err);
        res.status(500).json({ error: 'Erro no servidor ao registrar alta.' });
    } finally {
        client.release();
    }
});

// [NOVO] POST /api/patients/:id/transfer - Rota que executa a transferência
apiRouter.post('/patients/:id/transfer', async (req, res) => {
    const { id: patientId } = req.params;
    const { oldBedId, newUnitId, newBedId } = req.body;

    if (!oldBedId || !newUnitId || !newBedId || !patientId) {
        return res.status(400).json({ error: 'Dados insuficientes para a transferência.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Pega o nome do paciente para colocar no novo leito
        const patientRes = await client.query('SELECT name FROM patients WHERE id = $1', [patientId]);
        if (patientRes.rows.length === 0) throw new Error('Paciente não encontrado.');
        const patientName = patientRes.rows[0].name;

        // 1. Libera o leito antigo
        const freeOldBedSql = 'UPDATE beds SET status = $1, patient_id = $2, patient_name = $3 WHERE id = $4';
        await client.query(freeOldBedSql, ['free', null, null, oldBedId]);

        // 2. Ocupa o novo leito
        const occupyNewBedSql = 'UPDATE beds SET status = $1, patient_id = $2, patient_name = $3 WHERE id = $4';
        await client.query(occupyNewBedSql, ['occupied', patientId, patientName, newBedId]);

        // 3. Atualiza os dados do paciente
        const updatePatientSql = 'UPDATE patients SET unit_id = $1, bed_id = $2 WHERE id = $3';
        await client.query(updatePatientSql, [newUnitId, newBedId, patientId]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Paciente transferido com sucesso!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro na transferência do paciente:', err);
        res.status(500).json({ error: 'Erro no servidor ao realizar a transferência.' });
    } finally {
        client.release();
    }
});

// --- Rotas de Histórico (SEM ALTERAÇÕES) ---
// ... (as rotas de evolutions e prescriptions continuam aqui, sem mudanças)

app.use('/api', apiRouter);

app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});