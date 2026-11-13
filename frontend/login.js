/* Live sign-in. The server checks hashed passwords and issues a secure session cookie. */
document.addEventListener('DOMContentLoaded',function(){
 const form=document.getElementById('loginForm'),email=document.getElementById('email'),password=document.getElementById('password'),toggle=document.getElementById('togglePassword'),message=document.getElementById('loginMessage'),button=form?.querySelector('[type="submit"]');
 if(toggle)toggle.addEventListener('click',()=>{password.type=password.type==='password'?'text':'password';toggle.textContent=password.type==='password'?'Show':'Hide';});
 if(!form)return;
 form.addEventListener('submit',async function(e){
  e.preventDefault();button.disabled=true;button.textContent='Signing in…';message.textContent='';message.className='login-message';
  try{
   await LMAuth.login(email.value.trim(),password.value);
   message.textContent='Signed in successfully.';message.classList.add('success');
   const next=new URLSearchParams(location.search).get('next');
   const safe=/^[a-z0-9-]+\.html$/i.test(next||'')&&!['login.html','register.html','reset-password.html'].includes(next)?next:'dashboard.html';
   location.href=safe;
  }catch(err){
   message.classList.add('error');message.textContent=err.message;
   if(err.code==='EMAIL_UNVERIFIED'){
    const link=document.createElement('a');link.href='check-email.html?email='+encodeURIComponent(email.value.trim());link.textContent='Resend verification email';message.append(' ',link);
   }
   button.disabled=false;button.textContent='Login';
  }
 });
});
