'use strict';const test=require('node:test');const assert=require('node:assert/strict');
const {installV5Routes}=require('../v5-routes');
function harness(){
 const routes=new Map(),rows=new Map(),docs=new Map();
 const app={get(path,...f){routes.set('GET '+path,f.at(-1));},post(path,...f){routes.set('POST '+path,f.at(-1));},patch(path,...f){routes.set('PATCH '+path,f.at(-1));},put(path,...f){routes.set('PUT '+path,f.at(-1));},delete(path,...f){routes.set('DELETE '+path,f.at(-1));}};
 const pool={async query(sql,params){
  const id=params[0]+'|'+(params[1]??'');
  if(sql.includes('FROM lm_v5_animals a LEFT JOIN'))return {rows:[...rows].filter(([k])=>k.startsWith(params[0]+'|')).map(([k,v])=>({id:k.split('|')[1],data:v.data,version:v.version,updated_at:'now',photo:v.photo||'',photo_version:v.photoVersion||0}))};
  if(sql.includes('FROM lm_farm_records'))return {rows:[...docs].filter(([k])=>k.startsWith(params[0]+'|')).map(([k,v])=>({record_key:k.split('|')[1],...v}))};
  if(sql.includes('INSERT INTO lm_v5_animals')){
   if(rows.has(id))return {rowCount:0,rows:[]};rows.set(id,{data:JSON.parse(params[2]),version:1,photo:'',photoVersion:0});return {rowCount:1,rows:[{version:1}]};
  }
  if(sql.includes('UPDATE lm_v5_animals')){
   const r=rows.get(id);if(!r||r.version!==params[3])return {rowCount:0,rows:[]};
   for(const k of params[4])delete r.data[k];Object.assign(r.data,JSON.parse(params[2]));r.version++;
   return {rowCount:1,rows:[{version:r.version}]};
  }
  if(sql.includes('DELETE FROM lm_v5_animals')){
   const r=rows.get(id);if(!r||r.version!==params[2])return {rowCount:0,rows:[]};rows.delete(id);return {rowCount:1,rows:[{animal_id:params[1]}]};
  }
  if(sql.includes('INSERT INTO lm_v5_animal_photos')){
   const r=rows.get(id);if(!r||r.photoVersion)return {rowCount:0,rows:[]};r.photo=params[2];r.photoVersion=1;return {rowCount:1,rows:[{version:1}]};
  }
  if(sql.includes('UPDATE lm_v5_animal_photos')){
   const r=rows.get(id);if(!r||r.photoVersion!==params[3])return {rowCount:0,rows:[]};r.photo=params[2];r.photoVersion++;return {rowCount:1,rows:[{version:r.photoVersion}]};
  }
  throw Error('Unexpected SQL '+sql);
 }};
 installV5Routes(app,{pool,requireAuth:()=>{},asyncRoute:fn=>fn,fail:(res,status,error)=>res.status(status).json({error}),limit:()=>{}});
 async function call(method,path,body={},user='farmer-a',params={}){
  const h=routes.get(method+' '+path);assert.ok(h,'route '+method+' '+path+' exists');
  const res={statusCode:200,status(x){this.statusCode=x;return this;},json(x){this.value=x;return this;}};
  await h({authUser:{id:user},params,body},res);return res;
 }
 return {rows,docs,call};
}
test('V5 server route create, PATCH and independent PHOTO succeed',async()=>{
 const h=harness();
 let r=await h.call('POST','/api/v5/animals',{id:'qqq',data:{name:'Cow',weight:400}});assert.equal(r.statusCode,201);
 r=await h.call('PATCH','/api/v5/animals/:id',{expectedVersion:1,changes:{weight:450},removed:[]},'farmer-a',{id:'qqq'});
 assert.equal(r.statusCode,200);assert.equal(r.value.version,2);
 r=await h.call('PUT','/api/v5/animals/:id/photo',{expectedVersion:0,photo:'data:image/jpeg;base64,QUJD'},'farmer-a',{id:'qqq'});
 assert.equal(r.value.photoVersion,1);assert.equal(h.rows.get('farmer-a|qqq').data.weight,450);
 assert.equal(h.rows.get('farmer-a|qqq').photo,'data:image/jpeg;base64,QUJD');
});
test('two animal IDs get independent versions and no group conflict',async()=>{
 const h=harness();await h.call('POST','/api/v5/animals',{id:'qqq',data:{weight:400}});
 await h.call('POST','/api/v5/animals',{id:'Ttt',data:{weight:400}});
 const one=await h.call('PATCH','/api/v5/animals/:id',{expectedVersion:1,changes:{weight:420},removed:[]},'farmer-a',{id:'qqq'});
 const two=await h.call('PATCH','/api/v5/animals/:id',{expectedVersion:1,changes:{weight:430},removed:[]},'farmer-a',{id:'Ttt'});
 assert.equal(one.statusCode,200);assert.equal(two.statusCode,200);
});
test('stale writes and stale photo writes are rejected',async()=>{
 const h=harness();await h.call('POST','/api/v5/animals',{id:'cow',data:{weight:400}});
 await h.call('PATCH','/api/v5/animals/:id',{expectedVersion:1,changes:{weight:500}},'farmer-a',{id:'cow'});
 const stale=await h.call('PATCH','/api/v5/animals/:id',{expectedVersion:1,changes:{weight:600}},'farmer-a',{id:'cow'});
 assert.equal(stale.statusCode,409);assert.equal(h.rows.get('farmer-a|cow').data.weight,500);
 await h.call('PUT','/api/v5/animals/:id/photo',{expectedVersion:0,photo:'data:image/jpeg;base64,QUJD'},'farmer-a',{id:'cow'});
 const stalePhoto=await h.call('PUT','/api/v5/animals/:id/photo',{expectedVersion:0,photo:'data:image/jpeg;base64,QkJC'},'farmer-a',{id:'cow'});
 assert.equal(stalePhoto.statusCode,409);
});
test('account scoping protects against cross-farm edits and reads',async()=>{
 const h=harness();await h.call('POST','/api/v5/animals',{id:'cow',data:{name:'Alice'}} ,'alice');
 let state=await h.call('GET','/api/v5/state',{},'bob');assert.equal(state.value.animals.length,0);
 let changed=await h.call('PATCH','/api/v5/animals/:id',{expectedVersion:1,changes:{name:'Bob'}},'bob',{id:'cow'});
 assert.equal(changed.statusCode,409);assert.equal(h.rows.get('alice|cow').data.name,'Alice');
});
test('invalid photos and identity fields fail validation before database write',async()=>{
 const h=harness();let r=await h.call('POST','/api/v5/animals',{id:'cow',data:{farmerId:'other'}});assert.equal(r.statusCode,400);
 await h.call('POST','/api/v5/animals',{id:'cow',data:{name:'Cow'}});
 r=await h.call('PUT','/api/v5/animals/:id/photo',{expectedVersion:0,photo:'javascript:alert(1)'},'farmer-a',{id:'cow'});
 assert.equal(r.statusCode,400);
});
test('DELETE removes only matching version and only owned animal',async()=>{
 const h=harness();await h.call('POST','/api/v5/animals',{id:'cow',data:{name:'Cow'}});
 let r=await h.call('DELETE','/api/v5/animals/:id',{expectedVersion:1},'bob',{id:'cow'});assert.equal(r.statusCode,409);
 r=await h.call('DELETE','/api/v5/animals/:id',{expectedVersion:1},'farmer-a',{id:'cow'});assert.equal(r.statusCode,200);assert.equal(h.rows.size,0);
});
