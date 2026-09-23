import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/password-reset', { email });
      toast.success(data.message);
      if (data.reset_url) setResetUrl(data.reset_url);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending...' : 'Send reset link'}
        </Button>
        {resetUrl && (
          <p className="text-sm break-all">Dev reset link: <Link to={resetUrl.replace(window.location.origin, '')}>{resetUrl}</Link></p>
        )}
        <Link to="/login" className="text-sm text-primary underline block">Back to login</Link>
      </form>
    </div>
  );
}
