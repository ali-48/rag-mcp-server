import { promises as fs } from 'fs';
import path from 'path';

async function test() {
    try {
        const sqlite3 = await import('sqlite3');
        const { open } = await import('sqlite');
        
        console.log('sqlite3:', Object.keys(sqlite3));
        console.log('sqlite3.default:', sqlite3.default);
        console.log('sqlite3.Database:', sqlite3.Database);
        
        const dbPath = './rag/db/memory/test.sqlite';
        const dir = path.dirname(dbPath);
        await fs.mkdir(dir, { recursive: true });
        
        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        
        console.log('Database opened successfully');
        await db.close();
        console.log('Test passed');
    } catch (error) {
        console.error('Error:', error);
        console.error('Full error:', error.stack);
    }
}

test();
