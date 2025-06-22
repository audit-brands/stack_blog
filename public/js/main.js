// Stack Blog JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add copy button to code blocks
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(codeBlock => {
        const pre = codeBlock.parentElement;
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.textContent = 'Copy';
        button.setAttribute('aria-label', 'Copy code to clipboard');
        
        button.addEventListener('click', async function() {
            try {
                await navigator.clipboard.writeText(codeBlock.textContent);
                button.textContent = 'Copied!';
                setTimeout(() => {
                    button.textContent = 'Copy';
                }, 2000);
            } catch (err) {
                console.error('Failed to copy text: ', err);
                button.textContent = 'Failed';
                setTimeout(() => {
                    button.textContent = 'Copy';
                }, 2000);
            }
        });
        
        pre.style.position = 'relative';
        pre.appendChild(button);
    });

    // Mobile navigation toggle (if needed in the future)
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    const siteNav = document.querySelector('.site-nav');
    
    if (mobileToggle && siteNav) {
        mobileToggle.addEventListener('click', function() {
            siteNav.classList.toggle('nav-open');
            this.setAttribute('aria-expanded', 
                siteNav.classList.contains('nav-open') ? 'true' : 'false'
            );
        });
    }
});

// Add styles for copy button
const style = document.createElement('style');
style.textContent = `
    .copy-button {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: rgba(255, 255, 255, 0.8);
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.2s ease;
    }
    
    pre:hover .copy-button {
        opacity: 1;
    }
    
    .copy-button:hover {
        background: rgba(255, 255, 255, 0.95);
    }
`;
document.head.appendChild(style);