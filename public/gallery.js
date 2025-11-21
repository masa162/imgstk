/**
 * imgstk Gallery Page Script
 */

const API_BASE = '/api';

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

// Load batches on page load
window.addEventListener('DOMContentLoaded', loadBatches);

async function loadBatches() {
  try {
    loading.classList.remove('hidden');
    batchList.classList.add('hidden');
    emptyState.classList.add('hidden');
    errorDiv.classList.add('hidden');

    const response = await fetch(`${API_BASE}/batches`);

    if (!response.ok) {
      throw new Error('バッチの読み込みに失敗しました');
    }

    const data = await response.json();
    const batches = data.batches;

    loading.classList.add('hidden');

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

      <div class="flex space-x-2">
        <button
          class="markdown-btn flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm"
          data-batch-id="${batch.id}"
        >
          Markdown生成
        </button>
      </div>
    `;

    batchList.appendChild(card);
  });

  // Attach event listeners
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
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Markdown生成に失敗しました');
    }

    const data = await response.json();
    markdownContent.value = data.markdown;
    markdownModal.classList.remove('hidden');

  } catch (error) {
    console.error('Generate markdown error:', error);
    alert('Markdown生成に失敗しました: ' + error.message);
  }
}

async function deleteBatch(batchId, batchTitle) {
  const confirmed = confirm(`バッチ「${batchTitle}」を削除しますか？\n\nこの操作は取り消せません。R2から画像も完全に削除されます。`);

  if (!confirmed) return;

  try {
    const response = await fetch(`${API_BASE}/batches/${batchId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('削除に失敗しました');
    }

    const data = await response.json();
    alert(`${data.deleted}枚の画像を削除しました。`);

    // Reload batches
    loadBatches();

  } catch (error) {
    console.error('Delete batch error:', error);
    alert('削除に失敗しました: ' + error.message);
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
