import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '@/lib/api';

export default function Receipt() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    const share = params.get('share');
    const request = share
      ? api.get(`/public/receipt/${id}/${share}`, { responseType: 'text' })
      : api.get(`/invoices/${id}/receipt`, {
          params: token ? { token } : undefined,
          responseType: 'text',
        });
    request
      .then((res) => setHtml(res.data))
      .catch((err) => setError(err.message));
  }, [id, params]);

  if (error) return <div className="p-6">{error}</div>;
  if (!html) return <div className="p-6">Loading receipt...</div>;
  return <iframe title="Receipt" className="w-full min-h-screen border-0" srcDoc={html} />;
}
