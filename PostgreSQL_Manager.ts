
class PostgreSQL_db_manager {
    private Pool : any;
    private pool : any;
    private Client : any;
    private client : any;
    private db : any;
    public constructor() {
        this.Pool = require('pg').Pool;
        this.Client = require('pg').Client;
    }
    public connectTodb_pool(
        user: string = 'me',
        host: string = 'localhost',
        database: string = 'newbeginnings',
        password: string = '123',
        port: number = 5432 
    ) : void {
        this.pool = new this.Pool({
            user     : user,
            host     : host,
            database : database,
            password : password,
            port     : port 
        });
        this.db = this.pool;
        console.log('Connected to database as pool successfully...');
    }
    public connectTodb_client(
        user: string = 'me',
        host: string = 'localhost',
        database: string = 'newbeginnings',
        password: string = '123',
        port: number = 5432 
    ) : void {
        this.client = new this.Client({
            user     : user,
            host     : host,
            database : database,
            password : password,
            port     : port
        });
        this.db = this.client;
        console.log('Connected to database as client successfully...');
    }
    public async createRows(table : string, columns: string | string[], values: string | string[]) : Promise<void> {
        let createPromise = new Promise<void> ((resolve, reject) => {
            this.db.query(`INSERT INTO ${table} ${columns} VALUES ${values}`, (err) => {
                if(err) throw err;
                console.log('Postgres: Rows were created...');
                resolve();
            });
        });
        await createPromise;        
    }
    public async readRows(table : string, columns : string | string[], where : string, sort : string = ''){
        if (sort !== '') sort = 'ORDER BY ' + sort ;
        let readPromise = new Promise ((resolve, reject) => {
            this.db.query(`SELECT ${columns} FROM ${table} WHERE ${where} ${sort};`, (err, result) => {
                if(err) throw err;
                console.log('Postgres: Rows were read...');
                resolve(result.rows);
            });
        });
        let readResult = await readPromise;
        console.log(readResult);
        return readResult;
    }
    public async updateRows(table : string, columns: string | string[], values: string | string[], where : string) {
        let updatePromise : Promise<void> = new Promise ((resolve, reject) => {
            this.db.query(`UPDATE ${table} SET ${columns} = ${values} WHERE ${where};`, (err) => {
                if(err) throw err;
                console.log('Postgres: Rows were updated...');
                resolve();
            });
        });
        await updatePromise;
    }
    public async deleteRows(table : string, where : string) {
        let deletePromise: Promise<void> = new Promise ((resolve, reject) => {
            this.db.query(`DELETE FROM ${table} WHERE ${where};`, (err) => {
                if(err) throw err;
                console.log('Postgres: Rows were deleted...');
                resolve();
            });
        });
        await deletePromise;
    }
    public async customQuery(customQuery: string) : Promise<any> {
        let customQueryPromise : Promise<any> = new Promise ((resolve, reject) => {
            this.db.query(customQuery, (err, result) => {
                if(err) throw err;
                console.log('Postgres: custom query was done...');
                resolve(result.rows);
            });
        });
        let customQueryResult = await customQueryPromise;
        return customQueryResult;
    }
    public async keysetPagination(table : string, columns: string | string[], orderby : string, pageKey : string, page: number, pageSize : number) {
        let startPickingFrom : number = (page - 1) * pageSize;
        let keysetPagPromise = new Promise ((resolve, reject) => {
            this.db.query(`SELECT ${columns} FROM ${table} WHERE (${pageKey} >= ${startPickingFrom}) ORDER BY ${orderby} FETCH FIRST ${pageSize} ROWS ONLY;`, (err, result) => {
                if(err) throw err;
                resolve(result.rows);
            });
        });
        let keysetPagResult = await keysetPagPromise;
        return keysetPagResult;    
    }
    public async implicitKeysetPagination(table : string, columns: string | string[], orderby : string, page: number, pageSize : number) {
        let startPickingFrom : number = (page - 1) * pageSize;
        let keysetPagPromise = new Promise ((resolve, reject) => {
            this.db.query(`WITH temp AS (SELECT row_number() OVER(ORDER BY ${orderby}) pageKey, ${columns} FROM ${table}) SELECT * FROM temp WHERE (pageKey >= ${startPickingFrom}) ORDER BY pageKey FETCH FIRST ${pageSize} ROWS ONLY;`, (err, result) => {
                if(err) throw err;
                resolve(result.rows);
            });
        });
        let keysetPagResult = await keysetPagPromise;
        return keysetPagResult;
    }
    public async offsetPagination(table : string, columns: string | string[], orderby : string, page: number, pageSize : number) {
        let startPickingFrom : number = (page - 1) * pageSize;
        let offsetPagPromise = new Promise ((resolve, reject) => {
            this.db.query(`SELECT ${columns} FROM ${table} ORDER BY ${orderby} OFFSET ${startPickingFrom} FETCH NEXT ${pageSize} ROWS ONLY;`, (err, result) => {
                if(err) throw err;
                resolve(result.rows);
            });
        });
        let offsetPagResult = await offsetPagPromise;
        return offsetPagResult; 

    }
}
/* 
async function main() : Promise<void> {
    var db1 = new PostgreSQL_db_manager();

    db1.connectTodb_pool('me', 'localhost', 'newbeginnings', '123', 5432);
    
    /* await db1.createRows('first_test_table', '(test_int_column, test_varchar_column)', '(3, \'createRowCommand\')');

    console.log(await db1.readRows('first_test_table', 'test_int_column, test_varchar_column', 'id > 0'));

    await db1.updateRows('first_test_table', '(test_int_column, test_varchar_column)', '(18, \'updateRowCommand\')', 'id=1');

    await db1.deleteRows('first_test_table', 'id=2'); 

    await db1.customQuery('INSERT INTO first_test_table (test_int_column, test_varchar_column) VALUES (11, \'First statement in custom query\'); INSERT INTO first_test_table (test_int_column, test_varchar_column) VALUES (22, \'Second statement in custom query\');');
}
main(); 
 */
module.exports = {
    PostgreSQL_db_manager    
}
