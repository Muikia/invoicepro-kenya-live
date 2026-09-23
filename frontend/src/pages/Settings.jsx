import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { BUSINESS_TYPES } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState(user.business_name || '');
  const [businessType, setBusinessType] = useState(user.business_type || 'other');
  const [mpesa, setMpesa] = useState(user.m_pesa_number || '');
  const [saving, setSaving] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteToken, setDeleteToken] = useState('');
  const [deleteFails, setDeleteFails] = useState(0);
  const [deleteLockedUntil, setDeleteLockedUntil] = useState(0);
  const [countdown, setCountdown] = useState(30);
  const [deleting, setDeleting] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState(user.preferred_verification_method || 'sms');
  const [methodSaving, setMethodSaving] = useState(false);
  const [vat, setVat] = useState({
    business_vat_registered: false,
    vat_pin: '',
    default_vat_rate: 16,
  });
  const [vatLocked, setVatLocked] = useState(false);
  const [vatSaving, setVatSaving] = useState(false);

  useEffect(() => {
    api
      .get('/vat/settings')
      .then((res) => {
        setVat({
          business_vat_registered: Boolean(res.data.settings?.business_vat_registered),
          vat_pin: res.data.settings?.vat_pin || '',
          default_vat_rate: res.data.settings?.default_vat_rate || 16,
        });
        setVatLocked(Boolean(res.data.upgrade_required));
      })
      .catch(() => {});
  }, []);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/user/settings', {
        business_name: businessName,
        business_type: businessType,
        m_pesa_number: mpesa,
      });
      setUser(data.user);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    try {
      await api.put('/user/password', {
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      toast.success('Password updated');
      setPwOpen(false);
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function startDelete() {
    if (deleteLockedUntil && Date.now() < deleteLockedUntil) {
      toast.error('Wait 5 minutes before trying again');
      return;
    }
    setDeleteStep(1);
    setDeleteEmail('');
    setCountdown(30);
    setDeleteOpen(true);
    try {
      const { data } = await api.post('/user/request-deletion');
      setDeleteToken(data.deletion_token);
    } catch (err) {
      toast.error(err.message);
      setDeleteOpen(false);
    }
  }

  async function confirmDeleteEmail() {
    try {
      await api.post('/user/confirm-deletion', {
        deletion_token: deleteToken,
        email_confirmation: deleteEmail,
      });
      setDeleteStep(2);
      setCountdown(30);
    } catch (err) {
      if (err.status === 429) {
        setDeleteLockedUntil(Date.now() + 5 * 60 * 1000);
        setDeleteOpen(false);
        toast.error(err.message);
        return;
      }
      setDeleteFails((n) => n + 1);
      toast.error(err.message);
    }
  }

  async function finishDelete() {
    setDeleting(true);
    try {
      await api.post('/user/complete-deletion', { deletion_token: deleteToken });
      await logout();
      toast.success('Account deleted');
      navigate('/');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function cancelDelete() {
    if (deleteToken) {
      try {
        await api.post('/user/cancel-deletion', { deletion_token: deleteToken });
      } catch {
        // ignore
      }
    }
    setDeleteOpen(false);
    setDeleteStep(1);
    setDeleteEmail('');
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="space-y-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={user.phone} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Business Type</Label>
              <select className="h-10 w-full rounded-md border px-3 text-sm" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                {BUSINESS_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setPwOpen(true)}>Change Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verification Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Current: {user.preferred_verification_method === 'both' ? 'SMS + Email' : user.preferred_verification_method === 'email' ? 'Email' : 'SMS'}
          </p>
          <select
            className="h-10 w-full rounded-md border px-3 text-sm"
            value={verifyMethod}
            onChange={(e) => setVerifyMethod(e.target.value)}
          >
            <option value="sms">SMS to my phone</option>
            <option value="email">Email</option>
            <option value="both">Both (SMS primary, email backup)</option>
          </select>
          <Button
            disabled={methodSaving}
            onClick={async () => {
              setMethodSaving(true);
              try {
                const { data } = await api.put('/user/verification-preferences', { preferred_method: verifyMethod });
                setUser(data.user);
                toast.success('Verification method updated');
              } catch (err) {
                toast.error(err.message);
              } finally {
                setMethodSaving(false);
              }
            }}
          >
            Change Verification Method
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>VAT</CardTitle>
        </CardHeader>
        <CardContent>
          {vatLocked ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">VAT compliance is on Basic and Pro.</p>
              <Button asChild>
                <Link to="/app/upgrade">Upgrade Now</Link>
              </Button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setVatSaving(true);
                try {
                  const { data } = await api.post('/vat/settings', vat);
                  setVat(data.settings);
                  toast.success('VAT settings saved');
                } catch (err) {
                  toast.error(err.message);
                } finally {
                  setVatSaving(false);
                }
              }}
            >
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={vat.business_vat_registered}
                  onCheckedChange={(v) => setVat({ ...vat, business_vat_registered: Boolean(v) })}
                />
                Business is VAT registered
              </label>
              <div className="space-y-2">
                <Label>KRA PIN</Label>
                <Input value={vat.vat_pin} onChange={(e) => setVat({ ...vat, vat_pin: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Default VAT rate (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={vat.default_vat_rate}
                  onChange={(e) => setVat({ ...vat, default_vat_rate: e.target.value })}
                />
              </div>
              <Button type="submit" disabled={vatSaving}>
                {vatSaving ? 'Saving...' : 'Save VAT settings'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveSettings} className="space-y-3">
            <div className="space-y-2">
              <Label>M-Pesa Business Account Number</Label>
              <Input value={mpesa} onChange={(e) => setMpesa(e.target.value)} placeholder="Optional" />
            </div>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">This will delete your account and all data. This cannot be undone.</p>
          <Button variant="destructive" onClick={startDelete}>
            Delete Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="space-y-2">
              <Label>Current password</Label>
              <Input type="password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Confirm password</Label>
              <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            </div>
            <Button type="submit">Update password</Button>
          </form>
        </DialogContent>
      </Dialog>

      <DeleteAccountDialog
        open={deleteOpen}
        step={deleteStep}
        email={user.email}
        typed={deleteEmail}
        setTyped={setDeleteEmail}
        countdown={countdown}
        setCountdown={setCountdown}
        deleting={deleting}
        onCancel={cancelDelete}
        onConfirmEmail={confirmDeleteEmail}
        onFinish={finishDelete}
      />
    </div>
  );
}

function DeleteAccountDialog({
  open,
  step,
  email,
  typed,
  setTyped,
  countdown,
  setCountdown,
  deleting,
  onCancel,
  onConfirmEmail,
  onFinish,
}) {
  const matches = typed.trim().toLowerCase() === String(email || '').toLowerCase();

  useEffect(() => {
    if (!open || step !== 2) return undefined;
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [open, step, setCountdown]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Are you sure you want to delete your account? This action CANNOT be undone.</p>
              <ul className="space-y-1">
                <li>All invoices will be deleted</li>
                <li>All customers will be deleted</li>
                <li>All data will be permanently lost</li>
              </ul>
              <p className="font-medium">This is permanent. No recovery possible.</p>
              <div className="space-y-2">
                <Label>To confirm, type your email below:</Label>
                <div className="relative">
                  <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={email} />
                  {typed ? (
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 ${matches ? 'text-emerald-600' : 'text-red-600'}`}>
                      {matches ? '✓' : '✗'}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
                <Button variant="destructive" disabled={!matches} onClick={onConfirmEmail}>
                  Delete Account
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Final Confirmation</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>Your account will be PERMANENTLY deleted in 30 seconds. You cannot undo this.</p>
              <p className="text-2xl font-bold">Countdown: {countdown}s</p>
              <div className="flex gap-2">
                <Button variant="destructive" disabled={countdown > 0 || deleting} onClick={onFinish}>
                  {deleting ? 'Deleting...' : 'I understand, delete my account'}
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
