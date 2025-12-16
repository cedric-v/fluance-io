---
layout: base.njk
title: Reset Password
description: Reset your password to access your protected Fluance content
locale: en
permalink: /en/reset-password/
---

<div class="min-h-screen bg-[#fdfaf6] py-12 px-4 sm:px-6 lg:px-8">
  <div class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8 section-card">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-[#3E3A35] mb-2">Reset Password</h1>
      <p class="text-[#1f1f1f]/80">Enter your email to receive a reset link</p>
    </div>

    <!-- Reset request form -->
    <form id="reset-request-form" class="space-y-6">
      <div>
        <label for="email" class="block text-sm font-medium text-[#3E3A35] mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#3E3A35]"
          placeholder="your@email.com"
        />
      </div>

      <div id="success-message" class="hidden bg-[#E6B84A]/10 border border-[#E6B84A]/30 rounded-lg p-4">
        <p class="text-[#3E3A35] text-sm"></p>
      </div>

      <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="submit-button"
        class="w-full bg-fluance text-white py-3 px-4 rounded-lg font-semibold hover:bg-fluance/90 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="button-text">Send reset link</span>
        <span id="button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <!-- Reset confirmation form (shown if code present in URL) -->
    <form id="reset-confirm-form" class="space-y-6 hidden">
      <div>
        <label for="new-password" class="block text-sm font-medium text-[#3E3A35] mb-2">
          New Password
        </label>
        <input
          type="password"
          id="new-password"
          name="new-password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#3E3A35]"
          placeholder="At least 6 characters"
        />
        <p class="mt-1 text-xs text-[#1f1f1f]/60">Password must be at least 6 characters long</p>
      </div>

      <div>
        <label for="confirm-password" class="block text-sm font-medium text-[#3E3A35] mb-2">
          Confirm Password
        </label>
        <input
          type="password"
          id="confirm-password"
          name="confirm-password"
          required
          minlength="6"
          class="w-full px-4 py-2 border border-fluance/20 rounded-lg focus:ring-2 focus:ring-fluance focus:border-fluance text-[#3E3A35]"
          placeholder="Repeat password"
        />
      </div>

      <div id="confirm-success-message" class="hidden bg-[#E6B84A]/10 border border-[#E6B84A]/30 rounded-lg p-4">
        <p class="text-[#3E3A35] text-sm"></p>
      </div>

      <div id="confirm-error-message" class="hidden bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 text-sm"></p>
      </div>

      <button
        type="submit"
        id="confirm-submit-button"
        class="w-full bg-fluance text-white py-3 px-4 rounded-lg font-semibold hover:bg-fluance/90 transition-colors duration-200 flex items-center justify-center"
      >
        <span id="confirm-button-text">Reset Password</span>
        <span id="confirm-button-spinner" class="hidden ml-2">
          <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </span>
      </button>
    </form>

    <div class="mt-6 text-center space-y-2">
      <p class="text-sm text-[#1f1f1f]/80">
        <a href="/en/member-login" class="text-fluance hover:text-fluance/80 font-medium">Back to login</a>
      </p>
    </div>
  </div>
</div>

<script src="/assets/js/firebase-auth.js"></script>
<script>
document.addEventListener('DOMContentLoaded', async function() {
  // Wait for Firebase to initialize
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
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 3000);
    }
  });

  // Wait for window.FluanceAuth to be available
  await new Promise((resolve) => {
    if (typeof window.FluanceAuth !== 'undefined' && 
        typeof window.FluanceAuth.sendPasswordResetEmail === 'function') {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (typeof window.FluanceAuth !== 'undefined' && 
            typeof window.FluanceAuth.sendPasswordResetEmail === 'function') {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof window.FluanceAuth === 'undefined') {
          console.error('window.FluanceAuth is not available');
        }
        resolve();
      }, 5000);
    }
  });

  const requestForm = document.getElementById('reset-request-form');
  const confirmForm = document.getElementById('reset-confirm-form');
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  const confirmErrorDiv = document.getElementById('confirm-error-message');
  const confirmSuccessDiv = document.getElementById('confirm-success-message');

  // Check if reset code is present in URL
  const urlParams = new URLSearchParams(window.location.search);
  const actionCode = urlParams.get('oobCode') || urlParams.get('token'); // Support custom token
  const mode = urlParams.get('mode');

  // Show form if we have a code (Firebase) or token (custom)
  if (actionCode && (mode === 'resetPassword' || urlParams.get('token'))) {
    // Show confirmation form
    requestForm.classList.add('hidden');
    confirmForm.classList.remove('hidden');

    // Verify code is valid and get email
    let userEmail = null;
    const verifyResult = await window.FluanceAuth.verifyPasswordResetCode(actionCode);
    if (!verifyResult.success) {
      confirmErrorDiv.querySelector('p').textContent = verifyResult.error || 'Invalid or expired reset code.';
      confirmErrorDiv.classList.remove('hidden');
      confirmForm.querySelector('button').disabled = true;
    } else {
      userEmail = verifyResult.email;
    }

    // Handle confirmation form submission
    confirmForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const newPassword = document.getElementById('new-password').value;
      const confirmPassword = document.getElementById('confirm-password').value;

      if (newPassword !== confirmPassword) {
        confirmErrorDiv.querySelector('p').textContent = 'Passwords do not match.';
        confirmErrorDiv.classList.remove('hidden');
        confirmSuccessDiv.classList.add('hidden');
        return;
      }

      if (newPassword.length < 6) {
        confirmErrorDiv.querySelector('p').textContent = 'Password must be at least 6 characters long.';
        confirmErrorDiv.classList.remove('hidden');
        confirmSuccessDiv.classList.add('hidden');
        return;
      }

      const submitButton = document.getElementById('confirm-submit-button');
      const buttonText = document.getElementById('confirm-button-text');
      const buttonSpinner = document.getElementById('confirm-button-spinner');

      submitButton.disabled = true;
      buttonText.textContent = 'Resetting...';
      buttonSpinner.classList.remove('hidden');
      confirmErrorDiv.classList.add('hidden');
      confirmSuccessDiv.classList.add('hidden');

      try {
        const result = await window.FluanceAuth.confirmPasswordReset(actionCode, newPassword);

        if (result.success) {
          confirmSuccessDiv.querySelector('p').textContent = 'Your password has been reset successfully. You will be redirected to the login page...';
          confirmSuccessDiv.classList.remove('hidden');
          
          // Clean URL to prevent Firebase Auth from auto-redirecting
          window.history.replaceState({}, document.title, '/en/reset-password');
          
          // Redirect to login page
          // User can log in with their new password
          // Safari will correctly detect the fluance.io domain during manual login
          setTimeout(() => {
            window.location.replace('/en/member-login');
          }, 1500);
        } else {
          confirmErrorDiv.querySelector('p').textContent = result.error || 'Error resetting password.';
          confirmErrorDiv.classList.remove('hidden');
          submitButton.disabled = false;
          buttonText.textContent = 'Reset Password';
          buttonSpinner.classList.add('hidden');
        }
      } catch (error) {
        console.error('Error:', error);
        confirmErrorDiv.querySelector('p').textContent = 'An error occurred. Please try again.';
        confirmErrorDiv.classList.remove('hidden');
        submitButton.disabled = false;
        buttonText.textContent = 'Reset Password';
        buttonSpinner.classList.add('hidden');
      }
    });
  } else {
    // Show request form
    requestForm.classList.remove('hidden');
    confirmForm.classList.add('hidden');

    // Handle request form submission
    requestForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();

      if (!email) {
        errorDiv.querySelector('p').textContent = 'Please enter your email.';
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
        return;
      }

      const submitButton = document.getElementById('submit-button');
      const buttonText = document.getElementById('button-text');
      const buttonSpinner = document.getElementById('button-spinner');

      submitButton.disabled = true;
      buttonText.textContent = 'Sending...';
      buttonSpinner.classList.remove('hidden');
      errorDiv.classList.add('hidden');
      successDiv.classList.add('hidden');

      try {
        const result = await window.FluanceAuth.sendPasswordResetEmail(email);

        if (result.success) {
          const message = result.message || 'A password reset email has been sent to ' + email + '. Check your inbox and spam folder, then click the link to reset your password.';
          successDiv.querySelector('p').textContent = message;
          successDiv.classList.remove('hidden');
        } else {
          // Display error with suggestion if available
          let errorHTML = result.error || 'Error sending email.';
          if (result.suggestion) {
            errorHTML += '<br><br><strong>💡 Suggestion:</strong> ' + result.suggestion;
          }
          if (result.errorCode) {
            errorHTML += '<br><small class="text-red-600">Code: ' + result.errorCode + '</small>';
          }
          errorDiv.querySelector('p').innerHTML = errorHTML;
          errorDiv.classList.remove('hidden');
        }
      } catch (error) {
        console.error('Error:', error);
        errorDiv.querySelector('p').textContent = 'An error occurred. Please try again.';
        errorDiv.classList.remove('hidden');
      } finally {
        submitButton.disabled = false;
        buttonText.textContent = 'Send reset link';
        buttonSpinner.classList.add('hidden');
      }
    });
  }
});
</script>

