import mongoose from 'mongoose';

const mongoURI = 'mongodb://localhost:27017/gymmanager';

async function check() {
  try {
    await mongoose.connect(mongoURI);
    const db = mongoose.connection.db;
    
    const packages = await db.collection('packages').find({}).toArray();
    const disciplines = await db.collection('disciplines').find({}).toArray();
    const locations = await db.collection('locations').find({}).toArray();
    const customers = await db.collection('customers').find({}).toArray();
    
    console.log('=== Packages ===');
    console.log(JSON.stringify(packages, null, 2));
    console.log('\n=== Disciplines ===');
    console.log(JSON.stringify(disciplines, null, 2));
    console.log('\n=== Locations ===');
    console.log(JSON.stringify(locations, null, 2));
    console.log('\n=== Customers count ===', customers.length);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
  }
}

check();
