# Ingesta privada de datos al CRM

Los datos reales de inversores, socios, operaciones, contratos y documentos no se
versionan en este repositorio. Deben importarse mediante un proceso administrativo
autenticado desde una fuente privada y almacenarse en PostgreSQL o Netlify Blobs.

Normas:

- No incluir nombres, correos, teléfonos, domicilios, documentos de identidad ni credenciales.
- No incorporar PDFs reales como base64 en el código.
- No establecer contraseñas temporales compartidas.
- Registrar la fuente, fecha, operador y resultado de cada importación en auditoría.
- Validar duplicados e integridad antes de activar accesos de inversores.

La base de datos de producción conserva los registros ya importados; esta política
solo impide que vuelvan a quedar expuestos en Git o en los bundles de las funciones.
