import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://svacqjpyjniejqfmuwhl.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OhDMp29ICi6tpYWqBT67tQ_EJ1cAla0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: setting } = await supabase.from('global_settings').select('value').eq('key', 'whatsapp_settings').single();
  const ws = setting.value;

  const { data: users } = await supabase.rpc('get_users');
  const { data: ddsData } = await supabase.from('seguranca_dds').select('*').eq('date', '2026-09-22').single();
  const user = users.find(u => u.id === ddsData.palestrante_id);
  
  let msg = ws.messageTemplates?.ddsAmanha || '🎤 *Aviso Prévio DDS - Amanhã*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (amanhã)\n📋 {tema}\n\n_Mensagem automática - Sucena_';
  msg = msg.replace('{palestrante}', user ? user.name : 'Não informado')
           .replace('{data}', '22/09/2026')
           .replace('{tema}', ddsData.tema || 'TEMA A DEFINIR');

  let baseUrl = ws.url.trim();
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.includes('painel.w-api.app')) baseUrl = 'https://api.w-api.app/v1';
  else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) baseUrl = baseUrl + '/v1';
  
  const endpoint = `${baseUrl}/messages/send-text?instanceId=${ws.instanceId}`;
  
  // We send to the Group because the speaker's private number is not accessible in this context without a service role key.
  const number = ws.ddsReminders.specificGroupId || ws.groupId;

  console.log(`Sending to ${number}...`);
  const payload = { number, phone: number, text: msg, message: msg };
  
  let res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ws.token}`, 'apikey': ws.token },
    body: JSON.stringify(payload)
  });
  if (res.status === 404) {
    const fallback = endpoint.includes('/message/') ? endpoint.replace('/message/', '/messages/') : endpoint.replace('/messages/', '/message/');
    res = await fetch(fallback, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ws.token}`, 'apikey': ws.token }, body: JSON.stringify(payload) });
  }
  console.log(res.status, await res.text());
}
run();
