import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Users,
  UserCheck,
  UserX,
  Shield,
  Search,
  Filter,
  Plus,
  Edit2,
  Key,
  Power,
  Lock,
  X,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';
import { UserAccount, UserRole, AccountStatus } from '../types';

export const AccountManagement: React.FC = () => {
  const {
    users,
    locations,
    createUserAccount,
    updateUserAccount,
    toggleUserStatus,
    resetUserPassword,
    currentUser,
    can,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [locationFilter, setLocationFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resetResultModal, setResetResultModal] = useState<{ name: string; email: string; tempPass: string } | null>(null);

  // Form states for Create/Edit
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('LOGISTIK');
  const [formLocation, setFormLocation] = useState('Gudang Utama CGK');
  const [formStatus, setFormStatus] = useState<AccountStatus>('Active');
  const [formPhone, setFormPhone] = useState('');
  const [formDepartment, setFormDepartment] = useState('');

  const isAdmin = currentUser?.role === 'ADMIN';

  // Metrics
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'Active').length;
  const inactiveUsers = users.filter((u) => u.status === 'Inactive').length;
  const adminCount = users.filter((u) => u.role === 'ADMIN').length;
  const logistikCount = users.filter((u) => u.role === 'LOGISTIK').length;
  const siteHeadCount = users.filter((u) => u.role === 'SITE HEAD').length;

  // Filtered Users
  const filteredUsers = useMemo(() => {
    // If not Admin, security requirement: non-admin users cannot see unauthorized account details
    if (!isAdmin) {
      // Non-admin can only see their own profile or restricted high-level summary
      return users.filter((u) => u.id === currentUser?.id);
    }

    return users.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
      const matchStatus = statusFilter === 'ALL' || u.status === statusFilter;
      const matchLoc = locationFilter === 'ALL' || u.authorizedLocation === locationFilter;

      return matchSearch && matchRole && matchStatus && matchLoc;
    });
  }, [users, searchTerm, roleFilter, statusFilter, locationFilter, isAdmin, currentUser]);

  // Paginated
  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleOpenCreateModal = () => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Administrator yang dapat membuat akun.');
      return;
    }
    setFormEmployeeId('EMP-0' + (users.length + 10));
    setFormFullName('');
    setFormEmail('');
    setFormRole('LOGISTIK');
    setFormLocation(locations[0]?.name || 'Gudang Utama CGK');
    setFormStatus('Active');
    setFormPhone('');
    setFormDepartment('Operasional Pergudangan');
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formFullName.trim() || !formEmail.trim() || !formEmployeeId.trim()) {
      showToast('error', 'Validasi Gagal', 'Lengkapi seluruh data wajib pengguna.');
      return;
    }

    const success = createUserAccount({
      employeeId: formEmployeeId.trim(),
      fullName: formFullName.trim(),
      email: formEmail.trim(),
      role: formRole,
      authorizedLocation: formLocation,
      status: formStatus,
      phone: formPhone,
      department: formDepartment,
    });

    if (success) {
      setCreateModalOpen(false);
    }
  };

  const handleOpenEdit = (user: UserAccount) => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Admin yang dapat mengubah akun.');
      return;
    }
    setEditingUser(user);
    setFormEmployeeId(user.employeeId);
    setFormFullName(user.fullName);
    setFormEmail(user.email);
    setFormRole(user.role);
    setFormLocation(user.authorizedLocation);
    setFormStatus(user.status);
    setFormPhone(user.phone || '');
    setFormDepartment(user.department || '');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const success = updateUserAccount(editingUser.id, {
      fullName: formFullName.trim(),
      email: formEmail.trim(),
      role: formRole,
      authorizedLocation: formLocation,
      status: formStatus,
      phone: formPhone,
      department: formDepartment,
    });

    if (success) {
      setEditingUser(null);
    }
  };

  const handleToggleStatus = (user: UserAccount) => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Admin yang dapat mengubah status akun.');
      return;
    }
    toggleUserStatus(user.id);
  };

  const handleResetPassword = (user: UserAccount) => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Admin yang dapat mereset kredensial.');
      return;
    }
    const tempPass = resetUserPassword(user.id);
    if (tempPass) {
      setResetResultModal({
        name: user.fullName,
        email: user.email,
        tempPass,
      });
    }
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Account Management" actionRequired="ADMIN_ONLY" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Manajemen Akun & Hak Akses Pengguna
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              {totalUsers} Akun Terdaftar
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Administrasi otorisasi personil, penugasan peran (RBAC), dan status kredensial PT IAS Support
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Akun Baru</span>
            </button>
          ) : (
            <button
              disabled
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-400 font-semibold text-xs sm:text-sm border border-slate-200 cursor-not-allowed flex items-center gap-2"
              title="Fitur ini dibatasi hanya untuk Administrator"
            >
              <Lock className="w-4 h-4" />
              <span>Tambah Akun Baru (Admin Only)</span>
            </button>
          )}
        </div>
      </div>

      {/* Account Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Pengguna</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalUsers}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Seluruh Personil</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs mb-1">
            <span className="font-semibold">Akun Aktif</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700">{activeUsers}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Memiliki Akses Login</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-rose-700 text-xs mb-1">
            <span className="font-semibold">Non-Aktif</span>
            <UserX className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-700">{inactiveUsers}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Diblokir / Ditangguhkan</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Peran Admin</span>
            <Shield className="w-4 h-4 text-emerald-800" />
          </div>
          <div className="text-2xl font-extrabold text-[#064e3b]">{adminCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Kontrol Penuh</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Peran Logistik</span>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{logistikCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Operasional Fisik</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 text-xs mb-1">
            <span className="font-semibold">Site Head</span>
            <Shield className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-800">{siteHeadCount}</div>
          <div className="text-[10px] text-amber-700 mt-0.5">Pengawasan (Read-Only)</div>
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800">Kebijakan Privasi & Keamanan:</span> Sesuai standar tata kelola PT IAS Support, daftar detail dan manajemen seluruh personil hanya dapat dilihat dan dikelola oleh Administrator. Anda hanya dapat melihat informasi profil Anda sendiri di bawah ini.
          </div>
        </div>
      )}

      {/* Filter and Search Bar (Admin Only) */}
      {isAdmin && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cari ID, nama personil, email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
              />
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 bg-white"
              >
                <option value="ALL">Semua Peran (Roles)</option>
                <option value="ADMIN">ADMIN</option>
                <option value="LOGISTIK">LOGISTIK</option>
                <option value="SITE HEAD">SITE HEAD</option>
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 bg-white"
              >
                <option value="ALL">Semua Status Akun</option>
                <option value="Active">Active (Aktif)</option>
                <option value="Inactive">Inactive (Non-Aktif)</option>
              </select>
            </div>

            <div>
              <select
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 bg-white"
              >
                <option value="ALL">Semua Lokasi Otorisasi</option>
                <option value="Semua Lokasi">Semua Lokasi (Pusat)</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Employee ID</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Email Perusahaan</th>
                <th className="py-3 px-4 text-center">Peran (Role)</th>
                <th className="py-3 px-4">Lokasi Otorisasi</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 font-mono">Created Date</th>
                <th className="py-3 px-4 font-mono">Last Login</th>
                <th className="py-3 px-4 text-center">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ditemukan data akun sesuai filter yang dipilih.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const isUserActive = user.status === 'Active';
                  const isCurrent = user.id === currentUser?.id;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {user.employeeId}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{user.fullName}</span>
                          {isCurrent && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                              Anda
                            </span>
                          )}
                        </div>
                        {user.department && (
                          <div className="text-[11px] text-slate-400 font-normal">
                            {user.department}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {user.email}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                            user.role === 'ADMIN'
                              ? 'bg-emerald-900 text-white'
                              : user.role === 'SITE HEAD'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {user.authorizedLocation}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isUserActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isUserActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {user.createdDate}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {user.lastLogin || 'Belum Login'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isAdmin ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(user)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-slate-100 transition"
                              title="Ubah Akun & Peran"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-amber-700 hover:bg-slate-100 transition"
                              title="Reset Password Kredensial"
                            >
                              <Key className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              disabled={isCurrent}
                              className={`p-1.5 rounded-lg transition ${
                                isCurrent
                                  ? 'opacity-30 cursor-not-allowed text-slate-400'
                                  : isUserActive
                                  ? 'text-rose-600 hover:bg-rose-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                              title={isCurrent ? 'Tidak dapat menonaktifkan akun sendiri' : isUserActive ? 'Non-aktifkan Akun' : 'Aktifkan Akun'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Akses Dibatasi</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {isAdmin && totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredUsers.length)} dari {filteredUsers.length} akun
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-semibold text-slate-800">
                Halaman {currentPage} dari {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Account Modal (Admin Only) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-[#064e3b]">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Registrasi Akun Pengguna Baru
                  </h3>
                  <p className="text-xs text-slate-500">
                    Otorisasi kredensial karyawan PT IAS Support
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Employee ID (NIP)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: EMP-050"
                    value={formEmployeeId}
                    onChange={(e) => setFormEmployeeId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Surya Pratama"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Email Perusahaan</label>
                  <input
                    type="email"
                    required
                    placeholder="nama@pt-iassupport.co.id"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+62 812-..."
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Peran (Role)</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white font-bold"
                  >
                    <option value="LOGISTIK">LOGISTIK</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SITE HEAD">SITE HEAD</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-600 block mb-1 font-semibold">Lokasi Otorisasi Operasional</label>
                  <select
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    <option value="Semua Lokasi">Semua Lokasi (Pusat)</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Departemen / Divisi</label>
                <input
                  type="text"
                  placeholder="Contoh: Operasional Pergudangan Bandara CGK"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                <span className="font-bold">Keamanan Akun:</span> Pendaftaran publik dinonaktifkan. Akun dibuat secara terpusat oleh Administrator. Password acak awal akan diberikan dan wajib diganti pada saat login pertama.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46]"
              >
                Buat Akun
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Account Modal (Admin Only) */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Ubah Data & Peran Pengguna ({editingUser.employeeId})
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Email Perusahaan</label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Penugasan Peran</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white font-bold"
                  >
                    <option value="LOGISTIK">LOGISTIK</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SITE HEAD">SITE HEAD</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Status Akun</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    <option value="Active">Active (Aktif)</option>
                    <option value="Inactive">Inactive (Non-Aktif)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Lokasi Otorisasi</label>
                  <select
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    <option value="Semua Lokasi">Semua Lokasi</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Departemen</label>
                <input
                  type="text"
                  value={formDepartment}
                  onChange={(e) => setFormDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46]"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Password Reset Result Modal */}
      {resetResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">
                Kredensial Sementara Berhasil Dibuat
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Kredensial sementara telah di-generate untuk personil <strong>{resetResultModal.name}</strong> ({resetResultModal.email}):
            </p>

            <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 font-mono text-center text-sm font-extrabold text-slate-900 select-all tracking-wider mb-4">
              {resetResultModal.tempPass}
            </div>

            <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
              Karyawan wajib memperbarui kata sandi ini saat login berikutnya pada sistem Logistics Control Tower.
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setResetResultModal(null)}
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold text-xs"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
