// VERSÃO CORRIGIDA E FINAL DE server.js

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validação crítica da variável de ambiente do banco de dados
if (!process.env.DATABASE_URL) {
    console.error("ERRO CRÍTICO: A variável de ambiente DATABASE_URL não foi definida.");
    process.exit(1); 
}

// Configuração da conexão com o banco de dados PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middlewares
app.use(express.json()); // Para parsear o corpo de requisições JSON
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath)); // Para servir os arquivos estáticos (HTML, CSS, JS do cliente)

// ================== ROTAS DA API ==================
const apiRouter = express.Router();

// --- Rotas de Unidades e Leitos ---

// GET /api/units - Retorna todas as unidades com contagem de leitos ocupados
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

// GET /api/units/:id - Retorna uma unidade específica
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

// GET /api/units/:id/beds - Retorna todos os leitos de uma unidade
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

// POST /api/patients - Cria um novo paciente e o aloca em um leito
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

// GET /api/patients/:id - Retorna um paciente específico
apiRouter.get('/patients/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM patients WHERE id = $1', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Paciente não encontrado." });
        }
        res.json({ data: rows[0] });
    } catch (err) {
        console.error(`Erro ao buscar paciente ${req.params.id}:`, err);
        res.status(500).json({ error: 'Erro no servidor ao buscar paciente.' });
    }
});

// POST /api/patients/:id/discharge - Dá alta a um paciente, liberando o leito
apiRouter.post('/patients/:id/discharge', async (req, res) => {
    const { id } = req.params;
    const { bedId, reason, datetime } = req.body;

    if (!bedId || !reason || !datetime) {
        return res.status(400).json({ error: 'ID do leito, motivo e data são obrigatórios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const bedSql = 'UPDATE beds SET status = $1, patient_id = $2, patient_name = $3 WHERE id = $4';
        await client.query(bedSql, ['free', null, null, bedId]);
        
        console.log(`Paciente ${id} recebeu alta do leito ${bedId}. Motivo: ${reason}`);

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


// --- Rotas de Histórico (Evoluções e Receitas) ---

// GET /api/patients/:id/evolutions - Retorna todas as evoluções de um paciente
apiRouter.get('/patients/:id/evolutions', async (req, res) => {
    try {
        const sql = `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY created_at DESC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        if (err.code === '42P01') { // Código de erro para "tabela não existe"
            console.warn("Aviso: A tabela 'evolutions' parece não existir. Retornando array vazio.");
            res.json({ data: [] });
        } else {
            console.error(`Erro ao buscar evoluções para o paciente ${req.params.id}:`, err);
            res.status(500).json({ error: 'Erro no servidor ao buscar evoluções.' });
        }
    }
});

// POST /api/prescriptions - Cria uma nova receita
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

// GET /api/patients/:id/prescriptions - Retorna todas as receitas de um paciente
apiRouter.get('/patients/:id/prescriptions', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        console.error(`Erro ao buscar receitas para o paciente ${req.params.id}:`, err);
        res.status(500).json({ error: 'Falha ao buscar receitas.' });
    }
});


// Middleware para usar o roteador da API com o prefixo /api
app.use('/api', apiRouter);

// ================== ROTA DE FALLBACK ==================
// Qualquer requisição GET que não corresponda a uma rota da API servirá o index.html
// Isso é essencial para que o roteamento do lado do cliente (SPA) funcione corretamente
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ================== INICIALIZAÇÃO DO SERVIDOR ==================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});