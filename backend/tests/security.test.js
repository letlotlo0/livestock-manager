'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const sec=require('../security');
const {makeEmail}=require('../email');

test('password is hashed, verified, and random salted',async()=>{
 const password='Do not reuse this test passphrase 2026!';
 const a=await sec.hashPassword(password),b=await sec.hashPassword(password);
 assert.notEqual(a,b);assert.ok(!a.includes(password));
 assert.equal(await sec.checkPassword(password,a),true);
 assert.equal(await sec.checkPassword('wrong-password',a),false);
 assert.equal(await sec.checkPassword('wrong-password','malformed'),false);
});
test('password constraints & email normalization',()=>{
 assert.equal(sec.validPassword('123456789012'),true);
 assert.equal(sec.validPassword('short'),false);
 assert.equal(sec.validPassword('a'.repeat(129)),false);
 assert.equal(sec.normalizeEmail('  Farmer@Example.COM '),'farmer@example.com');
 assert.equal(sec.validEmail('farmer@example.com'),true);
 assert.equal(sec.validEmail('invalid-email'),false);
});
test('random tokens are unique and only digests need storage',()=>{
 const a=sec.randomToken(),b=sec.randomToken();assert.notEqual(a,b);
 assert.ok(a.length>=40);assert.equal(sec.digest(a).length,64);assert.notEqual(sec.digest(a),a);
});
test('email templates encode untrusted farmer name',()=>{
 const {html,text}=makeEmail({kind:'verify',name:'<script>alert(1)</script>',link:'https://example.com/verify-email.html?token=safe'});
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(text.includes('24 hours'));
});
