/**
 * Worker photo picker — shows Camera vs Gallery choice (Android-friendly).
 */
(function () {
  function empireWorkerClickFileInput(input) {
    if (!input) return;
    input.value = '';
    try {
      input.click();
    } catch (e) { /* ignore */ }
  }

  function photoT_(key, fallback) {
    if (typeof workerT === 'function') {
      var v = workerT(key);
      if (v && v !== key) return v;
    }
    return fallback != null ? fallback : key;
  }

  function empireWorkerShowPhotoChoice(opts) {
    opts = opts || {};
    var title = opts.title || photoT_('photoTitleAdd', 'Add photo');
    var existing = document.getElementById('empireWorkerPhotoChoice');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.id = 'empireWorkerPhotoChoice';
    wrap.className = 'worker-photo-choice-sheet';
    wrap.innerHTML =
      '<div class="worker-photo-choice-backdrop" data-close="1"></div>'
      + '<div class="worker-photo-choice-panel" role="dialog" aria-label="' + title + '">'
      + '<p class="worker-photo-choice-title">' + title + '</p>'
      + '<button type="button" class="worker-photo-choice-btn worker-photo-choice-camera" data-choice="camera">'
      + '<span class="worker-photo-choice-icon" aria-hidden="true">'
      + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/><circle cx="12" cy="13" r="3"/>'
      + '</svg></span> ' + photoT_('photoTakeCamera', 'Take photo (camera)') + '</button>'
      + '<button type="button" class="worker-photo-choice-btn worker-photo-choice-gallery" data-choice="gallery">'
      + '<span class="worker-photo-choice-icon" aria-hidden="true">'
      + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      + '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'
      + '</svg></span> ' + photoT_('photoChooseGallery', 'Choose from gallery') + '</button>'
      + '<button type="button" class="worker-photo-choice-btn worker-photo-choice-cancel" data-close="1">' + photoT_('photoCancel', 'Cancel') + '</button>'
      + '</div>';
    document.body.appendChild(wrap);

    function close() {
      wrap.remove();
    }
    wrap.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', close);
    });
    wrap.querySelector('[data-choice="camera"]').addEventListener('click', function () {
      close();
      if (typeof opts.onCamera === 'function') opts.onCamera();
    });
    wrap.querySelector('[data-choice="gallery"]').addEventListener('click', function () {
      close();
      if (typeof opts.onGallery === 'function') opts.onGallery();
    });
  }

  function empireWorkerPickPhoto(inputIds) {
    inputIds = inputIds || {};
    var camId = inputIds.camera || inputIds.cameraId;
    var galId = inputIds.gallery || inputIds.galleryId;
    if (!camId || !galId) return;
    empireWorkerShowPhotoChoice({
      title: inputIds.title || photoT_('photoTitleAdd', 'Add photo'),
      onCamera: function () {
        empireWorkerClickFileInput(document.getElementById(camId));
      },
      onGallery: function () {
        empireWorkerClickFileInput(document.getElementById(galId));
      }
    });
  }

  window.empireWorkerClickFileInput = empireWorkerClickFileInput;
  window.empireWorkerShowPhotoChoice = empireWorkerShowPhotoChoice;
  window.empireWorkerPickPhoto = empireWorkerPickPhoto;
})();
