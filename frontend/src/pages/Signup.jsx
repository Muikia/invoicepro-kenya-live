import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { BUSINESS_TYPES } from '@/lib/format';
import { passwordStrength } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, setValue } = useForm({
    defaultValues: {
      email: '',
      phone: '',
      password: '',
      confirm_password: '',
      business_name: '',
      business_type: 'other',
      terms: false,
    },
  });
  const password = watch('password');
  const confirmPassword = watch('confirm_password');
  const terms = watch('terms');
  const strength = passwordStrength(password);
  const hasMinLength = String(password || '').length >= 8;
  const hasUpperAndNumber = /[A-Z]/.test(password || '') && /[0-9]/.test(password || '');
  const passwordsMatch = Boolean(password) && password === confirmPassword;
  const passwordReady = hasMinLength && hasUpperAndNumber && passwordsMatch;
  const canSubmit = passwordReady && Boolean(terms) && !loading;

  async function onSubmit(values) {
    if (!values.terms) {
      toast.error('Accept the terms to continue');
      return;
    }
    if (values.password !== values.confirm_password) {
      toast.error('Passwords do not match. Try again.');
      return;
    }
    if (values.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(values.password) || !/[0-9]/.test(values.password)) {
      toast.error('Password must include 1 uppercase letter, 1 number');
      return;
    }
    setLoading(true);
    try {
      await signup({
        email: values.email,
        phone: values.phone,
        password: values.password,
        confirm_password: values.confirm_password,
        business_name: values.business_name,
        business_type: values.business_type,
      });
      toast.success('Account created');
      navigate('/app');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-sm text-muted-foreground">Start with 10 free invoices every month.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required {...register('email')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <div className="flex">
            <span className="inline-flex items-center rounded-l-md border border-r-0 px-3 text-sm bg-muted">🇰🇪 +254</span>
            <Input id="phone" className="rounded-l-none" placeholder="712345678" required {...register('phone')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={8} {...register('password')} />
          <div className="flex items-center gap-2 text-xs">
            <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden">
              <div className={`h-full ${strength.color}`} style={{ width: `${(strength.score / 4) * 100}%` }} />
            </div>
            <span>{strength.label}</span>
          </div>
          {!hasMinLength && password ? (
            <p className="text-xs text-red-600">Password must be at least 8 characters</p>
          ) : null}
          {password && !hasUpperAndNumber ? (
            <p className="text-xs text-red-600">Password must include 1 uppercase letter, 1 number</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm Password</Label>
          <div className="relative">
            <Input id="confirm_password" type="password" required {...register('confirm_password')} />
            {confirmPassword ? (
              <span
                className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${
                  passwordsMatch ? 'text-emerald-600' : 'text-red-600'
                }`}
                aria-hidden
              >
                {passwordsMatch ? '✓' : '✗'}
              </span>
            ) : null}
          </div>
          {confirmPassword && !passwordsMatch ? (
            <p className="text-xs text-red-600">Passwords do not match</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_name">Business name</Label>
          <Input id="business_name" required {...register('business_name')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="business_type">Business type</Label>
          <select id="business_type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" {...register('business_type')}>
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={Boolean(terms)} onCheckedChange={(v) => setValue('terms', Boolean(v))} />
          I agree to the{' '}
          <Link to="/terms" className="underline">
            Terms
          </Link>
        </label>
        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {loading ? 'Creating account...' : 'Create Account'}
        </Button>
        <p className="text-sm text-center text-muted-foreground">
          Already have account?{' '}
          <Link to="/login" className="text-primary underline">
            Login here
          </Link>
        </p>
      </form>
    </div>
  );
}
