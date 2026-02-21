import { MongoMemoryServer } from 'mongodb-memory-server';

async function test() {
    console.log('Creating MongoMemoryServer...');
    const mongo = await MongoMemoryServer.create();
    console.log('Mongo URI:', mongo.getUri());
    await mongo.stop();
    console.log('Mongo stopped.');
}

test().catch(console.error);
