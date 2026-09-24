# Publicação

Requisitos: Node ≥ 22.13, disco persistente para `data/` (banco SQLite e uploads), HTTPS na frente (Caddy, Nginx ou a plataforma).

```bash
NODE_ENV=production PORT=3000 \
PUBLIC_URL=https://agitae.exemplo.com.br \
PAYMENT_MODE=test PAYMENT_WEBHOOK_SECRET=<segredo longo aleatório> \
DATABASE_FILE=/var/lib/agitae/agitae.db UPLOAD_DIR=/var/lib/agitae/uploads \
node server/index.js
```

- Em `NODE_ENV=production` os dados de demonstração **não** são carregados. Crie o primeiro administrador via SQL (`UPDATE users SET roles='cliente,admin' WHERE email='você@…'`) após se cadastrar.
- `PUBLIC_URL` com `https://` ativa o atributo `Secure` do cookie. Sirva **somente** por HTTPS.
- Atrás de proxy: o rate limit usa o IP do socket; configure o proxy para limitar também (ou adapte para `X-Forwarded-For` confiável).
- Um processo só (SQLite em modo WAL). Para múltiplas instâncias/alta escala, migre para PostgreSQL (o SQL usado é simples; troque `server/db.js`).
- **Modo `PAYMENT_MODE=live`** só depois de implementar o adaptador (veja `PAYMENTS.md`).

## Docker (exemplo)
```dockerfile
FROM node:24-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3000
VOLUME /app/data
CMD ["node", "server/index.js"]
```

## Backups
`npm run backup` gera cópia consistente (`VACUUM INTO`) em `data/backups`, mantendo `BACKUP_KEEP` (14) arquivos. Agende (cron) e copie para armazenamento externo; **copie também `UPLOAD_DIR`**. Teste a restauração periodicamente (basta apontar `DATABASE_FILE` para o arquivo do backup).

## Monitoramento e logs
Logs em JSON por requisição (`stdout`) e erros com stack; use `GET /api/health` em health-check/uptime. E-mails saem para a tabela `emails` (outbox) — para envio real, implemente o envio SMTP a partir de `SMTP_URL` em `sendEmail` (`server/util.js`).

## Antes de abrir ao público
Revisar a Política de Privacidade e os Termos com assessoria jurídica; definir contato do encarregado (LGPD); ativar pagamentos reais; configurar SMTP; trocar `PAYMENT_WEBHOOK_SECRET`; revisar comissão em *Admin → Configurações*.
