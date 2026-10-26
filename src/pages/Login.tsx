import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Shield,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  Building2,
} from 'lucide-react';
import { UserRole } from '../types';

export const Login: React.FC = () => {
  const { users, setCurrentUser, showToast } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    setTimeout(() => {
      const trimmed = identifier.trim().toLowerCase();
      const user = users.find(
        (u) =>
          u.email.toLowerCase() === trimmed ||
          u.employeeId.toLowerCase() === trimmed
      );

      if (!user) {
        setErrorMessage('Employee ID atau Email tidak terdaftar dalam sistem PT IAS Support.');
        setIsLoading(false);
        return;
      }

      if (user.status !== 'Active') {
        setErrorMessage('Akun Anda dalam status Non-Aktif. Hubungi Administrator untuk reaktivasi.');
        setIsLoading(false);
        return;
      }

      // Password check simulation
      if (password.length < 3) {
        setErrorMessage('Kata sandi tidak boleh kosong.');
        setIsLoading(false);
        return;
      }

      setCurrentUser(user);
      showToast('success', 'Login Berhasil', `Selamat datang, ${user.fullName} (${user.role})`);
      setIsLoading(false);
    }, 400);
  };

  const handleQuickLogin = (role: UserRole) => {
    const user = users.find((u) => u.role === role && u.status === 'Active');
    if (user) {
      setCurrentUser(user);
      showToast('success', 'Login Cepat Berhasil', `Masuk sebagai ${user.fullName} (${role})`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-600 selection:text-white">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Brand Header */}
        <div className="bg-[#064e3b] p-7 text-white text-center relative overflow-hidden">
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 text-white flex items-center justify-center font-extrabold text-xl shadow-inner mb-3">
              IAS
            </div>
            <h1 className="text-lg font-extrabold tracking-tight">
              PT IAS SUPPORT
            </h1>
            <p className="text-xs font-bold text-emerald-200 uppercase tracking-widest mt-0.5">
              LOGISTICS CONTROL TOWER
            </p>
            <p className="text-[11px] text-emerald-100/80 mt-1">
              Sistem Manajemen Inventaris & Logistik Terpadu
            </p>
          </div>

          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-emerald-400/20 blur-xl pointer-events-none" />
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Regular Login Form */}
          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="text-slate-700 block mb-1 font-semibold">
                Employee ID atau Email
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: EMP-001 atau admin@pt-iassupport.co.id"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-700 block mb-1 font-semibold">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Masukkan kata sandi akun"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 mt-2"
            >
              <span>{isLoading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Dynamic Registered Users Quick Access */}
          {users.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5 text-center">
                Pilih Akun Terdaftar (Masuk Cepat)
              </div>

              <div className="space-y-2 text-xs">
                {users
                  .filter((u) => u.status === 'Active')
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setCurrentUser(u);
                        showToast('success', 'Login Berhasil', `Masuk sebagai ${u.fullName} (${u.role})`);
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-[#064e3b] hover:bg-emerald-50/50 transition flex items-center justify-between text-left group"
                    >
                      <div>
                        <div className="font-bold text-slate-900 group-hover:text-[#064e3b]">
                          {u.fullName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {u.employeeId} • {u.authorizedLocation}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          u.role === 'ADMIN'
                            ? 'bg-emerald-900 text-white'
                            : u.role === 'LOGISTIK'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500">
          PT IAS Support • Hak Cipta Dilindungi Undang-Undang
        </div>
      </div>
    </div>
  );
};
