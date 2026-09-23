function isSmsConfigured() {
  return Boolean(
    String(process.env.AFRICASTALKING_API_KEY || '').trim() &&
      String(process.env.AFRICASTALKING_USERNAME || '').trim()
  );
}

async function sendSms(to, message) {
  const apiKey = process.env.AFRICASTALKING_API_KEY;
  const username = process.env.AFRICASTALKING_USERNAME;

  if (!apiKey || !username) {
    console.log('[sms:dev]', { to, message });
    return { sent: false, logged: true };
  }

  const body = new URLSearchParams({
    username,
    to,
    message,
  });

  const response = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[sms] Africastalking failed', response.status, text);
    const error = new Error('Could not send SMS. Try again later.');
    error.status = 502;
    throw error;
  }

  return { sent: true };
}

async function sendPhoneVerificationSms(to, code) {
  return sendSms(to, `InvoicePro: Your verification code is ${code}\nThis code expires in 10 minutes.`);
}

module.exports = {
  isSmsConfigured,
  sendSms,
  sendPhoneVerificationSms,
};
