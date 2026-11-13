import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock da supabase para simular global_settings em memória
let mockDb: Record<string, any> = {};

vi.mock("./supabase", () => {
  return {
    supabase: {
      from: (table: string) => ({
        select: (cols: string) => ({
          eq: (col: string, val: string) => ({
            single: async () => {
              if (mockDb[val] !== undefined) {
                return { data: { value: mockDb[val] }, error: null };
              }
              return { data: null, error: { code: "PGRST116" } };
            },
            maybeSingle: async () => {
              if (mockDb[val] !== undefined) {
                return { data: { value: mockDb[val] }, error: null };
              }
              return { data: null, error: null };
            },
          }),
        }),
        upsert: async (record: { key: string; value: any }) => {
          mockDb[record.key] = record.value;
          return { error: null };
        },
      }),
    },
  };
});

import {
  extractWhatsappGroups,
  applyWhatsappGroups,
  getWhatsappSettings,
  saveWhatsappSettings,
  WHATSAPP_DEFAULT_GROUPS,
  type WhatsappSettings,
} from "./settings";

describe("Isolamento de Grupos de WhatsApp por Ambiente", () => {
  beforeEach(() => {
    localStorage.clear();
    mockDb = {};
    vi.clearAllMocks();
  });

  it("extractWhatsappGroups deve extrair todos os IDs de grupos", () => {
    const mockSettings: WhatsappSettings = {
      url: "https://api.w-api.app",
      instanceId: "INST_TEST",
      token: "TOKEN_TEST",
      groupId: "grupo_geral@g.us",
      interval: 30,
      ddsReminders: { enabled_0600: true, enabled_1600: true, specificGroupId: "grupo_dds@g.us" },
      requisitionAlerts: { enabled: true, specificGroupId: "grupo_req@g.us" },
      purchaseOrders: { enabled_group: true, enabled_individual: false, specificGroupId: "grupo_po@g.us" },
    };

    const groups = extractWhatsappGroups(mockSettings);
    expect(groups.groupId).toBe("grupo_geral@g.us");
    expect(groups.ddsReminders).toBe("grupo_dds@g.us");
    expect(groups.requisitionAlerts).toBe("grupo_req@g.us");
    expect(groups.purchaseOrders).toBe("grupo_po@g.us");
  });

  it("applyWhatsappGroups deve sobrepor os grupos sem alterar url, instanceId e token", () => {
    const baseSettings: WhatsappSettings = {
      url: "https://api.w-api.app",
      instanceId: "INST_COMPARTILHADA",
      token: "TOKEN_COMPARTILHADO",
      groupId: WHATSAPP_DEFAULT_GROUPS.LIDERANCA,
      interval: 30,
      ddsReminders: { enabled_0600: true, enabled_1600: true, specificGroupId: WHATSAPP_DEFAULT_GROUPS.AVISOS },
    };

    const civilGroups = {
      groupId: "civil_lideranca@g.us",
      ddsReminders: "civil_dds@g.us",
    };

    const result = applyWhatsappGroups(baseSettings, civilGroups);
    expect(result.url).toBe("https://api.w-api.app");
    expect(result.instanceId).toBe("INST_COMPARTILHADA");
    expect(result.token).toBe("TOKEN_COMPARTILHADO");
    expect(result.groupId).toBe("civil_lideranca@g.us");
    expect(result.ddsReminders?.specificGroupId).toBe("civil_dds@g.us");
  });

  it("getWhatsappSettings para hydro-civil deve iniciar com grupos em branco sem vazar os grupos padrão de Barcarena", async () => {
    // Banco simulado com credenciais compartilhadas e grupos de Barcarena
    mockDb["whatsapp_settings"] = {
      url: "https://api.w-api.app",
      instanceId: "LITE-GU764Y-QVE8TW",
      token: "token_seguro",
      groupId: WHATSAPP_DEFAULT_GROUPS.LIDERANCA,
      interval: 30,
    };

    // Busca para Barcarena: deve trazer o groupId de Barcarena
    const barcarenaSettings = await getWhatsappSettings("barcarena");
    expect(barcarenaSettings.url).toBe("https://api.w-api.app");
    expect(barcarenaSettings.instanceId).toBe("LITE-GU764Y-QVE8TW");
    expect(barcarenaSettings.groupId).toBe(WHATSAPP_DEFAULT_GROUPS.LIDERANCA);

    // Busca para Hydro Civil: credenciais devem ser as mesmas, mas grupos vazios
    const civilSettings = await getWhatsappSettings("hydro-civil");
    expect(civilSettings.url).toBe("https://api.w-api.app");
    expect(civilSettings.instanceId).toBe("LITE-GU764Y-QVE8TW");
    expect(civilSettings.token).toBe("token_seguro");
    // Grupos devem estar vazios ("") para o usuário preencher os IDs reais do Civil
    expect(civilSettings.groupId).toBe("");
    expect(civilSettings.ddsReminders?.specificGroupId).toBe("");
    expect(civilSettings.requisitionAlerts?.specificGroupId).toBe("");
  });

  it("salvar grupos em hydro-civil salva no storage específico e não corrompe Barcarena", async () => {
    mockDb["whatsapp_settings"] = {
      url: "https://api.w-api.app",
      instanceId: "LITE-GU764Y-QVE8TW",
      token: "token_seguro",
      groupId: WHATSAPP_DEFAULT_GROUPS.LIDERANCA,
      interval: 30,
      ddsReminders: { enabled_0600: false, enabled_1600: false, specificGroupId: WHATSAPP_DEFAULT_GROUPS.AVISOS },
    };

    // Salva configurações personalizadas para o Civil
    const civilSettingsToSave: WhatsappSettings = {
      url: "https://api.w-api.app",
      instanceId: "LITE-GU764Y-QVE8TW",
      token: "token_seguro",
      groupId: "120363999999999999@g.us",
      interval: 30,
      ddsReminders: { enabled_0600: true, enabled_1600: false, specificGroupId: "120363888888888888@g.us" },
    };

    await saveWhatsappSettings(civilSettingsToSave, "hydro-civil");

    // Verifica que o Civil carrega seus novos grupos
    const loadedCivil = await getWhatsappSettings("hydro-civil");
    expect(loadedCivil.groupId).toBe("120363999999999999@g.us");
    expect(loadedCivil.ddsReminders?.specificGroupId).toBe("120363888888888888@g.us");

    // Verifica que Barcarena mantém seus grupos originais intactos
    const loadedBarcarena = await getWhatsappSettings("barcarena");
    expect(loadedBarcarena.groupId).toBe(WHATSAPP_DEFAULT_GROUPS.LIDERANCA);
    expect(loadedBarcarena.ddsReminders?.specificGroupId).toBe(WHATSAPP_DEFAULT_GROUPS.AVISOS);
  });
});
