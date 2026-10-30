/* StudyNook extension · i18n.js — strings for the popup and the blocked page.
   Language: the desktop app's setting when connected, else the browser's. */
(function (root) {
  'use strict';
  const D = {
    en: {
      'pop.connected': 'Connected', 'pop.standalone': 'Standalone', 'pop.syncing': 'Syncing…', 'pop.sync': 'Sync now',
      'pop.stale': 'Your browser is running an older copy of the extension.', 'pop.reload': 'Reload extension',
      'pop.off': 'Website blocking is off', 'pop.active': 'Blocking is active', 'pop.sleeping': 'Waiting for your next focus',
      'pop.focusLeft': 'Focus · {time} left', 'pop.breakLeft': 'Break · {time} left', 'pop.paused': ' (paused)',
      'pop.noSession': 'No session running in the app', 'pop.saFocus': 'Standalone focus · {time} left', 'pop.offline': 'Desktop app is not running',
      'pop.sweep': 'Open tabs checked {n} s ago', 'pop.start': 'Start a 25-minute focus', 'pop.stop': 'End standalone focus',
      'pop.pair.label': 'Pair with the desktop app. Enter the 6-letter code from StudyNook → Websites.', 'pop.pair': 'Pair',
      'pop.pair.ok': 'Paired', 'pop.pair.fail': 'Wrong code, or the app is not running', 'pop.foot': 'Lists and settings live in the StudyNook app.',
      'blk.title': 'This site is blocked during focus', 'blk.body': 'It will be available again when your focus session ends.',
      'blk.left': 'Focus ends in {time}', 'blk.always': 'Blocking is set to always on', 'blk.paused': 'Session paused · {time} left', 'blk.offline': 'StudyNook is closed · blocking stays on', 'blk.back': 'Go back', 'blk.close': 'Close tab',
      'blk.count': 'Blocked {n} times so far', 'blk.site': 'this site',
      quotes: ['Small steps every day add up.', 'Focus is a gift to your future self.', 'The internet will still be here after your session.', 'One page, one problem, one minute at a time.', 'Deep work first, everything else later.', 'Progress hides inside quiet minutes.']
    },
    ar: {
      'pop.connected': 'متصل', 'pop.standalone': 'وضع مستقل', 'pop.syncing': 'جارٍ المزامنة…', 'pop.sync': 'زامن الآن',
      'pop.stale': 'يعمل متصفحك بنسخة قديمة من الإضافة.', 'pop.reload': 'أعد تحميل الإضافة',
      'pop.off': 'حظر المواقع متوقف', 'pop.active': 'الحظر نشط', 'pop.sleeping': 'بانتظار جلسة التركيز القادمة',
      'pop.focusLeft': 'تركيز · متبقٍ {time}', 'pop.breakLeft': 'استراحة · متبقٍ {time}', 'pop.paused': ' (متوقف مؤقتًا)',
      'pop.noSession': 'لا توجد جلسة في التطبيق', 'pop.saFocus': 'تركيز مستقل · متبقٍ {time}', 'pop.offline': 'تطبيق سطح المكتب لا يعمل',
      'pop.sweep': 'فُحصت علامات التبويب قبل {n} ث', 'pop.start': 'ابدأ تركيزًا لمدة 25 دقيقة', 'pop.stop': 'أنهِ التركيز المستقل',
      'pop.pair.label': 'اربط الإضافة بتطبيق سطح المكتب. أدخل الرمز المكوّن من 6 أحرف من StudyNook ← المواقع.', 'pop.pair': 'ربط',
      'pop.pair.ok': 'تم الربط', 'pop.pair.fail': 'رمز خاطئ أو أن التطبيق لا يعمل', 'pop.foot': 'القوائم والإعدادات موجودة في تطبيق StudyNook.',
      'blk.title': 'هذا الموقع محظور أثناء التركيز', 'blk.body': 'سيعود متاحًا عند انتهاء جلسة التركيز.',
      'blk.left': 'ينتهي التركيز بعد {time}', 'blk.always': 'الحظر مضبوط ليعمل دائمًا', 'blk.paused': 'الجلسة متوقفة مؤقتًا · المتبقي {time}', 'blk.offline': 'StudyNook مغلق · يبقى الحظر قائمًا', 'blk.back': 'رجوع', 'blk.close': 'أغلق علامة التبويب',
      'blk.count': 'حُظر {n} مرة حتى الآن', 'blk.site': 'هذا الموقع',
      quotes: ['الخطوات الصغيرة كل يوم تتراكم.', 'التركيز هدية لنفسك في المستقبل.', 'سيبقى الإنترنت هنا بعد جلستك.', 'صفحة واحدة، مسألة واحدة، دقيقة واحدة في كل مرة.', 'العمل العميق أولًا، وكل شيء آخر لاحقًا.', 'التقدم يختبئ في الدقائق الهادئة.']
    },
    fr: {
      'pop.connected': 'Connectée', 'pop.standalone': 'Autonome', 'pop.syncing': 'Synchronisation…', 'pop.sync': 'Synchroniser',
      'pop.stale': 'Votre navigateur utilise une ancienne version de l’extension.', 'pop.reload': 'Recharger l’extension',
      'pop.off': 'Le blocage des sites est désactivé', 'pop.active': 'Le blocage est actif', 'pop.sleeping': 'En attente de votre prochaine session',
      'pop.focusLeft': 'Concentration · encore {time}', 'pop.breakLeft': 'Pause · encore {time}', 'pop.paused': ' (en pause)',
      'pop.noSession': 'Aucune session en cours dans l’application', 'pop.saFocus': 'Session autonome · encore {time}', 'pop.offline': 'L’application de bureau n’est pas ouverte',
      'pop.sweep': 'Onglets vérifiés il y a {n} s', 'pop.start': 'Démarrer 25 minutes de concentration', 'pop.stop': 'Arrêter la session autonome',
      'pop.pair.label': 'Associez l’extension à l’application. Saisissez le code à 6 lettres affiché dans StudyNook → Sites web.', 'pop.pair': 'Associer',
      'pop.pair.ok': 'Associée', 'pop.pair.fail': 'Code incorrect, ou l’application n’est pas ouverte', 'pop.foot': 'Les listes et réglages se trouvent dans l’application StudyNook.',
      'blk.title': 'Ce site est bloqué pendant la concentration', 'blk.body': 'Il sera de nouveau accessible à la fin de votre session.',
      'blk.left': 'Fin de la session dans {time}', 'blk.always': 'Le blocage est réglé sur « toujours »', 'blk.paused': 'Session en pause · {time} restantes', 'blk.offline': 'StudyNook est fermé · le blocage reste actif', 'blk.back': 'Revenir', 'blk.close': 'Fermer l’onglet',
      'blk.count': 'Bloqué {n} fois jusqu’ici', 'blk.site': 'ce site',
      quotes: ['Les petits pas de chaque jour finissent par compter.', 'La concentration est un cadeau pour votre futur vous.', 'Internet sera toujours là après votre session.', 'Une page, un problème, une minute à la fois.', 'Le travail profond d’abord, le reste ensuite.', 'Le progrès se cache dans les minutes calmes.']
    },
    es: {
      'pop.connected': 'Conectada', 'pop.standalone': 'Independiente', 'pop.syncing': 'Sincronizando…', 'pop.sync': 'Sincronizar',
      'pop.stale': 'Tu navegador usa una versión antigua de la extensión.', 'pop.reload': 'Recargar extensión',
      'pop.off': 'El bloqueo de sitios está desactivado', 'pop.active': 'El bloqueo está activo', 'pop.sleeping': 'Esperando tu próxima sesión',
      'pop.focusLeft': 'Concentración · quedan {time}', 'pop.breakLeft': 'Descanso · quedan {time}', 'pop.paused': ' (en pausa)',
      'pop.noSession': 'No hay ninguna sesión en la aplicación', 'pop.saFocus': 'Sesión independiente · quedan {time}', 'pop.offline': 'La aplicación de escritorio no está abierta',
      'pop.sweep': 'Pestañas revisadas hace {n} s', 'pop.start': 'Empezar 25 minutos de concentración', 'pop.stop': 'Terminar la sesión independiente',
      'pop.pair.label': 'Vincula la extensión con la aplicación. Escribe el código de 6 letras de StudyNook → Sitios web.', 'pop.pair': 'Vincular',
      'pop.pair.ok': 'Vinculada', 'pop.pair.fail': 'Código incorrecto o la aplicación no está abierta', 'pop.foot': 'Las listas y los ajustes están en la aplicación StudyNook.',
      'blk.title': 'Este sitio está bloqueado durante la concentración', 'blk.body': 'Volverá a estar disponible cuando termine tu sesión.',
      'blk.left': 'La sesión termina en {time}', 'blk.always': 'El bloqueo está configurado como siempre activo', 'blk.paused': 'Sesión en pausa · quedan {time}', 'blk.offline': 'StudyNook está cerrado · el bloqueo sigue activo', 'blk.back': 'Volver', 'blk.close': 'Cerrar pestaña',
      'blk.count': 'Bloqueado {n} veces hasta ahora', 'blk.site': 'este sitio',
      quotes: ['Los pequeños pasos de cada día suman.', 'Concentrarte es un regalo para tu yo del futuro.', 'Internet seguirá aquí después de tu sesión.', 'Una página, un problema, un minuto cada vez.', 'Primero el trabajo profundo, lo demás después.', 'El progreso se esconde en los minutos tranquilos.']
    }
  };
  let lang = 'en';
  function pick(stored) {
    const nav = String((root.navigator && root.navigator.language) || 'en').slice(0, 2);
    lang = D[stored] ? stored : D[nav] ? nav : 'en';
    if (root.document) { root.document.documentElement.lang = lang; root.document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; }
    return lang;
  }
  function t(key, vars) {
    let s = (D[lang] && D[lang][key] !== undefined) ? D[lang][key] : D.en[key];
    if (s === undefined) return key;
    if (vars && typeof s === 'string') s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
    return s;
  }
  root.NookExtI18n = { t, pick, LANGS: Object.keys(D), D };
})(typeof self !== 'undefined' ? self : this);
