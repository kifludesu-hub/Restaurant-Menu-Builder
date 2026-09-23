async function initSignup(){
  const form=document.querySelector("#signupForm"),msg=document.querySelector("#msg");
  form.addEventListener("submit",async e=>{
    e.preventDefault(); msg.textContent="Creating account…";
    const name=document.querySelector("#name").value.trim(),email=document.querySelector("#email").value.trim(),password=document.querySelector("#password").value,restaurant=document.querySelector("#restaurant").value.trim(),slug=document.querySelector("#slug").value.trim().toLowerCase();
    const {data,error}=await desuSupabase.auth.signUp({email,password,options:{data:{full_name:name}}});
    if(error){msg.textContent=error.message;return}
    if(!data.session){msg.textContent="Account created. Check your email to confirm, then log in to finish setting up your restaurant.";return}
    // The profile row is created server-side by the on_auth_user_created trigger.
    // Only create the restaurant here, once we actually have an authenticated session.
    const {error:rErr}=await desuSupabase.from("restaurants").insert({owner_id:data.user.id,name:restaurant,slug});
    if(rErr){msg.textContent=rErr.message;return}
    msg.textContent="Account created. Redirecting…";
    location.href="/dashboard.html";
  });
}
async function initLogin(){
  const form=document.querySelector("#loginForm"),msg=document.querySelector("#msg");
  form.addEventListener("submit",async e=>{
    e.preventDefault();msg.textContent="Logging in…";
    const {data,error}=await desuSupabase.auth.signInWithPassword({email:document.querySelector("#email").value.trim(),password:document.querySelector("#password").value});
    if(error){msg.textContent=error.message;return}
    location.href="/dashboard.html";
  });
}
