// VERSÃO ESTÁVEL ANTERIOR DE server.js

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

// --- Rotas de Receitas (Prescriptions) ---
apiRouter.post('/prescriptions', async (req, res) => { /* ... código ... */ });
apiRouter.get('/patients/:id/prescriptions', async (req, res) => { /* ... código ... */ });

app.use('/api', apiRouter);

// ================== ROTA DE FALLBACK ==================
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ================== INICIALIZAÇÃO DO SERVIDOR ==================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});