# Deploy no Easypanel

Este projeto foi ajustado para usar variaveis de ambiente do Easypanel em runtime, sem URL de banco ou dominio hardcoded na imagem Docker.

## Variaveis principais

Configure estas variaveis no painel do app no Easypanel:

```env
DATABASE_URL=postgres://usuario:senha@host:5432/database
SLUGS_ORIGIN=https://$(PRIMARY_DOMAIN)
SLUGS_APPNAME=$(PROJECT_NAME)
BETTER_AUTH_SECRET=troque-por-um-valor-longo-e-fixo
SLUGS_ADMIN_EMAIL=admin@seudominio.com
SLUGS_ADMIN_USERNAME=admin
SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD=senha-temporaria-forte
```

`DATABASE_URL` e a variavel mais importante para a aplicacao funcionar por completo. Se ela estiver ausente, o app deve subir em modo degradado em vez de entrar em crash loop, mas as telas que dependem do banco serao redirecionadas para `/db-offline`.

`SLUGS_ORIGIN` define a origem publica usada por auth, emails, organizacoes e links. No Easypanel, use `https://$(PRIMARY_DOMAIN)`. Se esta variavel nao existir, o app tenta usar `PUBLIC_ORIGIN`, `ORIGIN`, `APP_URL` ou `PRIMARY_DOMAIN`.

`BETTER_AUTH_SECRET` precisa ser estavel. Nao gere um valor novo a cada deploy, porque isso pode invalidar sessoes e tokens.

## Deploy com banco criado junto

Se voce criar um App Service normal apontando para o GitHub, o Easypanel builda o `dockerfile` do projeto, mas nao cria um Postgres automaticamente para este app. Nesse modo, crie o Postgres no painel e informe `DATABASE_URL`.

Para um deploy em estilo "mini app", com app e banco juntos, use o arquivo:

```text
compose.easypanel.yaml
```

Esse compose cria:

- `app`: container do Slugs.
- `postgres`: Postgres 16 com healthcheck.
- `slugs_postgres`: volume persistente do banco.
- `slugs_config`: volume persistente de `/app/config`.
- limites de CPU/memoria para reduzir risco de um container consumir a VM inteira.

Variaveis recomendadas para esse compose:

```env
SLUGS_DB_PASSWORD=troque-por-uma-senha-forte
BETTER_AUTH_SECRET=troque-por-um-valor-longo-e-fixo
SLUGS_ORIGIN=https://$(PRIMARY_DOMAIN)
SLUGS_APPNAME=$(PROJECT_NAME)
SLUGS_DEBUG=false
SLUGS_ADMIN_EMAIL=admin@seudominio.com
SLUGS_ADMIN_USERNAME=admin
SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD=senha-temporaria-forte
```

Nesse modo, `DATABASE_URL` e montado automaticamente dentro do compose como:

```env
postgres://slugs:${SLUGS_DB_PASSWORD}@postgres:5432/slugs
```

Nao use `change-me` em producao. Defina `SLUGS_DB_PASSWORD` e `BETTER_AUTH_SECRET` antes do primeiro deploy.

Depois do primeiro login, remova `SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD` do Easypanel. Ela serve para bootstrap/recuperacao, nao para ficar permanente.

## Variaveis opcionais

```env
SLUGS_ADMIN_EMAIL=admin@seudominio.com
SLUGS_ADMIN_USERNAME=admin
SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD=senha-temporaria-forte
SLUGS_BOOTSTRAP_ADMIN_RESET=false
SLUGS_DISABLE_SIGNUP=false
SLUGS_DISABLE_2FA=true
SLUGS_DISABLE_HOMEPAGE=false
SLUGS_DISABLE_LIMITS=false
SLUGS_DISABLE_LOWER_CASE_FALLBACK=true
SLUGS_CUSTOM_REDIRECT=/dashboard
SLUGS_LIMIT_MAX_SLUGS_PER_USER=1000
SLUGS_LIMIT_REQUESTS_PER_DAY=1000
SLUGS_LIMIT_REQUESTS_PER_MINUTE=60
SLUGS_SMTP_ENABLED=false
SLUGS_SMTP_HOST=smtp.example.com
SLUGS_SMTP_PORT=587
SLUGS_SMTP_SECURE=false
SLUGS_SMTP_USER=usuario
SLUGS_SMTP_PASS=senha
SLUGS_SMTP_FROM=no-reply@seudominio.com
SLUGS_MAXMIND_DB_PATH=/app/config/maxmind/geolite2-city.mmdb
MAXMIND_LICENSE_KEY=sua-chave-maxmind
PUBLIC_VERSION=seu-build-ou-tag
DEBUG=false
```

`SLUGS_ADMIN_EMAIL` e `SLUGS_ADMIN_USERNAME` sobrescrevem o admin inicial definido em `config/settings.yaml`.

`SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD` cria o admin inicial com uma senha conhecida no primeiro deploy. O valor nao e impresso nos logs. Remova depois do primeiro login.

Se perder a senha depois, defina temporariamente:

```env
SLUGS_BOOTSTRAP_ADMIN_TEMP_PASSWORD=nova-senha-temporaria
SLUGS_BOOTSTRAP_ADMIN_RESET=true
```

Reinicie o app, faca login com a senha temporaria e remova as duas variaveis. Com `SLUGS_BOOTSTRAP_ADMIN_RESET=false`, o app nao altera senha de usuario existente.

As variaveis `SLUGS_DISABLE_*`, `SLUGS_LIMIT_*` e `SLUGS_SMTP_*` sobrescrevem o primeiro host do `settings.yaml` em runtime. Isso permite administrar dominio, signup, 2FA, limites e SMTP direto pelo Easypanel.

`PUBLIC_VERSION` aparece nos metadados/healthcheck quando configurado.

`DEBUG=true` aumenta logs em alguns pontos. Evite manter ativo em producao.

## GeoIP para metricas de paises, regioes e cidades

As metricas de pais, regiao e cidade dependem de um banco MaxMind GeoLite2 City (`.mmdb`). Sem esse arquivo, as visitas continuam sendo registradas, mas a localizacao aparece como `Outro`.

Se `MAXMIND_LICENSE_KEY` estiver configurada, o app baixa automaticamente o GeoLite2 City no startup quando o arquivo ainda nao existir. A chave pode ser gerada na conta MaxMind GeoLite2.

Para usar arquivo manual, coloque o `.mmdb` em:

```txt
/app/config/maxmind/geolite2-city.mmdb
```

Esse caminho fica dentro do volume persistente `slugs_config`. Se usar outro local, defina:

```env
SLUGS_MAXMIND_DB_PATH=/caminho/para/geolite2-city.mmdb
```

O app nao baixa novamente se o arquivo ja existir no volume.

## Origem HTTPS e proxy

O app considera headers de proxy:

- `x-forwarded-host`
- `x-forwarded-proto`
- `host`

Isso e importante porque no Easypanel o container normalmente roda em HTTP interno, enquanto o usuario acessa por HTTPS externo. Com `SLUGS_ORIGIN=https://$(PRIMARY_DOMAIN)`, o app normaliza a origem publica correta.

Exemplos aceitos:

```env
SLUGS_ORIGIN=https://$(PRIMARY_DOMAIN)
SLUGS_ORIGIN=https://${PRIMARY_DOMAIN}
SLUGS_ORIGIN=$PRIMARY_DOMAIN
PRIMARY_DOMAIN=links.seudominio.com
```

Quando a variavel contem apenas o dominio, sem protocolo, o app assume `https://` para hosts publicos e `http://` para `localhost`/`127.0.0.1`.

## Arquivos de configuracao persistentes

Monte/preserve a pasta `config` se quiser manter configuracoes editadas pela UI:

```text
config/settings.yaml
config/oauth.json
config/custom.css
config/users/*.yaml
```

No Docker Compose do README isso aparece como:

```yaml
volumes:
  - ./config:/app/config
```

No Easypanel, use um volume persistente apontando para `/app/config` se quiser que alteracoes feitas no app sobrevivam a redeploys.

## Banco e migracoes

Na inicializacao, o app:

1. Verifica se `DATABASE_URL` existe.
2. Testa conexao com o Postgres.
3. Roda migracoes com `drizzle-kit`.
4. Faz bootstrap de admin, organizacoes e roles.

Se o banco estiver ausente ou indisponivel, o processo nao deve encerrar o container. Ele registra o problema no log e deixa o app responder em modo degradado.

## Healthcheck

Use estes endpoints:

```text
/api/live
/api
```

`/api/live` e um liveness check: confirma que o processo Node esta vivo e nao depende do banco. Use este endpoint se o painel/orquestrador for reiniciar o container quando o healthcheck falhar.

`/api` e um readiness check: verifica dependencias como o banco. Com banco saudavel, ele retorna status geral `ok` e `checks.database.status` como `up`.

Se `DATABASE_URL` estiver ausente ou o banco estiver fora, o endpoint responde JSON com status de banco `down` ou equivalente, sem tentar derrubar o processo.

## Checklist de deploy

- Definir `DATABASE_URL` usando o Postgres interno do Easypanel.
- Definir `SLUGS_ORIGIN=https://$(PRIMARY_DOMAIN)`.
- Definir `BETTER_AUTH_SECRET` fixo e longo.
- Opcionalmente definir `SLUGS_APPNAME=$(PROJECT_NAME)`.
- Persistir `/app/config` se for editar settings pela UI.
- Verificar `/api/live` para confirmar que o processo esta vivo.
- Verificar `/api` para confirmar que o banco esta saudavel.
- Abrir `/settings` e confirmar se host, signup, SMTP e integracoes estao corretos.

## Onde o runtime usa essas configuracoes

- `src/lib/server/env.ts`: expande variaveis `$(VAR)`, `${VAR}` e `$VAR`, normaliza origem e le headers de proxy.
- `src/lib/server/settings/index.ts`: cria fallback seguro e aplica overrides de ambiente.
- `src/hooks.server.ts`: inicializa banco/migracoes/bootstrap sem matar o processo em caso de falha.
- `src/lib/server/db/db-handle.ts`: redireciona para `/db-offline` quando o banco esta indisponivel.
- `src/routes/api/+server.ts`: endpoint de saude.
- `src/routes/api/live/+server.ts`: liveness check sem dependencia do banco.
- `dockerfile`: imagem sem banco/dominio hardcoded.
