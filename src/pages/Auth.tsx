import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const Auth = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { if (session) navigate('/'); });
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) navigate('/'); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = mode === 'in'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === 'up') setMsg('Sprawdź skrzynkę i potwierdź adres e-mail.');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4 font-mono">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 border border-primary/40 rounded-lg p-6 bg-card">
        <h1 className="text-xl text-primary">{mode === 'in' ? 'Logowanie do bramki' : 'Nowe konto'}</h1>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e-mail"
          className="w-full bg-background border border-primary/30 rounded px-3 py-2 text-foreground" />
        <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="hasło"
          className="w-full bg-background border border-primary/30 rounded px-3 py-2 text-foreground" />
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button type="submit" disabled={busy} className="w-full">{mode === 'in' ? 'Zaloguj' : 'Załóż konto'}</Button>
        <button type="button" className="text-sm text-primary underline" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Nie masz konta? Zarejestruj się' : 'Masz konto? Zaloguj się'}
        </button>
      </form>
    </main>
  );
};

export default Auth;
