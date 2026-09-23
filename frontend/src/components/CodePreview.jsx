export default function CodePreview({ code, channel = 'email' }) {
  if (!code) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-center space-y-1">
      <p className="text-xs text-amber-900">
        {channel === 'sms' ? 'SMS is not set up yet' : 'Email is not set up yet'}. Use this code:
      </p>
      <p className="text-3xl font-bold tracking-[0.3em]">{code}</p>
      <p className="text-[11px] text-amber-800">This only shows because delivery is not configured on this machine.</p>
    </div>
  );
}
