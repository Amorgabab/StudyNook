/* ============================================================
   StudyNook · catalog.js  (PURE DATA — no dependencies)
   ------------------------------------------------------------
   • DISTRACTION_CATALOG: popular distracting apps with their
     real process names per OS, so "add Discord" just works.
   • NEVER_KILL: OS/system processes we refuse to touch (safety).
   • Seed lists for site blocklists / allowlists.
   Works in Node (module.exports) and in the browser (NookCatalog).
   ============================================================ */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.NookCatalog = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // procs entries are *normalized* names: lowercase, no path, no .exe
  const DISTRACTION_CATALOG = [
    { id: 'discord',    label: 'Discord',           emoji: '💬', procs: { win: ['discord', 'discordptb', 'discordcanary'], mac: ['discord'], linux: ['discord'] } },
    { id: 'steam',      label: 'Steam',             emoji: '🎮', procs: { win: ['steam', 'steamwebhelper', 'gameoverlayui', 'steamerrorreporter'], mac: ['steam'], linux: ['steam'] } },
    { id: 'epic',       label: 'Epic Games',        emoji: '', procs: { win: ['epicgameslauncher', 'epicwebhelper'], mac: ['epicgameslauncher'], linux: [] } },
    { id: 'minecraft',  label: 'Minecraft',         emoji: '⛏️', procs: { win: ['minecraft.windows', 'minecraft launcher', 'javaw'], mac: ['minecraft launcher'], linux: ['minecraft-launcher', 'java'] } },
    { id: 'roblox',     label: 'Roblox',            emoji: '🧱', procs: { win: ['robloxplayerlauncher', 'robloxplayerbeta', 'robloxstudiobeta'], mac: ['roblox'], linux: [] } },
    { id: 'lol',        label: 'League of Legends', emoji: '🏹', procs: { win: ['league of legends', 'leagueclient', 'leagueclientux', 'riotclientservices'], mac: ['league of legends'], linux: [] } },
    { id: 'valorant',   label: 'Valorant',          emoji: '🎯', procs: { win: ['valorant-win64-shipping', 'valorant', 'riotclientservices'], mac: [], linux: [] } },
    { id: 'cs2',        label: 'Counter-Strike 2',  emoji: '🔫', procs: { win: ['cs2', 'csgo'], mac: ['cs2'], linux: ['cs2'] } },
    { id: 'battlenet',  label: 'Battle.net',        emoji: '🛡️', procs: { win: ['battle.net', 'agent', 'blizzardbrowser'], mac: ['battle.net'], linux: [] } },
    { id: 'ea',         label: 'EA App',            emoji: '️', procs: { win: ['eadesktop', 'eabackgroundservice', 'origin'], mac: ['origin'], linux: [] } },
    { id: 'genshin',    label: 'Genshin Impact',    emoji: '✨', procs: { win: ['genshinimpact', 'yuanshen'], mac: ['genshin impact'], linux: [] } },
    { id: 'amongus',    label: 'Among Us',          emoji: '🚪', procs: { win: ['among us', 'amongus'], mac: ['among us'], linux: [] } },
    { id: 'terraria',   label: 'Terraria',          emoji: '🌳', procs: { win: ['terraria'], mac: ['terraria'], linux: ['terraria'] } },
    { id: 'spotify',    label: 'Spotify',           emoji: '🎧', procs: { win: ['spotify'], mac: ['spotify'], linux: ['spotify'] } },
    { id: 'whatsapp',   label: 'WhatsApp Desktop',  emoji: '📱', procs: { win: ['whatsapp', 'whatsappapp'], mac: ['whatsapp'], linux: ['whatsapp'] } },
    { id: 'telegram',   label: 'Telegram Desktop',  emoji: '✈️', procs: { win: ['telegram'], mac: ['telegram'], linux: ['telegram'] } },
    { id: 'skype',      label: 'Skype',             emoji: '☎️', procs: { win: ['skype', 'skypeapp'], mac: ['skype'], linux: ['skype'] } },
    { id: 'xbox',       label: 'Xbox App',          emoji: '🟩', procs: { win: ['xboxapp', 'gamingapp', 'xboxgameservices'], mac: [], linux: [] } },
    { id: 'wallpaper',  label: 'Wallpaper Engine',  emoji: '🖼️', procs: { win: ['wallpaper32', 'wallpaper64'], mac: [], linux: [] } },
    { id: 'netflix',    label: 'Netflix App',       emoji: '', procs: { win: ['netflix', 'microsoft.media.player'], mac: ['netflix'], linux: [] } },
    { id: 'obsidian_n', label: 'Obsidian (if you doom-read)', emoji: '️', procs: { win: ['obsidian'], mac: ['obsidian'], linux: ['obsidian'] } }
  ];

  // Processes StudyNook will NEVER close, no matter what. (Safety net.)
  const NEVER_KILL = {
    win: [
      'system', 'registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass',
      'svchost', 'fontdrvhost', 'dwm', 'explorer', 'sihost', 'taskhostw', 'ctfmon',
      'runtimebroker', 'searchhost', 'searchapp', 'searchindexer', 'shellhost',
      'shellexperiencehost', 'startmenuexperiencehost', 'textinputhost',
      'applicationframehost', 'systemsettings', 'audiodg', 'wudfhost', 'dllhost',
      'msdtc', 'spoolsv', 'memory compression', 'securityhealthservice',
      'securityhealthsystray', 'msmpeng', 'niservice', 'conhost', 'cmd', 'powershell',
      'windowsterminal', 'code', 'nvvsvc', 'nvcontainer', 'nvdisplay.container',
      'nvtray', 'igfxem', 'igfxtray', 'igfxpers', 'amdlogmon', 'atieclxx', 'atiesrxx',
      'synaptics', 'synapticstouchpad', 'etdctrl', 'etdcctrl', 'rtkngui',
      'rtkaudioservice', 'aestsrv64', 'wacom', 'tabtips', 'tabtip', 'gamebar',
      'gamebarftserver', 'widgets', 'onedrive', 'logioptionsplus', 'lghub',
      'studynook', 'electron' // ourselves!
    ],
    mac: [
      'launchd', 'kernel_task', 'windowserver', 'finder', 'dock', 'systemuiserver',
      'loginwindow', 'coreservicesd', 'distnoted', 'usernoted', 'cfprefsd',
      'spotlight', 'mds', 'mds_stores', 'launchservicesd', 'securityd', 'configd',
      'powerd', 'blued', 'wifiagent', 'airportd', 'appleevents', 'tccd',
      'notification_center', 'controlcenter', 'talagent', 'lsd', 'pbs',
      'fontworker', 'iconservicesd', 'diskarbitrationd', 'coresymbolicationd',
      'opendirectoryd', 'taskgated', 'trustd', 'amfid', 'kernelmanagerd',
      'com.apple', 'studynook', 'electron'
    ],
    linux: [
      'systemd', 'init', 'kthreadd', 'xorg', 'wayland', 'gnome-shell', 'kwin',
      'plasmashell', 'xfce4-session', 'dbus-daemon', 'pulseaudio', 'pipewire',
      'wireplumber', 'networkmanager', 'accounts-daemon', 'polkitd', 'udisksd',
      'login', 'sshd', 'cron', 'crond', 'gdm', 'sddm', 'lightdm',
      'studynook', 'electron'
    ]
  };

  // Starter allowlist seeds (study-friendly apps) if you flip apps to allow mode
  const SAFE_ALLOW_SEED_APPS = ['chrome', 'msedge', 'firefox', 'code', 'notepad', 'winword', 'excel', 'powerpnt', 'onenote', 'anki', 'obsidian', 'notion', 'zoom', 'explorer'];

  // Sensible first site lists
  const SEED_BLOCK_SITES = ['youtube.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'instagram.com', 'tiktok.com', 'facebook.com', 'discord.com', 'netflix.com', 'pinterest.com'];
  const SEED_ALLOW_SITES = ['wikipedia.org', 'google.com', 'docs.google.com', 'drive.google.com', 'classroom.google.com', 'chatgpt.com', 'github.com', 'stackoverflow.com', 'khanacademy.org', 'coursera.org', 'quizlet.com', 'desmos.com', 'wolframalpha.com', 'notion.so'];

  function normalizeProcName(name) {
    if (!name) return '';
    let n = String(name).trim().toLowerCase();
    n = n.split(/[\\/]/).pop();          // strip path
    n = n.replace(/\.(exe|app|bin|cmd|com|bat)$/i, ''); // strip executable suffix
    return n.trim();
  }

  return { DISTRACTION_CATALOG, NEVER_KILL, SAFE_ALLOW_SEED_APPS, SEED_BLOCK_SITES, SEED_ALLOW_SITES, normalizeProcName };
});
