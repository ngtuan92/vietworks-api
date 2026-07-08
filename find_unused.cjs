const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/VietWorks');
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const dbCollNames = collections.map(c => c.name);
  
  const modelsDir = path.join(process.cwd(), 'src/models');
  let modelsContent = '';
  fs.readdirSync(modelsDir).forEach(f => {
    if(f.endsWith('.js')) {
      modelsContent += fs.readFileSync(path.join(modelsDir, f), 'utf8') + '\n';
    }
  });

  const unused = [];

  for (const collName of dbCollNames) {
    const explicitRegex = new RegExp('[\'\"\`]' + collName + '[\'\"\`]');
    if (explicitRegex.test(modelsContent)) continue;
    
    const singular1 = collName.endsWith('s') ? collName.slice(0, -1) : collName;
    const singular2 = collName.endsWith('es') ? collName.slice(0, -2) : collName;
    const singular3 = collName.endsWith('ies') ? collName.slice(0, -3) + 'y' : collName;
    
    const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
    const toPascal = s => s.split('_').map(capitalize).join('');
    
    const possibleModels = [
      toPascal(singular1), toPascal(singular2), toPascal(singular3),
      capitalize(singular1), capitalize(singular2), capitalize(singular3)
    ];
    
    let matched = false;
    for (const m of possibleModels) {
      if (modelsContent.includes('model(\'' + m + '\'') || modelsContent.includes('model(\"' + m + '\")')) {
        matched = true;
        break;
      }
    }
    
    const controllersDir = path.join(process.cwd(), 'src/controllers');
    let foundInControllers = false;
    fs.readdirSync(controllersDir).forEach(f => {
      if (fs.readFileSync(path.join(controllersDir, f), 'utf8').includes(collName)) {
        foundInControllers = true;
      }
    });

    if (!matched && !foundInControllers) {
      unused.push(collName);
    }
  }
  console.log('Unused collections in DB:', unused.join(', '));
  process.exit(0);
}
run();
