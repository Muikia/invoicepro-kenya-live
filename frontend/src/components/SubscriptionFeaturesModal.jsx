import { Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PLANS } from '@/lib/plans';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SubscriptionFeaturesModal({ tier = 'free', open, onClose, onUpgrade }) {
  const plan = PLANS[tier] || PLANS.free;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {plan.name} plan · {plan.price}
            {plan.period}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{plan.blurb}</p>
        <ul className="space-y-2">
          {plan.features.map((feature) => (
            <li key={feature.label} className="flex items-start gap-2 text-sm">
              {feature.ok ? (
                <Check className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
              ) : (
                <X className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
              )}
              <span className={feature.ok ? '' : 'text-muted-foreground'}>{feature.label}</span>
            </li>
          ))}
        </ul>
        <div className="pt-2">
          {tier === 'free' ? (
            <Button className="w-full" asChild>
              <Link to="/signup" onClick={onClose}>
                Start free
              </Link>
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                onClose?.();
                onUpgrade?.(tier);
              }}
              asChild={!onUpgrade}
            >
              {onUpgrade ? (
                'Upgrade Now'
              ) : (
                <Link to={`/app/upgrade?tier=${tier}`}>Upgrade Now</Link>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
