'use strict';
/* electron-builder's own icon/version editing is off (signAndEditExecutable: false, because it needs
   the winCodeSign bundle, which cannot be unpacked without symlink rights on many Windows setups).
   Without it StudyNook.exe keeps Electron's default atom icon in the taskbar, Start menu and file
   lists. This hook stamps the real icon and names into the packaged exe instead. */
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { rcedit } = await import('rcedit');
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');
  const version = context.packager.appInfo.version;
  await rcedit(exe, {
    icon: path.join(context.packager.projectDir, 'assets', 'icon.ico'),
    'version-string': {
      ProductName: 'StudyNook',
      FileDescription: 'StudyNook',
      OriginalFilename: 'StudyNook.exe',
      InternalName: 'StudyNook'
    },
    'file-version': version,
    'product-version': version
  });
};
