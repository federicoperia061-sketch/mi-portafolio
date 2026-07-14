# Mi Portafolio 📊

Tracker personal de inversiones con precios en tiempo real, análisis de cartera y login con Google.

## Setup paso a paso

### 1. Instalar Node.js
Descargá Node.js desde [nodejs.org](https://nodejs.org/) (versión LTS). Verificá que funciona:
```bash
node --version
npm --version
```

### 2. Clonar y configurar
```bash
# Descomprimí el zip y entrá a la carpeta
cd mi-portafolio

# Instalá dependencias
npm install

# Copiá el archivo de variables de entorno
cp .env.example .env
```

### 3. Configurar variables de entorno
Editá el archivo `.env` con tus claves de Supabase:
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...tu-anon-key
```
Las encontrás en: Supabase Dashboard → Settings → API

### 4. Crear las tablas en Supabase
Abrí Supabase → SQL Editor → New Query → pegá el contenido de `supabase-schema.sql` → Run

### 5. Probar en local
```bash
npm run dev
```
Abrí `http://localhost:5173` en el navegador.

### 6. Subir a GitHub
```bash
git init
git add .
git commit -m "Mi Portafolio v1.0"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mi-portafolio.git
git push -u origin main
```

### 7. Deploy en Vercel
1. Andá a [vercel.com](https://vercel.com)
2. "Add New Project" → importá el repo de GitHub
3. **Environment Variables**: agregá las mismas 2 variables del `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Click "Deploy"
5. En 1-2 minutos tenés tu URL: `mi-portafolio-xxx.vercel.app`

### 8. Configurar redirect en Supabase
Después del deploy, andá a Supabase → Authentication → URL Configuration:
- Site URL: `https://mi-portafolio-xxx.vercel.app`
- Redirect URLs: agregá `https://mi-portafolio-xxx.vercel.app`

También actualizá en Google Cloud Console → Credentials → OAuth Client:
- Authorized redirect URIs: agregá `https://xxxxx.supabase.co/auth/v1/callback`

## Stack
- **React 18** + Vite
- **Supabase** (PostgreSQL + Auth + RLS)
- **Finnhub** (precios gratuitos)
- **Vercel** (hosting gratuito)
- **ExcelJS** (exportar a Excel)

## Costo
$0 — Todo es gratuito.
