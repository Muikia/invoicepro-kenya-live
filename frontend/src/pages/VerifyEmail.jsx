import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import OtpInput from '@/components/OtpInput';
import CodePreview from '@/components/CodePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function VerifyEmail() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState('');
  const [seconds, setSeconds] = useState(15 * 60);
  const [busy, setBusy] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState(user?.email || '');

  useEffect(() => {
    if (user?.email_verified) {
      navigate('/verify-phone', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCode() {
      try {
        const { data } = await api.get('/auth/verification-status');
        if (cancelled) return;
        if (data.email_preview_code) {
          setPreview(data.email_preview_code);
          return;
        }
        if (!data.email_verified && !data.email_configured) {
          const resent = await api.post('/auth/resend-email-code');
          if (!cancelled) setPreview(resent.data.preview_code || '');
        }
      } catch {
        // stay on the form
      }
    }
    loadCode();
    return () => {
      cancelled = true;
    };
  }, []);

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  async function verify(nextCode) {
    const value = nextCode || code;
    if (value.length !== 6) return;
    setBusy(true);
    try {
      const { data } = await api.post('/auth/verify-email', { user_id: user.id, code: value });
      setUser(data.user);
      toast.success('Email verified');
      navigate('/verify-phone');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/resend-email-code', { user_id: user.id });
      setSeconds(data.expires_in || 900);
      setPreview(data.preview_code || '');
      toast.success(data.preview_code ? `Your code is ${data.preview_code}` : data.message || 'Code sent');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeEmail(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/change-unverified-email', { email: newEmail });
      setUser(data.user);
      setSeconds(data.expires_in || 900);
      setPreview(data.preview_code || '');
      setChangeOpen(false);
      toast.success(data.preview_code ? `Your code is ${data.preview_code}` : 'Code sent to the new email');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h1 className="text-2xl font-bold">Verify Your Email</h1>
          <p className="text-sm text-muted-foreground mt-1">We sent a verification code to:</p>
          <p className="font-medium">{user?.email}</p>
        </div>
        <CodePreview code={preview} />
        <OtpInput value={code} onChange={setCode} onComplete={verify} disabled={busy} />
        <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => verify()}>
          {busy ? 'Verifying...' : 'Verify Email'}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Code expires in: {mins}:{secs}
        </p>
        <div className="flex flex-col gap-2 text-sm text-center">
          <button type="button" className="underline" onClick={resend} disabled={busy}>
            Didn&apos;t get the code? Resend Code
          </button>
          <button type="button" className="underline" onClick={() => setChangeOpen((v) => !v)}>
            Wrong email? Change Email
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => logout()}>
            Use a different account
          </button>
        </div>
        {changeOpen && (
          <form onSubmit={changeEmail} className="space-y-2 border-t pt-3">
            <Label>New email</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            <Button type="submit" variant="outline" disabled={busy}>
              Send new code
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
