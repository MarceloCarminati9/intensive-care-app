// CÓDIGO COMPLETO E ATUALIZADO PARA server.js

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

// ... (todas as suas rotas de units, patients, etc. que já estavam aqui) ...
apiRouter.get('/units', async (req, res) => { /* ... código ... */ });
apiRouter.get('/units/:id', async (req, res) => { /* ... código ... */ });
apiRouter.get('/units/:id/beds', async (req, res) => { /* ... código ... */ });
apiRouter.get('/patients/:id', async (req, res) => { /* ... código ... */ });
apiRouter.get('/patients/:id/evolutions', async (req, res) => { /* ... código ... */ });
apiRouter.post('/prescriptions', async (req, res) => { /* ... código ... */ });
apiRouter.get('/patients/:id/prescriptions', async (req, res) => { /* ... código ... */ });


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

        const updatePatientSql = `
            UPDATE patients 
            SET status = $1, discharge_at = $2, bed_id = NULL 
            WHERE id = $3;
        `;
        await client.query(updatePatientSql, [`Discharged: ${reason}`, datetime, patientId]);

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


app.use('/api', apiRouter);

app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});


// ================== MIGRAÇÕES DO BANCO DE DADOS (ATUALIZADO) ==================
async function runMigrations() {
    console.log('Verificando a necessidade de migrações no banco de dados...');
    const client = await pool.connect();
    try {
        // --- Migração 1: Tabela de Prescrições ---
        const checkPrescriptionsTable = await client.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prescriptions');");
        if (!checkPrescriptionsTable.rows[0].exists) {
            console.log('Criando tabela "prescriptions"...');
            await client.query(`
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
            `);
            console.log('Tabela "prescriptions" criada.');
        }

        // --- Migração 2: Novas colunas na tabela de Pacientes ---
        const checkStatusColumn = await client.query("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='patients' AND column_name='status');");
        if (!checkStatusColumn.rows[0].exists) {
            console.log('Adicionando coluna "status" à tabela "patients"...');
            await client.query('ALTER TABLE patients ADD COLUMN status VARCHAR(255);');
            console.log('Coluna "status" adicionada.');
        }
        
        const checkDischargeColumn = await client.query("SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='patients' AND column_name='discharge_at');");
        if (!checkDischargeColumn.rows[0].exists) {
            console.log('Adicionando coluna "discharge_at" à tabela "patients"...');
            await client.query('ALTER TABLE patients ADD COLUMN discharge_at TIMESTAMPTZ;');
            console.log('Coluna "discharge_at" adicionada.');
        }
        
        console.log('Migrações do banco de dados concluídas.');

    } catch (err) {
        console.error('Erro durante a migração do banco de dados:', err);
    } finally {
        client.release();
    }
}

// ================== INICIALIZAÇÃO DO SERVIDOR ==================
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    runMigrations();
});