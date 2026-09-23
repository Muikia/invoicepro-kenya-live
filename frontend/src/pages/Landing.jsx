import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SubscriptionFeaturesModal from '@/components/SubscriptionFeaturesModal';
import { PlanGrid } from '@/pages/Pricing';

export default function Landing() {
  const [tier, setTier] = useState(null);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
          <span className="font-bold">InvoicePro</span>
          <div className="flex gap-2">
            <Button variant="ghost" asChild><Link to="/login">Login</Link></Button>
            <Button asChild><Link to="/signup">Try Free</Link></Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Simple Invoicing for Kenyan Shops</h1>
          <p className="mt-4 text-lg text-muted-foreground">Track customers. Never lose a repeat customer again.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild><Link to="/signup">Try Free</Link></Button>
            <Button size="lg" variant="outline" asChild><a href="#how-it-works">How it works</a></Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Free tier: 10 invoices/month. No credit card required.</p>
        </section>
        <section className="mx-auto max-w-5xl px-4 pb-16 grid sm:grid-cols-2 gap-4">
          <Feature title="Create invoices in 2 minutes" />
          <Feature title="Auto-track customer history" />
          <Feature title="See revenue at a glance" />
          <Feature title="Repeat customers = repeat revenue" />
        </section>
        <section id="pricing" className="mx-auto max-w-5xl px-4 pb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">Pricing</h2>
          <PlanGrid onView={setTier} />
        </section>
        <section id="how-it-works" className="bg-card border-y py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-2xl font-bold mb-6">How it works</h2>
            <ol className="space-y-3 text-muted-foreground">
              <li>1. Create your free account with your shop name.</li>
              <li>2. Add a customer (name + phone).</li>
              <li>3. Create an invoice. Print, email, or send via WhatsApp.</li>
              <li>4. See who comes back — and how much they spend.</li>
            </ol>
          </div>
        </section>
      </main>
      <footer className="border-t py-6">
        <div className="mx-auto max-w-5xl px-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/pricing">Pricing</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
        </div>
      </footer>
      <SubscriptionFeaturesModal tier={tier || 'free'} open={Boolean(tier)} onClose={() => setTier(null)} />
    </div>
  );
}

function Feature({ title }) {
  return <div className="rounded-xl border bg-card p-5 font-medium">{title}</div>;
}
