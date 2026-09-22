import { createClient } from "@supabase/supabase-js";
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}})}
export default async function handler(req){
 if(req.method!=="POST")return json({error:"POST only"},405);
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.CHAPA_SECRET_KEY)return json({error:"Server environment is not configured"},500);
 let body;try{body=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 const tx=body.tx_ref;if(!tx)return json({error:"tx_ref required"},400);
 const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const {data:p,error:perr}=await admin.from("payments").select("*").eq("tx_ref",tx).maybeSingle();if(perr||!p)return json({error:"Payment not found"},404);
 const response=await fetch(`https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(tx)}`,{headers:{Authorization:`Bearer ${process.env.CHAPA_SECRET_KEY}`}});
 const result=await response.json().catch(()=>({}));
 const providerStatus=String(result.data?.status||result.status||"").toLowerCase();
 const success=result.status==="success" && (providerStatus==="success"||providerStatus==="completed");
 if(success && Number(result.data?.amount??p.amount)===Number(p.amount) && String(result.data?.currency??p.currency).toUpperCase()===p.currency){
   await admin.from("payments").update({status:"success",provider_response:result,verified_at:new Date().toISOString()}).eq("id",p.id);
   const months=1;const start=new Date();const end=new Date(start);end.setMonth(end.getMonth()+months);
   await admin.from("restaurants").update({plan:p.plan,subscription_status:"ACTIVE",subscription_started_at:start.toISOString(),subscription_expires_at:end.toISOString()}).eq("id",p.restaurant_id);
   return json({success:true,status:"ACTIVE",expires_at:end.toISOString()});
 }
 await admin.from("payments").update({status:"failed",provider_response:result}).eq("id",p.id);
 return json({success:false,status:"FAILED"},400);
}