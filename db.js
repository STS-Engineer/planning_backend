const {Pool} = require('pg');


const pool = new Pool ({
    user: 'administrationSTS',  
    host: 'avo-adb-002.postgres.database.azure.com',  
    database: 'IT_ProjectsDB',  
    password: 'St$@0987',  
    port: 5432,  
    ssl: false,  
})

module.exports= pool;