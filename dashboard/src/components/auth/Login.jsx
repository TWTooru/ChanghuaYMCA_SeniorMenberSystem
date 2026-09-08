import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, Mail, ArrowRight } from "lucide-react";

/**
 * 登入畫面只負責建立 Supabase email/password session；
 * 成功後的路由與 dashboard 顯示由 `AuthContext`／`App` 接手。
 */
export default function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setError(error.message);
            } else {
                setEmail('');
                setPassword('');
                if (onLoginSuccess) onLoginSuccess();
            }
        } catch {
            setError('登入服務暫時無法使用，請稍後再試。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dark relative min-h-screen flex items-center justify-center overflow-hidden bg-[#030712] selection:bg-indigo-500/30">
            {/* 裝飾背景，不承載互動或可讀內容。 */}
            <div className="absolute inset-0 z-0">
                <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-indigo-600/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-600/10 blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
                <div className="absolute top-[20%] right-[20%] w-[30vw] h-[30vw] rounded-full bg-blue-600/10 blur-[100px] mix-blend-screen" />
            </div>

            {/* 登入表單主容器。 */}
            <div className="relative z-10 w-full max-w-md p-8 sm:p-10 mx-4 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)]">
                <div className="flex flex-col items-center mb-10">
                    <div className="flex items-center justify-center mb-6">
                        <img src="./YMCA.png" alt="YMCA Logo" className="h-16 w-auto object-contain drop-shadow-md" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 tracking-tight">
                        YMCA社教學員資料庫
                    </h2>
                    <h3>學員資料管理系統</h3>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div role="alert" className="login-error p-4 text-sm text-red-200 bg-red-950/40 border border-red-500/30 rounded-xl text-center backdrop-blur-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <div className="space-y-2 group">
                            <Label htmlFor="email" className="text-muted-foreground group-focus-within:text-primary transition-colors">
                                Email Address
                            </Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="hello@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="pl-12 h-12"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 group">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-muted-foreground group-focus-within:text-primary transition-colors">
                                    Password
                                </Label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-300" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={loading}
                                    className="pl-12 h-12"
                                />
                            </div>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        size="lg"
                        className="group w-full mt-4"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <span className="flex items-center justify-center w-full">
                                Sign In
                                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                            </span>
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
