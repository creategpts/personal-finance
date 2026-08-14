# Finance Tracker

Seguimiento de finanzas personales: movimientos de dinero entre cuentas y categorías, de los que se derivan los indicadores (ingreso, gasto, ahorro, inversión).

## Language

**Movimiento**:
Un traslado de una cantidad de dinero desde un Origen a un Destino, con fecha y Estado (Previsto o Realizado). Es el único hecho que se registra; el Concepto no se guarda en el movimiento — se deriva de qué son el Origen y el Destino.
_Avoid_: Transacción, Apunte

**Categoría**:
Un nodo con nombre que puede actuar como Origen o Destino de un Movimiento. Es de tipo Ingreso, Gasto, o Cuenta.

**Subcategoría**:
Una Categoría de Gasto que anida bajo otra Categoría de Gasto (su Categoría principal). Exactamente 2 niveles — una Subcategoría no puede tener a su vez Subcategorías. Solo el tipo Gasto admite esto (Ingreso y Cuenta se quedan planos). Al registrar un Movimiento, elegir la Categoría principal primero habilita un segundo desplegable con sus Subcategorías; es opcional — sin elegir ninguna, el Movimiento queda contra la Categoría principal directamente. En el gráfico «Gasto por categoría» y en Presupuestos, el gasto de una Subcategoría se agrega siempre bajo su Categoría principal — una Subcategoría nunca tiene su propia fila ni su propio Presupuesto independiente.
_Avoid_: Categoría principal como sinónimo de Categoría (una Categoría principal es específicamente una de Gasto sin padre — toda Categoría de Ingreso o Cuenta es "principal" por defecto, pero ese término solo tiene sentido útil dentro del árbol de Gasto)

**Cuenta**:
Una Categoría de tipo distinto de Ingreso/Gasto: representa dinero en algún sitio (banco, broker, efectivo). Tiene un Tipo de cuenta.

**Tipo de cuenta**:
Uno de tres valores fijos que determina cómo cuenta una Cuenta en los indicadores: Ahorro, Inversión, Gasto (disponible para gasto). Es el propio campo `type` de la Cuenta — no hay una capa intermedia que lo traduzca a otra cosa: el tipo ES el grupo. No existe un tipo neutral — toda Cuenta pertenece a uno de estos tres, y no se pueden crear tipos nuevos.
_Avoid_: Comportamiento (término retirado — hasta hace poco había una tabla `AccountType` separada, de la que el usuario podía crear tantas etiquetas como quisiera, cada una asignada a un Comportamiento fijo; se colapsó porque las etiquetas siempre acababan siendo 1:1 con el Comportamiento, así que la capa no aportaba nada), Corriente/Cuenta corriente (eliminado — ya no existe un tipo neutral)

**Concepto**:
La clasificación de un Movimiento — Ingreso, Gasto, Ahorro, Inversión, o Traspaso — determinada por el Tipo de cuenta del Origen y el Destino. Un mismo Movimiento puede tener más de un Concepto a la vez (p. ej. Ingreso que aterriza en una Cuenta de Ahorro cuenta como Ingreso Y como Ahorro). No es un campo del Movimiento: se calcula cada vez que se necesita, nunca se almacena.
_Avoid_: Tipo de movimiento, Categoría del movimiento

**Ingreso**:
Concepto de un Movimiento cuyo Origen es una Categoría de Ingreso y cuyo Destino es cualquier Cuenta. Un Movimiento de Ingreso nunca puede tener como Destino una Categoría de Gasto — el dinero siempre pasa por una Cuenta real en algún punto.

**Gasto**:
Concepto de un Movimiento cuyo Destino es una Categoría de Gasto, sea el Origen la Cuenta que sea (Disponible para gasto, Ahorro o Inversión). Pagar un Gasto directamente desde el Ahorro o la Inversión es Gasto Y además Retirada de esa Cuenta — reduce su total.

**Aportación**:
El Concepto Ahorro o Inversión, en positivo, cuando el dinero entra en una Cuenta de ese Tipo. Se suma siempre, sea cual sea el Origen.

**Retirada**:
El Concepto Ahorro o Inversión, en negativo, cuando el dinero sale de una Cuenta de ese Tipo. Se resta siempre, sea cual sea el Destino (a diferencia de una Aportación/Retirada anterior que solo se reconocía yendo hacia una Cuenta corriente — ese modelo se abandonó). Un Movimiento entre Ahorro e Inversión genera una Retirada en el Origen y una Aportación en el Destino a la vez.

**Traspaso**:
El caso particular de un Movimiento entre dos Cuentas del mismo Tipo (p. ej. dos Cuentas de Ahorro distintas). Genera una Retirada y una Aportación del mismo Tipo a la vez, que se cancelan — el total de ese Tipo no cambia, aunque el Movimiento sigue siendo visible si se filtra por él.
_Avoid_: Transferencia (mismo concepto — evitar mezclar los dos términos)

**Concepto (campo)** — ⚠️ colisión de nombre con **Concepto** (arriba):
El campo `concept` de un Movimiento es una etiqueta de texto libre puesta por el usuario (p. ej. "Nómina", "Cena Dani"), SÍ se guarda. No tiene relación con el Concepto-clasificación (Ingreso/Gasto/Ahorro/Inversión/Traspaso) descrito arriba, que se calcula y nunca se guarda. Mismo nombre de campo, cosas distintas — no confundir.

## Otras entidades

**Presupuesto** (`Budget`): importe objetivo para una Categoría de Gasto en un mes/año concreto. Se compara contra el Gasto real de esa categoría en ese mes. Solo se fija sobre Categorías principales — si tiene Subcategorías, el gasto real las agrega todas.

**Gasto recurrente** (`RecurringExpense`): plantilla de Movimiento (concepto, importe, origen, destino) con una frecuencia (mensual/trimestral/anual) y una próxima fecha de vencimiento. Si `auto_generate` está activo, genera Movimientos automáticamente al llegar la fecha; si no, solo se usa para el análisis anual (gastos sin fecha fija: peluquería, ITV...).

**Meta** (`Goal` + `GoalTarget`): objetivo de aportación neta a una Cuenta, evaluado mes a mes de forma acumulada (un mes flojo se compensa con uno fuerte). Tipos (`goals_logic.GOAL_TYPES`): `fixed` (importe fijo/mes), `percent_income` (% del ingreso del mes), `target_date` (saldo total objetivo a una fecha). El objetivo vigente en cada mes se busca por fecha de efecto (`GoalTarget.eff_year/eff_month`), así que cambiar la meta nunca reescribe el pasado.

**Settings**: pares clave-valor globales (app de un solo usuario, sin tabla de usuarios). Claves actuales: `app_name`, `user_name`, `favicon`.

**Backup**: volcado JSON completo de todas las tablas, fuera del repo (por defecto, carpeta hermana del proyecto — `LIFETRACK_BACKUP_DIR` para cambiarla). Se dispara solo (si el más reciente tiene >7 días) al arrancar el backend o al listar backups; también hay backup/restore manual vía API y un modo CLI (`python -m app.routers.backup`).

## Páginas (frontend)

- **Panel**: dashboard con KPIs del mes/periodo.
- **Movimientos**: alta/edición/listado de Movimientos, import CSV.
- **Análisis**: 3 pestañas — Gasto (por categoría, top destinos, tendencia mensual, gasto vs presupuesto), Ingreso (por categoría), Patrimonio (evolución temporal y saldo de hoy, solo cuentas Ahorro/Inversión — Efectivo/gasto queda fuera, eso es liquidez, no patrimonio).
- **Planificación**: Presupuestos, Gastos recurrentes, Metas.
- **Configuración**: Categorías/Cuentas, Settings (nombre app/usuario, favicon), backups.

Toggle de privacidad (`hideAmounts.ts`): preferencia global persistida en localStorage que difumina todos los importes en pantalla; no afecta a los datos.
