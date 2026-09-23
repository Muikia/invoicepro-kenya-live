import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p>InvoicePro is a simple invoicing tool for Kenyan shops. The free plan is limited to 10 invoices per month. The Basic plan is KSh 500/month for unlimited invoices.</p>
      <p>You are responsible for the accuracy of invoices you create. You can delete your account at any time.</p>
      <Link to="/" className="text-primary underline">Back home</Link>
    </div>
  );
}
