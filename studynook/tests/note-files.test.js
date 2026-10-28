'use strict';
/* PDF attachments on notes: only real PDFs go in, paths can't escape the attachments folder,
   and a note's stored shape (direction, attachment list) is sanitised on load. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const NoteFiles = require('../app/main/note-files.js');
const { sanitizeData } = require('../app/main/store.js');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nook-notefiles-'));
const root = path.join(tmp, 'attachments');
const make = (name, content) => { const f = path.join(tmp, name); fs.writeFileSync(f, content); return f; };
const pdf = (name) => make(name, '%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

suite('note files · adding PDFs', () => {
  test('a real PDF is copied into the note folder under a generated id', () => {
    const r = NoteFiles.addPdfs(root, 'n1', [pdf('lecture one.pdf')], 20);
    expect(r.added.length).toBe(1);
    expect(r.rejected.length).toBe(0);
    expect(r.added[0].name).toBe('lecture one.pdf');
    expect(fs.existsSync(NoteFiles.attachmentPath(root, 'n1', r.added[0].id))).toBe(true);
    expect(r.added[0].size > 0).toBe(true);
  });
  test('a copy survives the original being deleted', () => {
    const src = pdf('temp.pdf');
    const r = NoteFiles.addPdfs(root, 'n2', [src], 20);
    fs.unlinkSync(src);
    expect(fs.existsSync(NoteFiles.attachmentPath(root, 'n2', r.added[0].id))).toBe(true);
  });
  test('wrong extension, fake PDF, directories and missing files are refused with a reason', () => {
    const r = NoteFiles.addPdfs(root, 'n3', [make('notes.txt', '%PDF-1.4'), make('fake.pdf', 'MZ not a pdf'), tmp, path.join(tmp, 'gone.pdf')], 20);
    expect(r.added.length).toBe(0);
    expect(r.rejected.map((x) => x.reason)).toEqual(['not-pdf', 'not-pdf', 'not-pdf', 'unreadable']);
  });
  test('stops at the per-note limit', () => {
    const r = NoteFiles.addPdfs(root, 'n4', [pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')], 2);
    expect(r.added.length).toBe(2);
    expect(r.rejected.map((x) => x.reason)).toEqual(['limit']);
  });
  test('an unsafe note id never touches the disk', () => {
    const r = NoteFiles.addPdfs(root, '../evil', [pdf('x.pdf')], 20);
    expect(r.added.length).toBe(0);
    expect(fs.existsSync(path.join(tmp, 'evil'))).toBe(false);
  });
});

suite('note files · path safety and cleanup', () => {
  test('ids that could escape the folder have no path', () => {
    for (const bad of ['../x', 'a/b', 'a\\b', '', 'a b', '..', null, undefined, 5]) {
      expect(NoteFiles.attachmentPath(root, bad, 'a1')).toBe(null);
      expect(NoteFiles.attachmentPath(root, 'n1', bad)).toBe(null);
    }
    expect(NoteFiles.attachmentPath(root, 'n1', 'a1')).toBe(path.join(root, 'n1', 'a1.pdf'));
  });
  test('removing one attachment, then the whole note folder', () => {
    const r = NoteFiles.addPdfs(root, 'n5', [pdf('p.pdf'), pdf('q.pdf')], 20);
    NoteFiles.removeAttachmentFile(root, 'n5', r.added[0].id);
    expect(fs.existsSync(NoteFiles.attachmentPath(root, 'n5', r.added[0].id))).toBe(false);
    expect(fs.existsSync(NoteFiles.attachmentPath(root, 'n5', r.added[1].id))).toBe(true);
    NoteFiles.removeNoteFiles(root, 'n5');
    expect(fs.existsSync(path.join(root, 'n5'))).toBe(false);
    NoteFiles.removeNoteFiles(root, '../..');   // refused, harmless
    expect(fs.existsSync(tmp)).toBe(true);
  });
});

suite('store · note shape', () => {
  test('direction defaults to auto and unknown values are refused', () => {
    const d = sanitizeData({ notes: [{ id: 'n1', title: 't', body: 'b' }, { id: 'n2', dir: 'sideways' }, { id: 'n3', dir: 'rtl' }, { id: 'n4', dir: 'ltr' }] });
    expect(d.notes.map((n) => n.dir)).toEqual(['auto', 'auto', 'rtl', 'ltr']);
    expect(d.notes[0].attachments).toEqual([]);
  });
  test('attachment entries are validated, trimmed and capped at 20', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: 'a' + i, name: 'f' + i + '.pdf', size: 10, addedAt: 1 }));
    const d = sanitizeData({ notes: [{ id: 'n1', attachments: [{ id: '../x', name: 'evil' }, { id: 'ok_1', name: 'x'.repeat(500), size: 'big' }, 'junk', null].concat(many) }] });
    const a = d.notes[0].attachments;
    expect(a.length).toBe(20);
    expect(a.some((x) => x.id === '../x')).toBe(false);
    expect(a[0].id).toBe('ok_1');
    expect(a[0].name.length).toBe(120);
    expect(a[0].size).toBe(0);
  });
});
