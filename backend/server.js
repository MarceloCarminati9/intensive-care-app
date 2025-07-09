const express = require('express');
const path = require('path');
const { Pool } = require('pg');

// CARREGA AS VARIÁVEIS DO ARQUIVO .env PARA O AMBIENTE LOCAL
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Validação da variável de ambiente do banco de dados
if (!process.env.DATABASE_URL) {
    console.error("ERRO CRÍTICO: A variável de ambiente DATABASE_URL não foi definida.");
    process.exit(1); 
}

// Configuração da Conexão com o PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(express.json());

// SERVIDOR DE ARQUIVOS ESTÁTICOS
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));


// ================== ROTAS DA API ==================
const apiRouter = express.Router();

// --- Rotas de Unidades e Leitos (Já existentes) ---
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

// --- NOVAS ROTAS ADICIONADAS PARA PACIENTES ---

// ROTA PARA BUSCAR DADOS DE UM PACIENTE ESPECÍFICO
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

// ROTA PARA OBTER AS EVOLUÇÕES DE UM PACIENTE
apiRouter.get('/patients/:id/evolutions', async (req, res) => {
    try {
        const patientId = req.params.id;
        // Assumindo que você terá uma tabela 'evolutions' com uma coluna 'patient_id'
        const sql = `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY created_at DESC`;
        const { rows } = await pool.query(sql, [patientId]);
        res.json({ data: rows });
    } catch (err) {
        // Se a tabela 'evolutions' não existir, isso pode dar erro. 
        // Por enquanto, vamos retornar um array vazio para não quebrar o frontend.
        if (err.code === '42P01') { // '42P01' é o código de erro para "undefined_table" no PostgreSQL
            console.warn("A tabela 'evolutions' ainda não existe. Retornando array vazio.");
            res.json({ data: [] });
        } else {
            console.error(`Erro ao buscar evoluções para o paciente ${req.params.id}:`, err);
            res.status(500).json({ error: err.message });
        }
    }
});


// Usa o roteador para todas as rotas que começam com /api
app.use('/api', apiRouter);


// ================== ROTA DE FALLBACK ==================
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});


// ================== INICIALIZAÇÃO DO SERVIDOR ==================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});