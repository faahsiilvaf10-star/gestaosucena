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
