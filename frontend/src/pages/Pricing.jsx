import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PLAN_LIST } from '@/lib/plans';
import SubscriptionFeaturesModal from '@/components/SubscriptionFeaturesModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Pricing() {
  const [tier, setTier] = useState(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold">
            InvoicePro
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link to="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link to="/signup">Try Free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold">Simple pricing for Kenyan shops</h1>
          <p className="mt-2 text-muted-foreground">Start free. Upgrade when you outgrow 10 invoices a month.</p>
        </div>
        <PlanGrid onView={(id) => setTier(id)} />
      </main>

      <SubscriptionFeaturesModal tier={tier || 'free'} open={Boolean(tier)} onClose={() => setTier(null)} />
    </div>
  );
}

export function PlanGrid({ onView, onUpgrade, currentTier }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PLAN_LIST.map((plan) => {
        const current = currentTier === plan.id;
        return (
          <Card key={plan.id} className={plan.id === 'basic' ? 'border-primary' : ''}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between">
                <span>{plan.name}</span>
                {current && <span className="text-xs font-normal text-emerald-700">Current</span>}
              </CardTitle>
              <p className="text-2xl font-bold">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
              </p>
              <p className="text-sm text-muted-foreground">{plan.blurb}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => onView(plan.id)}>
                View Features
              </Button>
              {plan.id !== 'free' && onUpgrade && (
                <Button className="w-full" disabled={current} onClick={() => onUpgrade(plan.id)}>
                  {current ? 'Active' : `Upgrade to ${plan.name}`}
                </Button>
              )}
              {plan.id === 'free' && !onUpgrade && (
                <Button className="w-full" asChild>
                  <Link to="/signup">Start free</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
