/* StudyNook · help/help-es.js — Artículos de ayuda (español). Misma estructura que help-en.js. */
(function (root) {
  root.NookHelp = root.NookHelp || {};
  root.NookHelp.es = [
    {
      id: 'start', icon: 'rocket', title: 'Primeros pasos',
      lead: 'StudyNook es un temporizador de concentración que cierra las apps y bloquea los sitios que te distraen mientras estudias. Todo se queda en tu equipo.',
      blocks: [
        { h: 'Tu primera sesión' },
        { ol: [
          'Abre **Tareas** y añade lo que quieres estudiar (opcional).',
          'En **Concentración**, elige **Pomodoro** (rondas con descansos) o **Concentración libre** (un solo bloque de la duración que quieras).',
          'Elige una tarea en la lista **Tarea** si quieres que el tiempo cuente para ella.',
          'Pulsa **Empezar**. El temporizador sigue aunque ocultes la ventana.'
        ] },
        { h: 'Activa el bloqueo' },
        { ul: [
          '**Aplicaciones**: añade los programas que te distraen. Durante la concentración se cierran tras un breve aviso.',
          '**Sitios web**: añade los sitios que te distraen y luego instala y vincula la extensión (consulta **Bloquear sitios**).'
        ] },
        { h: 'Dónde está el temporizador' },
        { p: 'Al cerrar la ventana, StudyNook se cierra cuando nada necesita seguir activo. Se oculta en la bandeja (abajo a la derecha de la barra de tareas) si hay una sesión en curso, si el guardián o el bloqueo de sitios funcionan todo el tiempo, o si activas Ajustes → General → Seguir en la bandeja. Durante una sesión, un pequeño **minitemporizador** queda por encima de las demás ventanas; haz clic en él para volver a StudyNook.' },
        { note: 'No puedes cerrar ni salir de StudyNook mientras exista una sesión, aunque esté en pausa. Termina primero la sesión.', kind: 'info' }
      ]
    },
    {
      id: 'focus', icon: 'timer', title: 'Sesiones de concentración',
      lead: 'Dos modos de temporizador, un modo estricto opcional y un modo Iron para los días en que necesitas un compromiso firme.',
      blocks: [
        { h: 'Pomodoro y concentración libre' },
        { table: { head: ['Modo', 'Cómo funciona'], rows: [
          ['Pomodoro', 'Rondas de concentración (25 min por defecto) separadas por descansos cortos, con un descanso largo tras cierto número de rondas. Cambia las duraciones en **Ajustes → Temporizador**.'],
          ['Concentración libre', 'Un solo bloque continuo. Elige de 15 a 90 minutos con los botones o escribe cualquier duración de hasta 600 minutos.']
        ] } },
        { h: 'Pausar y terminar' },
        { ul: [
          '**Pausa** detiene el reloj. El bloqueo de apps y sitios sigue activo.',
          '**Terminar sesión** acaba antes de tiempo. Los minutos que ya te concentraste cuentan, pero pierdes la bonificación por completar.',
          '**Saltar descanso** pasa directamente a la siguiente ronda.'
        ] },
        { h: 'Modo estricto' },
        { p: 'Con el modo estricto, terminar una ronda antes de tiempo no da XP por esa ronda. Actívalo en **Ajustes → Temporizador**.' },
        { h: 'Sesiones Iron' },
        { p: 'Una sesión Iron es una promesa que te haces. Mientras dura una concentración Iron:' },
        { ul: [
          'La guardia cierra las apps bloqueadas al instante y no se puede pausar.',
          'El bloqueo de sitios no se puede desactivar.',
          'Las listas de apps solo pueden crecer: puedes bloquear más apps, pero no quitar, desactivar ni permitir ninguna.',
          'Terminar antes requiere esperar 60 segundos y escribir una frase exactamente.',
          'Si la extensión desaparece, StudyNook cierra el navegador tras unos 90 segundos.'
        ] },
        { note: 'Al activar Iron, el interruptor queda bloqueado durante los días indicados en **Duración del bloqueo Iron** (4 por defecto). Elige una duración con la que te sientas cómodo antes de activarlo.', kind: 'warning' },
        { h: 'Qué da XP' },
        { p: 'Cada minuto de concentración da 1 XP, una ronda completada suma 10 XP y cada tarea completada suma 5 XP.' }
      ]
    },
    {
      id: 'apps', icon: 'app-window', title: 'Bloquear apps',
      lead: 'La guardia de apps vigila los programas abiertos y cierra los que has decidido bloquear.',
      blocks: [
        { h: 'Añadir apps' },
        { ul: [
          '**Biblioteca**: con un clic añades distracciones habituales con los nombres de proceso correctos.',
          '**En ejecución**: muestra todos los programas abiertos para que puedas bloquearlos o permitirlos.',
          '**Por nombre**: escribe un nombre y los nombres de proceso (búscalos en **En ejecución**).'
        ] },
        { h: 'Lista de bloqueo o de permitidas' },
        { table: { head: ['Modo', 'Qué se cierra'], rows: [
          ['Lista de bloqueo', 'Solo las apps de tu lista **Bloqueadas**.'],
          ['Lista de permitidas', 'Todas las apps que **no** están en tu lista **Permitidas**. Usa **Vista previa** para ver qué se cerraría antes de confiar en este modo.']
        ] } },
        { h: 'Qué pasa cuando se abre una app bloqueada' },
        { ul: [
          '**Avisar y cerrar**: una tarjeta de aviso hace una cuenta atrás (15 segundos por defecto) y luego la app se cierra.',
          '**Cerrar al instante**: la app se cierra en cuanto se detecta.',
          '**Solo avisar**: recibes un recordatorio y no se cierra nada.'
        ] },
        { p: 'En la tarjeta de aviso, **Mantener 5 min** da a esa app una excepción breve. Cambia estas opciones en **Ajustes → Bloqueo**.' },
        { h: 'Pausa de emergencia' },
        { p: 'Pausa la guardia 5, 15 o 60 minutos desde la página Aplicaciones o **Ajustes → Bloqueo**. No disponible durante una concentración Iron.' },
        { note: 'Los procesos del sistema (Explorador de Windows, servicios del sistema y similares) nunca se cierran, digan lo que digan tus listas.', kind: 'info' }
      ]
    },
    {
      id: 'sites', icon: 'globe', title: 'Bloquear sitios',
      lead: 'El bloqueo de sitios lo hace la extensión de StudyNook, que sigue tus sesiones automáticamente una vez vinculada.',
      blocks: [
        { h: 'Instalar la extensión' },
        { ol: [
          'Abre Chrome, Edge o Brave y ve a `chrome://extensions`.',
          'Activa el **Modo de desarrollador** (arriba a la derecha).',
          'Haz clic en **Cargar descomprimida** y elige la carpeta que aparece en la página **Sitios web**.',
          'Haz clic en el icono de la extensión StudyNook, escribe el código de 6 letras de la página Sitios web y pulsa **Vincular**.'
        ] },
        { h: 'Listas' },
        { ul: [
          '**Lista de bloqueo**: se bloquean los sitios de tu lista de bloqueados.',
          '**Lista de permitidos**: durante la concentración solo se abren los sitios de tu lista de permitidos.',
          'Una entrada puede incluir una ruta: `youtube.com/shorts` bloquea solo los Shorts, no todo YouTube.'
        ] },
        { h: 'Cuándo funciona el bloqueo' },
        { p: 'Elige **Durante la concentración** o **Siempre** en **Ajustes → Bloqueo**. Un sitio bloqueado muestra una página con el tiempo que le queda a tu sesión.' },
        { h: 'Si la aplicación se cierra durante una sesión' },
        { p: 'La extensión sigue bloqueando hasta la hora en que habría terminado la sesión, así que cerrar StudyNook no desbloquea los sitios.' },
        { note: 'Los navegadores no permiten que ninguna app te impida quitar o desactivar una extensión. StudyNook te avisa si la extensión deja de responder durante la concentración y, en una sesión Iron, cierra el navegador.', kind: 'info' }
      ]
    },
    {
      id: 'tasks', icon: 'list-checks', title: 'Tareas y notas',
      lead: 'Lleva el control de lo que tienes que estudiar y vincula tu tiempo de concentración a ello.',
      blocks: [
        { h: 'Tareas' },
        { ul: [
          '**Asignatura**: elige entre las asignaturas de **Ajustes → General**.',
          '**Tiempo previsto**: cuánto crees que te llevará. En concentración libre, elegir la tarea fija la duración de la sesión.',
          '**Estimación**: cuántos Pomodoros calculas. Las rondas completadas se cuentan respecto a ella.',
          '**Fuentes**: adjunta enlaces a vídeos de clase, artículos o páginas del libro y ábrelos con un clic.'
        ] },
        { p: 'Elige una tarea en la lista **Tarea** de la página Concentración antes de empezar y la sesión contará para ella. Completar una tarea da 5 XP.' },
        { h: 'Notas' },
        { p: 'Las notas son de texto sencillo y se guardan solas mientras escribes. Se almacenan con el resto de tus datos en este equipo.' },
        { ul: [
          '**Lista de notas**: la columna izquierda muestra tus notas, de la más reciente a la más antigua. Usa **Buscar en las notas** para encontrar una por su título o su texto.',
          '**Dirección del texto**: cada nota tiene su propio ajuste **Auto / LTR / RTL**. Auto sigue el idioma en el que escribes, así que las notas en árabe se leen de derecha a izquierda y las de español de izquierda a derecha. Elige LTR o RTL para forzarlo.',
          '**PDF**: pulsa **Adjuntar PDF**, o suelta archivos PDF sobre una nota, para guardar contigo las diapositivas y los artículos (hasta 20 por nota, 50 MB cada uno). Haz clic en un PDF para abrirlo en tu lector de PDF.',
          'Los PDF se copian a la carpeta **attachments** dentro de tu carpeta de datos (**Ajustes → Datos y privacidad → Carpeta de datos**). No forman parte de **Exportar datos** ni de las copias automáticas: copia esa carpeta si cambias de equipo.'
        ] }
      ]
    },
    {
      id: 'progress', icon: 'chart-column', title: 'Progreso',
      lead: 'El XP, los niveles, las rachas, el objetivo diario, el compañero y los logros reflejan lo mismo: el tiempo que pasas concentrado.',
      blocks: [
        { h: 'Niveles y rachas' },
        { ul: [
          'Cada nivel necesita algo más de XP que el anterior; la barra de la barra de título muestra tu progreso.',
          'Tu racha cuenta los días seguidos con al menos un minuto de concentración. Si te saltas un día, vuelve a cero.',
          'Define un **objetivo diario** en **Ajustes → General** para seguirlo en la página Concentración.'
        ] },
        { h: 'Tu compañero' },
        { table: { head: ['Etapa', 'Concentración total'], rows: [
          ['Huevo', 'Inicio'], ['Recién nacido', '45 min'], ['Gatito', '3 h'], ['Gato estudioso', '9 h'], ['Erudito', '20 h'], ['Leyenda', '40 h']
        ] } },
        { h: 'Logros' },
        { p: 'Hay 24 logros, desde tu primera sesión hasta una racha de 30 días. Los bloqueados indican qué necesitan en la página Progreso.' }
      ]
    },
    {
      id: 'settings', icon: 'settings', title: 'Referencia de ajustes',
      lead: 'Cada ajuste se guarda al instante. Esto es lo que controla cada sección.',
      blocks: [
        { table: { head: ['Sección', 'Ajustes'], rows: [
          ['General', 'Idioma, inicio con Windows, tu nombre, nombre del compañero, objetivo diario, asignaturas.'],
          ['Apariencia', 'Tema (Sistema, Claro, Oscuro, Auto) y minitemporizador.'],
          ['Temporizador', 'Duración de rondas y descansos, rondas antes de un descanso largo, inicio automático, modo estricto, sesión Iron y duración del bloqueo.'],
          ['Bloqueo', 'Cuándo funciona la guardia, lista de bloqueo o de permitidas, qué pasa al abrirse una app bloqueada, tiempo de aviso, frecuencia de comprobación, cuándo funciona el bloqueo de sitios, pausa de emergencia.'],
          ['Notificaciones', 'Concentración terminada, descanso terminado, avisos del bloqueador.'],
          ['Sonido', 'Sonidos de la interfaz, campanillas, volumen del ambiente, archivos de ambiente propios.'],
          ['Datos y privacidad', 'Copias de seguridad, exportar, importar, carpeta de datos, restablecer.'],
          ['Acerca de', 'Versión, recorrido de bienvenida, ayuda.']
        ] } },
        { h: 'Tema' },
        { p: '**Sistema** sigue el ajuste claro u oscuro de Windows. **Auto** es oscuro de 19:00 a 7:00 y claro durante el día. Toda la aplicación, incluidos el minitemporizador y la tarjeta de aviso, cambia a la vez.' }
      ]
    },
    {
      id: 'data', icon: 'database', title: 'Datos y privacidad',
      lead: 'StudyNook no tiene cuentas y no envía nada a internet. Todos los datos se quedan en una carpeta de tu equipo.',
      blocks: [
        { h: 'Archivos' },
        { table: { head: ['Archivo', 'Contenido'], rows: [
          ['`data.json`', 'Tus ajustes, tareas, notas, listas y progreso.'],
          ['`session.json`', 'La sesión en curso, para poder reanudarla tras un cierre inesperado.'],
          ['`backups/`', 'Una copia automática al día; se guardan las 7 últimas.'],
          ['`lifecycle.log`', 'Cuándo se inició, cerró o reinició la aplicación, para resolver problemas.']
        ] } },
        { p: 'Abre la carpeta desde **Ajustes → Datos y privacidad → Abrir carpeta de datos**.' },
        { h: 'Exportar e importar' },
        { p: '**Exportar** descarga todo en un archivo JSON, sin el secreto de vinculación de la extensión. **Importar** sustituye tus datos por un archivo exportado. Importar y restablecer no están disponibles durante una sesión.' },
        { h: 'Recuperación automática' },
        { p: 'Si StudyNook se cierra o falla durante una sesión, un pequeño asistente en segundo plano lo vuelve a abrir y la sesión continúa donde se quedó. Terminar una sesión de forma normal detiene el asistente.' },
        { h: 'La extensión' },
        { p: 'La extensión solo se comunica con StudyNook en tu propio equipo (`127.0.0.1`, puerto 47470), protegida por el código de vinculación.' }
      ]
    },
    {
      id: 'trouble', icon: 'wrench', title: 'Solución de problemas',
      lead: 'Soluciones para los problemas más habituales.',
      blocks: [
        { h: 'La extensión dice «sin conectar»' },
        { ul: [
          'Comprueba que StudyNook está abierto.',
          'Comprueba que el código de la página Sitios web coincide con el que escribiste en la extensión.',
          'Usa **Comprobar extensión** en la página Sitios web: te dice si está instalada, desactivada o ausente.',
          'Carga la extensión desde la carpeta que aparece en la página Sitios web, no desde una copia antigua.'
        ] },
        { h: '«Error de enlace» o «el puerto 47470 está ocupado»' },
        { p: 'Otro programa u otra copia de StudyNook está usando el puerto. Cierra las otras copias y reinicia StudyNook.' },
        { h: 'La ventana del temporizador desapareció' },
        { p: 'StudyNook está en la bandeja. Haz clic en su icono o en el minitemporizador.' },
        { h: 'No hay sonido' },
        { p: 'Haz clic una vez en cualquier parte de la ventana y vuelve a elegir un ambiente. Revisa **Ajustes → Sonido**.' },
        { h: 'La aplicación se cerró de forma inesperada' },
        { p: 'Vuelve a abrirla: tu sesión continúa. El archivo `lifecycle.log` de la carpeta de datos registra lo que pasó.' },
        { h: 'El modo lista de permitidas cerró algo que necesitaba' },
        { p: 'Añádelo en **Aplicaciones → Permitidas**, o usa **Vista previa** para ver qué cerraría ese modo antes de empezar una sesión.' }
      ]
    }
  ];
})(typeof self !== 'undefined' ? self : this);
