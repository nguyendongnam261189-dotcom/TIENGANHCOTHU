import React, { useState, useEffect } from 'react';
import { User, Role } from '../types';
import { 
  getAllUsers, 
  getPendingUsers, 
  approveUser, 
  rejectUser, 
  updateUserRole 
} from '../services/firebaseService';

interface AdminUserPanelProps {
  currentUser: User;
  onBack: () => void;
}

type Tab = 'pending' | 'all';

const AdminUserPanel: React.FC<AdminUserPanelProps> = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const [allUsers, pending] = await Promise.all([
        getAllUsers(),
        getPendingUsers()
      ]);
      setUsers(allUsers);
      setPendingUsers(pending);
    } catch (err) {
      console.error('Load users error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await approveUser(userId);
      alert('✅ Đã phê duyệt user!');
      loadUsers();
    } catch (err) {
      console.error('Approve error:', err);
      alert('❌ Lỗi khi phê duyệt');
    }
  };

  const handleReject = async (userId: string, userName: string) => {
    if (!confirm(`Bạn có chắc muốn từ chối và xóa tài khoản "${userName}"?`)) return;
    
    try {
      await rejectUser(userId);
      alert('✅ Đã từ chối user!');
      loadUsers();
    } catch (err) {
      console.error('Reject error:', err);
      alert('❌ Lỗi khi từ chối');
    }
  };

  const handleChangeRole = async (userId: string, newRole: Role) => {
    try {
      await updateUserRole(userId, newRole);
      alert('✅ Đã cập nhật vai trò!');
      loadUsers();
    } catch (err) {
      console.error('Update role error:', err);
      alert('❌ Lỗi khi cập nhật');
    }
  };

  const getRoleBadge = (role: Role) => {
    switch (role) {
      case Role.ADMIN:
      case Role.LEADER:
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'Admin' };
      case Role.DEPUTY:
        return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Phó' };
      case Role.TEACHER:
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Giáo viên' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Thành viên' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div 
        className="text-white p-4 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-white/20 rounded-lg transition"
            >
              ← Quay lại
            </button>
            <div>
              <h1 className="text-xl font-bold">👥 Quản lý Người dùng</h1>
              <p className="text-red-100 text-sm">Phê duyệt và quản lý tài khoản</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-6 py-3 rounded-xl font-semibold transition flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-yellow-500 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            ⏳ Chờ duyệt
            {pendingUsers.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 rounded-xl font-semibold transition ${
              activeTab === 'all'
                ? 'bg-teal-600 text-white shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            👥 Tất cả ({users.length})
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Đang tải...</p>
          </div>
        ) : (
          <>
            {/* Pending Users Tab */}
            {activeTab === 'pending' && (
              <div className="space-y-4">
                {pendingUsers.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <p className="text-gray-500">Không có yêu cầu chờ duyệt!</p>
                  </div>
                ) : (
                  pendingUsers.map(user => (
                    <div key={user.id} className="bg-white rounded-xl p-5 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {user.avatar ? (
                            <img 
                              src={user.avatar} 
                              alt={user.name} 
                              className="w-14 h-14 rounded-full"
                            />
                          ) : (
                            <div className="w-14 h-14 bg-teal-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="font-bold text-gray-800">{user.name}</h3>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            <p className="text-xs text-gray-400">
                              Đăng ký: {user.createdAt?.toLocaleDateString('vi-VN')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(user.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                          >
                            ✓ Duyệt
                          </button>
                          <button
                            onClick={() => handleReject(user.id, user.name)}
                            className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium"
                          >
                            ✗ Từ chối
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* All Users Tab */}
            {activeTab === 'all' && (
              <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Người dùng</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Email</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Vai trò</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Trạng thái</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(user => {
                      const roleBadge = getRoleBadge(user.role);
                      const isCurrentUser = user.id === currentUser.id;
                      
                      return (
                        <tr key={user.id} className={`hover:bg-gray-50 ${isCurrentUser ? 'bg-teal-50' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {user.avatar ? (
                                <img src={user.avatar} alt="" className="w-10 h-10 rounded-full" />
                              ) : (
                                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center font-bold">
                                  {user.name.charAt(0)}
                                </div>
                              )}
                              <span className="font-medium">
                                {user.name}
                                {isCurrentUser && <span className="text-teal-600 text-xs ml-2">(Bạn)</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                          <td className="px-4 py-3 text-center">
                            <select
                              value={user.role}
                              onChange={(e) => handleChangeRole(user.id, e.target.value as Role)}
                              disabled={isCurrentUser}
                              className={`px-3 py-1 rounded-full text-xs font-medium border-0 ${roleBadge.bg} ${roleBadge.text} ${isCurrentUser ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <option value={Role.TEACHER}>Giáo viên</option>
                              <option value={Role.ADMIN}>Admin</option>
                              <option value={Role.LEADER}>Leader</option>
                              <option value={Role.DEPUTY}>Deputy</option>
                              <option value={Role.MEMBER}>Member</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {user.isApproved ? (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                ✓ Đã duyệt
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                                ⏳ Chờ duyệt
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {!isCurrentUser && (
                              <div className="flex justify-center gap-2">
                                {!user.isApproved && (
                                  <button
                                    onClick={() => handleApprove(user.id)}
                                    className="px-3 py-1 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 text-sm"
                                  >
                                    Duyệt
                                  </button>
                                )}
                                <button
                                  onClick={() => handleReject(user.id, user.name)}
                                  className="px-3 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 text-sm"
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUserPanel;
