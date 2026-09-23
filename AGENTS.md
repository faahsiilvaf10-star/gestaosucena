<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## WhatsApp Integration
> [!IMPORTANT]
> Toda implementação nova de envio automático no WhatsApp API DEVE criar obrigatoriamente um modelo editável no painel Admin.
> Ao criar uma nova notificação:
> 1. Adicione a chave no `messageTemplates` em `src/lib/settings.ts`
> 2. Adicione a interface de edição em `src/routes/admin.tsx` (na aba do WhatsApp)
> 3. Use variáveis dinâmicas `{chave}` e garanta que o código (seja TSX ou SQL) faça os devidos replaces lendo da configuração antes de disparar.

## Fluxo de Trabalho e Controle de Qualidade
> [!IMPORTANT]
> - **Issues:** Antes de iniciar qualquer tarefa, crie uma Issue no GitHub categorizada como "Correção", "Melhoria" ou "Nova função".
> - **Pull Requests:** Trabalhe criando branches e submetendo Pull Requests (PRs) para gerenciar entregas e deploys, nunca fazendo commit direto na `main` a menos que explicitamente solicitado pelo usuário.
> - **Padrão de PRs:**
>   1. **Referência:** Todo PR deve mencionar a Issue relacionada na descrição (ex: `Fixes #1`).
>   2. **O que mudou:** Deve explicar claramente o que mudou no código.
>   3. **Validação:** Deve descrever exatamente como as alterações foram validadas/testadas localmente.
>   4. **Análise de Risco:** Deve registrar quaisquer riscos inerentes, limitações da abordagem e próximos passos caso existam.

## Diretrizes de UI/UX (Padrão de Qualidade)
> [!IMPORTANT]
> Garanta que toda interface do sistema tenha:
> - **Performance:** Lazy loading quando fizer sentido e Skeleton screens para carregamento.
> - **Fluidez:** Animações suaves de entrada e saída, transições consistentes entre telas, cards, modais e listas.
> - **Interatividade:** Estados de progresso nos elementos interativos e feedback visual para ações do usuário.
> - **Revisão de Qualidade:** Antes de finalizar qualquer alteração na interface, o agente deve agir como um designer de produto sênior, revisando e corrigindo proativamente tudo que parecer brusco, travado, genérico ou amador.
