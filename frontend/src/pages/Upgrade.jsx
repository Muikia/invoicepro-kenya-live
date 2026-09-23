import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import SubscriptionFeaturesModal from '@/components/SubscriptionFeaturesModal';
import { PlanGrid } from '@/pages/Pricing';

export default function Upgrade() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [featuresTier, setFeaturesTier] = useState(null);

  async function confirmPayment(tier) {
    setLoading(true);
    try {
      const { data } = await api.get('/subscription/verify', { params: { tier } });
      setUser(data.user);
      toast.success(data.message);
      navigate('/app');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-sm text-muted-foreground">
          You are on <strong className="uppercase">{user.subscription_tier || 'free'}</strong>. Pay via M-Pesa, then confirm to unlock the plan.
        </p>
      </div>
      <PlanGrid
        currentTier={user.subscription_tier || 'free'}
        onView={setFeaturesTier}
        onUpgrade={loading ? undefined : confirmPayment}
      />
      {loading && <p className="text-sm text-muted-foreground">Confirming payment...</p>}
      <p className="text-sm text-muted-foreground">
        After launch this will use a payment provider. For now, confirm after sending KSh 500 (Basic) or KSh 1,500 (Pro).
      </p>
      <Button variant="ghost" onClick={() => navigate('/app')}>
        Back to dashboard
      </Button>
      <SubscriptionFeaturesModal
        tier={featuresTier || 'free'}
        open={Boolean(featuresTier)}
        onClose={() => setFeaturesTier(null)}
        onUpgrade={confirmPayment}
      />
    </div>
  );
}
