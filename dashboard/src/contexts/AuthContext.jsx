import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({
    session: null,
    user: null,
    role: 'viewer',
    loading: true,
    signOut: async () => {},
    passwordFlow: null,
    completePasswordFlow: () => {},
});

export function extractRole(session) {
    return session?.user?.app_metadata?.app_role || 'viewer';
}

export function detectPasswordFlow(locationLike) {
    if (locationLike?.pathname !== '/set-password') return null;
    const flow = new URLSearchParams(locationLike.search).get('flow');
    return flow === 'invite' || flow === 'recovery' ? flow : null;
}

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [passwordFlow, setPasswordFlow] = useState(() => detectPasswordFlow(window.location));

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setSession(session);
            if (event === 'PASSWORD_RECOVERY') setPasswordFlow('recovery');
        });

        return () => subscription.unsubscribe();
    }, []);

    const user = session?.user ?? null;
    const role = extractRole(session);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const completePasswordFlow = () => {
        window.history.replaceState({}, document.title, '/');
        setPasswordFlow(null);
    };

    return (
        <AuthContext.Provider value={{ session, user, role, loading, signOut, passwordFlow, completePasswordFlow }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
