# BRAVA — briefing técnico

## Producto

BRAVA combina web pública, CRM interno, portal de inversores y portal inmobiliario.
Las divisiones visibles son BRAVA Investment, BRAVA Real Estate y BRAVA Rent.

## Producción

- Dominio principal: `https://bravaae.com`
- Netlify: proyecto `brava-dubai`
- Rama publicada: `claude/brava-dubai-web-crm-65yi5c`
- Publicación automática desde GitHub.

## Arquitectura

- Frontend estático HTML/CSS/JavaScript en `files/`.
- API principal en `netlify/functions/api.mjs`.
- Funciones auxiliares: correo Microsoft 365, fichas inmobiliarias, documentos y avisos programados.
- PostgreSQL mediante `@netlify/database`.
- Archivos privados y material multimedia mediante Netlify Blobs.
- Microsoft Graph para la bandeja humana del CRM.
- Resend para mensajes transaccionales automáticos.
- Anthropic para asistencia de redacción y generación.

## Seguridad y privacidad

- Nunca versionar credenciales, hashes de cuentas maestras, tokens o secretos.
- Nunca sembrar personas, KYC, documentos, domicilios, contratos o PDFs reales desde Git.
- Los datos reales se importan desde una fuente privada y viven únicamente en PostgreSQL/Blobs.
- Las sesiones del navegador no deben persistirse en `localStorage`.
- Toda salida dinámica hacia `innerHTML` debe escaparse o sanearse.
- Las rutas de diagnóstico profundo requieren autenticación administrativa.

## Migraciones

El DDL vive temporalmente en `ensureSchema()`. Cualquier cambio debe incrementar
`SCHEMA_VERSION`, ser idempotente y preservar los datos de producción.

## Validación mínima

```bash
npm run check
```

Antes de publicar:

1. Revisar `git diff --check` y confirmar que no se incluyen archivos ajenos.
2. Ejecutar pruebas y comprobaciones sintácticas.
3. Desplegar y esperar estado `ready`.
4. Comprobar `/api/health`, páginas públicas y funciones modificadas.
5. No mostrar secretos ni datos personales en logs o respuestas.

## Archivos sensibles al conflicto

- `netlify/functions/api.mjs`
- `files/crm.html`
- `files/inversor.html`
- `netlify.toml`

Los cambios deben ser pequeños, revisables y acompañados de pruebas de regresión.
