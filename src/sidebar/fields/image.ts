// Image field: preview + drag-and-drop / click-to-browse upload into the
// media library. The hidden input holds the attachment ID that gets saved.

import type { Field, RestResponse } from '../../types';
import { t, type Lang } from '../../lib/i18n';
import { h } from '../dom';

export type UploadImage = (base64: string, filename: string, mime: string) => Promise<RestResponse>;

export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error || new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

export function buildImageField(sectionId: string, field: Field, lang: Lang, uploadImage: UploadImage): HTMLElement {
  const hidden = h('input', {
    type: 'hidden',
    value: String(field.value || ''),
    dataset: { section: sectionId, field: field.id, type: 'text' },
  });
  const preview = h('img', { className: 'seb-image-preview' });
  if (field.previewUrl) preview.src = field.previewUrl;
  else preview.style.display = 'none';

  const dropZone = h('div', { className: 'seb-dropzone', textContent: t('dropImage', lang) });
  const fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });

  const upload = async (file: File) => {
    const originalText = dropZone.textContent;
    dropZone.textContent = t('uploading', lang);
    try {
      const res = await uploadImage(await fileToBase64(file), file.name, file.type);
      if (!res.ok) throw new Error('Upload failed: ' + res.status);
      const attachment = res.json;
      hidden.value = String(attachment.id);
      // Programmatic value changes don't fire 'input' — the delegated autosave listener needs this.
      hidden.dispatchEvent(new Event('input', { bubbles: true }));
      preview.src = attachment.source_url || attachment.media_details?.sizes?.thumbnail?.source_url || '';
      preview.style.display = '';
      dropZone.textContent = originalText;
    } catch (err) {
      dropZone.textContent = t('error', lang) + ': ' + (err as Error).message;
    }
  };

  dropZone.onclick = () => fileInput.click();
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('seb-drag-over'); };
  dropZone.ondragleave = () => dropZone.classList.remove('seb-drag-over');
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('seb-drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) upload(file);
  };
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (file) upload(file);
  };

  return h('div', { className: 'seb-image-field' }, preview, dropZone, fileInput, hidden);
}
