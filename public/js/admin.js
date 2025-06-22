// Stack Blog Admin JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Auto-logout warning for inactive sessions
    let inactivityTimer;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    const WARNING_TIMEOUT = 25 * 60 * 1000; // 25 minutes

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        
        inactivityTimer = setTimeout(function() {
            if (confirm('Your session will expire in 5 minutes due to inactivity. Click OK to stay logged in.')) {
                // User clicked OK, reset timer
                resetInactivityTimer();
            } else {
                // User clicked Cancel or closed dialog, logout
                window.location.href = '/admin/logout';
            }
        }, WARNING_TIMEOUT);
    }

    // Only run inactivity timer on admin pages with user session
    if (document.body.classList.contains('admin-body') && window.location.pathname.startsWith('/admin') && window.location.pathname !== '/admin/login') {
        resetInactivityTimer();
        
        // Reset timer on user activity
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(function(event) {
            document.addEventListener(event, resetInactivityTimer, true);
        });
    }

    // Form enhancements
    const forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
        // Prevent double submission
        form.addEventListener('submit', function(e) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn && !submitBtn.disabled) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Processing...';
                
                // Re-enable after a delay in case of errors
                setTimeout(function() {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitBtn.getAttribute('data-original-text') || 'Submit';
                }, 5000);
            }
        });
        
        // Store original button text
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.setAttribute('data-original-text', submitBtn.textContent);
        }
    });

    // Markdown textarea enhancements
    const markdownTextareas = document.querySelectorAll('textarea[data-markdown]');
    markdownTextareas.forEach(function(textarea) {
        // Add markdown shortcuts
        textarea.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'b':
                        e.preventDefault();
                        wrapSelection(textarea, '**', '**');
                        break;
                    case 'i':
                        e.preventDefault();
                        wrapSelection(textarea, '*', '*');
                        break;
                    case 'k':
                        e.preventDefault();
                        const url = prompt('Enter URL:');
                        if (url) {
                            wrapSelection(textarea, '[', `](${url})`);
                        }
                        break;
                }
            }
        });

        // Tab key inserts spaces instead of changing focus
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
        });
    });

    function wrapSelection(textarea, before, after) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        const replacement = before + selectedText + after;
        
        textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = end + before.length;
        textarea.focus();
    }

    // Auto-save functionality for content editing
    const autoSaveForms = document.querySelectorAll('form[data-autosave]');
    autoSaveForms.forEach(function(form) {
        let autoSaveTimer;
        const AUTOSAVE_DELAY = 30000; // 30 seconds

        function autoSave() {
            const formData = new FormData(form);
            formData.append('autosave', 'true');
            
            fetch(form.action, {
                method: 'POST',
                body: formData
            }).then(function(response) {
                if (response.ok) {
                    showAutoSaveIndicator('saved');
                } else {
                    showAutoSaveIndicator('error');
                }
            }).catch(function() {
                showAutoSaveIndicator('error');
            });
        }

        function scheduleAutoSave() {
            clearTimeout(autoSaveTimer);
            showAutoSaveIndicator('saving');
            autoSaveTimer = setTimeout(autoSave, AUTOSAVE_DELAY);
        }

        // Listen for changes
        form.addEventListener('input', scheduleAutoSave);
        form.addEventListener('change', scheduleAutoSave);
    });

    function showAutoSaveIndicator(status) {
        let indicator = document.getElementById('autosave-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'autosave-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(indicator);
        }

        switch(status) {
            case 'saving':
                indicator.textContent = 'Saving...';
                indicator.style.backgroundColor = '#ffc107';
                indicator.style.color = '#000';
                break;
            case 'saved':
                indicator.textContent = 'Saved';
                indicator.style.backgroundColor = '#28a745';
                indicator.style.color = '#fff';
                setTimeout(function() {
                    indicator.style.opacity = '0';
                }, 2000);
                break;
            case 'error':
                indicator.textContent = 'Save failed';
                indicator.style.backgroundColor = '#dc3545';
                indicator.style.color = '#fff';
                break;
        }
        
        indicator.style.opacity = '1';
    }

    // Confirmation dialogs for destructive actions
    const destructiveActions = document.querySelectorAll('[data-confirm]');
    destructiveActions.forEach(function(element) {
        element.addEventListener('click', function(e) {
            const message = element.getAttribute('data-confirm');
            if (!confirm(message)) {
                e.preventDefault();
            }
        });
    });

    // File upload preview
    const fileInputs = document.querySelectorAll('input[type="file"][accept*="image"]');
    fileInputs.forEach(function(input) {
        input.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    let preview = input.parentNode.querySelector('.file-preview');
                    if (!preview) {
                        preview = document.createElement('div');
                        preview.className = 'file-preview';
                        preview.style.cssText = 'margin-top: 10px;';
                        input.parentNode.appendChild(preview);
                    }
                    
                    preview.innerHTML = `
                        <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 200px; border-radius: 4px;">
                        <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>
                    `;
                };
                reader.readAsDataURL(file);
            }
        });
    });
});