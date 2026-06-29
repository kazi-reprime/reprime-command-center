const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:Rp!Cmd-Ctr%232026%24Vault7nQx9LwK@db.yrnujfhzmoasodawqfri.supabase.co:5432/postgres?sslmode=require' });
client.connect()
  .then(() => {
    console.log('Connected to DB');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log(res.rows[0]);
    client.end();
  })
  .catch(err => {
    console.error('Connection error', err.stack);
    client.end();
  });
