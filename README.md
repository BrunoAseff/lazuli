# Lazúli

Plataforma de gestão de conhecimento e retenção ativa.

## Estrutura

- `apps/website`: cliente React, Vite, Tailwind CSS e shadcn/ui;
- `apps/server`: API Fastify, preparada para hospedagem separada;
- `packages/shared`: contratos compartilhados entre cliente e servidor.

## Development

- Instale as dependências e copie a configuração local:

```bash
vp install
cp .env.example .env
```

Substitua `RESEND_API_KEY` pela sua chave e inicie o PostgreSQL antes da API:

```bash
vp run db:up
vp run db:migrate
```

- Execute cliente e servidor juntos:

```bash
vp run dev
```

Também é possível executar os processos separadamente:

```bash
vp run dev:website
vp run dev:server
```

## Validação

```bash
vp run ready
```

## Produção

O frontend é publicado como Cloudflare Worker com Static Assets e a API, seus workers internos, PostgreSQL e bucket
S3-compatible ficam no Railway. As configurações e os segredos de produção não são versionados.

### API

O `Dockerfile` da raiz produz uma imagem Node 22 não privilegiada com a API, o executor de
migrations e a thread de conversão de documentos. Antes de publicar uma nova versão, execute as
migrations como comando separado:

```bash
node dist/migrate.mjs
```

O processo web inicia com `node dist/index.mjs`, escuta o `PORT` fornecido pelo Railway e encerra
corretamente ao receber `SIGTERM`. O health check público é `GET /api/health`.

### Frontend

- diretório raiz: repositório inteiro;
- comando de build: `pnpm --filter website build`;
- diretório de saída: `apps/website/dist`;
- variável de build obrigatória: `VITE_API_URL=https://api.<domínio>`.

O arquivo `apps/website/public/_redirects` mantém as rotas do SPA funcionais em acessos diretos.

### Smoke test

Após publicar API e frontend:

```bash
API_URL=https://api.<domínio> WEBSITE_URL=https://<domínio> vp run deploy:smoke
```

### Backup manual do PostgreSQL

Com `pg_dump` instalado e a URL privada ou pública do banco disponível:

```bash
DATABASE_URL='postgresql://...' BACKUP_DIRECTORY=./backups vp run db:backup
```

Os dumps são criados com permissões privadas e não devem ser commitados.
