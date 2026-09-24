# Demonstração estática (GitHub Pages)

O GitHub Pages só serve arquivos; por isso a demo **roda o servidor dentro do navegador**: as mesmas rotas e regras de `server/` (busca, preços, pedidos, pagamento de teste, admin…) executam sobre SQLite em WebAssembly ([sql.js](https://sql.js.org)). Não há servidor, e os dados ficam **apenas no navegador de quem visita** (localStorage) — cada pessoa tem a sua cópia. O botão *Restaurar demonstração* (rodapé) volta ao estado inicial.

## Publicar
```bash
npm install            # uma vez (esbuild, sql.js e buffer são só para o build da demo)
npm run publish:demo   # gera dist-demo/ e envia para a branch gh-pages
```
Depois, em *Settings → Pages* do repositório, escolha **Deploy from a branch → gh-pages → / (root)** (ou use `gh api`). A URL fica `https://<usuário>.github.io/<repositório>/`.

Testar localmente: `npm run build:demo && npm run serve:demo` → http://localhost:4173/Pendo-Agitae/

## Diferenças da versão com servidor
- Dados só locais (não há contas nem pedidos compartilhados entre pessoas).
- Upload de imagens desativado (cole URLs). E-mails não são enviados.
- Senhas usam um hash simples de demonstração (nada sensível: os dados são fictícios).
- Pagamentos: sempre modo teste.
- Para uso real (dados compartilhados, contas, pagamentos) publique o servidor Node — veja `DEPLOY.md`.
