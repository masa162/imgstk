/**
 * imgstk Upload Page Script
 */

const API_BASE = '/api';
let selectedFiles = [];

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileListContent = document.getElementById('fileListContent');
const batchTitleInput = document.getElementById('batchTitle');
const uploadBtn = document.getElementById('uploadBtn');
const progressDiv = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const progressCount = document.getElementById('progressCount');
const successDiv = document.getElementById('success');
const successCount = document.getElementById('successCount');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');

// File selection handlers
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('border-blue-500', 'bg-blue-50');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('border-blue-500', 'bg-blue-50');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('border-blue-500', 'bg-blue-50');

  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  handleFiles(files);
});

function handleFiles(files) {
  if (files.length === 0) {
    alert('画像ファイルを選択してください。');
    return;
  }

  if (files.length > 500) {
    alert('一度にアップロードできるのは最大500枚です。');
    return;
  }

  selectedFiles = files;
  renderFileList();
  updateUploadButton();
}

function renderFileList() {
  fileListContent.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const div = document.createElement('div');
    div.className = 'flex justify-between items-center py-1';
    div.innerHTML = `
      <span class="text-gray-700 truncate">${index + 1}. ${file.name}</span>
      <span class="text-gray-500 text-xs">${formatBytes(file.size)}</span>
    `;
    fileListContent.appendChild(div);
  });

  fileList.classList.remove('hidden');
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function updateUploadButton() {
  const hasTitle = batchTitleInput.value.trim().length > 0;
  const hasFiles = selectedFiles.length > 0;
  uploadBtn.disabled = !(hasTitle && hasFiles);
}

batchTitleInput.addEventListener('input', updateUploadButton);

// Upload handler
uploadBtn.addEventListener('click', async () => {
  const title = batchTitleInput.value.trim();

  if (!title || selectedFiles.length === 0) {
    return;
  }

  // Hide previous messages
  successDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');

  // Show progress
  progressDiv.classList.remove('hidden');
  uploadBtn.disabled = true;

  try {
    // Convert files to base64
    const filesData = await Promise.all(
      selectedFiles.map(async (file) => {
        const base64 = await fileToBase64(file);
        return {
          name: file.name,
          data: base64,
          size: file.size,
          type: file.type,
        };
      })
    );

    progressText.textContent = 'アップロード中...';
    progressCount.textContent = `0 / ${filesData.length}`;
    progressBar.style.width = '0%';

    // Upload to API
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        batchTitle: title,
        files: filesData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'アップロードに失敗しました');
    }

    const result = await response.json();

    // Update progress to complete
    progressBar.style.width = '100%';
    progressCount.textContent = `${result.images.length} / ${result.images.length}`;

    // Show success message
    setTimeout(() => {
      progressDiv.classList.add('hidden');
      successDiv.classList.remove('hidden');
      successCount.textContent = result.images.length;

      // Reset form
      batchTitleInput.value = '';
      fileInput.value = '';
      selectedFiles = [];
      fileList.classList.add('hidden');
      uploadBtn.disabled = true;
    }, 500);

  } catch (error) {
    console.error('Upload error:', error);
    progressDiv.classList.add('hidden');
    errorDiv.classList.remove('hidden');
    errorMessage.textContent = error.message;
    uploadBtn.disabled = false;
  }
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
