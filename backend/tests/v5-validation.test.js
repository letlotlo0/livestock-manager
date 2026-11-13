'use strict';const test=require('node:test');const assert=require('node:assert/strict');
const v=require('../v5-validation');
test('per-animal identifiers safe and valid',()=>{assert.ok(v.idOk('1794302533848'));assert.equal(v.idOk('a/b'),false);assert.equal(v.idOk(''),false);});
test('animal cannot smuggle photo or identity via fields',()=>{assert.equal(v.validFields({name:'cow',weight:400}),true);assert.equal(v.validFields({photo:'data:'}),false);assert.equal(v.validFields({farmerId:'other'}),false);assert.equal(v.validFields(null),false);});
test('photo validation rejects scripts and oversize data',()=>{assert.ok(v.validPhoto(''));assert.ok(v.validPhoto('data:image/jpeg;base64,QUJD'));assert.equal(v.validPhoto('data:text/html;base64,QUJD'),false);assert.equal(v.validPhoto('data:image/jpeg;base64,garbage'),false);assert.equal(v.validPhoto('data:image/jpeg;base64,'+'QUJD'.repeat(800000)),false);});
