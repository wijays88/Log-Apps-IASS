import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  User,
  Shield,
  Key,
  Mail,
  Phone,
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const ProfilAkun: React.FC = () => {
  const { currentUser, updateUserAccount, showToast } = useApp();

  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [department, setDepartment] = useState(currentUser?.department || '');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    updateUserAccount(currentUser.id, {
      phone,
      department,
    });
    showToast('success', 'Profil Diperbarui', 'Informasi kontak Anda berhasil disimpan.');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      showToast('error', 'Kata Sandi Lemah', 'Kata sandi baru minimal harus 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('error', 'Validasi Gagal', 'Konfirmasi kata sandi tidak cocok.');
      return;
    }

    // Success simulation
    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast('success', 'Kata Sandi Berhasil Diubah', 'Kredensial keamanan Anda telah diperbarui.');

    setTimeout(() => {
      setPasswordSuccess(false);
    }, 4000);
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6 max-w-4xl">
      <PermissionNotice moduleName="Profil Akun Pengguna" />

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Profil Akun & Kredensial
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Informasi otorisasi personil dan pengaturan keamanan sandi PT IAS Support
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center font-extrabold text-2xl mx-auto shadow-md">
            {currentUser.fullName.charAt(0)}
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-base leading-tight">
              {currentUser.fullName}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              {currentUser.employeeId}
            </p>
          </div>

          <div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                currentUser.role === 'ADMIN'
                  ? 'bg-emerald-900 text-white'
                  : currentUser.role === 'SITE HEAD'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}
            >
              {currentUser.role}
            </span>
          </div>

          <div className="pt-4 border-t border-slate-100 text-left text-xs space-y-2.5 text-slate-600">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{currentUser.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">{currentUser.authorizedLocation}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Login Terakhir: {currentUser.lastLogin || 'Sesi ini'}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Edit Contact Details Form */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-[#064e3b]" />
              <span>Informasi Kontak & Unit Kerja</span>
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Employee ID (Tetap)</label>
                  <input
                    type="text"
                    disabled
                    value={currentUser.employeeId}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Email Perusahaan (Tetap)</label>
                  <input
                    type="email"
                    disabled
                    value={currentUser.email}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">No. Telepon / Ponsel</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+62 812-..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Departemen / Unit</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Contoh: Operasional Apron Bandara"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46] transition"
                >
                  Simpan Kontak
                </button>
              </div>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
            <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
              <Key className="w-4 h-4 text-[#064e3b]" />
              <span>Perbarui Kata Sandi</span>
            </h3>

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Kata sandi Anda telah berhasil diperbarui dan aktif.</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Kata Sandi Saat Ini</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Masukkan kata sandi lama"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Kata Sandi Baru</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Konfirmasi Kata Sandi Baru</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition"
                >
                  Ubah Kata Sandi
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
