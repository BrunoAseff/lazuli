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
