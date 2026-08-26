# Brava Dubai · Desplegar en Netlify

El proyecto es **web estática + funciones de servidor + base de datos Postgres**.
No se despliega arrastrando un ZIP: hay que desplegarlo con el **build de Netlify**,
que instala dependencias, provisiona la base de datos y publica las funciones.

Todo está ya preparado en el repo `keiomobile/BravaDubai`
(rama `claude/brava-dubai-web-crm-65yi5c`, que es la rama por defecto).

## Sitio ya creado
- Proyecto Netlify: **brava-dubai** → https://app.netlify.com/projects/brava-dubai
- URL de producción: https://bravaae.com
- (Vacío hasta el primer despliegue.)

## Pasos para desplegar (desde el panel de Netlify)

1. Entra en el proyecto **brava-dubai** en Netlify.
2. **Project configuration → Build & deploy → Continuous deployment → Link repository**.
3. Elige **GitHub** y autoriza la app de Netlify (tu cuenta aún no tiene GitHub conectado).
   - Da acceso a la organización **keiomobile** y al repositorio **BravaDubai**.
   - Si GitHub pide aprobación de administrador de la organización, apruébala.
4. Selecciona el repo **keiomobile/BravaDubai** y la rama **claude/brava-dubai-web-crm-65yi5c**.
5. Ajustes de build (se autodetectan desde `netlify.toml`, no cambies nada):
   - **Publish directory**: `files`
   - **Functions directory**: `netlify/functions`
   - **Build command**: (vacío)
6. **Deploy**. En el primer build Netlify:
   - instala `@netlify/database` y `@netlify/blobs`,
   - **provisiona Postgres automáticamente** (sin configurar cadenas de conexión),
   - publica las funciones (`/api/*`) y la web.

A partir de aquí, **cada push a esa rama redepliega solo**.

## Acceso al CRM (tras el despliegue)
- URL: `https://bravaae.com/crm.html`
- El backend crea automáticamente el usuario **superadministrador**:
  - Usuario: **jesusleon@keio.es** (tu email)
  - Contraseña: la que ya usabas en VLC (el hash es el mismo; no se puede leer en claro).
- Nota: en el primer arranque el backend **elimina las cuentas demo** (`admin`,
  `cliente`, `colab`) y arranca limpio. La cuenta operativa es la de superadmin.

## Variables de entorno (opcionales, se añaden después)
La web y el CRM funcionan sin nada de esto. Actívalas cuando quieras las features:
- `RESEND_API_KEY` + `EMAIL_FROM` → envío de emails (verificación, avisos).
- `ANTHROPIC_API_KEY` → generación de fichas con IA.
- `NETLIFY_DATABASE_URL` → la configura Netlify sola al provisionar la BBDD.

Se añaden en **Project configuration → Environment variables**.

## Dominio propio (más adelante)
Para usar `bravaae.com`: **Domain management → Add a domain** y apuntar los DNS
(en GoDaddy) a Netlify.
