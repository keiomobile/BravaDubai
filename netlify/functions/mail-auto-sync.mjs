import { getDatabase } from "@netlify/database";
import { mailAccessToken, mailProviderFor, mailAudit } from "./api.mjs";

const db=getDatabase();

async function cache(accountId,m){
  if(!m||!m.providerThreadId)return;
  const id="mth_"+Buffer.from(accountId+":"+m.providerThreadId).toString("base64url").slice(0,48);
  await db.sql`INSERT INTO mail_threads (id,provider_thread_id,account_id,subject,participants,preview,last_message_at,unread,has_attachments)
    VALUES (${id},${m.providerThreadId},${accountId},${m.subject||""},${JSON.stringify([m.from].concat(m.to||[]).filter(Boolean))}::jsonb,${m.preview||""},${m.receivedAt||m.sentAt||null},${!m.isRead},${!!m.hasAttachments})
    ON CONFLICT (account_id,provider_thread_id) DO UPDATE SET subject=EXCLUDED.subject,participants=EXCLUDED.participants,preview=EXCLUDED.preview,last_message_at=EXCLUDED.last_message_at,unread=EXCLUDED.unread,has_attachments=EXCLUDED.has_attachments,updated_at=NOW()`;
}

export default async()=>{
  const accounts=await db.sql`SELECT * FROM mail_accounts WHERE active=TRUE AND encrypted_refresh_token IS NOT NULL ORDER BY created_at ASC LIMIT 12`;
  let synced=0,failed=0;
  for(const account of accounts){
    try{
      const token=await mailAccessToken(account),provider=mailProviderFor(account,token);
      let cursor=account.last_delta_link||null,finalDelta=null;
      for(let page=0;page<3;page++){
        const delta=await provider.syncDelta({folderId:"inbox",deltaLink:cursor});
        for(const m of delta.messages||[]){await cache(account.id,m);synced++;}
        if(delta.deltaLink){finalDelta=delta.deltaLink;break;}
        if(!delta.nextLink)break;
        cursor=delta.nextLink;
      }
      if(finalDelta)await db.sql`UPDATE mail_accounts SET last_delta_link=${finalDelta},last_error=NULL,active=TRUE,updated_at=NOW() WHERE id=${account.id}`;
      await mailAudit(account.id,null,"auto_sync",null,{messages:synced});
    }catch(e){failed++;try{await db.sql`UPDATE mail_accounts SET last_error=${String(e&&e.message||e).slice(0,180)},updated_at=NOW() WHERE id=${account.id}`;}catch(e2){}}
  }
  console.log(JSON.stringify({ok:failed===0,accounts:accounts.length,synced,failed}));
};

export const config={schedule:"*/5 * * * *"};
