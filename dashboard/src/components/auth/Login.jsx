import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (error) {
            setError(error.message);
        } else {
            setEmail('');
            setPassword('');
            if (onLoginSuccess) onLoginSuccess();
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <h2>System Login</h2>
            {error && <div style={{color:'red'}}>{error}</div>}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required disabled={loading} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required disabled={loading} />
            <button type="submit" disabled={loading}>{loading ? 'Logging in...' : 'Login'}</button>
        </form>
    );
}
