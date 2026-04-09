# Deployment y operaciones

## Requisitos

- **Node.js** v20+
- **PostgreSQL** 14+ (base de datos accesible via `DATABASE_URL`)
- **pnpm** v10+
- Variables de entorno mínimas para arrancar (ver abajo)

---

## Setup inicial

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env   # editar JWT_SECRET y DATABASE_URL como mínimo

# 3. Aplicar migraciones
npx prisma migrate deploy

# 4. Generar cliente Prisma
npx prisma generate

# 5. Seed inicial (roles, usuarios, tipos de trámite, plazos, feriados, datos demo)
pnpm prisma:seed
```

### Variables de entorno mínimas

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/gams_procedures
JWT_SECRET=<mínimo 32 caracteres aleatorios>
```

El resto tiene defaults razonables (ver [`docs/ops/env-vars.md`](env-vars.md)).

---

## Credenciales del seed

> Solo para desarrollo y staging. Cambiar antes de producción.

| Email | Rol | Contraseña |
|---|---|---|
| `superadmin@gmail.com` | SUPERADMIN | `passwds12345` |
| `encargado@gmail.com` | ENCARGADO | `passwds12345` |
| `secretaria@gmail.com` | SECRETARIA | `passwds12345` |
| `inspector@gmail.com` | INSPECTOR | `passwds12345` |

El seed crea 10 usuarios en total (1 superadmin, 2 encargados, 2 secretarias, 5 inspectores), datos demo de empresas y procedimientos de prueba.

---

## Comandos del día a día

```bash
pnpm start:dev       # desarrollo con watch (ts-node + hot reload)
pnpm build           # compila TypeScript → dist/
pnpm start:prod      # ejecuta el build compilado (requiere pnpm build previo)

npx prisma migrate dev   # crear y aplicar nueva migración en desarrollo
npx prisma studio        # GUI de BD en localhost:5555
```

---

## En producción (VPS)

Stack recomendado:

```
Internet → Nginx (reverse proxy + TLS) → PM2 → NestJS :3000
```

### PM2

```bash
pnpm install -g pm2

# Primera vez
pm2 start "pnpm start:prod" --name gams-procedures

# Guardar para que sobreviva reinicios del sistema
pm2 save
pm2 startup   # sigue las instrucciones que imprime

# Operación diaria
pm2 list                    # ver estado
pm2 restart gams-procedures # reiniciar
pm2 logs gams-procedures    # logs en tiempo real
```

### Nginx (fragmento mínimo)

```nginx
server {
    listen 443 ssl;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Correlation-ID $http_x_correlation_id;
    }
}
```

### Deploy de una nueva versión

```bash
git pull
pnpm install
pnpm build
npx prisma migrate deploy
pm2 restart gams-procedures
```
