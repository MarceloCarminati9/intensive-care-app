const express = require('express');
const path = require('path');
const { Pool } = require('pg');

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

app.use(express.json({ limit: '10mb' }));
const publicPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath));

async function initializeDatabase() {
    let client;
    try {
        client = await pool.connect();
        console.log("Conectado ao PostgreSQL para inicialização.");
        
        const createTablesQuery = `
            CREATE TABLE IF NOT EXISTS units ( id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, total_beds INTEGER NOT NULL );
            CREATE TABLE IF NOT EXISTS patients ( id SERIAL PRIMARY KEY, name TEXT NOT NULL, dob TEXT, age INTEGER, cns TEXT, dih TEXT, unit_id INTEGER, bed_id INTEGER, history JSONB );
            CREATE TABLE IF NOT EXISTS beds ( id SERIAL PRIMARY KEY, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE, bed_number TEXT NOT NULL, status TEXT DEFAULT 'free', patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL, patient_name TEXT );
        `;
        await client.query(createTablesQuery);
        console.log("Tabelas do sistema verificadas/criadas com sucesso.");

    } catch (err) {
        console.error('Erro na inicialização do banco de dados:', err);
    } finally {
        if (client) client.release();
    }
}

// ================== API Endpoints Completos ==================

// Endpoints de Unidades
app.get('/api/units', async (req, res) => {
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
        res.status(500).json({ error: err.message });
    }
});

// Endpoints de Leitos
app.get('/api/units/:id/beds', async (req, res) => {
    try {
        const sql = `SELECT id, bed_number, status, patient_id, patient_name FROM beds WHERE unit_id = $1 ORDER BY LENGTH(bed_number), bed_number ASC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoints de Pacientes
app.post('/api/patients', async (req, res) => {
    const { name, dob, age, cns, dih, unitId, bedId } = req.body;
    if (!name || !bedId || !unitId) {
        return res.status(400).json({ error: "Nome, ID do leito e ID da unidade são obrigatórios." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertPatientSql = `INSERT INTO patients (name, dob, age, cns, dih, unit_id, bed_id, history) VALUES ($1, $2, $3, $4, $5, $6, $7, '[]') RETURNING id`;
        const patientParams = [name, dob, age, cns, dih, unitId, bedId];
        const patientRes = await client.query(insertPatientSql, patientParams);
        const newPatientId = patientRes.rows[0].id;
        const updateBedSql = `UPDATE beds SET status = 'occupied', patient_id = $1, patient_name = $2 WHERE id = $3`;
        await client.query(updateBedSql, [newPatientId, name, bedId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Paciente cadastrado com sucesso!", patientId: newPatientId });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: "Falha ao registrar paciente: " + err.message });
    } finally {
        client.release();
    }
});

app.get('/api/patients/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Paciente não encontrado." });
        const patient = rows[0];
        patient.history = patient.history || [];
        res.json({ data: patient });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoints de Evoluções
app.post('/api/patients/:id/evolutions', async (req, res) => {
    const patientId = req.params.id;
    const evolutionData = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT history FROM patients WHERE id = $1 FOR UPDATE', [patientId]);
        if (rows.length === 0) throw new Error("Paciente não encontrado");
        
        let history = rows[0].history || [];
        const existingIndex = history.findIndex(evo => evo.timestamp === evolutionData.timestamp);

        if (existingIndex > -1) {
            history[existingIndex] = evolutionData;
        } else {
            history.push(evolutionData);
        }

        await client.query('UPDATE patients SET history = $1 WHERE id = $2', [JSON.stringify(history), patientId]);
        await client.query('COMMIT');
        res.status(201).json({ message: "Evolução salva com sucesso!", data: evolutionData });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Rota de Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// INICIA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    initializeDatabase().catch(console.error);
});