'use strict';
/* PDF attachments for notes. Files are copied into <data>/attachments/<noteId>/<attId>.pdf, so a note
   keeps its PDFs even if the original is moved or deleted. The renderer never supplies a path to open
   or delete: it names a note and an attachment, and the path is rebuilt here from ids that pass SAFE. */
const fs = require('fs');
const path = require('path');

const SAFE = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_PER_NOTE = 20;

const isSafeId = (s) => typeof s === 'string' && SAFE.test(s);
const newId = () => 'a' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

/** Where an attachment lives, or null if either id could escape the folder. */
function attachmentPath(root, noteId, attId) {
  if (!isSafeId(noteId) || !isSafeId(attId)) return null;
  return path.join(root, noteId, attId + '.pdf');
}

function isPdfFile(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(5);
    fs.readSync(fd, head, 0, 5, 0);
    return head.toString('latin1') === '%PDF-';
  } finally { fs.closeSync(fd); }
}

/** Copy PDFs in. Returns { added: [{id, name, size, addedAt}], rejected: [{name, reason}] };
    reasons: 'limit' | 'not-pdf' | 'too-big' | 'unreadable'. `room` is how many more the note may take. */
function addPdfs(root, noteId, paths, room) {
  const added = [], rejected = [];
  if (!isSafeId(noteId)) return { added, rejected: (paths || []).map((p) => ({ name: path.basename(String(p)), reason: 'unreadable' })) };
  for (const p of (Array.isArray(paths) ? paths : []).slice(0, MAX_PER_NOTE)) {
    const name = path.basename(String(p || '')).slice(0, 120) || 'file.pdf';
    try {
      if (added.length >= room) { rejected.push({ name, reason: 'limit' }); continue; }
      if (!/\.pdf$/i.test(name)) { rejected.push({ name, reason: 'not-pdf' }); continue; }
      const st = fs.statSync(p);
      if (!st.isFile()) { rejected.push({ name, reason: 'unreadable' }); continue; }
      if (st.size > MAX_BYTES) { rejected.push({ name, reason: 'too-big' }); continue; }
      if (!isPdfFile(p)) { rejected.push({ name, reason: 'not-pdf' }); continue; }
      const id = newId();
      fs.mkdirSync(path.join(root, noteId), { recursive: true });
      fs.copyFileSync(p, attachmentPath(root, noteId, id));
      added.push({ id, name, size: st.size, addedAt: Date.now() });
    } catch (e) { rejected.push({ name, reason: 'unreadable' }); }
  }
  return { added, rejected };
}

function removeAttachmentFile(root, noteId, attId) {
  const f = attachmentPath(root, noteId, attId);
  if (f) { try { fs.unlinkSync(f); } catch (e) { /* already gone */ } }
}

function removeNoteFiles(root, noteId) {
  if (!isSafeId(noteId)) return;
  try { fs.rmSync(path.join(root, noteId), { recursive: true, force: true }); } catch (e) { /* best effort */ }
}

/** Delete every attachment file no note refers to (a whole folder when its note is gone).
    Reset passes no notes, so the folder is emptied; an import keeps the PDFs of notes it brings back. */
function pruneAttachments(root, notes) {
  const keep = new Map();
  for (const n of notes || []) if (n && isSafeId(n.id)) keep.set(n.id, new Set((n.attachments || []).map((a) => a && a.id)));
  let dirs = [];
  try { dirs = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return; }
  for (const d of dirs) {
    const full = path.join(root, d.name);
    if (!d.isDirectory() || !keep.has(d.name)) { try { fs.rmSync(full, { recursive: true, force: true }); } catch (e) { /* best effort */ } continue; }
    const ids = keep.get(d.name);
    for (const f of fs.readdirSync(full)) {
      if (!ids.has(f.replace(/\.pdf$/i, ''))) { try { fs.rmSync(path.join(full, f), { force: true }); } catch (e) { /* best effort */ } }
    }
  }
}

module.exports = { pruneAttachments, MAX_BYTES, MAX_PER_NOTE, isSafeId, attachmentPath, addPdfs, removeAttachmentFile, removeNoteFiles };
