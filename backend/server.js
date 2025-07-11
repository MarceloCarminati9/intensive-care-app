// VERSÃO DEFINITIVA, COMPLETA E CORRIGIDA - 11/07/2025

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

// --- ROTAS DE UNIDADES E LEITOS ---
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

apiRouter.post('/units', async (req, res) => {
    const { name, total_beds } = req.body;
    if (!name || !total_beds || total_beds <= 0) {
        return res.status(400).json({ error: 'Nome e número de leitos (maior que zero) são obrigatórios.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const unitResult = await client.query('INSERT INTO units (name, total_beds) VALUES ($1, $2) RETURNING id', [name, total_beds]);
        const unitId = unitResult.rows[0].id;
        for (let i = 1; i <= total_beds; i++) {
            await client.query('INSERT INTO beds (unit_id, bed_number, status) VALUES ($1, $2, $3)', [unitId, String(i), 'free']);
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'Unidade e leitos criados com sucesso!', unitId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Erro ao criar unidade", err);
        res.status(500).json({ error: 'Erro no servidor ao criar unidade.' });
    } finally {
        client.release();
    }
});

apiRouter.delete('/units/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM beds WHERE unit_id = $1', [id]);
        await client.query('DELETE FROM units WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Unidade e leitos associados deletados com sucesso!' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao deletar unidade:', err);
        res.status(500).json({ error: 'Erro no servidor ao deletar unidade.' });
    } finally {
        client.release();
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
                ) FILTER (WHERE b.id IS NOT NULL AND b.status = 'free') as free_beds
            FROM units u
            LEFT JOIN beds b ON u.id = b.unit_id
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


// --- ROTAS DE PACIENTES ---

apiRouter.post('/patients', async (req, res) => {
    const { 
        bed_id, name, mother_name, dob, cns, dih, 
        hd_primary_desc, hd_primary_cid, secondary_diagnoses_desc, secondary_diagnoses_cid, hpp, allergies
    } = req.body;

    if (!bed_id || !name || !dob) {
        return res.status(400).json({ error: 'ID do leito, nome e data de nascimento são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const patientSql = `
            INSERT INTO patients (
                name, mother_name, dob, cns, dih, 
                hd_primary_desc, hd_primary_cid, 
                secondary_diagnoses_desc, secondary_diagnoses_cid, 
                hpp, allergies, current_bed_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id;
        `;
        const patientParams = [
            name, mother_name, dob, cns, dih, 
            hd_primary_desc, hd_primary_cid, 
            secondary_diagnoses_desc, secondary_diagnoses_cid, 
            hpp, allergies, bed_id
        ];
        const patientResult = await client.query(patientSql, patientParams);
        const newPatientId = patientResult.rows[0].id;

        const bedSql = `UPDATE beds SET status = 'occupied', patient_id = $1, patient_name = $2 WHERE id = $3;`;
        await client.query(bedSql, [newPatientId, name, bed_id]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Paciente admitido com sucesso!', patientId: newPatientId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao admitir paciente:', err);
        res.status(500).json({ error: 'Erro no servidor ao admitir paciente.' });
    } finally {
        client.release();
    }
});

apiRouter.get('/patients/:id', async (req, res) => {
    try {
        const sql = `
            SELECT 
                p.id, p.name, p.mother_name, p.dob, p.cns, p.dih, 
                p.hd_primary_desc, p.hd_primary_cid, 
                p.secondary_diagnoses_desc, p.secondary_diagnoses_cid,
                p.hpp, p.allergies, p.current_bed_id,
                b.bed_number, 
                u.name as unit_name
            FROM patients p
            LEFT JOIN beds b ON p.current_bed_id = b.id
            LEFT JOIN units u ON b.unit_id = u.id
            WHERE p.id = $1;
        `;
        const { rows } = await pool.query(sql, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Paciente não encontrado." });
        }
        res.json({ data: rows[0] });
    } catch (err) {
        console.error("Erro ao buscar paciente:", err);
        res.status(500).json({ error: 'Erro no servidor ao buscar paciente.' });
    }
});

apiRouter.post('/patients/:id/discharge', async (req, res) => {
    const { id } = req.params;
    const { bedId, reason, date } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE patients SET discharge_date = $1, discharge_reason = $2, current_bed_id = NULL WHERE id = $3`, [date, reason, id]);
        await client.query(`UPDATE beds SET status = 'free', patient_id = NULL, patient_name = NULL WHERE id = $1`, [bedId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Alta registrada com sucesso!' });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Erro ao dar alta:", err);
        res.status(500).json({ error: 'Erro no servidor ao registrar alta.' });
    } finally {
        client.release();
    }
});

apiRouter.post('/patients/:id/transfer', async (req, res) => {
    const { id } = req.params;
    const { oldBedId, newBedId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`UPDATE patients SET current_bed_id = $1 WHERE id = $2`, [newBedId, id]);
        await client.query(`UPDATE beds SET status = 'free', patient_id = NULL, patient_name = NULL WHERE id = $1`, [oldBedId]);
        const patientResult = await client.query('SELECT name FROM patients WHERE id = $1', [id]);
        const patientName = patientResult.rows[0].name;
        await client.query(`UPDATE beds SET status = 'occupied', patient_id = $1, patient_name = $2 WHERE id = $3`, [id, patientName, newBedId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Paciente transferido com sucesso!' });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Erro na transferência:", err);
        res.status(500).json({ error: 'Erro no servidor ao transferir paciente.' });
    } finally {
        client.release();
    }
});


// --- ROTAS DE HISTÓRICO ---

apiRouter.post('/patients/:id/evolutions', async (req, res) => {
    const { id } = req.params;
    const evolutionData = req.body;
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

apiRouter.post('/prescriptions', async (req, res) => {
    const { patient_id, medicamento, posologia, via, quantidade } = req.body;
    if (!patient_id || !medicamento || !posologia) {
        return res.status(400).json({ message: 'Campos obrigatórios (paciente, medicamento, posologia) estão faltando.' });
    }
    try {
        const sql = `
            INSERT INTO prescriptions (patient_id, medicamento, posologia, via_administracao, quantidade)
            VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
        const { rows } = await pool.query(sql, [patient_id, medicamento, posologia, via, quantidade]);
        res.status(201).json({ message: 'Receita salva com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao salvar receita:', err);
        res.status(500).json({ error: 'Falha ao salvar a receita no servidor.' });
    }
});

apiRouter.get('/patients/:id/evolutions', async (req, res) => {
    try {
        const sql = `SELECT * FROM evolutions WHERE patient_id = $1 ORDER BY created_at DESC`;
        const { rows } = await pool.query(sql, [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor ao buscar evoluções.' });
    }
});

apiRouter.get('/patients/:id/prescriptions', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM prescriptions WHERE patient_id = $1 ORDER BY created_at DESC', [req.params.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: 'Falha ao buscar receitas.' });
    }
});

apiRouter.get('/evolutions/:evolutionId', async (req, res) => {
    try {
        const { evolutionId } = req.params;
        const sql = `SELECT * FROM evolutions WHERE id = $1`;
        const { rows } = await pool.query(sql, [evolutionId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Evolução não encontrada." });
        }
        res.json({ data: rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Erro no servidor ao buscar a evolução.' });
    }
});

apiRouter.put('/evolutions/:evolutionId', async (req, res) => {
    const { evolutionId } = req.params;
    const evolutionData = req.body;
    if (!evolutionData) {
        return res.status(400).json({ error: 'Dados da evolução são obrigatórios.' });
    }
    try {
        const sql = `UPDATE evolutions SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *;`;
        const { rows } = await pool.query(sql, [evolutionData, evolutionId]);
         if (rows.length === 0) {
            return res.status(404).json({ message: "Evolução não encontrada para atualizar." });
        }
        res.status(200).json({ message: 'Evolução atualizada com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao atualizar evolução:', err);
        res.status(500).json({ error: 'Erro no servidor ao atualizar a evolução.' });
    }
});

apiRouter.delete('/evolutions/:evolutionId', async (req, res) => {
    const { evolutionId } = req.params;
    try {
        const sql = `UPDATE evolutions SET deleted_at = NOW() WHERE id = $1 RETURNING *;`;
        const { rows } = await pool.query(sql, [evolutionId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Evolução não encontrada para excluir." });
        }
        res.status(200).json({ message: 'Evolução marcada como excluída com sucesso!', data: rows[0] });
    } catch (err) {
        console.error('Erro ao marcar evolução como excluída:', err);
        res.status(500).json({ error: 'Erro no servidor ao excluir a evolução.' });
    }
});


app.use('/api', apiRouter);

// Rota final para servir o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});