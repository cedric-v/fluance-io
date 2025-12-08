---
layout: base.njk
title: Login - Protected content
description: Log in to access your protected Fluance content
locale: en
permalink: /en/firebase-login/
---

<div class="min-h-screen bg-[#fdfaf6] py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 section-card">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-[#0f172a] mb-2">Login</h1>
      <p class="text-[#1f1f1f]/80">Access your protected Fluance content</p>
    </div>

    <!-- Tabs to choose login method -->
    <div class="mb-6 border-b border-[#82153e]/20">
      <nav class="flex -mb-px">
        <button
          id="tab-password"
          class="flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-[#82153e] text-[#82153e]"
          onclick="switchTab('password')"
        >
          Password
        </button>
        <button
          id="tab-passwordless"
          class="flex-1 py-3 px-4 text-center font-medium text-sm border-b-2 border-transparent text-[#1f1f1f]/60 hover:text-[#82153e] hover:border-[#82153e]/30"
          onclick="switchTab('passwordless')"
        >
          Email login
        </button>
      </nav>
    </div>

    <!-- Password form -->
    <form id="login-form" class="space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-[#0f172a] mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          class="w-full px-4 py-2 border border-[#82153e]/20 rounded-lg focus:ring-2 focus:ring-[#82153e] focus:border-[#82153e] text-[#0f172a]"
          placeholder="your@email.com"
        />
      </div>

      <div id="password-field">
        <div class="flex items-center justify-between mb-2">
          <label for="password" class="block text-sm font-medium text-[#0f172a]">
            Password
          </label>
          <a href="/en/reset-password" class="text-sm text-[#82153e] hover:text-[#82153e]/80">
            Forgot password?
          </a>
        </div>
        <input
          type="password"
          id="password"
          name="password"
          class="w-full px-4 py-2 border border-[#82153e]/20 rounded-lg focus:ring-2 focus:ring-[#82153e] focus:border-[#82153e] text-[#0f172a]"
          placeholder="Your password"
        />
      </div>

      <div id="success-message" class="hidden bg-[#ffce2d]/10 border border-[#ffce2d]/30 rounded-lg p-4">
        <p class="text-[#0f172a] text-sm"></p>
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-[#82153e] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#82153e]/90 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Login</span>
        <span id="button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <div class="mt-6 text-center space-y-2">
      <p class="text-sm text-[#1f1f1f]/80">
        Don't have an account yet? 
        <a href="/en/create-account" class="text-[#82153e] hover:text-[#82153e]/80 font-medium">Create an account</a>
      </p>
      <p class="text-sm text-[#1f1f1f]/60">
        <a href="/en/connexion" class="hover:text-[#82153e]">Back to main login page</a>
      </p>
    </div>

    <!-- Help section (collapsible) -->
    <div class="mt-8 border-t border-[#82153e]/20 pt-6">
      <button
        id="help-toggle"
        class="w-full flex items-center justify-between text-left text-sm font-medium text-[#82153e] hover:text-[#82153e]/80 transition-colors"
        onclick="toggleHelp()"
      >
        <span>❓ Need help?</span>
        <svg id="help-arrow" class="w-5 h-5 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div id="help-content" class="hidden mt-4 space-y-4 text-sm text-[#1f1f1f]/80">
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">I can't find my email/code</p>
          <p>→ Check your spam folder.</p>
        </div>
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">The code doesn't work</p>
          <p>→ Make sure to copy-paste the complete code, without spaces</p>
        </div>
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">What is "Email login"?</p>
          <p>It's a passwordless login method. We send you an email containing a unique, one-time-use link to identify yourself. It's simple and very secure.</p>
        </div>
        <div>
          <p class="font-semibold text-[#0f172a] mb-1">Still need help?</p>
          <p><a href="/en/contact" class="text-[#82153e] hover:underline">Contact us.</a></p>
        </div>
      </div>
    </div>
  </div>
</div>

<script src="/assets/js/firebase-auth.js"></script>
<script>
let currentTab = 'password';
let errorDiv, successDiv; // Global variables for error/success divs

// Global functions to handle error/success messages
function showError(message) {
  if (errorDiv && successDiv) {
    errorDiv.querySelector('p').textContent = message;
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
  }
}

function hideError() {
  if (errorDiv) {
    errorDiv.classList.add('hidden');
  }
}

function showSuccess(message) {
  if (successDiv && errorDiv) {
    successDiv.querySelector('p').textContent = message;
    successDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  }
}

function hideSuccess() {
  if (successDiv) {
    successDiv.classList.add('hidden');
  }
}

// Function to switch tabs
function switchTab(tab) {
  currentTab = tab;
  const passwordTab = document.getElementById('tab-password');
  const passwordlessTab = document.getElementById('tab-passwordless');
  const passwordField = document.getElementById('password-field');
  const passwordInput = document.getElementById('password');
  const buttonText = document.getElementById('button-text');

  if (tab === 'password') {
    passwordTab.classList.add('border-[#82153e]', 'text-[#82153e]');
    passwordTab.classList.remove('border-transparent', 'text-[#1f1f1f]/60');
    passwordlessTab.classList.remove('border-[#82153e]', 'text-[#82153e]');
    passwordlessTab.classList.add('border-transparent', 'text-[#1f1f1f]/60');
    passwordField.style.display = 'block';
    passwordInput.required = true;
    buttonText.textContent = 'Login';
  } else {
    passwordlessTab.classList.add('border-[#82153e]', 'text-[#82153e]');
    passwordlessTab.classList.remove('border-transparent', 'text-[#1f1f1f]/60');
    passwordTab.classList.remove('border-[#82153e]', 'text-[#82153e]');
    passwordTab.classList.add('border-transparent', 'text-[#1f1f1f]/60');
    passwordField.style.display = 'none';
    passwordInput.required = false;
    passwordInput.value = '';
    buttonText.textContent = 'Send login link';
  }
  
  hideError();
  hideSuccess();
}

document.addEventListener('DOMContentLoaded', async function() {
  // Check if a passwordless link is present in the URL
  try {
    await new Promise((resolve) => {
      if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      }
    });

    const linkResult = await window.FluanceAuth.handleSignInLink();
    if (linkResult.success) {
      // Login successful with link
      const returnUrl = new URLSearchParams(window.location.search).get('return') || '/en/';
      window.location.href = returnUrl;
      return;
    }
  } catch (error) {
    console.error('Error handling sign in link:', error);
  }

  const form = document.getElementById('login-form');
  errorDiv = document.getElementById('error-message'); // Assign to global variable
  successDiv = document.getElementById('success-message'); // Assign to global variable
  const submitButton = document.getElementById('submit-button');
  const buttonText = document.getElementById('button-text');
  const buttonSpinner = document.getElementById('button-spinner');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email) {
      showError('Please enter your email.');
      return;
    }

    if (currentTab === 'password' && !password) {
      showError('Please enter your password.');
      return;
    }

    // Disable button and show spinner
    submitButton.disabled = true;
    buttonText.textContent = currentTab === 'password' ? 'Logging in...' : 'Sending...';
    buttonSpinner.classList.remove('hidden');
    hideError();
    hideSuccess();

    try {
      // Wait for Firebase to be initialized
      await new Promise((resolve) => {
        if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
          resolve();
        } else {
          const checkInterval = setInterval(() => {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        }
      });

      if (currentTab === 'password') {
        // Login with password
        const result = await window.FluanceAuth.signIn(email, password);

        if (result.success) {
          // Redirect to original page or homepage
          const returnUrl = new URLSearchParams(window.location.search).get('return') || '/en/';
          window.location.href = returnUrl;
        } else {
          showError(result.error || 'Login error.');
        }
      } else {
        // Send passwordless link
        // Save email in localStorage for link verification
        window.localStorage.setItem('emailForSignIn', email);
        
        const result = await window.FluanceAuth.sendSignInLink(email);

        if (result.success) {
          showSuccess('A login link has been sent to your email. Click on the link to log in.');
        } else {
          showError(result.error || 'Error sending link.');
          window.localStorage.removeItem('emailForSignIn');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      showError('An error occurred. Please try again.');
      if (currentTab === 'passwordless') {
        window.localStorage.removeItem('emailForSignIn');
      }
    } finally {
      submitButton.disabled = false;
      buttonText.textContent = currentTab === 'password' ? 'Login' : 'Send login link';
      buttonSpinner.classList.add('hidden');
    }
  });

  // Functions showError, hideError, showSuccess, hideSuccess are already defined globally
  // Function to toggle help section
  function toggleHelp() {
    const helpContent = document.getElementById('help-content');
    const helpArrow = document.getElementById('help-arrow');
    if (helpContent && helpArrow) {
      helpContent.classList.toggle('hidden');
      helpArrow.classList.toggle('rotate-180');
    }
  }
  window.toggleHelp = toggleHelp;
});
</script>

