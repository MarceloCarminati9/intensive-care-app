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
// Aponta para a pasta 'public', que está um nível acima da pasta 'backend'
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

app.get('/api/units/:id/beds', async (req, res) => {
    try {
        const sql = `SELECT id, bed_number, status, patient_id, patient_name FROM beds WHERE unit_id = $1 ORDER BY LENGTH(bed_number), bed_number ASC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/patients', async (req, res) => {
    const { name, bedId, unitId } = req.body;
    if (!name || !bedId || !unitId) {
        return res.status(400).json({ error: "Nome, ID do leito e ID da unidade são obrigatórios." });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const insertPatientSql = `INSERT INTO patients (name, unit_id, bed_id, history) VALUES ($1, $2, $3, '[]') RETURNING id`;
        const patientRes = await client.query(insertPatientSql, [name, unitId, bedId]);
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


// Rota de Fallback - ESSENCIAL PARA A NAVEGAÇÃO
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});


// INICIA O SERVIDOR
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    // A inicialização é feita pelo comando Pre-deploy no Render,
    // mas mantemos aqui para testes locais se necessário.
    initializeDatabase().catch(console.error);
});