---
layout: base.njk
title: Create my account
description: Create your Fluance account to access your protected content
locale: en
permalink: /en/create-account/
---

<div class="min-h-screen bg-[#fdfaf6] py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 section-card">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-[#0f172a] mb-2">Create my account</h1>
      <p class="text-[#1f1f1f]/80">Access your protected Fluance content</p>
    </div>

    <form id="token-form" class="space-y-6">
      <div>
        <label for="token" class="block text-sm font-medium text-[#0f172a] mb-2">
          Activation code
        </label>
        <input
          type="text"
          id="token"
          name="token"
          required
          class="w-full px-4 py-2 border border-[#82153e]/20 rounded-lg focus:ring-2 focus:ring-[#82153e] focus:border-[#82153e] text-[#0f172a]"
          placeholder="Your activation code"
        />
        <p class="mt-1 text-sm text-[#1f1f1f]/60">
          This code was sent to you by email after your purchase.
        </p>
      </div>

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

      <div>
        <label for="password" class="block text-sm font-medium text-[#0f172a] mb-2">
          Password
        </label>
        <input
          type="password"
          id="password"
          name="password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-[#82153e]/20 rounded-lg focus:ring-2 focus:ring-[#82153e] focus:border-[#82153e] text-[#0f172a]"
          placeholder="Minimum 6 characters"
        />
      </div>

      <div>
        <label for="confirm-password" class="block text-sm font-medium text-[#0f172a] mb-2">
          Confirm password
        </label>
        <input
          type="password"
          id="confirm-password"
          name="confirm-password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-[#82153e]/20 rounded-lg focus:ring-2 focus:ring-[#82153e] focus:border-[#82153e] text-[#0f172a]"
          placeholder="Repeat your password"
        />
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <div id="success-message" class="hidden bg-[#ffce2d]/10 border border-[#ffce2d]/30 rounded-lg p-4">
        <p class="text-[#0f172a] text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-[#82153e] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#82153e]/90 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Create my account</span>
        <span id="button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <div class="mt-6 text-center">
      <p class="text-sm text-[#1f1f1f]/80">
        Already have an account? 
        <a href="/en/firebase-login" class="text-[#82153e] hover:text-[#82153e]/80 font-medium">Login</a>
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
document.addEventListener('DOMContentLoaded', function() {
  // Get token from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    document.getElementById('token').value = tokenFromUrl;
  }

  const form = document.getElementById('token-form');
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  const submitButton = document.getElementById('submit-button');
  const buttonText = document.getElementById('button-text');
  const buttonSpinner = document.getElementById('button-spinner');

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const token = document.getElementById('token').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    // Validation
    if (!token || !email || !password || !confirmPassword) {
      showError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      showError('Password must contain at least 6 characters.');
      return;
    }

    // Disable button and show spinner
    submitButton.disabled = true;
    buttonText.textContent = 'Creating account...';
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

      const result = await window.FluanceAuth.verifyTokenAndCreateAccount(token, password, email);

      console.log('Result from verifyTokenAndCreateAccount:', result);

      if (result.success) {
        showSuccess('Account created successfully!');
        
        // Verify that user is connected
        // Use firebase.auth() directly to be sure
        let user = null;
        let attempts = 0;
        const maxAttempts = 30; // 3 seconds max (30 * 100ms)
        
        while (!user && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (typeof firebase !== 'undefined' && firebase.auth) {
            try {
              user = firebase.auth().currentUser;
              console.log('Attempt', attempts + 1, '- Current user:', user ? user.email : 'null');
            } catch (e) {
              console.error('Error getting current user:', e);
            }
          }
          attempts++;
        }
        
        if (user) {
          console.log('✅ User authenticated:', user.email, '- Redirecting to /test-contenu-protege/');
          showSuccess('Redirecting to your content...');
          // Immediate redirect
          window.location.href = '/test-contenu-protege/';
        } else {
          console.error('❌ User not authenticated after', maxAttempts, 'attempts');
          console.log('Firebase state:', {
            firebaseDefined: typeof firebase !== 'undefined',
            authAvailable: typeof firebase !== 'undefined' && !!firebase.auth,
            currentUser: typeof firebase !== 'undefined' && firebase.auth ? firebase.auth().currentUser : 'N/A'
          });
          showError('Login successful but redirect failed. Redirecting to login page...');
          setTimeout(() => {
            window.location.href = '/en/firebase-login/';
          }, 2000);
        }
      } else {
        console.error('Account creation failed:', result.error);
        showError(result.error || 'Error creating account.');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('An error occurred. Please try again.');
    } finally {
      submitButton.disabled = false;
      buttonText.textContent = 'Create my account';
      buttonSpinner.classList.add('hidden');
    }
  });

  function showError(message) {
    errorDiv.querySelector('p').textContent = message;
    errorDiv.classList.remove('hidden');
    successDiv.classList.add('hidden');
  }

  function hideError() {
    errorDiv.classList.add('hidden');
  }

  function showSuccess(message) {
    successDiv.querySelector('p').textContent = message;
    successDiv.classList.remove('hidden');
    errorDiv.classList.add('hidden');
  }

  function hideSuccess() {
    successDiv.classList.add('hidden');
  }

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

