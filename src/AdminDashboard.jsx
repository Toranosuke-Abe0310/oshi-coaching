import React, { useState, useEffect } from 'react';
import { Shield, Check, X, Search, Mail, Users, Calendar, UserPlus } from 'lucide-react';
import { supabase } from './supabaseClient';

const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState('pending'); // 'pending', 'approved', 'rejected'
  const [viewType, setViewType] = useState('client'); // 'client' or 'coaches'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [mainTab, setMainTab] = useState('applications'); // 'applications' or 'createCoach'

  // Supabaseから取得するデータ
  const [applications, setApplications] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);

  // コーチ登録フォームのstate
  const [coachForm, setCoachForm] = useState({
    userId: '',
    email: '',
    name: '',
    displayName: '',
    formerGroup: '',
    specialty: '',
    introduction: '',
    sessionPrice: '',
    availableDays: [],
    image: '🌸'
  });
  const [coachFormLoading, setCoachFormLoading] = useState(false);
  const [coachFormMessage, setCoachFormMessage] = useState({ type: '', text: '' });

  // 申し込みデータをSupabaseから取得
  const fetchApplications = async () => {
    setLoading(true);
    // applications テーブルを取得
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (appError) {
      console.error('applications取得エラー:', appError);
      setLoading(false);
      return;
    }

    if (!appData || appData.length === 0) {
      setApplications([]);
      setLoading(false);
      return;
    }

    // クライアントIDを収集してusersテーブルから名前/メールを取得
    const clientIds = [...new Set(appData.map(a => a.client_id).filter(Boolean))];
    const coachIds = [...new Set(appData.map(a => a.coach_id).filter(Boolean))];

    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', clientIds);

    const { data: coachesData } = await supabase
      .from('coaches')
      .select('user_id, display_name, former_group')
      .in('user_id', coachIds);

    const usersMap = {};
    (usersData || []).forEach(u => { usersMap[u.id] = u; });

    const coachesMap = {};
    (coachesData || []).forEach(c => { coachesMap[c.user_id] = c; });

    const enriched = appData.map(a => ({
      ...a,
      clientName: usersMap[a.client_id]?.name || usersMap[a.client_id]?.email || 'unknown',
      clientEmail: usersMap[a.client_id]?.email || '',
      coachName: coachesMap[a.coach_id]?.display_name || 'unknown',
      coachFormerGroup: coachesMap[a.coach_id]?.former_group || '',
      appliedDate: a.created_at ? new Date(a.created_at).toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }) : '-'
    }));

    setApplications(enriched);
    setLoading(false);
  };

  // コーチ一覧をSupabaseから取得
  const fetchCoaches = async () => {
    const { data: coachData, error } = await supabase
      .from('coaches')
      .select('*');
    if (error || !coachData) return;

    // usersテーブルからメールを別途取得
    const userIds = coachData.map(c => c.user_id).filter(Boolean);
    let usersMap = {};
    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);
      (usersData || []).forEach(u => { usersMap[u.id] = u; });
    }

    setCoaches(coachData.map(c => ({
      ...c,
      userEmail: usersMap[c.user_id]?.email || '',
      userName: usersMap[c.user_id]?.name || ''
    })));
  };

  useEffect(() => {
    fetchApplications();
    fetchCoaches();
  }, []);

  const handleCreateCoach = async (e) => {
    e.preventDefault();
    setCoachFormLoading(true);
    setCoachFormMessage({ type: '', text: '' });

    try {
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: coachForm.userId,
          email: coachForm.email,
          name: coachForm.name,
          user_type: 'coach'
        });
      if (userError) throw new Error('usersテーブルへの登録失敗: ' + userError.message);

      const { error: coachError } = await supabase
        .from('coaches')
        .insert({
          user_id: coachForm.userId,
          display_name: coachForm.displayName,
          former_group: coachForm.formerGroup,
          specialty: coachForm.specialty,
          introduction: coachForm.introduction,
          session_price: coachForm.sessionPrice,
          available_days: coachForm.availableDays,
          image: coachForm.image,
          clients_count: 0
        });
      if (coachError) throw new Error('coachesテーブルへの登録失敗: ' + coachError.message);

      setCoachFormMessage({ type: 'success', text: `${coachForm.displayName}さんのコーチアカウントを登録しました！` });
      setCoachForm({
        userId: '', email: '', name: '', displayName: '',
        formerGroup: '', specialty: '', introduction: '',
        sessionPrice: '', availableDays: [], image: '🌸'
      });
      fetchCoaches();
    } catch (err) {
      setCoachFormMessage({ type: 'error', text: err.message });
    } finally {
      setCoachFormLoading(false);
    }
  };

  const toggleDay = (day) => {
    setCoachForm(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const handleApprove = async (application) => {
    const { error } = await supabase
      .from('applications')
      .update({ status: 'approved' })
      .eq('id', application.id);
    if (error) {
      alert('エラーが発生しました: ' + error.message);
      return;
    }
    setApplications(prev => prev.map(a =>
      a.id === application.id ? { ...a, status: 'approved' } : a
    ));
    setSelectedApplication(null);
    alert(`${application.clientName}さんの申し込みを承認しました。\n次回ログイン時にコーチが表示されます。`);
  };

  const handleReject = async (application) => {
    const reason = prompt('却下理由を入力してください（任意）');
    if (reason === null) return; // キャンセル

    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('id', application.id);
    if (error) {
      alert('エラーが発生しました: ' + error.message);
      return;
    }
    setApplications(prev => prev.map(a =>
      a.id === application.id ? { ...a, status: 'rejected' } : a
    ));
    setSelectedApplication(null);
    alert(`${application.clientName}さんの申し込みを却下しました。`);
  };

  const getFilteredApplications = () => {
    let data = applications.filter(a => {
      if (currentView === 'pending') return a.status === 'pending';
      if (currentView === 'approved') return a.status === 'approved';
      if (currentView === 'rejected') return a.status === 'rejected';
      return true;
    });
    if (searchQuery) {
      data = data.filter(item => {
        const text = `${item.clientName} ${item.clientEmail} ${item.coachName}`;
        return text.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }
    return data;
  };

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const approvedCount = applications.filter(a => a.status === 'approved').length;
  const rejectedCount = applications.filter(a => a.status === 'rejected').length;

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
        {/* メインタブ */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm p-2 inline-flex gap-2">
            <button
              onClick={() => setMainTab('applications')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                mainTab === 'applications' ? 'bg-pink-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              申し込み管理
            </button>
            <button
              onClick={() => setMainTab('createCoach')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                mainTab === 'createCoach' ? 'bg-pink-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              コーチ登録
            </button>
          </div>
        </div>

        {/* コーチ登録フォーム */}
        {mainTab === 'createCoach' && (
          <div className="max-w-2xl">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-blue-800 mb-2">📋 コーチ登録の手順</h3>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                <li>Supabaseダッシュボード → Authentication → Users → <strong>「Add user」</strong></li>
                <li>コーチのメール・パスワードを設定してユーザーを作成</li>
                <li>作成されたユーザーの <strong>UUID をコピー</strong></li>
                <li>下のフォームにUUIDとプロフィール情報を入力して登録</li>
              </ol>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">コーチアカウント登録</h2>

              {coachFormMessage.text && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${
                  coachFormMessage.type === 'error'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-green-50 text-green-600 border border-green-200'
                }`}>
                  {coachFormMessage.text}
                </div>
              )}

              <form onSubmit={handleCreateCoach} className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <p className="text-sm font-medium text-gray-700">Supabaseから取得する情報</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ユーザーUUID <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={coachForm.userId}
                      onChange={e => setCoachForm({...coachForm, userId: e.target.value})}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500 font-mono text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      value={coachForm.email}
                      onChange={e => setCoachForm({...coachForm, email: e.target.value})}
                      placeholder="coach@example.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">本名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={coachForm.name}
                    onChange={e => setCoachForm({...coachForm, name: e.target.value})}
                    placeholder="山田 花子"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">表示名 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={coachForm.displayName}
                    onChange={e => setCoachForm({...coachForm, displayName: e.target.value})}
                    placeholder="山田 花子"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">元所属グループ</label>
                  <input
                    type="text"
                    value={coachForm.formerGroup}
                    onChange={e => setCoachForm({...coachForm, formerGroup: e.target.value})}
                    placeholder="StarLight"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">専門分野</label>
                  <input
                    type="text"
                    value={coachForm.specialty}
                    onChange={e => setCoachForm({...coachForm, specialty: e.target.value})}
                    placeholder="キャリア相談"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">自己紹介</label>
                  <textarea
                    value={coachForm.introduction}
                    onChange={e => setCoachForm({...coachForm, introduction: e.target.value})}
                    placeholder="アイドル時代の経験を活かし..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500 h-24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">セッション料金</label>
                  <input
                    type="text"
                    value={coachForm.sessionPrice}
                    onChange={e => setCoachForm({...coachForm, sessionPrice: e.target.value})}
                    placeholder="10,000円/60分"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">対応可能曜日</label>
                  <div className="flex gap-2 flex-wrap">
                    {['月', '火', '水', '木', '金', '土', '日'].map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-2 rounded-lg border-2 transition-colors text-sm ${
                          coachForm.availableDays.includes(day)
                            ? 'border-pink-500 bg-pink-50 text-pink-600'
                            : 'border-gray-300 text-gray-600 hover:border-pink-300'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">アイコン絵文字</label>
                  <div className="flex gap-2 flex-wrap">
                    {['🌸', '⭐', '🌟', '💖', '🎀', '🌺', '✨', '🦋'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setCoachForm({...coachForm, image: emoji})}
                        className={`w-10 h-10 text-xl rounded-lg border-2 transition-colors ${
                          coachForm.image === emoji ? 'border-pink-500 bg-pink-50' : 'border-gray-200 hover:border-pink-300'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={coachFormLoading}
                  className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                    coachFormLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-pink-500 hover:bg-pink-600'
                  }`}
                >
                  {coachFormLoading ? '登録中...' : 'コーチアカウントを登録する'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* 申し込み管理 */}
        {mainTab === 'applications' && (<>
        {/* タブ切り替え */}
        <div className="mb-6">
          <div className="bg-white rounded-xl shadow-sm p-2 inline-flex gap-2">
            <button
              onClick={() => { setViewType('client'); setSelectedApplication(null); }}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                viewType === 'client' ? 'bg-pink-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              クライアント申し込み管理
            </button>
            <button
              onClick={() => { setViewType('coaches'); setSelectedApplication(null); }}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                viewType === 'coaches' ? 'bg-pink-500 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              コーチアカウント管理
            </button>
          </div>
        </div>

        {/* クライアント申し込み管理 */}
        {viewType === 'client' && (<>
          {/* 統計カード */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border-l-4 border-yellow-400">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">承認待ち</p>
                  <p className="text-3xl font-bold text-gray-800">{pendingCount}</p>
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
                  <p className="text-3xl font-bold text-gray-800">{approvedCount}</p>
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
                  <p className="text-3xl font-bold text-gray-800">{rejectedCount}</p>
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
                {[
                  { key: 'pending', label: '承認待ち', count: pendingCount, color: 'yellow' },
                  { key: 'approved', label: '承認済み', count: approvedCount, color: 'green' },
                  { key: 'rejected', label: '却下済み', count: rejectedCount, color: 'red' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setCurrentView(tab.key)}
                    className={`py-4 px-2 border-b-2 font-medium transition-colors ${
                      currentView === tab.key
                        ? `border-${tab.color}-500 text-${tab.color}-600`
                        : 'border-transparent text-gray-600'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="名前、メール、コーチ名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                />
              </div>
            </div>
          </div>

          {/* リスト or 詳細 */}
          {loading ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm">
              <p className="text-gray-500">読み込み中...</p>
            </div>
          ) : !selectedApplication ? (
            <div className="space-y-4">
              {getFilteredApplications().length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                  <p className="text-gray-500">該当するデータがありません</p>
                </div>
              ) : (
                getFilteredApplications().map(item => (
                  <div
                    key={item.id}
                    onClick={() => currentView === 'pending' && setSelectedApplication(item)}
                    className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 transition-all ${
                      currentView === 'pending' ? 'hover:border-pink-300 hover:shadow-md cursor-pointer' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-800">{item.clientName}</h3>
                          <span className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs">
                            → {item.coachName}
                          </span>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            item.status === 'approved' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.status === 'pending' ? '承認待ち' : item.status === 'approved' ? '承認済み' : '却下済み'}
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
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm text-gray-500">{item.appliedDate}</p>
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
                  <h2 className="text-2xl font-bold text-gray-800 mb-1">{selectedApplication.clientName}</h2>
                  <p className="text-gray-600">クライアント申し込み詳細</p>
                </div>

                <div className="p-6">
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
                          <p className="text-sm text-gray-600">申し込み日時</p>
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
                        onClick={() => handleReject(selectedApplication)}
                        className="flex-1 bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 transition-colors font-medium flex items-center justify-center gap-2"
                      >
                        <X className="w-5 h-5" />
                        却下する
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>承認すると：</strong>このクライアントが次回ログイン時に{selectedApplication.coachName}さんのページに自動的に移動します。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>)}

        {/* コーチアカウント管理 */}
        {viewType === 'coaches' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-500">登録済みコーチ: {coaches.length}名</p>
              <button
                onClick={fetchCoaches}
                className="text-sm text-pink-600 hover:text-pink-700"
              >
                更新
              </button>
            </div>
            {coaches.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                <p className="text-gray-500">登録済みコーチがいません</p>
              </div>
            ) : (
              coaches.map(coach => (
                <div key={coach.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center text-3xl">
                      {coach.image || '🌸'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-800">{coach.display_name}</h3>
                        {coach.former_group && (
                          <span className="bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full text-xs">
                            元{coach.former_group}
                          </span>
                        )}
                      </div>
                      {coach.specialty && (
                        <p className="text-sm text-gray-600">専門: {coach.specialty}</p>
                      )}
                      {coach.userEmail && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                          <Mail className="w-3 h-3" />
                          <span>{coach.userEmail}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-pink-600">
                        <Users className="w-4 h-4" />
                        <span className="font-bold">{coach.clients_count || 0}名</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        </>)}
      </div>
    </div>
  );
};

export default AdminDashboard;
