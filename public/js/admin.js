// Admin Panel JavaScript

document.addEventListener('DOMContentLoaded', function() {
  initializeAdmin();
});

function initializeAdmin() {
  // Initialize components
  initializeMobileMenu();
  initializeNotifications();
  initializeModals();
  initializeFileUpload();
  initializeMarkdownEditor();
  initializeSearchSuggestions();
  initializeAutoSave();
  initializeDeleteConfirmations();
  initializeCopyButtons();
}

// Mobile menu toggle
function initializeMobileMenu() {
  const burger = document.querySelector('.navbar-burger');
  const menu = document.querySelector('.navbar-menu');
  
  if (burger && menu) {
    burger.addEventListener('click', function() {
      burger.classList.toggle('is-active');
      menu.classList.toggle('is-active');
    });
  }
}

// Auto-dismiss notifications
function initializeNotifications() {
  const notifications = document.querySelectorAll('.notification');
  
  notifications.forEach(notification => {
    const deleteBtn = notification.querySelector('.delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', function() {
        notification.remove();
      });
    }
    
    // Auto-dismiss after 5 seconds
    if (!notification.classList.contains('is-persistent')) {
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    }
  });
}

// Modal handling
function initializeModals() {
  const modalButtons = document.querySelectorAll('[data-modal-target]');
  const modalCloses = document.querySelectorAll('.modal-close, .modal-card-head .delete');
  const modalBackgrounds = document.querySelectorAll('.modal-background');
  
  modalButtons.forEach(button => {
    button.addEventListener('click', function() {
      const target = button.getAttribute('data-modal-target');
      const modal = document.getElementById(target);
      if (modal) {
        modal.classList.add('is-active');
      }
    });
  });
  
  const closeModal = function(modal) {
    modal.classList.remove('is-active');
  };
  
  modalCloses.forEach(close => {
    close.addEventListener('click', function() {
      const modal = close.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  
  modalBackgrounds.forEach(background => {
    background.addEventListener('click', function() {
      const modal = background.closest('.modal');
      if (modal) closeModal(modal);
    });
  });
  
  // Close modals with escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal.is-active');
      if (activeModal) closeModal(activeModal);
    }
  });
}

// File upload with drag and drop
function initializeFileUpload() {
  const uploadAreas = document.querySelectorAll('.upload-area');
  
  uploadAreas.forEach(area => {
    const fileInput = area.querySelector('input[type="file"]');
    if (!fileInput) return;
    
    // Click to upload
    area.addEventListener('click', function() {
      fileInput.click();
    });
    
    // Drag and drop
    area.addEventListener('dragover', function(e) {
      e.preventDefault();
      area.classList.add('is-dragover');
    });
    
    area.addEventListener('dragleave', function(e) {
      e.preventDefault();
      if (!area.contains(e.relatedTarget)) {
        area.classList.remove('is-dragover');
      }
    });
    
    area.addEventListener('drop', function(e) {
      e.preventDefault();
      area.classList.remove('is-dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        handleFileUpload(fileInput);
      }
    });
    
    // File input change
    fileInput.addEventListener('change', function() {
      if (fileInput.files.length > 0) {
        handleFileUpload(fileInput);
      }
    });
  });
}

// Handle file upload
function handleFileUpload(fileInput) {
  const form = fileInput.closest('form');
  if (!form) return;
  
  const formData = new FormData(form);
  const uploadArea = fileInput.closest('.upload-area');
  const submitButton = form.querySelector('button[type="submit"]');
  
  // Show loading state
  if (submitButton) {
    submitButton.classList.add('is-loading');
    submitButton.disabled = true;
  }
  
  if (uploadArea) {
    uploadArea.innerHTML = '<div class="has-text-centered"><span class="icon is-large spin"><i class="fas fa-spinner"></i></span><p>Uploading...</p></div>';
  }
  
  fetch(form.action, {
    method: 'POST',
    body: formData,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showNotification('Files uploaded successfully!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      throw new Error(data.message || 'Upload failed');
    }
  })
  .catch(error => {
    console.error('Upload error:', error);
    showNotification(error.message || 'Upload failed', 'danger');
    
    // Reset upload area
    if (uploadArea) {
      uploadArea.innerHTML = '<div class="has-text-centered"><span class="icon is-large"><i class="fas fa-upload"></i></span><p><strong>Click to upload</strong> or drag files here</p></div>';
    }
  })
  .finally(() => {
    if (submitButton) {
      submitButton.classList.remove('is-loading');
      submitButton.disabled = false;
    }
  });
}

// Enhanced markdown editor
function initializeMarkdownEditor() {
  const editors = document.querySelectorAll('.editor-content');
  
  editors.forEach(editor => {
    // Add line numbers (optional)
    addLineNumbers(editor);
    
    // Handle tab key for indentation
    editor.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const value = editor.value;
        
        editor.value = value.substring(0, start) + '  ' + value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
      }
    });
    
    // Auto-resize
    editor.addEventListener('input', function() {
      autoResize(editor);
    });
    
    // Initial resize
    autoResize(editor);
  });
}

function addLineNumbers(editor) {
  // This is a simplified version - in production you might want a more robust solution
  const container = editor.parentElement;
  if (container.querySelector('.line-numbers')) return;
  
  const lineNumbers = document.createElement('div');
  lineNumbers.className = 'line-numbers';
  lineNumbers.style.cssText = `
    position: absolute;
    left: 0;
    top: 0;
    width: 40px;
    height: 100%;
    background: #f5f5f5;
    border-right: 1px solid #dbdbdb;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.5;
    padding: 1rem 0.5rem;
    color: #999;
    user-select: none;
    pointer-events: none;
  `;
  
  container.style.position = 'relative';
  editor.style.paddingLeft = '50px';
  container.insertBefore(lineNumbers, editor);
  
  function updateLineNumbers() {
    const lines = editor.value.split('\n').length;
    lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('\n');
  }
  
  editor.addEventListener('input', updateLineNumbers);
  updateLineNumbers();
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.max(textarea.scrollHeight, 350) + 'px';
}

// Search suggestions
function initializeSearchSuggestions() {
  const searchInputs = document.querySelectorAll('.search-input');
  
  searchInputs.forEach(input => {
    let timeout;
    let suggestionsContainer;
    
    input.addEventListener('input', function() {
      const query = input.value.trim();
      
      clearTimeout(timeout);
      
      if (query.length < 2) {
        hideSuggestions();
        return;
      }
      
      timeout = setTimeout(() => {
        fetchSuggestions(query, input);
      }, 300);
    });
    
    input.addEventListener('blur', function() {
      setTimeout(hideSuggestions, 200);
    });
    
    function fetchSuggestions(query, input) {
      fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}&limit=5`)
        .then(response => response.json())
        .then(data => {
          showSuggestions(data.data || [], input);
        })
        .catch(error => {
          console.error('Suggestions error:', error);
        });
    }
    
    function showSuggestions(suggestions, input) {
      hideSuggestions();
      
      if (suggestions.length === 0) return;
      
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.className = 'suggestions-dropdown';
      suggestionsContainer.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #dbdbdb;
        border-top: none;
        border-radius: 0 0 4px 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 1000;
        max-height: 200px;
        overflow-y: auto;
      `;
      
      suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.style.cssText = `
          padding: 0.5rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid #f5f5f5;
        `;
        item.textContent = suggestion;
        
        item.addEventListener('mouseenter', function() {
          item.style.backgroundColor = '#f5f5f5';
        });
        
        item.addEventListener('mouseleave', function() {
          item.style.backgroundColor = 'white';
        });
        
        item.addEventListener('click', function() {
          input.value = suggestion;
          hideSuggestions();
          input.form.submit();
        });
        
        suggestionsContainer.appendChild(item);
      });
      
      const inputContainer = input.parentElement;
      inputContainer.style.position = 'relative';
      inputContainer.appendChild(suggestionsContainer);
    }
    
    function hideSuggestions() {
      if (suggestionsContainer) {
        suggestionsContainer.remove();
        suggestionsContainer = null;
      }
    }
  });
}

// Auto-save functionality
function initializeAutoSave() {
  const forms = document.querySelectorAll('[data-autosave]');
  
  forms.forEach(form => {
    let timeout;
    let lastSaved = '';
    
    const inputs = form.querySelectorAll('input, textarea, select');
    const statusIndicator = createAutoSaveIndicator();
    form.appendChild(statusIndicator);
    
    inputs.forEach(input => {
      input.addEventListener('input', function() {
        clearTimeout(timeout);
        
        timeout = setTimeout(() => {
          const currentData = new FormData(form).toString();
          if (currentData !== lastSaved) {
            performAutoSave(form, statusIndicator);
            lastSaved = currentData;
          }
        }, 2000);
      });
    });
  });
}

function createAutoSaveIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'autosave-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 0.5rem 1rem;
    background: #363636;
    color: white;
    border-radius: 4px;
    font-size: 0.875rem;
    z-index: 1000;
    display: none;
  `;
  return indicator;
}

function performAutoSave(form, indicator) {
  const formData = new FormData(form);
  formData.append('autosave', 'true');
  
  indicator.textContent = 'Saving...';
  indicator.style.display = 'block';
  
  fetch(form.action, {
    method: 'POST',
    body: formData,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      indicator.textContent = 'Saved';
      indicator.style.background = '#48c774';
    } else {
      throw new Error(data.message || 'Auto-save failed');
    }
  })
  .catch(error => {
    console.error('Auto-save error:', error);
    indicator.textContent = 'Save failed';
    indicator.style.background = '#f14668';
  })
  .finally(() => {
    setTimeout(() => {
      indicator.style.display = 'none';
      indicator.style.background = '#363636';
    }, 2000);
  });
}

// Delete confirmations
function initializeDeleteConfirmations() {
  const deleteButtons = document.querySelectorAll('[data-confirm-delete]');
  
  deleteButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      
      const message = button.getAttribute('data-confirm-delete') || 'Are you sure you want to delete this item?';
      
      if (confirm(message)) {
        if (button.tagName === 'A') {
          window.location.href = button.href;
        } else if (button.form) {
          button.form.submit();
        }
      }
    });
  });
}

// Copy to clipboard buttons
function initializeCopyButtons() {
  const copyButtons = document.querySelectorAll('[data-copy]');
  
  copyButtons.forEach(button => {
    button.addEventListener('click', function() {
      const text = button.getAttribute('data-copy');
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          showNotification('Copied to clipboard!', 'success');
        });
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification('Copied to clipboard!', 'success');
      }
    });
  });
}

// Utility functions
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification is-${type} fade-in`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2000;
    max-width: 400px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  `;
  
  notification.innerHTML = `
    <button class="delete"></button>
    ${message}
  `;
  
  document.body.appendChild(notification);
  
  // Auto-dismiss
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
  
  // Manual dismiss
  notification.querySelector('.delete').addEventListener('click', () => {
    notification.remove();
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const saveButton = document.querySelector('button[type="submit"]');
    if (saveButton) {
      saveButton.click();
    }
  }
  
  // Ctrl/Cmd + Enter to submit form
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const form = document.querySelector('form');
    if (form) {
      form.submit();
    }
  }
});

// Theme toggle (if implemented)
function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('admin-theme', newTheme);
}

// Initialize theme from localStorage
const savedTheme = localStorage.getItem('admin-theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
}