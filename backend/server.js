// VERSÃO ESTÁVEL E COMPLETA DE server.js

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

// ================== ROTAS DA API ==================
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
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/units/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Unidade não encontrada." });
        res.json({ data: rows[0] });
    } catch (err) {
        console.error(`Erro ao buscar unidade ${req.params.id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/units/:id/beds', async (req, res) => {
    try {
        const sql = `SELECT id, bed_number, status, patient_id, patient_name FROM beds WHERE unit_id = $1 ORDER BY LENGTH(bed_number), bed_number ASC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        console.error(`Erro ao buscar leitos para unidade ${req.params.id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

// --- Rotas de Pacientes ---
apiRouter.get('/patients/:id', async (req, res) => {
    try {
        const patientId = req.params.id;
        const sql = `SELECT * FROM patients WHERE id = $1`; 
        const { rows } = await pool.query(sql, [patientId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Paciente não encontrado." });
        }
        res.json({ data: rows[0] });
    } catch (err) {
        console.error(`Erro ao buscar paciente ${req.params.id}:`, err);
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/patients/:id/evolutions', async (req, res) => {
    try {
        const patientId = req.params.id;
        const sql = `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY created_at DESC`;
        const { rows } = await pool.query(sql, [patientId]);
        res.json({ data: rows });
    } catch (err) {
        if (err.code === '42P01') { 
            res.json({ data: [] });
        } else {
            console.error(`Erro ao buscar evoluções para o paciente ${req.params.id}:`, err);
            res.status(500).json({ error: err.message });
        }
    }
});

// Rota para criar pacientes novos (necessária para a função de cadastrar)
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


// --- Rotas de Receitas (Prescriptions) ---
apiRouter.post('/prescriptions', async (req, res) => {
    const { patient_id, medicamento, posologia, via, quantidade } = req.body;
    if (!patient_id || !medicamento || !posologia) {
        return res.status(400).json({ message: 'Campos obrigatórios estão faltando.' });
    }
    try {
        const sql = `
            INSERT INTO prescriptions (patient_id, medicamento, posologia, via_administracao, quantidade)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const { rows } = await pool.query(sql, [patient_id, medicamento, posologia, via, quantidade]);
        res.status(201).json({ message: 'Receita salva com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao salvar receita:', err);
        res.status(500).json({ error: 'Falha ao salvar a receita no servidor.' });
    }
});

apiRouter.get('/patients/:id/prescriptions', async (req, res) => {
    try {
        const { id } = req.params;
        const sql = 'SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC';
        const { rows } = await pool.query(sql, [id]);
        res.json({ data: rows });
    } catch (err) {
        console.error(`Erro ao buscar receitas para o paciente ${req.params.id}:`, err);
        res.status(500).json({ error: 'Falha ao buscar receitas.' });
    }
});


app.use('/api', apiRouter);

// ================== ROTA DE FALLBACK ==================
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ================== INICIALIZAÇÃO DO SERVIDOR ==================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});