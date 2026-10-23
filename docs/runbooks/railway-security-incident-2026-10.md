# Retomada do Railway após o incidente de 21 de outubro de 2026

Este runbook registra as ações necessárias antes de reabrir a API do Lazúli no Railway. Não inclua
valores de credenciais neste documento, em issues, commits, logs ou mensagens de deploy.

## Estado atual

- [x] Deployment da API pausado/removido no Railway.
- [x] Railway GitHub App suspenso na conta GitHub.
- [x] `OPENAI_API_KEY` rotacionada e a chave anterior revogada.
- [x] `RESEND_API_KEY` rotacionada e a chave anterior revogada.
- [x] `BETTER_AUTH_SECRET` rotacionado.
- [x] Novos segredos mantidos fora do Railway enquanto o incidente estiver ativo.
- [ ] Desenvolvimento local continua usando apenas o `.env` não versionado.

## Condições para iniciar a retomada

Não iniciar a retomada até que todos estes itens sejam verdadeiros:

- [ ] O incidente está marcado como resolvido em `status.railway.com`.
- [ ] Dashboard, API, autenticação e deploys do plano da conta estão estáveis.
- [ ] O relatório final ou a atualização de segurança da Railway foi lido.
- [ ] Não existe nova orientação da Railway que altere este procedimento.
- [ ] Existe um backup recente e restaurável do PostgreSQL.
- [ ] Audit logs e logs relevantes do período do incidente foram preservados.

## Retomada do acesso

- [ ] Autenticar novamente no Railway; sessões e tokens anteriores devem ser tratados como
      invalidados.
- [ ] Se a CLI ou uma integração usar token de API/projeto, criar um token novo e não reutilizar o
      anterior.
- [ ] Reativar/reinstalar o Railway GitHub App com acesso somente ao repositório do Lazúli.
- [ ] Confirmar no serviço da API o repositório, a branch de produção e a configuração de
      autodeploy.
- [ ] Revisar GitHub Security Log, GitHub Apps, OAuth Apps, deploy keys, webhooks e tokens antes de
      liberar novamente a integração.

## Rotação das credenciais internas do Railway

### PostgreSQL

- [ ] Identificar todos os consumidores de `DATABASE_URL`.
- [ ] No serviço PostgreSQL, usar **Database → Config → Regenerate** para trocar a senha.
- [ ] Não editar `POSTGRES_PASSWORD` manualmente e não executar `ALTER USER` como substituto da
      rotação suportada.
- [ ] Atualizar `DATABASE_URL` do serviço da API com o valor recém-gerado pelo Railway.
- [ ] Confirmar que conexões antigas foram encerradas e revisar roles, extensões e sessões
      desconhecidas.

### Bucket

- [ ] Executar uma nova rotação de credenciais do bucket após a estabilização, mesmo que a Railway
      já tenha feito uma rotação durante o incidente.
- [ ] Atualizar `S3_ACCESS_KEY_ID` e `S3_SECRET_ACCESS_KEY` do serviço da API com o novo par.
- [ ] Confirmar que `S3_BUCKET`, `S3_ENDPOINT` e `S3_REGION` ainda correspondem ao bucket de
      produção.
- [ ] Revisar o bucket em busca de objetos inesperados ou ausentes.

## Atualização dos segredos externos

Copiar os valores já rotacionados do gerenciador de segredos ou do `.env` local. Nunca imprimir o
conteúdo do `.env` no terminal, em logs ou em uma ferramenta de revisão.

- [ ] Atualizar `OPENAI_API_KEY` no serviço da API.
- [ ] Atualizar `RESEND_API_KEY` no serviço da API.
- [ ] Atualizar `BETTER_AUTH_SECRET` no serviço da API.
- [ ] Conferir que os valores antigos não permanecem em variáveis compartilhadas, ambientes de
      preview ou serviços desativados.
- [ ] Revogar todas as sessões existentes da aplicação antes de reabrir produção; a troca de
      `BETTER_AUTH_SECRET` não deve ser considerada suficiente para encerrar sessões persistidas no
      banco.

## Deploy controlado

- [ ] Revisar todas as alterações de variáveis antes de confirmar o deploy.
- [ ] Disparar apenas um deploy da API; não criar deploys duplicados enquanto houver fila ou
      instabilidade.
- [ ] Confirmar que migrations foram executadas com sucesso.
- [ ] Confirmar que `GET /api/health` responde com sucesso.
- [ ] Verificar os logs de inicialização e ausência de erros de autenticação do PostgreSQL ou do
      bucket.

## Smoke tests antes de reabrir

- [ ] Cadastro, login, logout e verificação de e-mail.
- [ ] Recuperação e alteração de senha.
- [ ] Login ou vínculo com Google, se estiver habilitado em produção.
- [ ] Envio de e-mail pelo Resend.
- [ ] Uma geração pequena e controlada pela OpenAI.
- [ ] Criação, leitura e exclusão de um arquivo no bucket.
- [ ] Leitura e escrita no PostgreSQL.
- [ ] Solicitação e recebimento de uma cópia dos dados da conta.
- [ ] Fluxos críticos do frontend contra a API publicada.
- [ ] Executar o smoke test automatizado:

```bash
API_URL=https://api.<domínio> WEBSITE_URL=https://<domínio> vp run deploy:smoke
```

## Reabertura e acompanhamento

- [ ] Somente após todos os testes, confirmar que o novo deployment está recebendo tráfego.
- [ ] Monitorar erros, autenticação, OpenAI, Resend, PostgreSQL e bucket durante a primeira hora.
- [ ] Revisar novamente os dashboards de uso e auditoria após 24 horas.
- [ ] Registrar horário, responsável e resultado de cada rotação no histórico interno do incidente.
- [ ] Manter este runbook até a publicação e revisão do relatório final da Railway.

## Critérios de interrupção

Interromper a retomada e manter a API fora do ar se ocorrer qualquer um destes casos:

- o Railway voltar a apresentar falhas de autenticação ou indisponibilidade de deploy;
- uma credencial antiga continuar funcionando após a rotação;
- aparecer atividade não reconhecida em logs, banco, bucket ou provedores externos;
- o deployment iniciar com uma variável antiga ou ausente;
- qualquer smoke test crítico falhar.
