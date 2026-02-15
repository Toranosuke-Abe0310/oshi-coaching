import React, { useState } from 'react';
import { Shield, Check, X, Search, Mail, Phone, Users, Calendar } from 'lucide-react';

const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [viewType, setViewType] = useState('client'); // 'client' or 'coach' applications
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);

  // サンプルデータ - 承認待ちのコーチアカウント申請
  const [pendingCoachApplications, setPendingCoachApplications] = useState([
    {
      id: 1,
      name: '佐々木 愛美',
      email: 'aimi.sasaki@example.com',
      phoneNumber: '090-1234-5678',
      formerGroup: 'Starlight',
      specialty: 'キャリア相談',
      appliedDate: '2024-01-26',
      status: 'pending'
    },
  ]);

  // 新規追加：クライアント→コーチへの申し込み管理
  const [pendingClientApplications, setPendingClientApplications] = useState([
    {
      id: 101,
      clientName: '山田太郎',
      clientEmail: 'taro.yamada@example.com',
      coachId: 1,
      coachName: '桜井 美咲',
      message: 'はじめまして。キャリアの方向性について悩んでおり、ぜひ桜井さんにコーチングをお願いしたいと思っています。月曜日と水曜日の夕方が希望です。',
      appliedDate: '2024-01-28 10:30',
      status: 'pending'
    },
    {
      id: 102,
      clientName: '佐々木花子',
      clientEmail: 'hanako.sasaki@example.com',
      coachId: 1,
      coachName: '桜井 美咲',
      message: '人間関係で悩んでいます。アイドル時代の経験を持つ桜井さんなら相談しやすいと思い、申し込みました。よろしくお願いします。',
      appliedDate: '2024-01-27 15:20',
      status: 'pending'
    },
  ]);

  const [approvedClientApplications, setApprovedClientApplications] = useState([]);

  const [approvedCoaches, setApprovedCoaches] = useState([
    {
      id: 101,
      name: '桜井 美咲',
      email: 'misaki.sakurai@example.com',
      formerGroup: 'StarLight',
      specialty: 'キャリア相談',
      approvedDate: '2024-01-15',
      clientCount: 12
    },
    {
      id: 102,
      name: '田中 優花',
      email: 'yuka.tanaka@example.com',
      formerGroup: 'Rainbow48',
      specialty: '自己啓発',
      approvedDate: '2024-01-10',
      clientCount: 8
    },
  ]);

  const [rejectedApplications, setRejectedApplications] = useState([
    {
      id: 201,
      name: '伊藤 花子',
      email: 'hanako.ito@example.com',
      formerGroup: 'Unknown',
      specialty: '不明',
      rejectedDate: '2024-01-20',
      reason: '所属グループの確認が取れませんでした'
    },
  ]);

  const handleApprove = (application) => {
    if (viewType === 'coach') {
      // コーチアカウント承認
      const approved = {
        ...application,
        approvedDate: new Date().toISOString().split('T')[0],
        clientCount: 0
      };
      setApprovedCoaches([...approvedCoaches, approved]);
      setPendingCoachApplications(pendingCoachApplications.filter(app => app.id !== application.id));
      setSelectedApplication(null);
      alert(`${application.name}さんのコーチアカウントを承認しました。`);
    } else {
      // クライアント申し込み承認（コーチに通知を送る）
      const approved = {
        ...application,
        approvedDate: new Date().toISOString().split('T')[0]
      };
      setApprovedClientApplications([...approvedClientApplications, approved]);
      setPendingClientApplications(pendingClientApplications.filter(app => app.id !== application.id));
      setSelectedApplication(null);
      alert(`${application.clientName}さんの申し込みを承認しました。\n\n${application.coachName}さんに通知が送信されます。`);
    }
  };

  const handleReject = (application, reason) => {
    if (viewType === 'coach') {
      // コーチアカウント却下
      const rejected = {
        ...application,
        rejectedDate: new Date().toISOString().split('T')[0],
        reason: reason || '条件を満たしていません'
      };
      setRejectedApplications([...rejectedApplications, rejected]);
      setPendingCoachApplications(pendingCoachApplications.filter(app => app.id !== application.id));
      setSelectedApplication(null);
      alert(`${application.name}さんのコーチアカウント申請を却下しました。`);
    } else {
      // クライアント申し込み却下
      const rejected = {
        ...application,
        rejectedDate: new Date().toISOString().split('T')[0],
        reason: reason || '申し込みを受け付けられませんでした'
      };
      setRejectedApplications([...rejectedApplications, rejected]);
      setPendingClientApplications(pendingClientApplications.filter(app => app.id !== application.id));
      setSelectedApplication(null);
      alert(`${application.clientName}さんの申し込みを却下しました。`);
    }
  };

  const getFilteredData = () => {
    let data = [];
    if (viewType === 'coach') {
      if (currentView === 'pending') data = pendingCoachApplications;
      else if (currentView === 'approved') data = approvedCoaches;
      else if (currentView === 'rejected') data = rejectedApplications.filter(r => r.name);
    } else {
      if (currentView === 'pending') data = pendingClientApplications;
      else if (currentView === 'approved') data = approvedClientApplications;
      else if (currentView === 'rejected') data = rejectedApplications.filter(r => r.clientName);
    }

    if (searchQuery) {
      return data.filter(item => {
        const searchText = viewType === 'coach' 
          ? `${item.name} ${item.email} ${item.formerGroup}` 
          : `${item.clientName} ${item.coachName} ${item.clientEmail}`;
        return searchText.includes(searchQuery);
      });
    }
    return data;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-pink-500" />
              <div>
                <h1 className="text-xl font-bold text-gray-800">推しコーチング 管理画面</h1>
                <p className="text-sm text-gray-600">コーチアカウント管理</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* タブ切り替え: クライアント申し込み vs コーチアカウント */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm p-2 inline-flex gap-2">
            <button
              onClick={() => {
                setViewType('client');
                setSelectedApplication(null);
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                viewType === 'client'
                  ? 'bg-pink-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              クライアント申し込み管理
            </button>
            <button
              onClick={() => {
                setViewType('coach');
                setSelectedApplication(null);
              }}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                viewType === 'coach'
                  ? 'bg-pink-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              コーチアカウント管理
            </button>
          </div>
        </div>

        {/* 統計カード */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-yellow-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">承認待ち</p>
                <p className="text-3xl font-bold text-gray-800">
                  {viewType === 'client' ? pendingClientApplications.length : pendingCoachApplications.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-green-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">承認済み</p>
                <p className="text-3xl font-bold text-gray-800">
                  {viewType === 'client' ? approvedClientApplications.length : approvedCoaches.length}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-red-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">却下済み</p>
                <p className="text-3xl font-bold text-gray-800">
                  {rejectedApplications.filter(r => viewType === 'client' ? r.clientName : r.name).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <X className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* タブ・検索バー */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <div className="flex gap-4 px-6">
              <button
                onClick={() => setCurrentView('pending')}
                className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                  currentView === 'pending'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-600 hover:text-yellow-600'
                }`}
              >
                承認待ち ({viewType === 'client' ? pendingClientApplications.length : pendingCoachApplications.length})
              </button>
              <button
                onClick={() => setCurrentView('approved')}
                className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                  currentView === 'approved'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-green-600'
                }`}
              >
                承認済み ({viewType === 'client' ? approvedClientApplications.length : approvedCoaches.length})
              </button>
              <button
                onClick={() => setCurrentView('rejected')}
                className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                  currentView === 'rejected'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-600 hover:text-red-600'
                }`}
              >
                却下済み ({rejectedApplications.filter(r => viewType === 'client' ? r.clientName : r.name).length})
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="名前、メール、グループ名で検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>
        </div>

        {/* リスト表示 */}
        {!selectedApplication ? (
          <div className="space-y-4">
            {getFilteredData().length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                <p className="text-gray-500">該当するデータがありません</p>
              </div>
            ) : (
              getFilteredData().map((item) => (
                <div
                  key={item.id}
                  onClick={() => currentView === 'pending' && setSelectedApplication(item)}
                  className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all ${
                    currentView === 'pending' ? 'hover:border-pink-300 hover:shadow-md cursor-pointer' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {viewType === 'coach' ? (
                        // コーチアカウント表示
                        <>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-800">{item.name}</h3>
                            <span className="inline-block bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-xs">
                              {item.formerGroup}
                            </span>
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span>{item.email}</span>
                            </div>
                            {item.phoneNumber && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <span>{item.phoneNumber}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <span className="font-medium">専門分野:</span>
                              <span>{item.specialty}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        // クライアント申し込み表示
                        <>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-bold text-gray-800">{item.clientName}</h3>
                            <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs">
                              → {item.coachName}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm text-gray-600">
                            {item.clientEmail && (
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                <span>{item.clientEmail}</span>
                              </div>
                            )}
                            {item.message && (
                              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <p className="text-gray-700">{item.message}</p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <div className="text-right">
                      {currentView === 'pending' && (
                        <p className="text-sm text-gray-600">申請日: {item.appliedDate}</p>
                      )}
                      {currentView === 'approved' && (
                        <>
                          <p className="text-sm text-gray-600 mb-1">承認日: {item.approvedDate}</p>
                          {viewType === 'coach' && item.clientCount !== undefined && (
                            <div className="flex items-center gap-2 justify-end text-pink-600">
                              <Users className="w-4 h-4" />
                              <span className="font-bold">{item.clientCount}名</span>
                            </div>
                          )}
                        </>
                      )}
                      {currentView === 'rejected' && (
                        <>
                          <p className="text-sm text-gray-600 mb-1">却下日: {item.rejectedDate}</p>
                          <p className="text-xs text-red-600">理由: {item.reason}</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          // 詳細・承認画面
          <div>
            <button
              onClick={() => setSelectedApplication(null)}
              className="mb-4 text-pink-600 hover:text-pink-700 flex items-center gap-2"
            >
              ← 一覧に戻る
            </button>

            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-pink-50 to-white p-6 border-b border-pink-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">
                  {viewType === 'coach' ? selectedApplication.name : selectedApplication.clientName}
                </h2>
                <p className="text-gray-600">
                  {viewType === 'coach' ? 'コーチアカウント申請詳細' : 'クライアント申し込み詳細'}
                </p>
              </div>

              <div className="p-6">
                {viewType === 'coach' ? (
                  // コーチアカウント詳細
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">基本情報</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">お名前</p>
                          <p className="font-medium text-gray-800">{selectedApplication.name}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">メールアドレス</p>
                          <p className="font-medium text-gray-800">{selectedApplication.email}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">電話番号</p>
                          <p className="font-medium text-gray-800">{selectedApplication.phoneNumber}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-700 mb-3">コーチ情報</h3>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">元所属グループ</p>
                          <p className="font-medium text-gray-800">{selectedApplication.formerGroup}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">専門分野</p>
                          <p className="font-medium text-gray-800">{selectedApplication.specialty}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">申請日</p>
                          <p className="font-medium text-gray-800">{selectedApplication.appliedDate}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // クライアント申し込み詳細
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-700 mb-3">申し込み情報</h3>
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">クライアント名</p>
                          <p className="font-medium text-gray-800">{selectedApplication.clientName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">メールアドレス</p>
                          <p className="font-medium text-gray-800">{selectedApplication.clientEmail}</p>
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">希望コーチ</p>
                          <p className="font-medium text-gray-800">{selectedApplication.coachName}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">申し込み日</p>
                          <p className="font-medium text-gray-800">{selectedApplication.appliedDate}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">申し込みメッセージ</p>
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <p className="text-gray-800">{selectedApplication.message}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="font-medium text-gray-700 mb-3">承認・却下</h3>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleApprove(selectedApplication)}
                      className="flex-1 bg-green-500 text-white py-3 rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      承認する
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('却下理由を入力してください(任意)');
                        if (reason !== null) {
                          handleReject(selectedApplication, reason);
                        }
                      }}
                      className="flex-1 bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" />
                      却下する
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>注意:</strong> 承認後、申請者にメールで通知が送信されます。却下の場合も通知されますので、適切な理由を入力してください。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
