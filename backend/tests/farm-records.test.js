'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {DOCUMENT_TYPES,validDocument,MAX_DOCUMENT_BYTES}=require('../farm-records');
test('the farm document allowlist has no authentication/session keys',()=>{
 for(const key of ['currentUser','livestockUsers','isLoggedIn','lm_auth_sessions','__proto__','selectedAnimalId']){
   assert.equal(Object.hasOwn(DOCUMENT_TYPES,key),false);
   assert.equal(validDocument(key,[]),false);
 }
 assert.equal(validDocument('livestockAnimals',[]),true);
 assert.equal(validDocument('livestockAnimals',{}),false);
 assert.equal(validDocument('farmerProfile',{}),true);
 assert.equal(validDocument('farmerProfile',[]),false);
 assert.equal(validDocument('farmExpenses',null),true);
 assert.equal(validDocument('livestockAnimals',Array(1).fill('x'.repeat(MAX_DOCUMENT_BYTES))),false);
});
test('farm records schema belongs to the authenticated farmer and carries a version',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../schema.sql'),'utf8');
 const routes=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS lm_farm_records/);
 assert.match(sql,/PRIMARY KEY\(user_id,record_key\)/);
 assert.match(routes,/app\.get\('\/api\/farm\/records',requireAuth/);
 assert.match(routes,/app\.put\('\/api\/farm\/records\/:key',requireAuth/);
 assert.match(routes,/WHERE user_id=\$1 AND record_key=\$2 AND version=\$4/);
 assert.match(routes,/req\.authUser\.id/);
});
