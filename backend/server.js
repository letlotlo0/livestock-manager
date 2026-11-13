'use strict';
const path = require('node:path');
const {Pool}=require('pg');
const {createApp}=require('./app');
const {createSender}=require('./email');
if (process.env.LM_V5_TEST_ONLY !== 'true') {console.error('V5 preview requires LM_V5_TEST_ONLY=true; never deploy on the production service.');process.exit(1);}
if (!process.env.TEST_FARM_EMAIL || !process.env.TEST_FARM_PASSWORD) {console.error('Set TEST_FARM_EMAIL and TEST_FARM_PASSWORD for V5 preview.');process.exit(1);}
if (!process.env.DATABASE_URL || !process.env.APP_ORIGIN || !/^https?:\/\//.test(process.env.APP_ORIGIN)) {
  console.error('DATABASE_URL and a valid APP_ORIGIN must be configured.');process.exit(1);
}
if (process.env.NODE_ENV !== 'development' && (!process.env.APP_ORIGIN.startsWith('https://') || (!process.env.TEST_FARM_EMAIL && (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)))) {
  console.error('Production requires HTTPS APP_ORIGIN, RESEND_API_KEY, and MAIL_FROM.');process.exit(1);
}
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const app=createApp({pool,origin:process.env.APP_ORIGIN.replace(/\/$/,''),sendMail:createSender()});
// You can serve the complete frontend from Render, or host it on Netlify with an /api proxy.
if (process.env.SERVE_FRONTEND === 'true') {
  const express=require('express');
  const root=path.resolve(__dirname,'..','frontend');
  app.use(express.static(root,{index:'index.html',dotfiles:'deny',extensions:['html']}));
}
const port=Number(process.env.PORT||10000);
app.listen(port,'0.0.0.0',()=>console.log('Livestock Manager authentication API listening on '+port));
