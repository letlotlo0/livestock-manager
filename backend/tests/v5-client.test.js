'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const script=n=>fs.readFileSync(path.join(__dirname,'../../frontend',n),'utf8');
class TestBackend{
 constructor(){this.animals=new Map();this.docs=new Map();this.online=true;this.inject=null;this.requests=[];}
 fetchFor(user){return async(url,opts={})=>{
  this.requests.push({user,url,method:opts.method||'GET'});
  if(!this.online)throw Error('offline');
  const pathUrl=url.split('?')[0],method=opts.method||'GET',b=opts.body?JSON.parse(opts.body):{};
  const ok=(payload,status=200)=>({ok:true,status,json:async()=>payload});
  const err=(status,code,error)=>({ok:false,status,json:async()=>({code,error})});
  const key=id=>user+'|'+id;
  if(pathUrl==='/api/v5/state'&&method==='GET'){
   const animals=[...this.animals.entries()].filter(([k])=>k.startsWith(user+'|')).map(([k,v])=>({id:k.substring(user.length+1),data:v.data,version:v.version,photo:v.photo||'',photoVersion:v.photoVersion||0}));
   const records=[...this.docs.entries()].filter(([k])=>k.startsWith(user+'|')).map(([k,v])=>({key:k.substring(user.length+1),data:v.data,version:v.version}));
   return ok({apiVersion:5,animals,records});
  }
  if(pathUrl==='/api/v5/animals'&&method==='POST'){
   if(this.animals.has(key(b.id)))return err(409,'ANIMAL_CONFLICT','Duplicate');
   this.animals.set(key(b.id),{data:b.data,version:1,photo:'',photoVersion:0});return ok({id:b.id,version:1},201);
  }
  const m=pathUrl.match(/^\/api\/v5\/animals\/([^/]+)(\/photo)?$/);
  if(m){
   const id=decodeURIComponent(m[1]),original=this.animals.get(key(id));
   if(!original)return err(409,'ANIMAL_CONFLICT','Not found');
   if(method==='PATCH'){
    if(this.inject){let f=this.inject;this.inject=null;f(this,user,id);}
    if(original.version!==b.expectedVersion)return err(409,'ANIMAL_CONFLICT','Version mismatch');
    const data={...original.data,...b.changes};for(const k of b.removed||[])delete data[k];
    original.data=data;original.version++;return ok({id,version:original.version});
   }
   if(method==='DELETE'){
    if(original.version!==b.expectedVersion)return err(409,'ANIMAL_CONFLICT','Version mismatch');
    this.animals.delete(key(id));return ok({id,deleted:true});
   }
   if(method==='PUT'&&m[2]==='/photo'){
    if(original.photoVersion!==b.expectedVersion)return err(409,'PHOTO_CONFLICT','Version mismatch');
    original.photo=b.photo;original.photoVersion++;return ok({id,photoVersion:original.photoVersion});
   }
  }
  const d=pathUrl.match(/^\/api\/farm\/records\/([^/]+)$/);
  if(d&&method==='PUT'){
   const id=decodeURIComponent(d[1]),old=this.docs.get(key(id));
   if((old?.version||0)!==b.expectedVersion)return err(409,'SYNC_CONFLICT','Version mismatch');
   this.docs.set(key(id),{data:b.data,version:(old?.version||0)+1});return ok({key:id,version:(old?.version||0)+1});
  }
  return err(404,'NOT_FOUND','Wrong API '+method+' '+pathUrl);
 };}
 get(user,id){return this.animals.get(user+'|'+id);}
}
function device(api,user='farmer-a',storageData){
 const values=storageData||new Map();const listeners={};
 class Storage{
  getItem(k){k=String(k);return values.has(k)?values.get(k):null;}
  setItem(k,v){values.set(String(k),String(v));}
  removeItem(k){values.delete(String(k));}
  key(i){return [...values.keys()][i]||null;}
  get length(){return values.size;}
 }
 const localStorage=new Storage();
 localStorage.setItem('currentUser',JSON.stringify({id:user,name:'Farmer'}));
 const document={hidden:false,body:{appendChild(){}},
  getElementById(){return null;},addEventListener(t,fn){(listeners[t]??=[]).push(fn);},
  createElement(tag){return {style:{},children:[],appendChild(e){this.children.push(e);},remove(){},click(){},setAttribute(){},querySelector(){return {textContent:''}}};}
 };
 const ctx={Storage,localStorage,document,navigator:{},console,fetch:api.fetchFor(user),Map,Set,JSON,Date,Blob,URL,
  setTimeout:()=>42,clearTimeout:()=>{},setInterval:()=>43,clearInterval:()=>{},confirm:()=>false,alert:()=>{},
  location:{reload(){}},addEventListener(t,fn){(listeners[t]??=[]).push(fn);},dispatchEvent(){},
  CustomEvent:class{constructor(type,opt){this.type=type;this.detail=opt?.detail;}},
 };
 ctx.window=ctx;
 for(const file of ['cloud-config.js','v5-merge.js','livestock-cloud.js','livestock-core.js'])vm.runInNewContext(script(file),ctx,{filename:file});
 return {cloud:ctx.LivestockCloud,core:ctx.LivestockCore,storageData:values,localStorage,
  get(){return JSON.parse(localStorage.getItem('livestockAnimals')||'[]');},
  save(animals){ctx.LivestockCore.saveAnimals(animals);},
  doc(key,v){localStorage.setItem(key,JSON.stringify(v));},
  state(){return ctx.LivestockCloud.getStatus().state;},user};
}
const a=(id,props={})=>({id,name:id,type:'Cattle',weight:400,photo:'',...props});
const photo='data:image/jpeg;base64,'+'QUJD'.repeat(1000);
test('V5 clean start does not migrate v4 local animal records',async()=>{
 const api=new TestBackend(),d=device(api);
 d.storageData.set('livestockAnimals',JSON.stringify([a('old-v4')]));
 d.storageData.set('lm_v2_farmer-a_livestockAnimals',JSON.stringify([a('old-v4-scoped')]));
 d.storageData.set('lm_cloud_meta_farmer-a','{"v4":true}');
 assert.equal(await d.cloud.bootstrap({id:'farmer-a'}),true);
 assert.equal(d.get().length,0);assert.equal(api.animals.size,0);assert.equal(d.state(),'synced');
});
test('separate animals: laptop and phone save changes without group 409',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.save([a('qqq'),a('Ttt'),a('www')]);await l.cloud.sync();
 const p=device(api);await p.cloud.bootstrap({id:'farmer-a'});
 l.save(l.get().map(x=>x.id==='qqq'?{...x,sellerRemarks:'Laptop v5 test'}:x));
 p.save(p.get().map(x=>x.id==='Ttt'?{...x,sellerRemarks:'Phone v5 test'}:x));
 await l.cloud.sync();await p.cloud.sync();
 assert.equal(api.get('farmer-a','qqq').data.sellerRemarks,'Laptop v5 test');
 assert.equal(api.get('farmer-a','Ttt').data.sellerRemarks,'Phone v5 test');
 assert.equal(p.state(),'synced');await l.cloud.refresh();
 assert.equal(l.get().find(x=>x.id==='Ttt').sellerRemarks,'Phone v5 test');
});
test('same animal weight and photo are independent atomic updates',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.save([a('www')]);await l.cloud.sync();
 const p=device(api);await p.cloud.bootstrap({id:'farmer-a'});
 l.save([{...l.get()[0],weight:450}]);
 p.save([{...p.get()[0],photo}]);
 await l.cloud.sync();await p.cloud.sync();
 assert.equal(api.get('farmer-a','www').data.weight,450);
 assert.equal(api.get('farmer-a','www').photo,photo);
 assert.equal(p.get()[0].weight,450);assert.equal(l.state(),'synced');
});
test('same field changed twice blocks instead of silently overwriting',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.save([a('cow')]);await l.cloud.sync();
 const p=device(api);await p.cloud.bootstrap({id:'farmer-a'});
 l.save([{...l.get()[0],weight:420}]);p.save([{...p.get()[0],weight:450}]);
 await l.cloud.sync();await p.cloud.sync();
 assert.equal(api.get('farmer-a','cow').data.weight,420);
 assert.equal(p.get()[0].weight,450);assert.equal(p.state(),'conflict');
});
test('delete and concurrent edit is protected conflict',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.save([a('cow')]);await l.cloud.sync();const p=device(api);await p.cloud.bootstrap({id:'farmer-a'});
 l.save([{...l.get()[0],name:'Renamed'}]);p.save([]);
 await l.cloud.sync();await p.cloud.sync();
 assert.equal(p.state(),'conflict');assert.ok(api.get('farmer-a','cow'));
});
test('offline edits stay queued and sync once connection returns',async()=>{
 const api=new TestBackend(),d=device(api);await d.cloud.bootstrap({id:'farmer-a'});
 api.online=false;d.save([a('offline')]);await d.cloud.sync();
 assert.equal(d.state(),'error');assert.equal(d.get()[0].id,'offline');
 api.online=true;await d.cloud.sync();assert.equal(d.state(),'synced');assert.ok(api.get('farmer-a','offline'));
});
test('new device with same user sees cloud; different user stays isolated',async()=>{
 const api=new TestBackend(),l=device(api,'alice');await l.cloud.bootstrap({id:'alice'});
 l.save([a('one')]);await l.cloud.sync();
 const p=device(api,'alice');await p.cloud.bootstrap({id:'alice'});assert.equal(p.get().length,1);
 const other=device(api,'bob');await other.cloud.bootstrap({id:'bob'});assert.equal(other.get().length,0);
});
test('409 during PATCH retries and merges independent server change',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.save([a('cow')]);await l.cloud.sync();
 l.save([{...l.get()[0],weight:490}]);
 api.inject=(server,user,id)=>{const row=server.get(user,id);row.data={...row.data,sellerRemarks:'other-device'};row.version++;};
 await l.cloud.sync();
 assert.equal(l.state(),'synced');assert.equal(api.get('farmer-a','cow').data.weight,490);
 assert.equal(api.get('farmer-a','cow').data.sellerRemarks,'other-device');
});
test('photos on the same animal conflict without losing either copy',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.save([a('one', {photo})]);await l.cloud.sync();
 const p=device(api);await p.cloud.bootstrap({id:'farmer-a'});
 l.save([{...l.get()[0],photo:'data:image/jpeg;base64,QkJC'}]);
 p.save([{...p.get()[0],photo:'data:image/jpeg;base64,Q0ND'}]);
 await l.cloud.sync();await p.cloud.sync();assert.equal(p.state(),'conflict');
 assert.equal(api.get('farmer-a','one').photo,'data:image/jpeg;base64,QkJC');
});
test('separate farm record groups sync alongside animals',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.doc('healthRecords',[{id:'h1',animalId:'qqq'}]);l.save([a('qqq')]);await l.cloud.sync();
 assert.equal(api.docs.get('farmer-a|healthRecords').data[0].id,'h1');
 assert.ok(api.get('farmer-a','qqq'));assert.equal(l.state(),'synced');
});
test('GET failure never reports cloud synced',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 api.online=false;await l.cloud.refresh();assert.equal(l.state(),'error');
});
test('both devices adding different animals are merged on next update',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 const p=device(api);await p.cloud.bootstrap({id:'farmer-a'});
 l.save([a('laptop-new')]);p.save([a('phone-new')]);
 await p.cloud.sync();await l.cloud.sync();
 assert.equal(l.state(),'synced');assert.equal(api.animals.size,2);
 assert.ok(api.get('farmer-a','laptop-new'));assert.ok(api.get('farmer-a','phone-new'));
});
test('offline device restarts with pending edits intact',async()=>{
 const api=new TestBackend(),storage=new Map();
 const initial=device(api,'farmer-a',storage);await initial.cloud.bootstrap({id:'farmer-a'});
 api.online=false;initial.save([a('survives-restart', {sellerRemarks:'Saved offline'})]);
 await initial.cloud.sync();assert.equal(initial.state(),'error');
 api.online=true;
 const reopened=device(api,'farmer-a',storage);await reopened.cloud.bootstrap({id:'farmer-a'});
 assert.equal(reopened.state(),'synced');assert.equal(api.get('farmer-a','survives-restart').data.sellerRemarks,'Saved offline');
});
test('deleting one animal does not change the other animal',async()=>{
 const api=new TestBackend(),l=device(api);await l.cloud.bootstrap({id:'farmer-a'});
 l.save([a('keep-me'),a('delete-me')]);await l.cloud.sync();
 l.save(l.get().filter(x=>x.id!=='delete-me'));await l.cloud.sync();
 assert.equal(l.state(),'synced');assert.equal(api.animals.size,1);assert.ok(api.get('farmer-a','keep-me'));
});
test('first simultaneous additions to an empty health record group merge safely',async()=>{
 const api=new TestBackend(),l=device(api),p=device(api);
 await l.cloud.bootstrap({id:'farmer-a'});await p.cloud.bootstrap({id:'farmer-a'});
 l.doc('healthRecords',[{id:'health-l',animalId:'qqq'}]);
 p.doc('healthRecords',[{id:'health-p',animalId:'Ttt'}]);
 await p.cloud.sync();await l.cloud.sync();
 const ids=api.docs.get('farmer-a|healthRecords').data.map(x=>x.id).sort();
 assert.deepEqual(ids,['health-l','health-p']);assert.equal(l.state(),'synced');
});
