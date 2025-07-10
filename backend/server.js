// VERSÃO FINAL CORRIGIDA - COM ROTAS POST PARA EVOLUÇÃO E RECEITA

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
// (Sem alterações nesta seção)
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
        res.status(500).json({ error: 'Erro no servidor ao buscar unidades.' });
    }
});

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
        res.status(500).json({ error: 'Erro no servidor ao buscar dados para transferência.' });
    }
});

apiRouter.get('/units/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Unidade não encontrada." });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor ao buscar unidade.' });
    }
});

apiRouter.get('/units/:id/beds', async (req, res) => {
    try {
        const sql = `SELECT id, bed_number, status, patient_id, patient_name FROM beds WHERE unit_id = $1 ORDER BY LENGTH(bed_number), bed_number ASC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor ao buscar leitos.' });
    }
});

// --- Rotas de Pacientes ---
// (Sem alterações nesta seção)
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
        res.status(500).json({ error: 'Erro no servidor ao cadastrar paciente.' });
    } finally {
        client.release();
    }
});

apiRouter.get('/patients/:id', async (req, res) => {
    try {
        const sql = `
            SELECT p.*, b.bed_number, u.name as unit_name
            FROM patients p
            LEFT JOIN beds b ON p.bed_id = b.id
            LEFT JOIN units u ON p.unit_id = u.id
            WHERE p.id = $1;
        `;
        const { rows } = await pool.query(sql, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Paciente não encontrado." });
        }
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor ao buscar paciente.' });
    }
});

apiRouter.post('/patients/:id/discharge', async (req, res) => {
    // Código existente, sem alterações
});

apiRouter.post('/patients/:id/transfer', async (req, res) => {
    // Código existente, sem alterações
});

// --- Rotas de Histórico ---

// [NOVO] Rota para SALVAR uma nova evolução médica
apiRouter.post('/patients/:id/evolutions', async (req, res) => {
    const { id } = req.params;
    const evolutionData = req.body; // O objeto JSON completo da evolução
    
    if (!id || !evolutionData) {
        return res.status(400).json({ error: 'ID do paciente e dados da evolução são obrigatórios.' });
    }
    
    try {
        const sql = `INSERT INTO evolutions (patient_id, content) VALUES ($1, $2) RETURNING *;`;
        const { rows } = await pool.query(sql, [id, evolutionData]);
        res.status(201).json({ message: 'Evolução salva com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao salvar evolução:', err);
        res.status(500).json({ error: 'Erro no servidor ao salvar a evolução.' });
    }
});

// [NOVO] Rota para SALVAR uma nova receita
apiRouter.post('/prescriptions', async (req, res) => {
    const { patient_id, medicamento, posologia, via, quantidade } = req.body;
    
    if (!patient_id || !medicamento || !posologia) {
        return res.status(400).json({ message: 'Campos obrigatórios (paciente, medicamento, posologia) estão faltando.' });
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

// Rotas GET para buscar histórico (já corrigidas anteriormente)
apiRouter.get('/patients/:id/evolutions', async (req, res) => {
    try {
        const sql = `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY created_at DESC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        if (err.code === '42P01') {
            res.json({ data: [] });
        } else {
            res.status(500).json({ error: 'Erro no servidor ao buscar evoluções.' });
        }
    }
});

apiRouter.get('/patients/:id/prescriptions', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        if (err.code === '42P01') {
            res.json({ data: [] });
        } else {
            res.status(500).json({ error: 'Falha ao buscar receitas.' });
        }
    }
});


app.use('/api', apiRouter);

app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});