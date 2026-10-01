# Resolução de Problemas: DDS e Inspeção de Cintas

## 1. Notificação Privada do DDS (Amanhã / Hoje)

### Problema Identificado
As mensagens de "DDS Amanhã" e "DDS Hoje" configuradas no painel Administrador não estavam sendo enviadas automaticamente porque o sistema não possuía um verificador de horário em segundo plano (um "Cron" interno) para disparar essas mensagens às 16:00 (para o palestrante do dia seguinte) e às 06:00 (para o palestrante do dia atual).

### Solução Proposta
1. Criar um novo componente invisível chamado `DdsAlertManager.tsx`.
2. Incluir esse componente no `AppLayout.tsx` para que ele rode silenciosamente enquanto o sistema estiver aberto.
3. O componente irá verificar a cada minuto:
   - Se for **16:00 (Horário do Pará)**, ele verifica no banco quem é o palestrante de amanhã, busca o telefone privado dele no banco de dados, e dispara a notificação `ddsAmanha` direto para ele.
   - Se for **06:00 (Horário do Pará)**, ele faz o mesmo para o palestrante de hoje com a notificação `ddsHoje`.
4. Um controle local (`localStorage`) impedirá que a mensagem seja enviada de forma duplicada no mesmo dia.

#### [NEW] src/components/DdsAlertManager.tsx
- Lógica de verificação de horário e disparo da notificação de DDS.

#### [MODIFY] src/components/AppLayout.tsx
- Importar e renderizar o `<DdsAlertManager />`.

---

## 2. Comportamento do Alerta de Cintas no Dashboard

### Problema Identificado
Você solicitou que "Ao inspecionar e salvar, ficará salvo no banco e no histórico, e irá desaparecer do Dashboard, só mostrando no próximo mês novamente".
Atualmente, a lógica de salvar no banco e ocultar do mês corrente *já está implementada*. Porém, após você clicar em salvar, o sistema **te redireciona para a tela de Cintas** (`/seguranca/cintas`), tirando você do Dashboard.

### Solução Proposta
Vou remover o redirecionamento (`navigate`) automático após a inspeção. Assim, quando você salvar, a janelinha apenas fechará e o alerta sumirá do Dashboard na mesma hora, mantendo você na tela inicial, exatamente como solicitado!

#### [MODIFY] src/components/seguranca/AlertaInspecaoMensal.tsx
- Remover a linha `navigate({ to: '/seguranca/cintas' })` no método `handleSaveBatch`.

---

## Perguntas Abertas / Solicitação de Aprovação
> [!IMPORTANT]
> - O horário padrão do servidor/fábrica para disparo será baseado no **fuso do Pará (GMT-3)**. Confirma se os horários de **16:00 (amanhã)** e **06:00 (hoje)** são os ideais para envio no WhatsApp privado do palestrante?
> - Podemos seguir com essa implementação?
