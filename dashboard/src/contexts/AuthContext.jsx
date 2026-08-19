import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { detectPasswordFlow } from '../lib/authFlow';
import { initialPasswordFlow, supabase } from '../lib/supabaseClient';

export { detectPasswordFlow } from '../lib/authFlow';

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
 * 缺少角色時降級為 `viewer`；未知值在此不會正規化。
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

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [passwordFlow, setPasswordFlow] = useState(() => initialPasswordFlow ?? detectPasswordFlow(window.location));

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        }).catch(() => {
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
        const basePath = window.location.pathname.replace(/\/set-password\/?$/, '') || '/';
        window.history.replaceState({}, document.title, basePath);
        setPasswordFlow(null);
    };

    const value = useMemo(
        () => ({ session, user, role, loading, signOut, passwordFlow, completePasswordFlow }),
        [session, user, role, loading, passwordFlow]
    );

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
