import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Lock,
  Mail,
  User,
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  CheckCircle2,
  UserPlus,
  LogIn,
} from 'lucide-react';

export const Login: React.FC = () => {
  const { loginWithEmail, registerWithEmail, resetPassword, loginWithGoogle } = useApp();
  
  // Tabs: 'LOGIN' | 'REGISTER' | 'FORGOT'
  const [activeTab, setActiveTab] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form state
  const [regFullName, setRegFullName] = useState('');
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLocation, setRegLocation] = useState('Gudang Utama CGK');

  // Forgot password form state
  const [forgotEmail, setForgotEmail] = useState('');

  // Status state
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Clear messages when switching tabs
  const handleSwitchTab = (tab: 'LOGIN' | 'REGISTER' | 'FORGOT') => {
    setActiveTab(tab);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    const emailTrimmed = loginEmail.trim();
    if (!emailTrimmed) {
      setErrorMessage('Silakan masukkan email akun terdaftar.');
      setIsLoading(false);
      return;
    }

    if (!loginPassword) {
      setErrorMessage('Kata sandi wajib diisi.');
      setIsLoading(false);
      return;
    }

    const result = await loginWithEmail(emailTrimmed, loginPassword);
    if (!result.success) {
      setErrorMessage(result.message || 'Gagal masuk. Periksa kembali email dan kata sandi Anda.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);
    const result = await loginWithGoogle();
    if (!result.success) {
      setErrorMessage(result.message || 'Gagal masuk dengan Google.');
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (regPassword.length < 6) {
      setErrorMessage('Kata sandi keamanan minimal 6 karakter.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok.');
      return;
    }

    setIsLoading(true);
    const result = await registerWithEmail(
      regEmail.trim(),
      regPassword,
      regFullName.trim(),
      regEmployeeId.trim().toUpperCase(),
      regLocation.trim()
    );

    if (result.success) {
      setSuccessMessage('Registrasi personil berhasil! Anda dapat langsung masuk dengan email & sandi.');
      setActiveTab('LOGIN');
      setLoginEmail(regEmail);
    } else {
      setErrorMessage(result.message || 'Gagal mendaftar. Silakan gunakan email lain atau periksa koneksi.');
    }
    setIsLoading(false);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const emailTrimmed = forgotEmail.trim();
    if (!emailTrimmed) {
      setErrorMessage('Silakan masukkan email terdaftar untuk menerima tautan reset kata sandi.');
      return;
    }

    setIsLoading(true);
    const result = await resetPassword(emailTrimmed);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage('Tautan pemulihan kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk.');
    } else {
      setErrorMessage(result.message || 'Gagal mengirim email reset. Pastikan email terdaftar.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col justify-center items-center p-4 selection:bg-[#1F5FAF] selection:text-white">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-[#D9E2EF] overflow-hidden">
        {/* Brand Header - Blue Corporate Theme */}
        <div className="bg-gradient-to-br from-[#123B66] to-[#1F5FAF] p-6 sm:p-7 text-white text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center font-extrabold text-xl shadow-inner mb-3">
              IAS
            </div>
            <h1 className="text-lg font-extrabold tracking-tight">
              PT IAS SUPPORT
            </h1>
            <p className="text-xs font-bold text-[#EFF6FF] uppercase tracking-widest mt-0.5">
              LOGISTICS CONTROL TOWER
            </p>
            <p className="text-[11px] text-[#EFF6FF]/80 mt-1">
              Sistem Manajemen Inventaris & Logistik Terpadu
            </p>
          </div>

          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-white/10 blur-xl pointer-events-none" />
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#D9E2EF] text-xs font-semibold bg-[#F7F9FC]">
          <button
            type="button"
            onClick={() => handleSwitchTab('LOGIN')}
            className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'LOGIN'
                ? 'border-[#1F5FAF] text-[#123B66] bg-white font-bold'
                : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 text-[#1F5FAF]" />
            <span>Masuk</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('REGISTER')}
            className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'REGISTER'
                ? 'border-[#1F5FAF] text-[#123B66] bg-white font-bold'
                : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-[#1F5FAF]" />
            <span>Daftar Staf</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab('FORGOT')}
            className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
              activeTab === 'FORGOT'
                ? 'border-[#1F5FAF] text-[#123B66] bg-white font-bold'
                : 'border-transparent text-[#64748B] hover:text-[#1F2937]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-[#1F5FAF]" />
            <span>Reset Sandi</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-4">
          {/* Notification Messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[#123B66] text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#1F5FAF] shrink-0 mt-0.5" />
              <span className="leading-snug">{successMessage}</span>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'LOGIN' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[#1F2937] block mb-1 font-semibold">
                  Email Perusahaan / Employee ID
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    type="text"
                    required
                    placeholder="nama@pt-iassupport.co.id atau EMP-001"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[#1F2937] font-semibold">
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSwitchTab('FORGOT')}
                    className="text-[11px] text-[#1F5FAF] hover:underline"
                  >
                    Lupa sandi?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Masukkan kata sandi terdaftar"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#64748B] hover:text-[#1F2937]"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                <span>{isLoading ? 'Memverifikasi Kredensial...' : 'Masuk ke Sistem'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#D9E2EF]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-[#64748B]">Atau Autentikasi SSO</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl border border-[#D9E2EF] bg-white hover:bg-[#F7F9FC] text-[#1F2937] font-bold text-xs shadow-2xs transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Masuk dengan Akun Google</span>
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER FORM */}
          {activeTab === 'REGISTER' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-[#1F2937] block mb-1 font-semibold">
                  Nama Lengkap Personil
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#1F2937] block mb-1 font-semibold">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="EMP-101"
                    value={regEmployeeId}
                    onChange={(e) => setRegEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-mono uppercase font-medium"
                  />
                </div>

                <div>
                  <label className="text-[#1F2937] block mb-1 font-semibold">
                    Lokasi Kerja
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Gudang Utama CGK"
                    value={regLocation}
                    onChange={(e) => setRegLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[#1F2937] block mb-1 font-semibold">
                  Email Perusahaan
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-2.5 text-[#64748B]" />
                  <input
                    type="email"
                    required
                    placeholder="staf@pt-iassupport.co.id"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[#1F2937] block mb-1 font-semibold">
                    Kata Sandi
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Min. 6 karakter"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="text-[#1F2937] block mb-1 font-semibold">
                    Konfirmasi Sandi
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Ulangi sandi"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-[#EFF6FF] rounded-xl border border-[#D9E2EF] text-[11px] text-[#123B66] leading-relaxed">
                Pendaftaran baru secara default diberikan peran <strong>LOGISTIK</strong>. Hak akses Administrator diberikan secara terpisah oleh Administrator melalui konsol manajemen.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                <span>{isLoading ? 'Mendaftarkan Akun...' : 'Daftar Akun Baru'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD FORM */}
          {activeTab === 'FORGOT' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4 text-xs">
              <p className="text-[#64748B] text-xs leading-relaxed">
                Masukkan alamat email resmi Anda. Kami akan mengirimkan tautan aman untuk menyetel ulang kata sandi melalui Firebase Authentication.
              </p>

              <div>
                <label className="text-[#1F2937] block mb-1 font-semibold">
                  Email Perusahaan
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-[#64748B]" />
                  <input
                    type="email"
                    required
                    placeholder="nama@pt-iassupport.co.id"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF] text-xs font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <span>{isLoading ? 'Mengirim Tautan...' : 'Kirim Tautan Reset Sandi'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleSwitchTab('LOGIN')}
                className="w-full py-2 text-center text-xs text-[#64748B] hover:text-[#1F2937] font-semibold"
              >
                Kembali ke Halaman Masuk
              </button>
            </form>
          )}

          {/* Security & Admin Provisioning Notice */}
          <div className="pt-3 border-t border-[#D9E2EF] text-[11px] text-[#64748B] space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-[#123B66]">
              <Building2 className="w-3.5 h-3.5 text-[#1F5FAF]" />
              <span>Otorisasi & Keamanan Multi-Peran PT IAS</span>
            </div>
            <p className="leading-relaxed">
              Autentikasi diamankan melalui enkripsi Firebase. Sesi tidak otomatis masuk ke akun Admin. Administrator diotorisasi melalui kredensial terdaftar di Cloud Firestore.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#F7F9FC] border-t border-[#D9E2EF] text-center text-[10px] text-[#64748B] font-mono">
          PT IAS Support • Logistics Control Tower • Cloud Firestore Secured
        </div>
      </div>
    </div>
  );
};
