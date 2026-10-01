import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://svacqjpyjniejqfmuwhl.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OhDMp29ICi6tpYWqBT67tQ_EJ1cAla0';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Get settings
  const { data: setting } = await supabase.from('global_settings').select('value').eq('key', 'whatsapp_settings').single();
  const ws = setting.value;

  // Get users
  const { data: users, error: usersError } = await supabase.rpc('get_users');
  if (usersError) {
    console.error("Error fetching users", usersError);
    return;
  }

  // Get today's DDS
  const { data: ddsData, error: ddsError } = await supabase.from('seguranca_dds').select('*').eq('date', '2026-09-21').single();
  if (ddsError) {
    console.error("Error fetching DDS", ddsError);
    return;
  }

  const user = users.find(u => u.id === ddsData.palestrante_id);
  if (!user) {
    console.error("User not found!");
    return;
  }

  console.log("Speaker:", user.nome, "Phone:", user.whatsapp);

  const phone = user.whatsapp;
  if (!phone) {
    console.error("User has no whatsapp configured!");
    return;
  }

  let msg = ws.messageTemplates?.ddsHoje || '🎤 *Lembrete DDS - Hoje*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (hoje)\n📋 {tema}\n\n_Mensagem automática - Sucena_';
  msg = msg.replace('{palestrante}', user.nome)
           .replace('{data}', '21/09/2026')
           .replace('{tema}', ddsData.tema || 'TEMA A DEFINIR');

  let baseUrl = ws.url.trim();
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (baseUrl.includes('painel.w-api.app')) baseUrl = 'https://api.w-api.app/v1';
  else if (baseUrl.includes('api.w-api.app') && !baseUrl.includes('/v1')) baseUrl = baseUrl + '/v1';
  
  const endpoint = `${baseUrl}/messages/send-text?instanceId=${ws.instanceId}`;
  
  // Clean phone number: remove non-digits
  const cleanPhone = phone.replace(/\D/g, '');
  const number = `${cleanPhone}@s.whatsapp.net`; // send to private number

  const payload = {
    number: number,
    phone: number,
    text: msg,
    message: msg
  };

  console.log(`Sending WhatsApp to ${number} at endpoint ${endpoint}`);
  let res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ws.token}`,
      'apikey': ws.token
    },
    body: JSON.stringify(payload)
  });

  if (res.status === 404) {
    const fallbackEndpoint = endpoint.includes('/message/') 
      ? endpoint.replace('/message/', '/messages/') 
      : endpoint.replace('/messages/', '/message/');
      
    res = await fetch(fallbackEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ws.token}`,
        'apikey': ws.token
      },
      body: JSON.stringify(payload)
    });
  }

  console.log(`WhatsApp Status: ${res.status} ${await res.text()}`);
  process.exit(0);
}

run();
