'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function makeHarness(fetchImpl) {
 const data=new Map();
 const localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 const window={};
 const context={window,localStorage,fetch:fetchImpl,Error};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../frontend/auth-api.js'),'utf8'),context);
 return {auth:window.LMAuth,data};
}
test('frontend login saves public identity but never login token or password',async()=>{
 const {auth,data}=makeHarness(async(url,options)=>{
  assert.equal(url,'/api/auth/login');assert.equal(options.credentials,'same-origin');
  return {ok:true,json:async()=>({user:{id:'account-one',name:'Farmer',email:'farmer@example.com'}})};
 });
 await auth.login('farmer@example.com','DO-NOT-STORE-ME');
 assert.equal(JSON.parse(data.get('currentUser')).id,'account-one');
 assert.ok(![...data.values()].join(' ').includes('DO-NOT-STORE-ME'));
 assert.ok(![...data.keys()].includes('token'));
});
test('frontend forget clears session identity only, leaving livestock backups untouched',()=>{
 const {auth,data}=makeHarness(()=>{});data.set('livestockAnimals','[1]');data.set('currentUser','{ "id": "former-user" }');
 auth.forget();assert.equal(data.get('currentUser'),undefined);assert.equal(data.get('livestockAnimals'),'[1]');
});
test('frontend shows API errors without pretending login succeeded',async()=>{
 const {auth,data}=makeHarness(async()=>({ok:false,status:403,json:async()=>({code:'EMAIL_UNVERIFIED',error:'Verify your email.'})}));
 await assert.rejects(()=>auth.login('x@y.com','password'),/Verify your email/);
 assert.equal(data.get('currentUser'),undefined);
});
