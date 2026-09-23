import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import OtpInput from '@/components/OtpInput';
import CodePreview from '@/components/CodePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function VerifyPhone() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(user?.phone || '');
  const [mode, setMode] = useState('choose');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState('');
  const [seconds, setSeconds] = useState(10 * 60);
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState('sms');

  async function sendCode() {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/send-phone-verification', {
        user_id: user.id,
        phone,
        delivery_method: 'sms',
      });
      await api.put('/user/verification-preferences', { preferred_method: method });
      setSeconds(data.expires_in || 600);
      setPreview(data.preview_code || '');
      setMode('code');
      const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
      window.setTimeout(() => clearInterval(timer), 10 * 60 * 1000);
      toast.success(data.preview_code ? `Your code is ${data.preview_code}` : data.message || 'Code sent via SMS');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(nextCode) {
    const value = nextCode || code;
    if (value.length !== 6) return;
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-phone', { user_id: user.id, code: value });
      setUser(data.user);
      toast.success('Welcome! Your account is secure.');
      navigate('/app');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    toast.success('Welcome! Your account is secure.');
    navigate('/app');
  }

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6">
        {mode === 'choose' ? (
          <>
            <div>
              <h1 className="text-2xl font-bold">Verify Your Phone (Optional)</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Add phone verification for extra security. You&apos;ll get SMS codes for password resets and account
                changes.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-2 text-sm">
              <p>How do you want to receive security codes?</p>
              <label className="flex items-center gap-2">
                <input type="radio" checked={method === 'sms'} onChange={() => setMethod('sms')} />
                SMS to my phone
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={method === 'email'} onChange={() => setMethod('email')} />
                Email
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={method === 'both'} onChange={() => setMethod('both')} />
                Both (SMS primary, email backup)
              </label>
            </div>
            <div className="flex gap-2">
              <Button disabled={busy || method === 'email'} onClick={sendCode}>
                {busy ? 'Sending...' : 'Send Code'}
              </Button>
              <Button variant="outline" onClick={skip}>
                Skip
              </Button>
            </div>
            {method === 'email' && (
              <p className="text-xs text-muted-foreground">
                Email-only codes are saved as your preference. You can skip phone verification.
              </p>
            )}
          </>
        ) : (
          <>
            <div>
              <h1 className="text-2xl font-bold">Verify Your Phone</h1>
              <p className="text-sm text-muted-foreground mt-1">We sent an SMS to {phone}</p>
            </div>
            <CodePreview code={preview} channel="sms" />
            <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
            <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => verify()}>
              Verify Phone
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Code expires in: {mins}:{secs}
            </p>
            <div className="flex justify-center gap-4 text-sm">
              <button type="button" className="underline" onClick={sendCode} disabled={busy}>
                Resend
              </button>
              <button type="button" className="underline" onClick={skip}>
                Skip for now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
