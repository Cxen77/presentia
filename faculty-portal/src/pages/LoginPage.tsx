import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {supabase} from '../services/supabase';

export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle,refreshUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [verifyMode,setVerifyMode]=useState(false),[verificationEmail,setVerificationEmail]=useState(''),[code,setCode]=useState(''),[message,setMessage]=useState<string|null>(null);
  const verify=async(e:React.FormEvent)=>{e.preventDefault();setLoading(true);setError(null);try{const {error}=await supabase.auth.verifyOtp({email:verificationEmail.trim(),token:code.trim(),type:'signup'});if(error)throw error;await refreshUser();navigate('/');}catch(e){setError(e instanceof Error?e.message:'Could not verify email.');}finally{setLoading(false);}};
  const resend=async()=>{if(!verificationEmail.includes('@')){setError('Enter the email address for this account.');return;}setLoading(true);setError(null);try{const {error}=await supabase.auth.resend({type:'signup',email:verificationEmail.trim()});if(error)throw error;setMessage('A fresh confirmation code has been sent. Check your inbox and spam.');}catch(e){setError(e instanceof Error?e.message:'Could not send confirmation.');}finally{setLoading(false);}};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Failed to authenticate. Please verify your faculty credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    if (!result.success) {
      setError(result.error || 'Google authentication failed.');
      setGoogleLoading(false);
    }
    // If successful, user is redirected by OAuth provider
  };

  return (
    <div className="login-layout">
      <div className="w-full max-w-[370px]">
        {/* Portal Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#172333] border border-[#273548] text-[#b5bafa] mb-4 shadow-xl">
            <GraduationCap size={25} strokeWidth={1.8} />
          </div>
          <h1 className="text-xl font-semibold text-[#eef2f8] tracking-tight">Staff workspace</h1>
          <p className="text-sm text-[#9aabc1] mt-1.5">Your classes and attendance, in one place.</p>
        </div>

        {/* Card */}
        <div className="bg-[#111b28] border border-[#273548] rounded-xl p-5 shadow-sm">
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-950/40 border border-red-500/40 flex items-start gap-3">
              <ShieldAlert size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-200">{error}</p>
            </div>
          )}

          {verifyMode?<form onSubmit={verify} className="space-y-4"><h2 className="text-base font-semibold">Verify your email</h2><p className="text-xs text-slate-400">Use the code from your confirmation email. Your account role is assigned by the administrator.</p>{message&&<p role="status" className="text-xs text-emerald-300">{message}</p>}<label className="field">Account email<input type="email" required autoComplete="email" value={verificationEmail} onChange={e=>setVerificationEmail(e.target.value)}/></label><label className="field">Confirmation code<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button disabled={loading} type="submit" className="p-button w-full">{loading?'Please wait…':'Verify & continue'}</button><button type="button" className="p-button secondary w-full" disabled={loading} onClick={()=>void resend()}>Resend code</button><button type="button" className="p-button ghost w-full" onClick={()=>setVerifyMode(false)}>Back to sign in</button></form>:<>
          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full py-2.5 px-4 rounded-lg bg-[#172333] hover:bg-[#1a3754] border border-[#273548] text-sm font-medium text-[#eef2f8] transition-all flex items-center justify-center gap-3 shadow-sm hover:border-[#b5bafa]/50 disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.665-5.17 3.665-9.09z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.09C3.27 21.48 7.34 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.59H1.26C.46 8.18 0 9.99 0 12s.46 3.82 1.26 5.41l4.02-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.52 1.26 6.59l4.02 3.09c.95-2.83 3.6-4.93 6.72-4.93z"
              />
            </svg>
            <span>{googleLoading ? 'Connecting Google...' : 'Continue with Google Workspace'}</span>
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#273548]"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
              <span className="bg-[#111b28] px-2 text-[#74869d]">Or Sign In with Password</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] uppercase tracking-wider mb-2">
                Faculty ID or email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74869d]" />
                <input
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="FAC-XXXXXXXX or staff email"
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-[#172333] border border-[#273548] text-sm text-[#eef2f8] placeholder-[#74869d] focus:outline-none focus:border-[#b5bafa] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#9aabc1] uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#74869d]" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full pl-11 pr-4 py-2.5 rounded-lg bg-[#172333] border border-[#273548] text-sm text-[#eef2f8] placeholder-[#74869d] focus:outline-none focus:border-[#b5bafa] transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-lg bg-[#F3F2EF] hover:bg-white text-[#101D2C] font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign in to workspace</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
          <button type="button" className="p-button ghost w-full mt-3" onClick={()=>{setVerifyMode(true);setVerificationEmail(email.includes('@')?email:'');setError(null);}}>Verify email / enter confirmation code</button>
          </>}
        </div>

        {/* Security Warning */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#74869d] leading-relaxed max-w-sm mx-auto">
            Faculty and administrators use this portal. Student accounts use the student app.
          </p>
        </div>
      </div>
    </div>
  );
};
