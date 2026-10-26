/* StudyNook · help/help-fr.js — Articles d’aide (français). Même structure que help-en.js. */
(function (root) {
  root.NookHelp = root.NookHelp || {};
  root.NookHelp.fr = [
    {
      id: 'start', icon: 'rocket', title: 'Bien démarrer',
      lead: 'StudyNook est un minuteur de concentration qui ferme les applis et bloque les sites qui vous distraient pendant vos études. Tout reste sur votre ordinateur.',
      blocks: [
        { h: 'Votre première session' },
        { ol: [
          'Ouvrez **Tâches** et ajoutez ce que vous voulez étudier (facultatif).',
          'Dans **Concentration**, choisissez **Pomodoro** (tours avec pauses) ou **Concentration libre** (un seul bloc de la durée voulue).',
          'Choisissez une tâche dans la liste **Tâche** si vous voulez que le temps lui soit compté.',
          'Appuyez sur **Commencer**. Le minuteur continue même si vous masquez la fenêtre.'
        ] },
        { h: 'Activer le blocage' },
        { ul: [
          '**Applications** : ajoutez les programmes qui vous distraient. Pendant la concentration, ils sont fermés après un court avertissement.',
          '**Sites web** : ajoutez les sites qui vous distraient, puis installez et associez l’extension (voir **Bloquer des sites**).'
        ] },
        { h: 'Où se trouve le minuteur' },
        { p: 'Fermer la fenêtre masque StudyNook dans la barre des tâches (en bas à droite). Pendant une session, un petit **mini minuteur** reste au-dessus des autres fenêtres ; cliquez dessus pour rouvrir StudyNook.' },
        { note: 'Vous ne pouvez pas fermer ni quitter StudyNook tant qu’une session existe, même en pause. Arrêtez d’abord la session.', kind: 'info' }
      ]
    },
    {
      id: 'focus', icon: 'timer', title: 'Sessions de concentration',
      lead: 'Deux modes de minuteur, un mode strict facultatif et un mode Iron pour les jours où vous avez besoin d’un engagement ferme.',
      blocks: [
        { h: 'Pomodoro et concentration libre' },
        { table: { head: ['Mode', 'Fonctionnement'], rows: [
          ['Pomodoro', 'Des tours de concentration (25 min par défaut) séparés par des pauses courtes, avec une pause longue après un certain nombre de tours. Modifiez les durées dans **Réglages → Minuteur**.'],
          ['Concentration libre', 'Un seul bloc continu. Choisissez 15 à 90 minutes avec les boutons, ou saisissez une durée jusqu’à 600 minutes.']
        ] } },
        { h: 'Pause et arrêt' },
        { ul: [
          '**Pause** arrête le chrono. Le blocage des applis et des sites continue.',
          '**Arrêter la session** termine plus tôt. Les minutes déjà concentrées comptent, mais vous perdez le bonus de fin de tour.',
          '**Passer la pause** démarre directement le tour suivant.'
        ] },
        { h: 'Mode strict' },
        { p: 'En mode strict, arrêter un tour plus tôt ne rapporte aucun XP pour ce tour. Activez-le dans **Réglages → Minuteur**.' },
        { h: 'Sessions Iron' },
        { p: 'Une session Iron est une promesse faite à vous-même. Pendant une concentration Iron :' },
        { ul: [
          'La garde ferme les applis bloquées immédiatement et ne peut pas être mise en pause.',
          'Le blocage des sites ne peut pas être désactivé.',
          'Les listes d’applis ne peuvent que s’allonger : vous pouvez bloquer d’autres applis, mais pas en retirer, en désactiver ni en autoriser.',
          'Arrêter plus tôt demande une attente de 60 secondes et la saisie exacte d’une phrase.',
          'Si l’extension disparaît, StudyNook ferme le navigateur après environ 90 secondes.'
        ] },
        { note: 'Activer Iron verrouille l’interrupteur pendant le nombre de jours défini dans **Durée du verrouillage Iron** (4 par défaut). Choisissez une durée qui vous convient avant de l’activer.', kind: 'warning' },
        { h: 'Ce qui rapporte de l’XP' },
        { p: 'Chaque minute de concentration rapporte 1 XP, un tour terminé ajoute 10 XP et chaque tâche terminée ajoute 5 XP.' }
      ]
    },
    {
      id: 'apps', icon: 'app-window', title: 'Bloquer des applis',
      lead: 'La garde des applis surveille les programmes ouverts et ferme ceux que vous avez choisi de bloquer.',
      blocks: [
        { h: 'Ajouter des applis' },
        { ul: [
          '**Bibliothèque** : un clic ajoute les distractions courantes avec les bons noms de processus.',
          '**En cours** : liste tous les programmes ouverts pour les bloquer ou les autoriser.',
          '**Par nom** : saisissez un nom et les noms de processus (trouvez-les dans **En cours**).'
        ] },
        { h: 'Liste de blocage ou d’autorisation' },
        { table: { head: ['Mode', 'Ce qui est fermé'], rows: [
          ['Liste de blocage', 'Uniquement les applis de votre liste **Bloquées**.'],
          ['Liste d’autorisation', 'Toutes les applis qui ne sont **pas** dans votre liste **Autorisées**. Utilisez **Aperçu** pour voir ce qui serait fermé avant de vous y fier.']
        ] } },
        { h: 'Quand une appli bloquée s’ouvre' },
        { ul: [
          '**Avertir puis fermer** : une carte d’avertissement fait un décompte (15 secondes par défaut), puis l’appli se ferme.',
          '**Fermer immédiatement** : l’appli se ferme dès qu’elle est détectée.',
          '**Avertir seulement** : vous recevez un rappel, rien n’est fermé.'
        ] },
        { p: 'Sur la carte d’avertissement, **Garder 5 min** accorde une courte exception à cette appli. Modifiez ces options dans **Réglages → Blocage**.' },
        { h: 'Pause d’urgence' },
        { p: 'Mettez la garde en pause 5, 15 ou 60 minutes depuis la page Applications ou **Réglages → Blocage**. Indisponible pendant une concentration Iron.' },
        { note: 'Les processus système (Explorateur Windows, services système, etc.) ne sont jamais fermés, quelles que soient vos listes.', kind: 'info' }
      ]
    },
    {
      id: 'sites', icon: 'globe', title: 'Bloquer des sites',
      lead: 'Le blocage des sites est assuré par l’extension StudyNook, qui suit vos sessions automatiquement une fois associée.',
      blocks: [
        { h: 'Installer l’extension' },
        { ol: [
          'Ouvrez Chrome, Edge ou Brave et allez sur `chrome://extensions`.',
          'Activez le **Mode développeur** (en haut à droite).',
          'Cliquez sur **Charger l’extension non empaquetée** et choisissez le dossier indiqué sur la page **Sites web**.',
          'Cliquez sur l’icône de l’extension StudyNook, saisissez le code à 6 lettres de la page Sites web et cliquez sur **Associer**.'
        ] },
        { h: 'Listes' },
        { ul: [
          '**Liste de blocage** : les sites de votre liste Bloqués sont bloqués.',
          '**Liste d’autorisation** : pendant la concentration, seuls les sites de votre liste Autorisés s’ouvrent.',
          'Une entrée peut contenir un chemin : `youtube.com/shorts` ne bloque que les Shorts, pas tout YouTube.'
        ] },
        { h: 'Quand le blocage fonctionne' },
        { p: 'Choisissez **Pendant la concentration** ou **Toujours** dans **Réglages → Blocage**. Un site bloqué affiche une page avec le temps restant de votre session.' },
        { h: 'Si l’application est fermée pendant une session' },
        { p: 'L’extension continue de bloquer jusqu’à l’heure où la session se serait terminée : fermer StudyNook ne débloque donc pas les sites.' },
        { note: 'Les navigateurs ne permettent à aucune application de vous empêcher de retirer ou de désactiver une extension. StudyNook vous avertit si l’extension ne répond plus pendant la concentration et, en session Iron, ferme le navigateur.', kind: 'info' }
      ]
    },
    {
      id: 'tasks', icon: 'list-checks', title: 'Tâches et notes',
      lead: 'Gardez la liste de ce que vous devez étudier et reliez-y votre temps de concentration.',
      blocks: [
        { h: 'Tâches' },
        { ul: [
          '**Matière** : choisissez parmi les matières de **Réglages → Général**.',
          '**Temps prévu** : la durée que vous prévoyez. En concentration libre, choisir la tâche règle la durée de la session.',
          '**Estimation** : le nombre de Pomodoros prévu. Les tours terminés y sont comptés.',
          '**Sources** : joignez des liens vers des vidéos de cours, des articles ou des pages de manuel et ouvrez-les en un clic.'
        ] },
        { p: 'Choisissez une tâche dans la liste **Tâche** de la page Concentration avant de commencer, et la session lui sera comptée. Terminer une tâche rapporte 5 XP.' },
        { h: 'Notes' },
        { p: 'Les notes sont en texte brut et s’enregistrent automatiquement pendant que vous tapez. Elles sont stockées avec le reste de vos données sur cet ordinateur.' }
      ]
    },
    {
      id: 'progress', icon: 'chart-column', title: 'Progression',
      lead: 'XP, niveaux, séries, objectif quotidien, compagnon et succès reflètent tous la même chose : le temps passé concentré.',
      blocks: [
        { h: 'Niveaux et séries' },
        { ul: [
          'Chaque niveau demande un peu plus d’XP que le précédent ; la barre de la barre de titre montre votre progression.',
          'Votre série compte les jours consécutifs avec au moins une minute de concentration. Manquer un jour la remet à zéro.',
          'Définissez un **objectif quotidien** dans **Réglages → Général** pour le suivre sur la page Concentration.'
        ] },
        { h: 'Votre compagnon' },
        { table: { head: ['Stade', 'Concentration totale'], rows: [
          ['Œuf', 'Début'], ['Nouveau-né', '45 min'], ['Chaton', '3 h'], ['Chat studieux', '9 h'], ['Érudit', '20 h'], ['Légende', '40 h']
        ] } },
        { h: 'Succès' },
        { p: 'Il y a 24 succès, de votre première session à une série de 30 jours. Ceux qui sont verrouillés indiquent leur condition sur la page Progression.' }
      ]
    },
    {
      id: 'settings', icon: 'settings', title: 'Référence des réglages',
      lead: 'Chaque réglage est enregistré immédiatement. Voici ce que contrôle chaque section.',
      blocks: [
        { table: { head: ['Section', 'Réglages'], rows: [
          ['Général', 'Langue, lancement avec Windows, votre prénom, nom du compagnon, objectif quotidien, matières.'],
          ['Apparence', 'Thème (Système, Clair, Sombre, Auto) et mini minuteur.'],
          ['Minuteur', 'Durées des tours et des pauses, tours avant une pause longue, démarrage automatique, mode strict, session Iron et durée du verrouillage.'],
          ['Blocage', 'Quand la garde fonctionne, liste de blocage ou d’autorisation, ce qui se passe quand une appli bloquée s’ouvre, délai d’avertissement, fréquence de vérification, quand le blocage des sites fonctionne, pause d’urgence.'],
          ['Notifications', 'Concentration terminée, pause terminée, alertes de blocage.'],
          ['Son', 'Sons de l’interface, carillons, volume de l’ambiance, fichiers d’ambiance personnalisés.'],
          ['Données et confidentialité', 'Sauvegardes, export, import, dossier des données, réinitialisation.'],
          ['À propos', 'Version, visite guidée, aide.']
        ] } },
        { h: 'Thème' },
        { p: '**Système** suit le réglage clair ou sombre de Windows. **Auto** est sombre de 19 h à 7 h et clair pendant la journée. Toute l’application, mini minuteur et carte d’avertissement compris, change en même temps.' }
      ]
    },
    {
      id: 'data', icon: 'database', title: 'Données et confidentialité',
      lead: 'StudyNook n’a pas de compte et n’envoie rien sur Internet. Toutes les données restent dans un dossier de votre ordinateur.',
      blocks: [
        { h: 'Fichiers' },
        { table: { head: ['Fichier', 'Contenu'], rows: [
          ['`data.json`', 'Vos réglages, tâches, notes, listes et votre progression.'],
          ['`session.json`', 'La session en cours, pour pouvoir la reprendre après un plantage.'],
          ['`backups/`', 'Une sauvegarde automatique par jour ; les 7 dernières sont conservées.'],
          ['`lifecycle.log`', 'Quand l’application a démarré, s’est fermée ou a redémarré, pour le dépannage.']
        ] } },
        { p: 'Ouvrez le dossier depuis **Réglages → Données et confidentialité → Ouvrir le dossier**.' },
        { h: 'Export et import' },
        { p: '**Exporter** télécharge tout dans un fichier JSON, sans le secret d’association de l’extension. **Importer** remplace vos données par un fichier exporté. L’import et la réinitialisation sont indisponibles pendant une session.' },
        { h: 'Reprise automatique' },
        { p: 'Si StudyNook est fermé ou plante pendant une session, un petit assistant en arrière-plan le rouvre et la session reprend là où elle s’était arrêtée. Arrêter une session normalement arrête l’assistant.' },
        { h: 'L’extension' },
        { p: 'L’extension communique uniquement avec StudyNook sur votre propre ordinateur (`127.0.0.1`, port 47470), protégée par le code d’association.' }
      ]
    },
    {
      id: 'trouble', icon: 'wrench', title: 'Dépannage',
      lead: 'Solutions aux problèmes les plus courants.',
      blocks: [
        { h: 'L’extension indique « non connectée »' },
        { ul: [
          'Vérifiez que StudyNook est ouvert.',
          'Vérifiez que le code de la page Sites web correspond à celui saisi dans l’extension.',
          'Utilisez **Vérifier l’extension** sur la page Sites web : vous saurez si elle est installée, désactivée ou absente.',
          'Chargez l’extension depuis le dossier indiqué sur la page Sites web, pas depuis une ancienne copie.'
        ] },
        { h: '« Erreur de liaison » ou « port 47470 occupé »' },
        { p: 'Un autre programme, ou une autre copie de StudyNook, utilise ce port. Quittez les autres copies et redémarrez StudyNook.' },
        { h: 'La fenêtre du minuteur a disparu' },
        { p: 'StudyNook est dans la barre des tâches. Cliquez sur son icône ou sur le mini minuteur.' },
        { h: 'Pas de son' },
        { p: 'Cliquez une fois n’importe où dans la fenêtre, puis choisissez de nouveau une ambiance. Vérifiez **Réglages → Son**.' },
        { h: 'L’application s’est fermée de façon inattendue' },
        { p: 'Rouvrez-la : votre session continue. Le fichier `lifecycle.log` du dossier des données indique ce qui s’est passé.' },
        { h: 'Le mode liste d’autorisation a fermé un programme utile' },
        { p: 'Ajoutez-le dans **Applications → Autorisées**, ou utilisez **Aperçu** pour voir ce que ce mode fermerait avant de commencer une session.' }
      ]
    }
  ];
})(typeof self !== 'undefined' ? self : this);
