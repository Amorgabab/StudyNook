'use strict';
const fs = require('fs');

/* Write a file so a kill at any instant leaves either the old or the new content, never half of it
   (a half-written session.json reads as "no session" and loses the focus round). The temp file is
   renamed over the target; if the rename is refused (a virus scanner holding the file), fall back
   to a plain write rather than losing the save. */
function writeFileAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text);
  try { fs.renameSync(tmp, file); }
  catch (e) { fs.writeFileSync(file, text); try { fs.unlinkSync(tmp); } catch (e2) {} }
}
module.exports = { writeFileAtomic };
