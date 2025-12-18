// Simple Pinterest-like demo: loads sample images and handles modal preview + download
const STORAGE_KEY = 'pintrost_uploads_v1';
// Utility: sanitize filename
function sanitizeFilename(name){
  return name.replace(/[^a-z0-9-_\.]/gi, '_');
}

// Convert dataURL to Blob
function dataURLToBlob(dataURL){
  const parts = dataURL.split(',');
  const meta = parts[0];
  const isBase64 = meta.indexOf('base64') >= 0;
  const raw = parts[1];
  let byteString;
  if(isBase64){
    byteString = atob(raw);
  }else{
    byteString = decodeURIComponent(raw);
  }
  const mime = meta.split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for(let i=0;i<byteString.length;i++) ia[i]=byteString.charCodeAt(i);
  return new Blob([ab], {type:mime});
}

// LocalStorage helpers
function loadUploadsFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return [];
    return JSON.parse(raw);
  }catch(e){ return []; }
}
function saveUploadsToStorage(list){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }catch(e){ console.warn('Could not save uploads', e); }
}
function addUploadedItemToStorage(item){
  const list = loadUploadsFromStorage();
  list.unshift(item);
  saveUploadsToStorage(list);
}

function createCard(item){
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `\n    <div class="image-wrap">\n      <img loading="lazy" src="${item.src}" alt="${item.title}">\n      <div class="overlay">\n        <button class="download-overlay" title="Unduh">⬇</button>\n      </div>\n    </div>\n    <div class="meta">\n      <h3 class="title">${item.title}</h3>\n      <div class="author">Oleh: ${item.author}</div>\n    </div>\n  `;
  // open modal when clicking card (but not overlay buttons)
  el.addEventListener('click', (e)=>{ if(e.target.closest('.download-overlay')) return; openModal(item); });
  // download button on the card
  const dl = el.querySelector('.download-overlay');
  dl.addEventListener('click', (e)=>{ e.stopPropagation(); dl.setAttribute('data-downloading','true'); downloadImage(item.src, `${sanitizeFilename(item.title)}.jpg`).finally(()=> dl.removeAttribute('data-downloading')); });
  return el;
}

async function downloadImage(url, filename){
  try{
    // show temporary status by disabling download button(s)
    document.querySelectorAll('[data-downloading]').forEach(b => b.setAttribute('disabled','disabled'));

    let blob;
    if(url.startsWith('data:')){
      blob = dataURLToBlob(url);
    }else{
      const res = await fetch(url, {mode:'cors'});
      if(!res.ok) throw new Error('Network response not ok');
      blob = await res.blob();
    }

    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }catch(err){
    console.error('Download failed', err);
    alert('Gagal mengunduh langsung. Gambar akan dibuka di tab baru.');
    window.open(url, '_blank');
  }finally{
    document.querySelectorAll('[data-downloading]').forEach(b => b.removeAttribute('disabled'));
  }
}

function openModal(item){
  const modal = document.getElementById('modal');
  const img = document.getElementById('modalImage');
  const title = document.getElementById('modalTitle');
  const author = document.getElementById('modalAuthor');
  const download = document.getElementById('downloadBtn');
  img.src = item.src;
  title.textContent = item.title;
  author.textContent = 'Oleh: ' + item.author;
  download.href = item.src;
  download.setAttribute('data-downloading','true');
  download.onclick = (e)=>{ e.preventDefault(); downloadImage(item.src, `${sanitizeFilename(item.title)}.jpg`); };
  modal.setAttribute('aria-hidden','false');
}

function closeModal(){
  document.getElementById('modal').setAttribute('aria-hidden','true');
}

function init(){
  const wrap = document.getElementById('masonry');
  // Load stored uploads first
  const stored = loadUploadsFromStorage();
  stored.forEach(s => wrap.appendChild(createCard(s)));
  // Then sample items
  samples.forEach(s => wrap.appendChild(createCard(s)));

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', (e)=>{ if(e.target === e.currentTarget) closeModal(); });
  document.getElementById('search').addEventListener('input', (e)=>{
    const q = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.card');
    cards.forEach(c=>{
      const title = c.querySelector('.title').textContent.toLowerCase();
      c.style.display = title.includes(q) ? '' : 'none';
    });
  });

  // Upload modal handling
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadModal = document.getElementById('uploadModal');
  const uploadClose = document.getElementById('uploadClose');
  const uploadForm = document.getElementById('uploadForm');
  const uploadCancel = document.getElementById('uploadCancel');
  const uploadFileInput = document.getElementById('uploadFileInput');
  const uploadPreview = document.getElementById('uploadPreview');

  uploadBtn && uploadBtn.addEventListener('click', ()=> uploadModal.setAttribute('aria-hidden','false'));
  uploadClose && uploadClose.addEventListener('click', ()=> uploadModal.setAttribute('aria-hidden','true'));
  uploadCancel && uploadCancel.addEventListener('click', ()=> uploadModal.setAttribute('aria-hidden','true'));
  uploadModal && uploadModal.addEventListener('click', (e)=>{ if(e.target === e.currentTarget) uploadModal.setAttribute('aria-hidden','true'); });

  uploadFileInput && uploadFileInput.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      const dataUrl = reader.result;
      uploadPreview.style.backgroundImage = `url(${dataUrl})`;
      uploadPreview.style.backgroundSize = 'cover';
      uploadPreview.style.backgroundPosition = 'center';
      uploadPreview.dataset.objectUrl = dataUrl; // store data URL for use on submit
    };
    reader.readAsDataURL(f);
  });

  uploadForm && uploadForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fdata = uploadFileInput.files && uploadFileInput.files[0];
    if(!fdata && !uploadPreview.dataset.objectUrl) return alert('Pilih gambar terlebih dahulu');
    const title = document.getElementById('uploadTitle').value || (fdata ? fdata.name : 'Uploaded');
    const author = document.getElementById('uploadAuthor').value || 'Anda';
    const dataUrl = uploadPreview.dataset.objectUrl; // data URL
    const newItem = {id: Date.now(), title, author, src: dataUrl};
    // save to storage
    addUploadedItemToStorage(newItem);
    // add to UI
    const card = createCard(newItem);
    document.getElementById('masonry').insertBefore(card, document.getElementById('masonry').firstChild);
    uploadModal.setAttribute('aria-hidden','true');
    // cleanup
    delete uploadPreview.dataset.objectUrl;
    uploadForm.reset();
  });
}

window.addEventListener('DOMContentLoaded', init);
