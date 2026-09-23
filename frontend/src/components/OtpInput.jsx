import { useRef } from 'react';
import { Input } from '@/components/ui/input';

export default function OtpInput({ value, onChange, onComplete, disabled }) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6).split('');
  while (digits.length < 6) digits.push('');
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  function setAt(index, char) {
    const next = [...digits];
    next[index] = char;
    const joined = next.join('').replace(/\D/g, '').slice(0, 6);
    onChange(joined);
    if (joined.length === 6) onComplete?.(joined);
  }

  return (
    <div className="flex justify-center gap-2" onPaste={(e) => {
      const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (!text) return;
      e.preventDefault();
      onChange(text);
      if (text.length === 6) onComplete?.(text);
      refs[Math.min(text.length, 5)].current?.focus();
    }}>
      {digits.map((digit, index) => (
        <Input
          key={index}
          ref={refs[index]}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digit}
          className="h-12 w-10 text-center text-lg font-semibold px-0"
          onChange={(e) => {
            const char = e.target.value.replace(/\D/g, '').slice(-1);
            setAt(index, char);
            if (char) refs[Math.min(index + 1, 5)].current?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[index] && index > 0) {
              refs[index - 1].current?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
