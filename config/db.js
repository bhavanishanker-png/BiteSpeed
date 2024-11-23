const mysql = require('mysql2');
require('dotenv').config();
console.log(process.env.DB_HOST,process.env.DB_USER,process.env.DB_PASSWORD)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 // 10 seconds
});


module.exports = pool.promise();
