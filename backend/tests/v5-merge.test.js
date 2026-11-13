'use strict';const test=require('node:test');const assert=require('node:assert/strict');
const M=require('../../frontend/v5-merge');
test('merge respects disjoint fields',()=>{const base={weight:400,photo:'old'},local={weight:450,photo:'old'},remote={weight:400,photo:'new'};let r=M.merge(base,local,remote);assert.equal(r.ok,true);assert.equal(r.value.weight,450);assert.equal(r.value.photo,'new');});
test('merge distinguishes simultaneous changes to one field',()=>{let r=M.merge({weight:400},{weight:500},{weight:600});assert.equal(r.ok,false);assert.equal(r.path,'value.weight');});
test('merge fingerprints large image strings safely',()=>{const pic='abc'.repeat(3000);let b=M.snap({photo:pic,weight:400});assert.equal(JSON.stringify(b).includes(pic),false);assert.equal(M.eq(b,{photo:pic,weight:400}),true);assert.equal(M.merge(b,{photo:pic,weight:450},{photo:'other',weight:400}).value.weight,450);});
test('array logs append without dropping entries',()=>{let base=[{text:'old'}],local=[{text:'old'},{text:'local'}],remote=[{text:'old'},{text:'remote'}];let r=M.merge(base,local,remote);assert.equal(r.ok,true);assert.equal(r.value.length,3);});
test('no lost edit on delete vs edit',()=>{let r=M.merge({weight:400},M.ABSENT,{weight:450});assert.equal(r.ok,false);});
