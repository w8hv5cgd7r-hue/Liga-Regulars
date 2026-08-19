# ⛳ Liga de Golf

Web app para llevar los resultados y las clasificaciones de vuestro grupo de golf: individual
a golpes, individual Stableford, match play 1 contra 1 y match play de parejas. Pensada para
usarse desde el móvil justo al acabar de jugar.

## Qué incluye

- **4 modalidades**: golpes (neto), Stableford, 1 contra 1 y parejas (mejor bola).
- **Cada partida pertenece a una única temporada y modalidad**: al apuntar un resultado eliges
  primero para qué temporada/modalidad cuenta esa tarjeta (por ejemplo "Temporada 1 · Parejas").
  Esa tarjeta solo puntúa ahí; si el mismo día queréis que cuente también para otra modalidad
  (por ejemplo golpes), se apunta como una partida aparte.
- **Temporadas independientes por modalidad**: cada modalidad tiene sus propias temporadas, con
  la duración que quieras (un mes, tres meses, lo que sea), más una clasificación general que
  une todas las temporadas de esa modalidad.
- **Campos configurables**: par e índice de dificultad (stroke index) de cada hoyo, para que el
  reparto de golpes de hándicap sea correcto.
- **Cuentas por jugador** con contraseña, más un perfil de administrador que activa altas nuevas,
  gestiona hándicaps, campos y temporadas.
- **Estadísticas por jugador**: evolución del hándicap (a partir de todas sus partidas), puntos
  Stableford por partida, récord en 1 contra 1 y en parejas.
- **Con hándicap o sin (scratch)**: cada partida elige si se juega con hándicap o "a pelo" (como
  si todos tuvierais 0). Se guarda en la propia partida y se ve en el listado y en el detalle.
- **Par por defecto**: al elegir quién juega, la tarjeta arranca ya rellena a par en todos los
  hoyos; solo tocáis los hoyos donde el resultado no sea par.
- **Tarjeta con ida, vuelta y total**: en campos de 18 hoyos se ve el parcial de los hoyos 1-9,
  el de los hoyos 10-18 y el total, tanto al apuntar como al consultar una partida.
- **Match play en vivo**: mientras metes los golpes se ve quién va arriba y por cuántos hoyos, a
  cuántos hoyos jugados ("thru"), y el desglose ida / vuelta / total.
- **Apuntar resultado en dos pasos**: primero se elige temporada, campo, fecha, quién juega y si
  hay hándicap (eso ya se guarda); después se abre la tarjeta para ir metiendo los golpes hoyo a
  hoyo, viendo el resultado en vivo.
- **Editar y borrar partidas** ya guardadas, solo quien las creó o un administrador.
- Diseño mobile-first, con barra de navegación inferior, botones grandes y posibilidad de
  "instalar" la web en la pantalla de inicio del móvil (PWA básica).

## Cómo funciona la puntuación (resumen)

Al pulsar "Apuntar resultado" lo primero que se elige es la temporada (y por tanto la
modalidad) para la que cuenta esa tarjeta. A partir de ahí:

- **Golpes**: se introduce quién ha jugado y los golpes brutos de cada hoyo; se resta el golpe de
  hándicap que corresponde a cada hoyo según su índice de dificultad. Clasificación de temporada
  = puntos de posición en cada partida (10-7-5-3-2-1…), sumados.
- **Stableford**: igual, pero la clasificación es la suma directa de los puntos Stableford de
  cada partida (2 = neto par, 3 = neto birdie, etc.).
- **Match play 1 contra 1 / parejas**: en vez de una lista de jugadores, se eligen los dos lados
  del enfrentamiento (un jugador por lado en 1 contra 1, dos por lado en parejas) y se introduce
  igualmente la tarjeta hoyo a hoyo de los participantes; la app compara el resultado neto
  hoyo a hoyo (en parejas, la mejor bola de los dos compañeros) para decidir quién gana.
  Clasificación de temporada = puntos de liga (3 por partido ganado, 1 por empatado, 0 por
  perdido), sumados por jugador.

## Actualizar una instalación ya desplegada

Si ya tenías la app funcionando y estás actualizando a esta versión (con hándicap sí/no, ida y
vuelta, tarjeta en dos pasos), hace falta un pequeño cambio en la base de datos **antes** de subir
el código nuevo. En Supabase, ve a **SQL Editor → New query**, pega esto y pulsa **Run**:

```sql
alter table rounds add column if not exists use_handicap boolean not null default true;
```

Esto añade la nueva columna sin tocar las partidas que ya tenías guardadas (todas quedan marcadas
como "con hándicap", que es como se jugaban hasta ahora). Después de ejecutar esto ya puedes subir
el código nuevo a GitHub con normalidad.

## Puesta en marcha

La app necesita dos cosas gratuitas: un proyecto de **Supabase** (base de datos + usuarios) y un
despliegue en **Vercel** (para tener una URL a la que entrar desde el móvil).

### 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita si no tienes una.
2. "New project". Elige un nombre (p. ej. `liga-golf`) y una contraseña de base de datos
   (guárdala, no hace falta recordarla luego).
3. Cuando el proyecto esté listo, ve a **SQL Editor → New query**.
4. Abre el archivo [`supabase/schema.sql`](./supabase/schema.sql) de este proyecto, copia TODO
   su contenido, pégalo en el editor y pulsa **Run**. Esto crea todas las tablas, la seguridad
   (RLS) y las reglas de la app.
5. Ve a **Settings → Data API** (o **Project Settings → API** según la versión) y copia:
   - **Project URL**
   - **anon public key**

### 2. Configurar las variables de entorno

En la raíz del proyecto, crea un archivo `.env.local` (puedes copiar `.env.local.example`) con:

```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-ANON-KEY
```

### 3. Probar en local (opcional)

```bash
npm install
npm run dev
```

Abre http://localhost:3000, pulsa "Crea tu cuenta" y regístrate con tu email.

### 4. Convertirte en el primer administrador

Después de registrarte una vez, tu cuenta queda "pendiente" (así funciona para todos, incluido
tú). Para activarte como administrador, en Supabase ve a **SQL Editor** y ejecuta (cambiando el
email):

```sql
update players set role = 'admin', status = 'active' where email = 'tu-email@ejemplo.com';
```

A partir de aquí ya puedes entrar en la app y, desde **Admin → Jugadores**, activar las cuentas
del resto de tus amigos según se vayan registrando (o cambiar su rol a administrador también si
queréis que haya más de uno).

### 5. Desplegar en Vercel (para tener la web accesible desde el móvil)

1. Sube este proyecto a un repositorio de GitHub (puedes usar `git init`, `git add .`,
   `git commit`, y crear un repo nuevo en GitHub y hacer push).
2. Ve a [vercel.com](https://vercel.com), crea una cuenta gratuita e **Import** ese repositorio.
3. En "Environment Variables", añade las mismas dos variables que en `.env.local`
   (`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy. En un par de minutos tendrás una URL tipo `https://liga-golf.vercel.app`.
5. Comparte esa URL con tu grupo. Desde el móvil, al entrar pueden usar "Añadir a pantalla de
   inicio" (Safari/Chrome) para que quede como una app más.

### 6. Primeros pasos dentro de la app

1. **Admin → Campos**: añade el/los campos donde jugáis, con el par y el índice de dificultad
   (stroke index) de cada hoyo — lo normal es que os lo den en la tarjeta de resultados del club.
2. **Admin → Jugadores**: ajusta el hándicap de cada jugador.
3. **Admin → Temporadas**: crea al menos una temporada, eligiendo su modalidad (golpes,
   Stableford, 1 contra 1 o parejas). Necesitas una temporada creada en una modalidad antes de
   poder apuntar resultados de esa modalidad; podéis tener varias temporadas abiertas a la vez,
   una por modalidad.
4. Desde **Partidas → Apuntar resultado**: primero eliges para qué temporada (y por tanto
   modalidad) cuenta esta tarjeta, si se juega con hándicap o sin, el campo, la fecha y quién
   juega (si es golpes o Stableford, quién ha jugado; si es 1 contra 1 o parejas, los dos lados
   del enfrentamiento). Al pulsar "Continuar" eso ya queda guardado y se abre la tarjeta, donde
   vas metiendo los golpes de cada hoyo y ves el resultado en vivo.
5. Si os equivocáis al apuntar un resultado, entrad en la partida (**Partidas → la tarjeta en
   cuestión**) y usad **Editar** para corregirla o **Borrar** para eliminarla del todo. Solo puede
   hacerlo quien la creó, o un administrador.

## Desarrollo

```bash
npm run dev      # servidor de desarrollo
npm run build    # build de producción (recomendable antes de desplegar cambios)
npm run lint     # comprobación de estilo de código
npx tsx scripts/test-scoring.ts   # comprobación rápida del motor de puntuación
```

Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres, Auth y Row Level
Security).

## Ideas para más adelante

- GPS / distancias al green.
- Juego de "skins" (bote hoyo a hoyo).
- Fotos y comentarios tras cada partida.
- Notificaciones cuando alguien apunta un resultado.

(La base de datos y el motor de puntuación están hechos como funciones independientes, así que
añadir cualquiera de estas cosas más adelante no debería requerir tocar lo ya construido.)
