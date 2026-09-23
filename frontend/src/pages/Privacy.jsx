import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p>InvoicePro stores the business and customer data you enter so you can create invoices and track repeat customers.</p>
      <p>We do not sell your data. Passwords are hashed. You can delete your account and all related data from Settings.</p>
      <p>Contact: support@invoicepro.example.com</p>
      <Link to="/" className="text-primary underline">Back home</Link>
    </div>
  );
}
