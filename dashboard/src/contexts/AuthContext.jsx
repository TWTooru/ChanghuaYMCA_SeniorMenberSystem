import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * 集中管理 Supabase session 與邀請／密碼重設流程。
 * `role` 供前端控制顯示；真正授權仍必須由 RLS 或 Edge Function 驗證。
 */
const AuthContext = createContext({
    session: null,
    user: null,
    role: 'viewer',
    loading: true,
    signOut: async () => {},
    passwordFlow: null,
    completePasswordFlow: () => {},
});

/**
 * 從 session metadata 解析 UI 使用的角色；legacy metadata 僅為相容舊帳號。
 * 缺少或未知角色時一律降級為 `viewer`。
 */
export function extractRole(session) {
    if (!session?.user) return 'viewer';
    return (
        session.user.app_metadata?.app_role ||
        session.user.app_metadata?.role ||
        // `app_metadata` 由可信任後端維護；`user_metadata` 只保留舊帳號相容性，不能作為後端授權依據。
        session.user.user_metadata?.role ||
        'viewer'
    );
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
