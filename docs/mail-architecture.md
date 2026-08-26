# Módulo de correo profesional — Arquitectura técnica

Módulo de correo corporativo integrado en el CRM de Brava (`/crm.html`, Admin →
"Correo electrónico"). Proveedor inicial: **Microsoft 365 vía Microsoft Graph**.
No sustituye a Resend: Resend sigue enviando los emails transaccionales
automáticos del sistema; este módulo añade una bandeja de trabajo humana
(leer/escribir/gestionar correo corporativo) dentro del CRM.

## 1. Principios de diseño

- **Capa de proveedor desacoplada** (`netlify/functions/_mail.mjs`). El router
  del CRM nunca habla directamente con Graph: usa `mailProvider.*`. Cambiar de
  proveedor (o añadir IMAP en el futuro) no obliga a tocar los endpoints.
- **Los tokens viven solo en el backend.** El navegador jamás recibe
  `access_token` ni `refresh_token`. El frontend solo ve datos de correo ya
  saneados.
- **Refresh tokens cifrados en reposo** (AES-256-GCM con `MAIL_TOKEN_ENCRYPTION_KEY`).
- **Permiso mínimo**: solo los scopes imprescindibles.
- **Sin secretos en logs.** Ningún token se registra ni se serializa a error.
- **Degradación limpia**: sin variables configuradas, el módulo muestra estado
  "no conectado" y no rompe el resto de la API.

## 2. Autenticación (OAuth 2.0 · Microsoft Identity Platform)

Flujo **Authorization Code + PKCE** contra el endpoint v2.0:

- Authorize: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
- Token:     `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`

Pasos:

1. `POST /api/mail/connect/start` (usuario admin autenticado en el CRM). El
   backend genera `code_verifier` (PKCE), `state` y `nonce` de un solo uso, los
   guarda en `mail_oauth_state` con caducidad corta (10 min) y devuelve la URL
   de autorización. El navegador solo recibe la URL; nunca el `code_verifier`.
2. Microsoft redirige a `MICROSOFT_REDIRECT_URI` →
   `GET /api/mail/connect/callback?code=...&state=...`.
3. El backend valida `state` (un solo uso, no caducado), intercambia el `code`
   por tokens usando el `code_verifier`, cifra el `refresh_token` y crea/actualiza
   la fila en `mail_accounts`. El `access_token` se usa en memoria y no se
   persiste; solo se guarda el `refresh_token` cifrado y su caducidad.
4. En cada operación, el backend obtiene un `access_token` fresco: si el
   guardado ha caducado, refresca con el `refresh_token`. Si el refresh falla
   (revocado/expirado), la cuenta pasa a `active=false` y la UI pide reconectar.

### Scopes mínimos

- Individual (delegado): `openid profile email offline_access Mail.ReadWrite Mail.Send`
- Bandeja compartida: requiere que Microsoft 365 conceda **Send As** / **Read and
  Manage** sobre el buzón compartido al usuario. Con permisos delegados y el
  buzón compartido añadido, se accede vía `/users/{sharedUpn}/...`. Si la
  organización exige permisos de aplicación (client credentials), queda como
  fase posterior y se documenta el bloqueo.

### Riesgo de tenant administrado por GoDaddy

Los tenants de Microsoft 365 provisionados por GoDaddy a veces **no permiten al
usuario registrar aplicaciones** (App registrations restringido a admins). Si el
registro de la app no es posible:

- El callback devolverá un error `AADSTS...` (típicamente `AADSTS650051`,
  `AADSTS90094` consent required, o `AADSTS700016` app no encontrada).
- El módulo detecta el prefijo `AADSTS`, lo muestra como "bloqueo de tenant" y
  registra en `docs/mail-architecture.md` (esta sección) que se requiere que un
  administrador global registre la aplicación y conceda consentimiento.
- **Acción requerida del owner**: registrar una App en Entra ID (Azure AD),
  configurar `MICROSOFT_REDIRECT_URI`, y conceder consentimiento de admin a los
  scopes. Sin esto, la conexión no puede completarse (no es un bug del código).

## 3. Variables de entorno (previstas — NO se crean valores aquí)

| Variable | Uso | Obligatoria |
|---|---|---|
| `MICROSOFT_CLIENT_ID` | App (client) ID de Entra ID | sí |
| `MICROSOFT_TENANT_ID` | Tenant ID (o `common`/`organizations`) | sí |
| `MICROSOFT_REDIRECT_URI` | URL de callback registrada | sí |
| `MICROSOFT_CLIENT_SECRET` | Solo si el flujo confidencial lo exige | condicional |
| `MAIL_TOKEN_ENCRYPTION_KEY` | Clave 32 bytes (hex/base64) para cifrar refresh tokens | sí |
| `MICROSOFT_WEBHOOK_CLIENT_STATE` | Secreto de validación de webhooks (Fase 4) | fase 4 |

`GET /api/mail/config` informa de cuáles faltan, sin revelar valores.

## 4. Modelo de datos (Postgres, en `ensureSchema()`)

Todas las tablas nuevas con prefijo `mail_`. Se crean con `CREATE TABLE IF NOT
EXISTS` y la migración se dispara subiendo `SCHEMA_VERSION`. No se reutiliza la
tabla `comunicaciones` (portal de inversores) para emails.

- `mail_accounts` — cuenta conectada (individual/compartida). Guarda
  `encrypted_refresh_token`, `token_expires_at`, `scopes`, `last_delta_link`.
- `mail_permissions` — permisos por usuario o rol sobre una cuenta
  (`can_read`, `can_send`, `can_manage`), independientes entre sí.
- `mail_threads` — hilo/conversación cacheado (`provider_thread_id`,
  `subject`, `participants`, `preview`, `unread`, `has_attachments`,
  `linked_entity_type/id`, `assigned_user_id`, `status`).
- `mail_messages` — mensaje cacheado (`provider_message_id`, `direction`,
  direcciones, `subject`, `body_html` saneado, `body_text`, fechas, `is_read`).
- `mail_attachments` — metadatos de adjunto (`provider_attachment_id`, `name`,
  `mime_type`, `size`, `blob_key` opcional).
- `mail_links` — relación hilo ↔ entidad CRM (lead/cliente/colaborador/agente/
  propiedad/proyecto/operación/expediente RG).
- `mail_audit_log` — auditoría de lecturas sensibles, envíos, borrados, cambios.
- `mail_oauth_state` — `state`/`nonce`/`code_verifier` de un solo uso (efímero).

Índices: por `account_id`, `provider_thread_id`, `provider_message_id` (único por
cuenta para idempotencia), `last_message_at`, y por entidad vinculada.

## 5. Estrategia de caché

- **No se duplica todo Graph en Postgres.** Se cachean metadatos de hilos y
  mensajes (asunto, participantes, fechas, flags, preview) para listar rápido y
  para poder vincular a entidades del CRM y auditar.
- **Cuerpos**: se cachea `body_html` saneado y `body_text` al abrir un mensaje
  (lazy). Si no está en caché, se pide a Graph en el momento.
- **Adjuntos**: por defecto **no** se almacenan; se transmiten desde Graph bajo
  demanda (`downloadAttachment`). `blob_key` queda disponible por si en el futuro
  se decide persistir alguno (p. ej. adjuntos enviados).
- **Sincronización incremental** con **delta queries** de Graph
  (`/mailFolders/{id}/messages/delta`). Se guarda `last_delta_link` por cuenta y
  se reanuda desde ahí. Idempotencia por `UNIQUE(account_id, provider_message_id)`
  (upsert) para no duplicar en reintentos.

## 6. Seguridad

- Autorización comprobada en **todos** los endpoints: el usuario debe tener
  permiso sobre `account_id`. Roles `cliente`/`inversor` nunca acceden.
- `can_read` y `can_send` son permisos **independientes**. "Enviar como" se
  valida también en backend, no solo en la UI.
- **HTML entrante saneado** (quita `<script>`, `<style>`, `<iframe>`, handlers
  `on*`, `javascript:`), servido con `Content-Security-Policy` y sin permitir
  ejecución. El cuerpo se muestra en un contenedor aislado.
- **Anti-SSRF**: el backend solo llama a hosts de Microsoft
  (`graph.microsoft.com`, `login.microsoftonline.com`); nunca a URLs
  proporcionadas por el usuario o incrustadas en un correo.
- **Límites de adjuntos**: tamaño máximo y tipos permitidos (ver `_mail.mjs`).
- **Auditoría**: envíos, borrados, cambios de permiso y lecturas de contenido
  sensible quedan en `mail_audit_log`.
- **Sin correos reales en pruebas**: los tests usan `fetch` simulado.

## 7. Endpoints (`/api/mail/*`, autenticados)

```
GET    /api/mail/config                         estado de variables (sin valores)
GET    /api/mail/accounts                        cuentas visibles para el usuario
POST   /api/mail/connect/start                   inicia OAuth (devuelve authUrl)
GET    /api/mail/connect/callback                intercambia code por tokens
POST   /api/mail/accounts/:id/disconnect         desconecta y borra tokens
GET    /api/mail/accounts/:id/folders            carpetas
GET    /api/mail/accounts/:id/threads            lista hilos (search/filtros/paginación)
GET    /api/mail/accounts/:id/threads/:threadId  hilo completo
POST   /api/mail/accounts/:id/send               enviar
POST   /api/mail/accounts/:id/messages/:mid/reply    responder
POST   /api/mail/accounts/:id/messages/:mid/forward  reenviar
PATCH  /api/mail/accounts/:id/messages/:mid          leído/destacado/archivar/papelera
GET    /api/mail/accounts/:id/attachments/:aid       descargar adjunto
POST   /api/mail/accounts/:id/sync                   sincronización delta
POST   /api/mail/accounts/:id/links                  vincular hilo a entidad
DELETE /api/mail/accounts/:id/links/:linkId          quitar vínculo
GET    /api/mail/accounts/:id/audit                  auditoría (admin)
```

## 8. Fases de entrega

- **Fase 1** (esta): diseño, esquema BD, capa de proveedor, OAuth start/callback,
  endpoints de cuentas y permisos, UI vacía con estados, pruebas unitarias.
- **Fase 2**: carpetas/hilos, lectura, delta sync, vínculos con entidades.
- **Fase 3**: redactar/responder/reenviar, adjuntos, auditoría completa,
  permisos completos ("Enviar como" en backend).
- **Fase 4**: webhooks de Graph + renovación de subscriptions, notificaciones y
  pulido móvil.

## 9. Permisos por rol

| Rol | Correo |
|---|---|
| superadmin / admin | configurar cuentas y permisos, ver auditoría, todas las bandejas autorizadas |
| equipo | solo bandejas asignadas |
| agente/colaborador | su cuenta individual + compartidas autorizadas |
| cliente / inversor | **sin acceso** |

`can_read` y `can_send` se conceden por separado. "Enviar como" (bandeja
compartida) exige permiso explícito comprobado en backend.
