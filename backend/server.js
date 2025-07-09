const express = require('express');
const path = require('path');
const { Pool } = require('pg');

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
app.use(express.json({ limit: '10mb' }));

// SERVIDOR DE ARQUIVOS ESTÁTICOS
// Aponta para a pasta 'public', que está na raiz do projeto
const publicPath = path.resolve(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Função de inicialização do Banco de Dados
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

        const defaultUnits = [
            { name: 'UTI 3 - Hospital Geral de Roraima', total_beds: 36, type: 'uti3' },
            { name: 'UTI 1A - Hospital Geral de Roraima', total_beds: 11, type: 'standard' },
            { name: 'UTI 1B - Hospital Geral de Roraima', total_beds: 11, type: 'standard' },
            { name: 'UTI 2A - Hospital Geral de Roraima', total_beds: 11, type: 'standard' },
            { name: 'UTI 2B - Hospital Geral de Roraima', total_beds: 11, type: 'standard' }
        ];

        for (const unit of defaultUnits) {
            const res = await client.query('SELECT * FROM units WHERE name = $1', [unit.name]);
            if (res.rowCount === 0) {
                console.log(`Criando unidade: ${unit.name}`);
                const unitInsert = await client.query('INSERT INTO units (name, total_beds) VALUES ($1, $2) RETURNING id', [unit.name, unit.total_beds]);
                const unitId = unitInsert.rows[0].id;
                
                const bedSql = 'INSERT INTO beds (unit_id, bed_number) VALUES ($1, $2)';
                if (unit.type === 'uti3') {
                    for (let i = 1; i <= 34; i++) await client.query(bedSql, [unitId, String(i).padStart(2, '0')]);
                    await client.query(bedSql, [unitId, 'Isolamento 01']);
                    await client.query(bedSql, [unitId, 'Isolamento 02']);
                } else if (unit.type === 'standard') {
                    await client.query(bedSql, [unitId, 'Isolamento 01']);
                    for (let i = 1; i <= 10; i++) await client.query(bedSql, [unitId, String(i).padStart(2, '0')]);
                }
            }
        }
        console.log("Dados iniciais do banco de dados verificados.");

    } catch (err) {
        console.error('Erro na inicialização do banco de dados:', err);
    } finally {
        if (client) client.release();
    }
}


// ================== API Endpoints Completos ==================
const apiRouter = express.Router();

// Endpoints de Unidades
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
        res.status(500).json({ error: err.message });
    }
});

apiRouter.delete('/units/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM units WHERE id = $1', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Unidade não encontrada." });
        }
        res.status(200).json({ message: "Unidade deletada com sucesso" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoints de Leitos e Pacientes
apiRouter.get('/units/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM units WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ message: "Unidade não encontrada." });
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.get('/units/:id/beds', async (req, res) => {
    try {
        const sql = `SELECT id, bed_number, status, patient_id, patient_name FROM beds WHERE unit_id = $1 ORDER BY LENGTH(bed_number), bed_number ASC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

apiRouter.post('/patients', async (req, res) => {
    const { name, dob, age, cns, dih, unitId, bedId, history } = req.body;
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

app.get('/patients/:id', async (req, res) => {
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


// Usa o roteador para todas as rotas que começam com /api
app.use('/api', apiRouter);


// ROTA DE FALLBACK
// Esta rota deve vir DEPOIS de todas as outras.
// Ela garante que o servidor entregue a página principal (index.html)
// para qualquer endereço que não seja de API.
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// INICIA O SERVIDOR
app.listen(PORT, () => {
    console