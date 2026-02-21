const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();

// Configura tu conexión a PostgreSQL aquí
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'joyas',
  password: 'francodev',
  port: 5432,
});

app.use(express.json());
app.use(session({ secret: 'secreto_joyas', resave: false, saveUninitialized: false }));

// Middleware para proteger rutas
const auth = (req, res, next) => {
    if (req.session.userId) next();
    else res.status(401).send('No autorizado');
};

// --- RUTAS ---

// 1. Registro (Usalo una vez para crearte tu usuario)
app.post('/register', async (req, res) => {
    const hash = await bcrypt.hash(req.body.password, 10);
    await pool.query('INSERT INTO usuarios (username, password_hash) VALUES ($1, $2)', [req.body.username, hash]);
    res.send('Usuario creado');
});

// 2. Login
app.post('/login', async (req, res) => {
    const user = await pool.query('SELECT * FROM usuarios WHERE username = $1', [req.body.username]);
    if (user.rows[0] && await bcrypt.compare(req.body.password, user.rows[0].password_hash)) {
        req.session.userId = user.rows[0].id;
        res.send('Login exitoso');
    } else {
        res.status(401).send('Credenciales incorrectas');
    }
});

// 3. Guardar Joya (Protegido por sesión)
app.post('/joyas', auth, async (req, res) => {
    const { foto, precio, tipo, cliente, tel, lat, lon, dir } = req.body;
    await pool.query(
        `INSERT INTO inventario_joyas (usuario_id, foto_path, precio, tipo_joya, cliente_nombre, cliente_telefono, latitud, longitud, direccion_texto) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [req.session.userId, foto, precio, tipo, cliente, tel, lat, lon, dir]
    );
    res.send('Joya guardada');
});

// 4. Ver mis Joyas
app.get('/joyas', auth, async (req, res) => {
    const result = await pool.query('SELECT * FROM inventario_joyas WHERE usuario_id = $1', [req.session.userId]);
    res.json(result.rows);
});

app.listen(3000, () => console.log('Servidor en http://localhost:3000'));
