# Rumbo · Tu vida en un solo lugar

App personal de gestión de vida: rituales de día, semana y mes (apertura y cierre), registro diario de tareas estilo bullet journal (posponer, delegar, soltar) con métricas de postergación, hábitos, finanzas, metas, lecturas, salud, rueda de la vida, diario, relaciones, listas, tendencias y un sistema de recompensas (rangos, insignias y cosméticos).

Hecha con la identidad de marca **BiPlot** (azul profundo · cian · coral).

## Producción
- **Repositorio:** organización **Biplot** (`Biplot/rumbo`).
- **App:** desplegada con GitHub Pages en `https://biplot.github.io/rumbo/` (dominio propio en configuración).
- **Notificaciones:** recordatorios de ritual (mañana/noche, semana y mes) vía GitHub Actions + Web Push (`notifier/`).

## Tecnología
- **Frontend:** HTML, CSS y JavaScript sin frameworks (estático).
- **Backend:** [Supabase](https://supabase.com) (Auth + Postgres). Cada usuario guarda su estado como un documento JSON, protegido por Row Level Security.

## Desarrollo local
```bash
node serve.js
```
Luego abre `http://localhost:5178`.

Tests de lógica (sin dependencias): `node tests/merge.test.mjs`.

Pruebas en navegador (requieren Playwright, solo para desarrollo): `node tests/e2e/run.cjs`. Levantan `serve.js` solas; con `E2E_SHOTS=carpeta` guardan capturas. Ambas corren en GitHub Actions en cada push (`.github/workflows/pruebas.yml`).

## Configuración de Supabase
Las claves públicas van en `js/store.js` (`SUPABASE_URL`, `SUPABASE_KEY`). La `publishable key` es pública por diseño; los datos están protegidos por RLS. Esquema:

```sql
create table estado_usuario (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb,
  updated_at timestamptz default now()
);
alter table estado_usuario enable row level security;
create policy "cada quien lo suyo" on estado_usuario
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

© BiPlot
