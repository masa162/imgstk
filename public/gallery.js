/**
 * imgstk Gallery Page Script
 */

const API_BASE = '/api';

/**
 * Japanese error messages for error codes
 */
const ERROR_MESSAGES = {
  'INVALID_REQUEST': 'リクエストが無効です。入力内容を確認してください。',
  'TOO_MANY_FILES': 'アップロードできるのは最大500枚までです。',
  'FILE_TYPE_INVALID': '画像ファイルのみアップロード可能です。',
  'FILE_TOO_LARGE': 'ファイルサイズが大きすぎます。',
  'INVALID_FILENAME': 'ファイル名が無効です。',
  'BATCH_NOT_FOUND': 'バッチが見つかりませんでした。',
  'IMAGE_NOT_FOUND': '画像が見つかりませんでした。',
  'UPLOAD_FAILED': 'アップロードに失敗しました。もう一度お試しください。',
  'DELETE_FAILED': '削除に失敗しました。',
  'DATABASE_ERROR': 'データベースエラーが発生しました。',
  'STORAGE_ERROR': 'ストレージエラーが発生しました。',
  'INTERNAL_ERROR': 'サーバーエラーが発生しました。',
};

/**
 * Get Japanese error message from error code
 */
function getErrorMessage(errorData) {
  if (errorData.code && ERROR_MESSAGES[errorData.code]) {
    return ERROR_MESSAGES[errorData.code];
  }
  return errorData.error || 'エラーが発生しました。';
}

// Track expanded batches
const expandedBatches = new Set();

// DOM Elements
const loading = document.getElementById('loading');
const batchList = document.getElementById('batchList');
const emptyState = document.getElementById('emptyState');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const markdownModal = document.getElementById('markdownModal');
const markdownContent = document.getElementById('markdownContent');
const closeModal = document.getElementById('closeModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const copyMarkdown = document.getElementById('copyMarkdown');

// Filter elements
const searchInput = document.getElementById('searchInput');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');
const clearFiltersBtn = document.getElementById('clearFilters');
const resultCount = document.getElementById('resultCount');

// Debounce timer
let debounceTimer = null;

// Load batches on page load
window.addEventListener('DOMContentLoaded', () => {
  loadBatches();
  setupFilters();
});

async function loadBatches() {
  try {
    loading.classList.remove('hidden');
    batchList.classList.add('hidden');
    emptyState.classList.add('hidden');
    errorDiv.classList.add('hidden');

    // Build query string with filters
    const params = new URLSearchParams();
    if (searchInput.value) params.append('search', searchInput.value);
    if (dateFrom.value) params.append('from', dateFrom.value);
    if (dateTo.value) params.append('to', dateTo.value);

    const queryString = params.toString();
    const url = queryString ? `${API_BASE}/batches?${queryString}` : `${API_BASE}/batches`;

    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(getErrorMessage(errorData));
    }

    const data = await response.json();
    const batches = data.batches;

    loading.classList.add('hidden');

    // Update result count
    resultCount.textContent = data.count || batches.length;

    if (batches.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      renderBatches(batches);
      batchList.classList.remove('hidden');
    }

  } catch (error) {
    console.error('Load batches error:', error);
    loading.classList.add('hidden');
    errorDiv.classList.remove('hidden');
    errorMessage.textContent = error.message;
  }
}

function renderBatches(batches) {
  batchList.innerHTML = '';

  batches.forEach(batch => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-md p-6';

    const uploadDate = new Date(batch.uploaded_at).toLocaleString('ja-JP');
    const totalMB = (batch.total_bytes / 1024 / 1024).toFixed(2);

    card.innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-xl font-bold text-gray-800">${escapeHtml(batch.title)}</h3>
          <p class="text-sm text-gray-500 mt-1">${uploadDate}</p>
        </div>
        <button
          class="delete-btn text-red-600 hover:text-red-800"
          data-batch-id="${batch.id}"
          data-batch-title="${escapeHtml(batch.title)}"
        >
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
        <div>
          <span class="text-gray-500">画像数:</span>
          <span class="font-semibold ml-1">${batch.image_count}枚</span>
        </div>
        <div>
          <span class="text-gray-500">連番:</span>
          <span class="font-semibold ml-1">${batch.first_filename} 〜 ${batch.last_filename}</span>
        </div>
        <div>
          <span class="text-gray-500">容量:</span>
          <span class="font-semibold ml-1">${totalMB} MB</span>
        </div>
        <div>
          <span class="text-gray-500">URL例:</span>
          <a href="https://stk.be2nd.com/${batch.first_filename}.webp" target="_blank" class="text-blue-600 hover:underline text-xs">
            stk.be2nd.com/${batch.first_filename}.webp
          </a>
        </div>
      </div>

      <div class="flex space-x-2 mb-3">
        <button
          class="toggle-images-btn flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 text-sm flex items-center justify-center"
          data-batch-id="${batch.id}"
        >
          <svg class="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
          画像を表示 (${batch.image_count}枚)
        </button>
        <button
          class="markdown-btn flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm"
          data-batch-id="${batch.id}"
        >
          Markdown生成
        </button>
      </div>

      <!-- Image Grid Container (Hidden by default) -->
      <div id="images-${batch.id}" class="hidden mt-4">
        <!-- Images will be loaded here -->
      </div>
    `;

    batchList.appendChild(card);
  });

  // Attach event listeners
  document.querySelectorAll('.toggle-images-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleImageView(btn.dataset.batchId, btn));
  });

  document.querySelectorAll('.markdown-btn').forEach(btn => {
    btn.addEventListener('click', () => generateMarkdown(btn.dataset.batchId));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteBatch(btn.dataset.batchId, btn.dataset.batchTitle));
  });
}

async function generateMarkdown(batchId) {
  try {
    const response = await fetch(`${API_BASE}/batches/${batchId}/markdown`, {
      credentials: 'include',
      method: 'POST',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(getErrorMessage(errorData));
    }

    const data = await response.json();
    markdownContent.value = data.markdown;
    markdownModal.classList.remove('hidden');

  } catch (error) {
    console.error('Generate markdown error:', error);
    alert(error.message);
  }
}

async function deleteBatch(batchId, batchTitle) {
  const confirmed = confirm(`バッチ「${batchTitle}」を削除しますか？\n\nこの操作は取り消せません。R2から画像も完全に削除されます。`);

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/batches/${batchId}`, {
      credentials: 'include',
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(getErrorMessage(errorData));
    }

    const data = await response.json();
    alert(`${data.deleted}枚の画像を削除しました。`);

    // Reload batches
    loadBatches();

  } catch (error) {
    console.error('Delete batch error:', error);
    alert(error.message);
  }
}

// Toggle image view
async function toggleImageView(batchId, buttonElement) {
  const container = document.getElementById(`images-${batchId}`);
  const isExpanded = expandedBatches.has(batchId);

  if (isExpanded) {
    // Collapse
    container.classList.add('hidden');
    expandedBatches.delete(batchId);
    buttonElement.innerHTML = `
      <svg class="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
      </svg>
      画像を表示 (${container.dataset.imageCount || ''}枚)
    `;
  } else {
    // Expand
    buttonElement.disabled = true;
    const originalHTML = buttonElement.innerHTML;
    buttonElement.textContent = '読み込み中...';

    try {
      await loadBatchImages(batchId);
      container.classList.remove('hidden');
      expandedBatches.add(batchId);
      buttonElement.innerHTML = `
        <svg class="inline h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
        </svg>
        画像を非表示
      `;
    } catch (error) {
      alert('画像の読み込みに失敗しました: ' + error.message);
      buttonElement.innerHTML = originalHTML;
    } finally {
      buttonElement.disabled = false;
    }
  }
}

// Load batch images from API
async function loadBatchImages(batchId) {
  const response = await fetch(`${API_BASE}/batches/${batchId}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(getErrorMessage(errorData));
  }

  const data = await response.json();
  renderImageGrid(data.images, batchId);
}

// Render image grid
function renderImageGrid(images, batchId) {
  const container = document.getElementById(`images-${batchId}`);
  container.dataset.imageCount = images.length;

  container.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded">
      ${images.map(img => `
        <div class="image-card bg-white rounded shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-1" data-filename="${img.filename}" data-batch-id="${batchId}">
          <div class="relative aspect-square">
            <!-- Selection Checkbox -->
            <div class="absolute top-2 left-2 z-10">
              <input
                type="checkbox"
                class="image-checkbox w-5 h-5 cursor-pointer rounded border-2 border-white shadow-lg"
                data-filename="${img.filename}"
                data-batch-id="${batchId}"
                data-url="${img.url}"
              />
            </div>
            <img
              src="${img.url}"
              alt="${img.filename}"
              class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
              loading="lazy"
              onclick="window.open('${img.url}', '_blank')"
              title="クリックして新しいタブで開く"
              onerror="this.onerror=null; this.classList.add('opacity-50'); this.parentElement.innerHTML='<div class=&quot;w-full h-full flex items-center justify-center bg-gray-200&quot;><span class=&quot;text-gray-500 text-xs&quot;>読み込みエラー</span></div>';"
            />
          </div>
          <div class="p-2 space-y-1">
            <div class="text-xs font-mono text-gray-700 truncate" title="${img.filename}">
              ${img.filename}
            </div>
            <div class="flex gap-1">
              <button
                class="copy-url-btn flex-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 py-1 px-2 rounded transition-colors"
                data-url="${img.url}"
                title="URLをコピー"
              >
                📎 Copy
              </button>
              <button
                class="delete-image-btn text-xs bg-red-50 text-red-600 hover:bg-red-100 py-1 px-2 rounded transition-colors"
                data-filename="${img.filename}"
                data-batch-id="${batchId}"
                title="画像を削除"
              >
                🗑️
              </button>
            </div>
            <div class="text-xs text-gray-500">
              ${(img.bytes / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // Attach event listeners to new buttons
  container.querySelectorAll('.copy-url-btn').forEach(btn => {
    btn.addEventListener('click', () => copyImageURL(btn.dataset.url, btn));
  });

  container.querySelectorAll('.delete-image-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteImage(btn.dataset.filename, btn.dataset.batchId));
  });

  // Attach event listeners to checkboxes
  container.querySelectorAll('.image-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => handleImageSelection(e.target));
  });
}

// Copy image URL to clipboard
async function copyImageURL(url, buttonElement) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }

    const originalText = buttonElement.textContent;
    buttonElement.textContent = '✓ Copied!';
    buttonElement.classList.add('bg-green-100', 'text-green-700');
    buttonElement.classList.remove('bg-blue-50', 'text-blue-600');

    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.classList.remove('bg-green-100', 'text-green-700');
      buttonElement.classList.add('bg-blue-50', 'text-blue-600');
    }, 2000);
  } catch (error) {
    console.error('Copy error:', error);
    alert('クリップボードへのコピーに失敗しました');
  }
}

// Delete single image
async function deleteImage(filename, batchId) {
  const confirmed = confirm(
    `画像「${filename}」を削除しますか？\n\nこの操作は取り消せません。R2から完全に削除されます。`
  );

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/images/${filename}`, {
      credentials: 'include',
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(getErrorMessage(errorData));
    }

    // Remove from UI with animation
    const card = document.querySelector(`[data-filename="${filename}"]`);
    card.style.opacity = '0';
    card.style.transform = 'scale(0.8)';
    card.style.transition = 'all 0.3s ease';

    setTimeout(() => {
      card.remove();

      // Check if grid is now empty
      const container = document.getElementById(`images-${batchId}`);
      const remainingImages = container.querySelectorAll('.image-card');
      if (remainingImages.length === 0) {
        container.innerHTML = '<div class="p-8 text-center"><p class="text-gray-500">このバッチの画像は全て削除されました</p></div>';
      }
    }, 300);

  } catch (error) {
    console.error('Delete image error:', error);
    alert(error.message);
  }
}

// Modal handlers
closeModal.addEventListener('click', () => {
  markdownModal.classList.add('hidden');
});

closeModalBtn.addEventListener('click', () => {
  markdownModal.classList.add('hidden');
});

copyMarkdown.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(markdownContent.value);
    const originalText = copyMarkdown.textContent;
    copyMarkdown.textContent = 'コピーしました！';
    setTimeout(() => {
      copyMarkdown.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error('Copy error:', error);
    alert('クリップボードへのコピーに失敗しました');
  }
});

// Close modal on outside click
markdownModal.addEventListener('click', (e) => {
  if (e.target === markdownModal) {
    markdownModal.classList.add('hidden');
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup filter event listeners
 */
function setupFilters() {
  // Debounced search input (300ms delay)
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadBatches();
    }, 300);
  });

  // Date filters (immediate)
  dateFrom.addEventListener('change', () => {
    loadBatches();
  });

  dateTo.addEventListener('change', () => {
    loadBatches();
  });

  // Clear filters button
  clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    dateFrom.value = '';
    dateTo.value = '';
    loadBatches();
  });
}

/**
 * Bulk Selection Management
 */

// Selection state: Map<batchId, Map<filename, imageData>>
const selectedImages = new Map();

// Toolbar elements
const selectionToolbar = document.getElementById('selectionToolbar');
const selectedCountEl = document.getElementById('selectedCount');
const downloadSelectedBtn = document.getElementById('downloadSelected');
const deleteSelectedBtn = document.getElementById('deleteSelected');
const clearSelectionBtn = document.getElementById('clearSelection');
const zipProgress = document.getElementById('zipProgress');
const zipProgressBar = document.getElementById('zipProgressBar');
const zipProgressText = document.getElementById('zipProgressText');
const zipProgressPercent = document.getElementById('zipProgressPercent');

/**
 * Handle image checkbox selection
 */
function handleImageSelection(checkbox) {
  const { filename, batchId, url } = checkbox.dataset;

  if (!selectedImages.has(batchId)) {
    selectedImages.set(batchId, new Map());
  }

  const batchImages = selectedImages.get(batchId);

  if (checkbox.checked) {
    batchImages.set(filename, { filename, url, batchId });
  } else {
    batchImages.delete(filename);
    if (batchImages.size === 0) {
      selectedImages.delete(batchId);
    }
  }

  updateSelectionUI();
}

/**
 * Update selection toolbar UI
 */
function updateSelectionUI() {
  let totalCount = 0;
  selectedImages.forEach(batch => {
    totalCount += batch.size;
  });

  selectedCountEl.textContent = totalCount;

  if (totalCount > 0) {
    selectionToolbar.classList.remove('hidden');
  } else {
    selectionToolbar.classList.add('hidden');
  }
}

/**
 * Clear all selections
 */
clearSelectionBtn.addEventListener('click', () => {
  selectedImages.clear();
  document.querySelectorAll('.image-checkbox').forEach(cb => cb.checked = false);
  updateSelectionUI();
});

/**
 * Bulk delete selected images
 */
deleteSelectedBtn.addEventListener('click', async () => {
  let totalCount = 0;
  selectedImages.forEach(batch => {
    totalCount += batch.size;
  });

  const confirmed = confirm(`選択した${totalCount}枚の画像を削除しますか？\n\nこの操作は取り消せません。R2から画像も完全に削除されます。`);

  if (!confirmed) return;

  try {
    deleteSelectedBtn.disabled = true;
    deleteSelectedBtn.textContent = '削除中...';

    const deletePromises = [];
    const imagesToDelete = [];

    selectedImages.forEach((batchImages, batchId) => {
      batchImages.forEach((imageData, filename) => {
        imagesToDelete.push({ filename, batchId });
        deletePromises.push(
          fetch(`${API_BASE}/images/${filename}`, {
            credentials: 'include',
            method: 'DELETE',
          })
        );
      });
    });

    // Execute all deletes in parallel
    const results = await Promise.allSettled(deletePromises);

    // Count successes and failures
    let successCount = 0;
    let failCount = 0;

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.ok) {
        successCount++;
        // Remove from UI
        const { filename } = imagesToDelete[index];
        const card = document.querySelector(`[data-filename="${filename}"]`);
        if (card) card.remove();
      } else {
        failCount++;
      }
    });

    // Clear selections
    selectedImages.clear();
    updateSelectionUI();

    // Show result
    if (failCount > 0) {
      alert(`${successCount}枚削除しました。\n${failCount}枚の削除に失敗しました。`);
    } else {
      alert(`${successCount}枚の画像を削除しました。`);
    }

    // Check for empty batches
    imagesToDelete.forEach(({ batchId }) => {
      const container = document.getElementById(`images-${batchId}`);
      if (container) {
        const remainingImages = container.querySelectorAll('.image-card');
        if (remainingImages.length === 0) {
          container.innerHTML = '<div class="p-8 text-center"><p class="text-gray-500">このバッチの画像は全て削除されました</p></div>';
        }
      }
    });

  } catch (error) {
    console.error('Bulk delete error:', error);
    alert('一括削除に失敗しました: ' + error.message);
  } finally {
    deleteSelectedBtn.disabled = false;
    deleteSelectedBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
      </svg>
      一括削除
    `;
  }
});

/**
 * Bulk ZIP download selected images
 */
downloadSelectedBtn.addEventListener('click', async () => {
  let totalCount = 0;
  selectedImages.forEach(batch => {
    totalCount += batch.size;
  });

  if (totalCount === 0) {
    alert('画像が選択されていません。');
    return;
  }

  try {
    downloadSelectedBtn.disabled = true;
    downloadSelectedBtn.textContent = 'ダウンロード中...';
    zipProgress.classList.remove('hidden');

    // Create ZIP file
    const zip = new JSZip();
    const imagePromises = [];
    const imageList = [];

    selectedImages.forEach((batchImages) => {
      batchImages.forEach((imageData) => {
        imageList.push(imageData);
      });
    });

    zipProgressText.textContent = `画像をダウンロード中... (0/${totalCount})`;
    zipProgressBar.style.width = '0%';
    zipProgressPercent.textContent = '0%';

    // Download all images
    let completed = 0;
    for (const imageData of imageList) {
      try {
        const response = await fetch(imageData.url);
        const blob = await response.blob();
        zip.file(imageData.filename, blob);

        completed++;
        const percent = Math.round((completed / totalCount) * 100);
        zipProgressBar.style.width = `${percent}%`;
        zipProgressPercent.textContent = `${percent}%`;
        zipProgressText.textContent = `画像をダウンロード中... (${completed}/${totalCount})`;
      } catch (error) {
        console.error(`Failed to download ${imageData.filename}:`, error);
      }
    }

    // Generate ZIP
    zipProgressText.textContent = 'ZIPファイルを生成中...';
    const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
      const percent = Math.round(metadata.percent);
      zipProgressBar.style.width = `${percent}%`;
      zipProgressPercent.textContent = `${percent}%`;
    });

    // Download ZIP
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `imgstk-${timestamp}.zip`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipBlob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);

    zipProgressText.textContent = 'ダウンロード完了！';
    setTimeout(() => {
      zipProgress.classList.add('hidden');
    }, 2000);

  } catch (error) {
    console.error('ZIP download error:', error);
    alert('ZIPダウンロードに失敗しました: ' + error.message);
    zipProgress.classList.add('hidden');
  } finally {
    downloadSelectedBtn.disabled = false;
    downloadSelectedBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
      </svg>
      ZIPダウンロード
    `;
  }
});
