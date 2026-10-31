import { supabase } from "./supabase";

export async function isRegistrationOpen(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "registration_open")
      .single();

    if (error || !data) {
      if (error && error.code === "PGRST116") {
        await setRegistrationOpen(true);
        return true;
      }
      return true;
    }

    return data.value === true || data.value === "true";
  } catch (err) {
    console.error("Erro ao buscar status do cadastro:", err);
    return true;
  }
}

export async function setRegistrationOpen(isOpen: boolean): Promise<boolean> {
  try {
    const { error } = await supabase.from("global_settings").upsert(
      {
        key: "registration_open",
        value: isOpen,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      console.error("Erro ao salvar status do cadastro:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro ao salvar status do cadastro:", err);
    return false;
  }
}

export async function getAITokens(): Promise<{ geminiKey: string; groqKey: string }> {
  try {
    const { data, error } = await supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["ai_gemini_api_key", "ai_groq_api_key"]);

    if (error || !data) return { geminiKey: "", groqKey: "" };

    const geminiKey = data.find((r) => r.key === "ai_gemini_api_key")?.value || "";
    const groqKey = data.find((r) => r.key === "ai_groq_api_key")?.value || "";

    return { geminiKey, groqKey };
  } catch (err) {
    return { geminiKey: "", groqKey: "" };
  }
}

export async function setAITokens(geminiKey: string, groqKey: string): Promise<boolean> {
  try {
    if (geminiKey)
      await supabase
        .from("global_settings")
        .upsert(
          { key: "ai_gemini_api_key", value: geminiKey, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
    if (groqKey || groqKey === "")
      await supabase
        .from("global_settings")
        .upsert(
          { key: "ai_groq_api_key", value: groqKey, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
    return true;
  } catch (err) {
    return false;
  }
}

export type GlobalAppearanceSettings = {
  backgroundCss: string;
  opacity?: number;
  darkCardOpacity?: number;
  lightCardOpacity?: number;
};

export async function getGlobalAppearanceSettings(): Promise<GlobalAppearanceSettings> {
  try {
    const { data, error } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "global_appearance")
      .single();

    if (error || !data) {
      return {
        backgroundCss: `linear-gradient(rgba(130, 140, 170, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(130, 140, 170, 0.08) 1px, transparent 1px), linear-gradient(135deg, #d0d5ea 0%, #e6e3ee 45%, #fbe1ce 100%)`,
        opacity: 100,
        darkCardOpacity: 35,
        lightCardOpacity: 75,
      };
    }

    let parsed = data.value;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {}
    }

    return {
      backgroundCss:
        parsed?.backgroundCss ||
        `linear-gradient(rgba(130, 140, 170, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(130, 140, 170, 0.08) 1px, transparent 1px), linear-gradient(135deg, #d0d5ea 0%, #e6e3ee 45%, #fbe1ce 100%)`,
      opacity: parsed?.opacity !== undefined ? parsed.opacity : 100,
      darkCardOpacity: parsed?.darkCardOpacity !== undefined ? parsed.darkCardOpacity : 35,
      lightCardOpacity: parsed?.lightCardOpacity !== undefined ? parsed.lightCardOpacity : 75,
    };
  } catch (err) {
    return {
      backgroundCss: `linear-gradient(rgba(130, 140, 170, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(130, 140, 170, 0.08) 1px, transparent 1px), linear-gradient(135deg, #d0d5ea 0%, #e6e3ee 45%, #fbe1ce 100%)`,
      opacity: 100,
      darkCardOpacity: 35,
      lightCardOpacity: 75,
    };
  }
}

export async function saveGlobalAppearanceSettings(
  settings: GlobalAppearanceSettings,
): Promise<boolean> {
  try {
    const { error } = await supabase.from("global_settings").upsert(
      {
        key: "global_appearance",
        value: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    return !error;
  } catch (err) {
    console.error("Erro ao salvar aparência:", err);
    return false;
  }
}

export type WhatsappSettings = {
  url: string;
  instanceId: string;
  token: string;
  groupId: string;
  interval: number;
  adminPhone?: string;
  ddsReminders?: {
    enabled_0600: boolean;
    enabled_1600: boolean;
    specificGroupId: string;
  };
  requisitionAlerts?: {
    enabled: boolean;
    specificGroupId: string;
  };
  reminders?: {
    enabled: boolean;
    specificGroupId: string;
  };
  attendanceAlerts?: {
    enabled: boolean;
    specificGroupId: string;
  };
  appMotoristaAlerts?: {
    enabled: boolean;
    specificGroupId: string;
  };
  equipamentosMovimentacao?: {
    enabled: boolean;
    specificGroupId: string;
  };
  cintasInspection?: {
    enabled: boolean;
    specificGroupId: string;
  };
  purchaseOrders?: {
    enabled_group: boolean;
    enabled_individual: boolean;
    specificGroupId: string;
  };
  asoVencendo?: {
    enabled: boolean;
    specificGroupId: string;
    diasAntecipacao: number;
  };
  relatorioDiarioEquipamentos?: {
    enabled: boolean;
    specificGroupId: string;
    horaEnvio: string;
  };
  // Novo: Alertas de estoque mínimo
  estoqueMinimo?: {
    enabled: boolean;
    specificGroupId: string;
  };
  // Novo: Notificações de alteração de quantidade
  estoqueAlteracao?: {
    enabled: boolean;
    specificGroupId: string;
  };
  // Inspeção de Canteiro
  matrizResponsabilidade?: {
    enabled: boolean;
    specificGroupId: string;
  };
  campanhasSeguranca?: {
    enabled: boolean;
    specificGroupId: string;
  };
  desviosSeguranca?: {
    enabled: boolean;
    specificGroupId: string;
  };
  inspecaoCanteiro?: {
    enabled_agendamento: boolean;
    enabled_dia_inspecao_0700: boolean;
    enabled_correcao_item: boolean;
    specificGroupId: string;
  };
  analiseRisco?: {
    enabled_5_dias: boolean;
    enabled_dia_vencimento: boolean;
    specificGroupId: string;
  };
  vistoriasEquipamentos?: {
    enabled_20_dias: boolean;
    specificGroupId: string;
  };
  messageTemplates?: {
    analiseRiscoVencendo5Dias?: string;
    vistoriaEquipamentoVencendo20Dias?: string;
    analiseRiscoVencendoHoje?: string;
    campanhaSegurancaMes?: string;
    matrizResponsabilidadeLembrete?: string;
    desvioRegistrado?: string;
    inspecaoCanteiroAgendada?: string;
    inspecaoCanteiroDia?: string;
    inspecaoCanteiroCorrecao?: string;
    ddsHoje: string;
    ddsAmanha: string;
    lembreteHoje: string;
    lembreteAmanha: string;
    listaPresenca: string;
    requisicaoEpi: string;
    anomaliaRegistrada: string;
    anomaliaCorrigida: string;
    statusAlterado: string;
    cintasAvisoMensal: string;
    fimJornadaApp: string;
    inicioJornadaApp: string;
    cintasInspecionada: string;
    equipamentoEntrada: string;
    equipamentoSaida: string;
    pedidoCompraGrupo: string;
    pedidoCompraIndividual: string;
    asoVencendo: string;
    relatorioDiarioEquipamentos: string;
    // Novos templates de estoque
    estoqueMinimo: string;
    estoqueAlteracao: string;
  };
};

const defaultWhatsappSettings: WhatsappSettings = {
  url: "",
  instanceId: "",
  token: "",
  groupId: "",
  interval: 30,
  adminPhone: "",
  ddsReminders: {
    enabled_0600: false,
    enabled_1600: false,
    specificGroupId: "",
  },
  requisitionAlerts: {
    enabled: false,
    specificGroupId: "",
  },
  reminders: {
    enabled: false,
    specificGroupId: "",
  },
  attendanceAlerts: {
    enabled: false,
    specificGroupId: "",
  },
  appMotoristaAlerts: {
    enabled: true,
    specificGroupId: "",
  },
  equipamentosMovimentacao: {
    enabled: false,
    specificGroupId: "",
  },
  cintasInspection: {
    enabled: false,
    specificGroupId: "",
  },
  purchaseOrders: {
    enabled_group: false,
    enabled_individual: false,
    specificGroupId: "",
  },
  asoVencendo: {
    enabled: false,
    specificGroupId: "",
    diasAntecipacao: 20,
  },
  relatorioDiarioEquipamentos: {
    enabled: false,
    specificGroupId: "",
    horaEnvio: "08:00",
  },
  // Alertas de estoque mínimo
  estoqueMinimo: {
    enabled: false,
    specificGroupId: "",
  },
  // Notificações de alteração de quantidade
  estoqueAlteracao: {
    enabled: false,
    specificGroupId: "",
  },
  // Inspeção de Canteiro
  matrizResponsabilidade: {
    enabled: true,
    specificGroupId: "",
  },
  campanhasSeguranca: {
    enabled: true,
    specificGroupId: "",
  },
  desviosSeguranca: {
    enabled: true,
    specificGroupId: "",
  },
  inspecaoCanteiro: {
    enabled_agendamento: true,
    enabled_dia_inspecao_0700: true,
    enabled_correcao_item: true,
    specificGroupId: "",
  },
  analiseRisco: {
    enabled_5_dias: true,
    enabled_dia_vencimento: true,
    specificGroupId: "",
  },
  vistoriasEquipamentos: {
    enabled_20_dias: true,
    specificGroupId: "",
  },
  messageTemplates: {
    vistoriaEquipamentoVencendo20Dias:
      "⏳ *AVISO: VISTORIA DE EQUIPAMENTO VENCENDO EM 20 DIAS* ⏳\n\n🚜 *Equipamento:* {equipamento}\n🏷️ *Placa / TAG:* {placa_tag}\n📋 *Tipo de Vistoria / Laudo:* {tipo_vistoria}\n📅 *Data de Vencimento:* {data_vencimento}\n⏳ *Prazo Restante:* Faltam {dias_restantes} dia(s) para o vencimento!\n\n⚠️ _Por favor, providencie a renovação do laudo/manutenção com antecedência para evitar paralisação do equipamento na obra._\n_Mensagem automática - Sucena / Hydro Reabilitação_",
    analiseRiscoVencendo5Dias:
      "⏳ *AVISO: ANÁLISE DE RISCO VENCENDO EM 5 DIAS* ⏳\n\n📋 *Título:* {titulo}\n📍 *Atividade / Local:* {local}\n📅 *Válida até:* {data_validade}\n⏳ *Prazo:* Faltam 5 dias para o vencimento!\n\n⚠️ _Por favor, providencie a elaboração da nova Análise de Risco com antecedência._\n_Mensagem automática - Sucena / Hydro Reabilitação_",
    analiseRiscoVencendoHoje:
      "🚨 *ATENÇÃO: ANÁLISE DE RISCO VENCE HOJE* 🚨\n\n📋 *Título:* {titulo}\n📍 *Atividade / Local:* {local}\n📅 *Data de Vencimento:* {data_validade} (HOJE)\n\n⚠️ _A validade desta Análise de Risco expira hoje. O Técnico de Segurança deve emitir a nova análise e fechar a anterior._\n_Mensagem automática - Sucena / Hydro Reabilitação_",
    ddsHoje:
      "🎤 *Lembrete DDS - Hoje*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (hoje)\n📋 {tema}\n\n_Mensagem automática - Sucena_",
    ddsAmanha:
      "🎤 *Aviso Prévio DDS - Amanhã*\n\n👤 *Palestrante:* {palestrante}\n📅 *Data:* {data} (amanhã)\n📋 {tema}\n\n_Mensagem automática - Sucena_",
    lembreteHoje:
      "🔔 *Lembrete Automático*\n\n📌 *{titulo}*\n_{descricao}_\n\n📅 Data: {data}\n⏰ Horário: {hora}",
    lembreteAmanha:
      "⏳ *Aviso Antecipado de Lembrete*\n\n📌 *{titulo}*\n_{descricao}_\n\n📅 Data: {data}\n⏰ Horário: {hora}",
    listaPresenca:
      "📅 Data: {data}\n\n✳️  {area}  ✳️\n\n{lista_nomes}\n───────────────────────────\n{resumo}",
    requisicaoEpi:
      "🦺 *TROCA DE EPI*\n\n📅 *Data:* {data}\n👤 *Funcionário:* {nome}\n💼 *Função:* {cargo}\n🆔 *Matrícula:* {matricula}\n📝 *Motivo:* {motivo}\n✅ *Autorizado por:* {autorizador} ({matricula_autorizador})\n\n*Itens:*\n{itens}{observacao_estoque}",
    anomaliaRegistrada:
      "🚨 *NOVA ANOMALIA REPORTADA* 🚨\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag:* {tag}\n🚙 *Placa:* {placa}\n\n⚠️ *Anomalia:* {anomalia}\n📝 *Descrição:* {descricao}\n👤 *Motorista:* {motorista}",
    anomaliaCorrigida:
      "🟢 *ANOMALIA CORRIGIDA* 🟢\n\n🕒 *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag:* {tag}\n🪧 *Placa:* {placa}\n\n✅ *Resolvido:* {anomalia}\n👤 *Motorista:* {motorista}",
    statusAlterado:
      "🔄 *MUDANÇA DE STATUS* 🔄\n\n🕒 *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag:* {tag}\n🪧 *Placa:* {placa}\n\n📌 *Novo Status:* {status}\n👤 *Motorista:* {motorista}",
    cintasAvisoMensal:
      "⚠️ *AVISO DE INSPEÇÃO MENSAL DE CINTAS*\n\n📅 *Mês:* {mes}\n🎨 *Cor do mês:* {cor}\n\n🔍 As seguintes cintas precisam ser inspecionadas:\n{lista_cintas}\n\n_Por favor, realize a inspeção e registre no sistema._\n\n_Mensagem automática - Sucena_",
    fimJornadaApp:
      "🏁 *JORNADA FINALIZADA - APP MOTORISTA*\n\n🚜 *Equipamento:* {equipamento}\n👤 *Operador/Motorista:* {motorista}\n👷‍♂️ *Ajudante:* {ajudante}\n📅 *Data:* {data}\n🛣️ *KM Final:* {km}\n⏱️ *Horímetro Final:* {horimetro}\n\n_Mensagem Automática - G. Sucena_",
    cintasInspecionada:
      "✅ *INSPEÇÃO DE CINTA REGISTRADA*\n\n🔗 *Tag:* {tag}\n📋 *Descrição:* {descricao}\n🎨 *Cor:* {cor}\n📅 *Data:* {data}\n👤 *Responsável:* {responsavel}\n\n_Mensagem automática - Sucena_",
    equipamentoEntrada:
      "🚜 *ENTRADA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n\n_Mensagem automática - Sucena_",
    equipamentoSaida:
      "🚜 *SAÍDA DE EQUIPAMENTO*\n\n⏰ *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🚙 *Placa:* {placa}\n\n⚠️ *Motivo:* {motivo}\n\n_Mensagem automática - Sucena_",
    pedidoCompraGrupo:
      "📦 *NOVO PEDIDO DE COMPRA #{numero_pedido}*\n\n👤 *Requisitante:* {requisitante}\n👥 *Responsável(is):* {responsaveis}\n📅 *Data Esperada:* {data_esperada}\n🚨 *Prioridade:* {prioridade}\n📝 *Observações:* {observacoes}\n\n*Itens do Pedido:*\n{itens}\n\n_Mensagem automática - Sucena_",
    pedidoCompraIndividual:
      "📦 *NOVO PEDIDO DE COMPRA #{numero_pedido} ATRIBUÍDO A VOCÊ*\n\n👤 *Requisitante:* {requisitante}\n📅 *Data Esperada:* {data_esperada}\n🚨 *Prioridade:* {prioridade}\n📝 *Observações:* {observacoes}\n\n*Itens do Pedido:*\n{itens}\n\n_Acesse o sistema para mais detalhes._",
    inicioJornadaApp:
      "🚀 *INÍCIO DE JORNADA* 🚀\n\n🕒 *Hora:* {hora}\n🚜 *Equipamento:* {equipamento}\n🏷️ *Tag:* {tag}\n🪧 *Placa:* {placa}\n\n👤 *Motorista:* {motorista}\n👷‍♂️ *Ajudante:* {ajudante}",
    asoVencendo:
      "⚠️ *AVISO: ASO VENCENDO* ⚠️\n\n📅 *Data do aviso:* {data_aviso}\n⏰ *Vencimento em:* {dias_vencendo} dia(s)\n\n👤 *Funcionário:* {nome}\n💼 *Função:* {cargo}\n🆔 *Matrícula:* {matricula}\n📋 *Tipo de ASO:* {tipo_aso}\n📆 *Data de validade:* {data_validade}\n\n_Por favor, providencie a renovação do ASO com antecedência._\n\n_Mensagem automática - Sucena_",
    relatorioDiarioEquipamentos:
      "📊 *RELATÓRIO DIÁRIO DE EQUIPAMENTOS*\n\n📅 *Data:* {data}\n🕐 *Hora:* {hora}\n\n✅ *Em operação:* {quantidade_operando}\n🔧 *Em manutenção:* {quantidade_manutencao}\n\n{lista_manutencao}\n\n_Mensagem automática - Sucena_",
    // Templates de estoque
    estoqueMinimo:
      "⚠️ *ALERTA: ESTOQUE MÍNIMO* ⚠️\n\n📦 *Produto:* {produto}\n🏷️ *Código:* {codigo}\n📍 *Localização:* {localizacao}\n\n🔴 *Quantidade atual:* {quantidade_atual} {unidade}\n📉 *Estoque mínimo:* {estoque_minimo} {unidade}\n\n_Reponha o estoque o mais rápido possível._\n\n_Mensagem automática - Sucena_",
    estoqueAlteracao:
      "📝 *ALTERAÇÃO DE ESTOQUE*\n\n👤 *Responsável:* {responsavel}\n📦 *Produto:* {produto}\n🏷️ *Código:* {codigo}\n\n🔄 *Quantidade anterior:* {quantidade_anterior} {unidade}\n➡️ *Nova quantidade:* {nova_quantidade} {unidade}\n📝 *Diferença:* {diferenca} {unidade}\n\n_Mensagem automática - Sucena_",
            matrizResponsabilidadeLembrete:
      "📋 *LEMBRETE: MATRIZ DE RESPONSABILIDADES ({mes_nome}/{ano})* 📋\n\n⏳ *Faltam {dias_restantes} dia(s) para finalizar o mês!*\nPor favor, verifiquem o preenchimento das atividades do seu cargo na Matriz de Segurança.\n\n📊 *SITUAÇÃO ATUAL:*\n• Cargos Concluídos (100%): *{cargos_concluidos}/{total_cargos}*\n• Cargos Pendentes: *{cargos_pendentes}*\n\n✅ *JÁ PREENCHERAM / CONCLUÍDOS:*\n{lista_concluidos}\n\n⏳ *FALTA PREENCHER / PENDENTES:*\n{lista_pendentes}\n\n🔗 _Acesse o sistema e atualize as atividades da sua função antes do fechamento do mês!_\n_Mensagem automática - Sucena / Hydro Reabilitação_",
    campanhaSegurancaMes:
      "🎗️ *CAMPANHA DO MÊS: {campanha_nome} ({mes_nome})* 🎗️\n\n💡 *Conscientização:* {tema}\n\n📝 *Sobre a campanha:*\n{descricao}\n\n📢 *Mensagem:* \"{frase}\"\n\n_Mensagem automática de Segurança do Trabalho - Sucena / Hydro Reabilitação_",
    desvioRegistrado:
      "⚠️ *NOVO DESVIO DE SEGURANÇA REGISTRADO* ⚠️\n\n📌 *Título:* {titulo}\n📝 *Descrição:* {descricao}\n🚨 *Prioridade:* {prioridade}\n⚠️ *Risco:* {risco} ({gravidade})\n📂 *Categoria:* {categoria}\n📍 *Local:* {local} {area}\n\n👷 *Técnico Responsável:* {tecnico}\n👥 *Pessoas Responsáveis:* {responsaveis}\n🏢 *Empresa/Equipe:* {empresa}\n⏰ *Data Limite para Correção:* {previsao}\n\n💡 *Instrução / Sugestão:* {sugestao}\n\n_Mensagem automática - Sucena Segurança_",
    inspecaoCanteiroAgendada:
      "🏗️ *NOVA INSPEÇÃO DE CANTEIRO AGENDADA* 🏗️\n\n📅 *Data da Inspeção:* {data_inspecao}\n📍 *Local / Frente:* {local}\n👤 *Responsável:* {responsavel}\n🕒 *Turno:* {turno}\n🏗️ *Área:* {area}\n⏳ *Prazo Final:* {prazo}\n\n⚠️ *Pontos de Atenção ({total_pontos}):*\n{lista_itens}\n\n_Mensagem automática - Sucena Segurança_",
    inspecaoCanteiroDia:
      "🚨 *HOJE É DIA DE INSPEÇÃO DE CANTEIRO (07:00)* 🚨\n\n📅 *Data:* {data_inspecao} (Hoje)\n📍 *Local:* {local}\n👤 *Responsável:* {responsavel}\n🕒 *Turno:* {turno}\n🏗️ *Área:* {area}\n\n📊 *Situação Atual:*\n• Total de pontos: {total_pontos}\n• ✅ Corrigidos: {total_corrigidos}\n• ⏳ Pendentes: {total_pendentes}\n\n{lista_pendencias}\n\n_Favor verificar os pontos pendentes antes da fiscalização.\n_Mensagem automática - Sucena Segurança_",
    inspecaoCanteiroCorrecao:
      "✅ *ITEM DE INSPEÇÃO DE CANTEIRO CORRIGIDO*\n\n🏗️ *Ponto:* {titulo_item}\n📂 *Categoria:* {categoria}\n🚨 *Prioridade:* {prioridade}\n📍 *Local:* {local}\n📅 *Prazo:* {prazo}\n\n🛠️ *O que foi feito na correção:*\n{o_que_foi_feito}\n\n👤 *Atualizado por:* {usuario}\n🕒 *Concluído em:* {data_correcao}\n📊 *Progresso da Inspeção:* {total_corrigidos}/{total_pontos} itens corrigidos ({porcentagem}%)\n\n_Mensagem automática - Sucena Segurança_",
  },
};

const WHATSAPP_SETTINGS_CACHE_KEY = "sucena_whatsapp_settings_cache";

export async function getWhatsappSettings(): Promise<WhatsappSettings> {
  try {
    const { data, error } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "whatsapp_settings")
      .single();

    if (!error && data && data.value) {
      const loaded = typeof data.value === "string" ? JSON.parse(data.value) : (data.value as any);
      const loadedTemplates = loaded.messageTemplates || {};
      const mergedTemplates: any = { ...defaultWhatsappSettings.messageTemplates! };
      for (const key of Object.keys(
        defaultWhatsappSettings.messageTemplates!,
      ) as (keyof NonNullable<typeof defaultWhatsappSettings.messageTemplates>)[]) {
        if (
          loadedTemplates[key] &&
          typeof loadedTemplates[key] === "string" &&
          loadedTemplates[key].trim().length > 0
        ) {
          mergedTemplates[key] = loadedTemplates[key];
        }
      }

      const mergedSettings: WhatsappSettings = {
        ...defaultWhatsappSettings,
        ...loaded,
        messageTemplates: mergedTemplates,
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(WHATSAPP_SETTINGS_CACHE_KEY, JSON.stringify(mergedSettings));
        } catch (_) {}
      }

      return mergedSettings;
    }
  } catch (err) {
    console.warn("Erro ao buscar configs do whatsapp no Supabase, tentando cache local:", err);
  }

  // Fallback para cache local no localStorage (essencial no APK e em conexões oscilantes)
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(WHATSAPP_SETTINGS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...defaultWhatsappSettings,
          ...parsed,
          messageTemplates: {
            ...defaultWhatsappSettings.messageTemplates,
            ...(parsed.messageTemplates || {}),
          },
        };
      }
    } catch (_) {}
  }

  return defaultWhatsappSettings;
}

export async function saveWhatsappSettings(
  settings: WhatsappSettings,
): Promise<{ success: boolean; error?: string }> {
  try {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(WHATSAPP_SETTINGS_CACHE_KEY, JSON.stringify(settings));
      } catch (_) {}
    }

    const { error } = await supabase.from("global_settings").upsert(
      {
        key: "whatsapp_settings",
        value: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      console.error("Erro ao salvar configs do whatsapp:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Erro ao salvar configs do whatsapp:", err);
    return { success: false, error: err.message };
  }
}

export type EquipmentActivity = {
  id: string;
  name: string;
  icon: string;
  color: string;
  categories: string[];
};

export async function getEquipmentActivities(): Promise<EquipmentActivity[]> {
  try {
    const { data, error } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", "equipment_activities")
      .single();

    if (error || !data) {
      return [
        {
          id: "1",
          name: "Lavagem Mirante",
          icon: "Waves",
          color: "bg-zinc-900 border border-zinc-800 text-white",
          categories: [],
        },
        {
          id: "2",
          name: "Irrigação Carretel",
          icon: "Droplet",
          color: "bg-white border border-gray-200 text-gray-900",
          categories: [],
        },
        {
          id: "3",
          name: "Irrigação Faixa 3",
          icon: "Sprout",
          color: "bg-zinc-900 border border-zinc-800 text-white",
          categories: [],
        },
        {
          id: "4",
          name: "Irrigação Faixa 4",
          icon: "Sprout",
          color: "bg-white border border-gray-200 text-gray-900",
          categories: [],
        },
        {
          id: "5",
          name: "Irrigação Faixa 5",
          icon: "Sprout",
          color: "bg-zinc-900 border border-zinc-800 text-white",
          categories: [],
        },
        {
          id: "6",
          name: "Abastecimento do Tanque de Irrigação",
          icon: "Fuel",
          color: "bg-white border border-gray-200 text-gray-900",
          categories: [],
        },
        {
          id: "7",
          name: "Lavagem Vertedouro",
          icon: "Waves",
          color: "bg-zinc-900 border border-zinc-800 text-white",
          categories: [],
        },
        {
          id: "8",
          name: "Umectação de Vias",
          icon: "CloudRain",
          color: "bg-white border border-gray-200 text-gray-900",
          categories: [],
        },
        {
          id: "9",
          name: "Lavagem de Carro",
          icon: "Car",
          color: "bg-zinc-900 border border-zinc-800 text-white",
          categories: [],
        },
      ];
    }

    return data.value as EquipmentActivity[];
  } catch (err) {
    console.error("Erro ao buscar atividades:", err);
    return [];
  }
}

export async function setEquipmentActivities(
  activities: EquipmentActivity[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from("global_settings").upsert(
      {
        key: "equipment_activities",
        value: activities,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );

    if (error) {
      console.error("Erro ao salvar atividades:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error("Erro ao salvar atividades:", err);
    return { success: false, error: err.message };
  }
}
