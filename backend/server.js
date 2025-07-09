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
            console.warn("A tabela 'evolutions' ainda não existe. Retornando array vazio.");
            res.json({ data: [] });
        } else {
            console.error(`Erro ao buscar evoluções para o paciente ${req.params.id}:`, err);
            res.status(500).json({ error: err.message });
        }
    }
});
// Em server.js, dentro do apiRouter

// ROTA PARA DAR ALTA A UM PACIENTE
apiRouter.post('/patients/:id/discharge', async (req, res) => {
    const patientId = req.params.id;
    const { reason, datetime, bedId } = req.body;

    if (!reason || !datetime || !bedId) {
        return res.status(400).json({ error: 'Motivo, data/hora e ID do leito são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Atualiza o status do paciente (ex: adiciona uma nota sobre a alta)
        const updatePatientSql = `
            UPDATE patients 
            SET status = $1, discharge_at = $2, bed_id = NULL 
            WHERE id = $3;
        `;
        await client.query(updatePatientSql, [`Discharged: ${reason}`, datetime, patientId]);

        // 2. Libera o leito
        const updateBedSql = `
            UPDATE beds 
            SET status = 'free', patient_id = NULL, patient_name = NULL 
            WHERE id = $1;
        `;
        await client.query(updateBedSql, [bedId]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Alta registrada com sucesso!' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao registrar alta:', err);
        res.status(500).json({ error: 'Erro no servidor ao processar a alta.' });
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


// ================== MIGRAÇÕES DO BANCO DE DADOS ==================
// ESTA FUNÇÃO SERÁ EXECUTADA NA INICIALIZAÇÃO PARA CRIAR A TABELA SE ELA NÃO EXISTIR
async function runMigrations() {
    console.log('Verificando a necessidade de migrações no banco de dados...');
    const client = await pool.connect();
    try {
        // Verifica se a tabela 'prescriptions' existe
        const checkTableQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'prescriptions'
            );
        `;
        const res = await client.query(checkTableQuery);
        const tableExists = res.rows[0].exists;

        if (!tableExists) {
            console.log('Tabela "prescriptions" não encontrada. Criando tabela...');
            const createTableQuery = `
                CREATE TABLE prescriptions (
                    id SERIAL PRIMARY KEY,
                    patient_id INTEGER NOT NULL,
                    medicamento TEXT NOT NULL,
                    posologia TEXT NOT NULL,
                    via_administracao TEXT,
                    quantidade TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE
                );
            `;
            await client.query(createTableQuery);
            console.log('Tabela "prescriptions" criada com sucesso.');
        } else {
            console.log('Tabela "prescriptions" já existe. Nenhuma migração necessária.');
        }
    } catch (err) {
        console.error('Erro durante a migração do banco de dados:', err);
    } finally {
        client.release(); // Libera o cliente de volta para o pool
    }
}


// ================== INICIALIZAÇÃO DO SERVIDOR ==================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    // Executa a verificação/criação da tabela assim que o servidor iniciar
    runMigrations();
});