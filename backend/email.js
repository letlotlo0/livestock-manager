'use strict';
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function makeEmail({kind,name,link}) {
  const subject = kind==='verify'?'Verify your Livestock Manager email':kind==='reset'?'Reset your Livestock Manager password':'Welcome to Livestock Manager';
  const greeting=`Hello ${name || 'Farmer'},`;
  const line=kind==='verify'?'Please verify your email address using the secure link below. This link expires in 24 hours.':kind==='reset'?'You requested a password reset. This link expires in 30 minutes.':'Your email has been verified. Your Livestock Manager account is ready for you to use.';
  const text = `${greeting}\n\n${line}${link?'\n\n'+link:''}\n\nIf you did not request this, you can ignore this email.\n\nLivestock Manager`;
  const html = `<div style="font-family:Arial,sans-serif;color:#163b2b;max-width:540px;margin:auto"><h2>Livestock Manager</h2><p>${escapeHTML(greeting)}</p><p>${escapeHTML(line)}</p>${link?`<p><a href="${escapeHTML(link)}" style="display:inline-block;background:#1f6c43;color:#fff;padding:12px 18px;text-decoration:none;border-radius:8px">${kind==='reset'?'Reset password':'Verify email'}</a></p><p style="word-break:break-all">${escapeHTML(link)}</p>`:''}<p style="color:#5c7064">If you did not request this, ignore this email.</p></div>`;
  return {subject,text,html};
}
function createSender(env=process.env, logger=console) {
  return async function send({to,kind,name,link}) {
    const payload = makeEmail({kind,name,link});
    if (env.EMAIL_MODE === 'console' && env.NODE_ENV === 'development' && /^http:\/\/localhost(?::\d+)?$/.test(env.APP_ORIGIN || '')) {
      logger.info(`[DEV EMAIL] ${payload.subject} -> ${to}: ${link || '(welcome email)'}`);
      return;
    }
    if (!env.RESEND_API_KEY || !env.MAIL_FROM) throw new Error('Email delivery is not configured on the server.');
    const response = await fetch('https://api.resend.com/emails', {
      method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:env.MAIL_FROM,to:[to],subject:payload.subject,text:payload.text,html:payload.html}),
      signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Email provider returned status ${response.status}`);
  };
}
module.exports={makeEmail,createSender};
