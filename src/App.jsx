import React, { useState } from 'react';
import { Heart, MessageCircle, Users, Calendar, FileText, Settings, LogOut, Menu, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const OshiCoachingApp = () => {
  // デモモード: trueにするとログイン済みの画面が直接表示されます
  const [demoMode] = useState(true);
  
  const [userType, setUserType] = useState(demoMode ? 'client' : null); // 'coach' or 'client'
  const [authView, setAuthView] = useState(null); // 'login' or 'register'
  const [isLoggedIn, setIsLoggedIn] = useState(demoMode ? true : false);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // フォームステート
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    name: '',
    formerGroup: '',
    specialty: '',
    phoneNumber: ''
  });
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [clientDetailView, setClientDetailView] = useState('overview'); // 'overview', 'files', 'sessions'
  
  // スケジュール管理用のstate
  const [scheduleEvents, setScheduleEvents] = useState([
    { id: 1, clientId: 1, clientName: '佐藤太郎', date: '2024-01-30', time: '14:00', duration: '60分', type: 'セッション' },
    { id: 2, clientId: 2, clientName: '鈴木花子', date: '2024-02-01', time: '10:00', duration: '60分', type: 'セッション' },
    { id: 3, clientId: 3, clientName: '高橋健太', date: '2024-01-29', time: '16:00', duration: '60分', type: 'セッション' },
  ]);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    clientId: '',
    date: '',
    time: '',
    duration: '60分',
    type: 'セッション'
  });
  
  // ファイルアップロード用のstate
  const [uploadedFiles, setUploadedFiles] = useState({});
  const fileInputRef = React.useRef(null);
  const clientFileInputRef = React.useRef(null); // クライアント側用
  
  // 設定画面用のstate
  const [settingsTab, setSettingsTab] = useState('account'); // 'account', 'profile', 'notifications'
  const [coachProfile, setCoachProfile] = useState({
    displayName: '桜井 美咲',
    formerGroup: 'StarLight',
    specialty: 'キャリア相談',
    introduction: 'アイドル時代の経験を活かし、夢に向かって頑張るあなたをサポートします。一緒に目標達成を目指しましょう!',
    sessionPrice: '10,000円/60分',
    availableDays: ['月', '水', '金'],
    image: '🌸'
  });
  const [notifications, setNotifications] = useState([
    // コーチへの通知は管理画面で承認後に届く
  ]);
  
  // クライアント（ファン）側の画面分岐用
  const [clientViewType, setClientViewType] = useState(null); // 'search' or 'mycoach'
  const [currentCoachIndex, setCurrentCoachIndex] = useState(0);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [clientMyCoachTab, setClientMyCoachTab] = useState('messages'); // 'messages', 'schedule', 'files'
  const [clientFiles, setClientFiles] = useState([
    { id: 1, name: '目標シート.xlsx', uploadDate: '2024-01-20', size: '45KB' },
    { id: 2, name: 'セッション記録_1月.pdf', uploadDate: '2024-01-25', size: '128KB' }
  ]);

  // サンプルデータ
  const coaches = [
    { 
      id: 1, 
      name: '桜井 美咲', 
      former_group: 'StarLight', 
      specialty: 'キャリア相談', 
      image: '🌸', 
      clients: 12,
      introduction: 'アイドル時代の経験を活かし、夢に向かって頑張るあなたをサポートします。一緒に目標達成を目指しましょう!',
      sessionPrice: '10,000円/60分',
      availableDays: ['月', '水', '金']
    },
    { 
      id: 2, 
      name: '田中 優花', 
      former_group: 'Rainbow48', 
      specialty: '自己啓発', 
      image: '🌈', 
      clients: 8,
      introduction: '自分らしく輝けるよう、全力でサポートします。一緒に新しい自分を見つけましょう!',
      sessionPrice: '8,000円/60分',
      availableDays: ['火', '木', '土']
    },
    { 
      id: 3, 
      name: '山田 彩花', 
      former_group: 'Crystal☆', 
      specialty: '人間関係', 
      image: '💎', 
      clients: 15,
      introduction: '人間関係の悩みに寄り添います。コミュニケーション力を一緒に高めていきましょう!',
      sessionPrice: '12,000円/60分',
      availableDays: ['月', '火', '金', '土']
    },
  ];

  const clients = [
    { 
      id: 1, 
      name: '佐藤太郎', 
      coachId: 1, 
      joinDate: '2024-01-15', 
      sessions: 5, 
      lastMessage: '2024-01-25',
      nextSession: '2024-01-30 14:00',
      memo: '前回のセッションで目標設定について話し合い。次回はアクションプランの進捗確認。',
      files: [
        { id: 1, name: '目標シート.xlsx', uploadDate: '2024-01-20', size: '45KB' },
        { id: 2, name: '進捗レポート.pdf', uploadDate: '2024-01-22', size: '128KB' }
      ]
    },
    { 
      id: 2, 
      name: '鈴木花子', 
      coachId: 1, 
      joinDate: '2024-01-20', 
      sessions: 3, 
      lastMessage: '2024-01-26',
      nextSession: '2024-02-01 10:00',
      memo: 'キャリアチェンジを検討中。業界研究のサポートが必要。',
      files: [
        { id: 3, name: '自己分析シート.xlsx', uploadDate: '2024-01-21', size: '32KB' }
      ]
    },
    { 
      id: 3, 
      name: '高橋健太', 
      coachId: 1, 
      joinDate: '2023-12-10', 
      sessions: 12, 
      lastMessage: '2024-01-27',
      nextSession: '2024-01-29 16:00',
      memo: '長期クライアント。継続的な成長サポート中。自己効力感が高まってきている。',
      files: [
        { id: 4, name: '月次振り返り_1月.xlsx', uploadDate: '2024-01-25', size: '58KB' },
        { id: 5, name: '年間目標.pdf', uploadDate: '2024-01-10', size: '95KB' },
        { id: 6, name: 'セッション記録.docx', uploadDate: '2024-01-27', size: '112KB' }
      ]
    },
  ];

  const messages = [
    { id: 1, sender: 'client', text: 'こんにちは!今週のセッションの準備ができました。', time: '10:30' },
    { id: 2, sender: 'coach', text: 'ありがとうございます!今週も頑張りましょう✨', time: '10:45' },
    { id: 3, sender: 'client', text: '先週のアドバイスを実践してみて、少し変化が出てきました!', time: '11:00' },
  ];

  // ログイン選択画面(最初の画面)
  if (!userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <Heart className="w-16 h-16 text-pink-400 mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-gray-800 mb-2">推しコーチング</h1>
            <p className="text-gray-600">あなたの推しが、あなたの人生をサポート</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div 
              onClick={() => {
                setUserType('coach');
                setAuthView('login');
              }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-pink-200"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-pink-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">コーチとして</h2>
                <p className="text-gray-600">ファンの成長をサポート</p>
              </div>
            </div>

            <div 
              onClick={() => {
                setUserType('client');
                setAuthView('login');
              }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-pink-200"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-10 h-10 text-pink-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">ファンとして</h2>
                <p className="text-gray-600">推しからコーチングを受ける</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ログイン・新規登録画面
  if (userType && !isLoggedIn) {
    const handleLogin = (e) => {
      e.preventDefault();
      // 実際はバックエンドでの認証処理
      setIsLoggedIn(true);
    };

    const handleRegister = (e) => {
      e.preventDefault();
      // 実際はバックエンドでの登録処理
      if (userType === 'coach') {
        alert('アカウント申請を受け付けました。承認までお待ちください。');
        setUserType(null);
        setAuthView(null);
      } else {
        setIsLoggedIn(true);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <button
            onClick={() => {
              setUserType(null);
              setAuthView(null);
            }}
            className="mb-4 text-pink-600 hover:text-pink-700 flex items-center gap-2"
          >
            ← 戻る
          </button>

          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-pink-400 mx-auto mb-3" />
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                {userType === 'coach' ? 'コーチ' : 'ファン'}
                {authView === 'login' ? 'ログイン' : '新規登録'}
              </h2>
              {userType === 'coach' && authView === 'register' && (
                <p className="text-sm text-gray-600 mt-2">
                  ※コーチアカウントは承認制です
                </p>
              )}
            </div>

            {authView === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({...loginForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-pink-500 text-white py-3 rounded-lg hover:bg-pink-600 transition-colors font-medium"
                >
                  ログイン
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAuthView('register')}
                    className="text-pink-600 hover:text-pink-700 text-sm"
                  >
                    新規登録はこちら
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    お名前
                  </label>
                  <input
                    type="text"
                    value={registerForm.name}
                    onChange={(e) => setRegisterForm({...registerForm, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    パスワード
                  </label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                    required
                  />
                </div>

                {userType === 'coach' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        元所属グループ
                      </label>
                      <input
                        type="text"
                        value={registerForm.formerGroup}
                        onChange={(e) => setRegisterForm({...registerForm, formerGroup: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                        placeholder="例: StarLight"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        専門分野
                      </label>
                      <input
                        type="text"
                        value={registerForm.specialty}
                        onChange={(e) => setRegisterForm({...registerForm, specialty: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                        placeholder="例: キャリア相談"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        電話番号
                      </label>
                      <input
                        type="tel"
                        value={registerForm.phoneNumber}
                        onChange={(e) => setRegisterForm({...registerForm, phoneNumber: e.target.value})}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                        placeholder="000-0000-0000"
                        required
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  className="w-full bg-pink-500 text-white py-3 rounded-lg hover:bg-pink-600 transition-colors font-medium"
                >
                  {userType === 'coach' ? '申請する' : '登録する'}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAuthView('login')}
                    className="text-pink-600 hover:text-pink-700 text-sm"
                  >
                    ログインはこちら
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  // コーチ側のダッシュボード
  if (userType === 'coach') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-400" />
              <h1 className="text-xl font-bold text-gray-800">推しコーチング - コーチ</h1>
            </div>
            <button 
              onClick={() => {
                setUserType(null);
                setIsLoggedIn(false);
                setAuthView(null);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* サイドバー */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <nav className="space-y-2">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'dashboard' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span>クライアント一覧</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('calendar')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'calendar' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Calendar className="w-5 h-5" />
                    <span>スケジュール</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('settings')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'settings' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Settings className="w-5 h-5" />
                    <span>設定</span>
                  </button>
                </nav>
              </div>
            </div>

            {/* メインコンテンツ */}
            <div className="lg:col-span-3">
              {currentView === 'settings' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">設定</h2>
                    <p className="text-gray-600">アカウント・プロフィール・通知の管理</p>
                  </div>

                  {/* タブナビゲーション */}
                  <div className="bg-white rounded-xl shadow-sm mb-6">
                    <div className="border-b border-gray-200">
                      <div className="flex gap-4 px-6">
                        <button
                          onClick={() => setSettingsTab('account')}
                          className={`py-4 px-2 border-b-2 font-medium ${
                            settingsTab === 'account'
                              ? 'border-pink-500 text-pink-600'
                              : 'border-transparent text-gray-600 hover:text-pink-600'
                          }`}
                        >
                          アカウント
                        </button>
                        <button
                          onClick={() => setSettingsTab('profile')}
                          className={`py-4 px-2 border-b-2 font-medium ${
                            settingsTab === 'profile'
                              ? 'border-pink-500 text-pink-600'
                              : 'border-transparent text-gray-600 hover:text-pink-600'
                          }`}
                        >
                          コーチ一覧用プロフィール
                        </button>
                        <button
                          onClick={() => setSettingsTab('notifications')}
                          className={`py-4 px-2 border-b-2 font-medium relative ${
                            settingsTab === 'notifications'
                              ? 'border-pink-500 text-pink-600'
                              : 'border-transparent text-gray-600 hover:text-pink-600'
                          }`}
                        >
                          通知
                          {notifications.filter(n => !n.read).length > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                              {notifications.filter(n => !n.read).length}
                            </span>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* アカウントタブ */}
                  {settingsTab === 'account' && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-gray-200">
                        <h3 className="font-bold text-gray-800 mb-4">アカウント情報</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-800">メールアドレス</p>
                              <p className="text-sm text-gray-600">coach@example.com</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-800">名前</p>
                              <p className="text-sm text-gray-600">桜井 美咲</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-800">元所属グループ</p>
                              <p className="text-sm text-gray-600">StarLight</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-800">専門分野</p>
                              <p className="text-sm text-gray-600">キャリア相談</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <h3 className="font-bold text-gray-800 mb-4">ログアウト</h3>
                        <button
                          onClick={() => {
                            if (confirm('ログアウトしますか？')) {
                              setUserType(null);
                              setIsLoggedIn(false);
                              setAuthView(null);
                              setCurrentView('dashboard');
                              setSelectedClient(null);
                            }
                          }}
                          className="w-full px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 font-medium"
                        >
                          <LogOut className="w-5 h-5" />
                          ログアウト
                        </button>
                        <p className="text-sm text-gray-600 mt-3 text-center">
                          ログアウトすると、最初の画面に戻ります
                        </p>
                      </div>
                    </div>
                  )}

                  {/* プロフィールタブ */}
                  {settingsTab === 'profile' && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="p-6">
                        <div className="mb-6">
                          <h3 className="font-bold text-gray-800 mb-2">コーチ一覧用プロフィール</h3>
                          <p className="text-sm text-gray-600">ファンの方がコーチを選ぶ際に表示されるプロフィールです</p>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              表示名
                            </label>
                            <input
                              type="text"
                              value={coachProfile.displayName}
                              onChange={(e) => setCoachProfile({...coachProfile, displayName: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              元所属グループ
                            </label>
                            <input
                              type="text"
                              value={coachProfile.formerGroup}
                              onChange={(e) => setCoachProfile({...coachProfile, formerGroup: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              専門分野
                            </label>
                            <input
                              type="text"
                              value={coachProfile.specialty}
                              onChange={(e) => setCoachProfile({...coachProfile, specialty: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                              placeholder="例: キャリア相談、人間関係、メンタルヘルス"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              自己紹介
                            </label>
                            <textarea
                              value={coachProfile.introduction}
                              onChange={(e) => setCoachProfile({...coachProfile, introduction: e.target.value})}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500 h-32"
                              placeholder="あなたの経験や、どのようなサポートができるかを書いてください"
                            />
                            <p className="text-sm text-gray-500 mt-1">{coachProfile.introduction.length}文字</p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              セッション料金
                            </label>
                            <input
                              type="text"
                              value={coachProfile.sessionPrice}
                              onChange={(e) => setCoachProfile({...coachProfile, sessionPrice: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                              placeholder="例: 10,000円/60分"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              対応可能曜日
                            </label>
                            <div className="flex gap-2 flex-wrap">
                              {['月', '火', '水', '木', '金', '土', '日'].map(day => (
                                <button
                                  key={day}
                                  onClick={() => {
                                    if (coachProfile.availableDays.includes(day)) {
                                      setCoachProfile({
                                        ...coachProfile,
                                        availableDays: coachProfile.availableDays.filter(d => d !== day)
                                      });
                                    } else {
                                      setCoachProfile({
                                        ...coachProfile,
                                        availableDays: [...coachProfile.availableDays, day]
                                      });
                                    }
                                  }}
                                  className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                                    coachProfile.availableDays.includes(day)
                                      ? 'border-pink-500 bg-pink-50 text-pink-600'
                                      : 'border-gray-300 text-gray-600 hover:border-pink-300'
                                  }`}
                                >
                                  {day}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                          <h4 className="font-medium text-gray-800 mb-3">プレビュー</h4>
                          <div className="bg-gradient-to-br from-pink-50 to-white p-6 rounded-xl border-2 border-pink-200">
                            <div className="text-center">
                              <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl">
                                {coachProfile.image}
                              </div>
                              <h3 className="text-xl font-bold text-gray-800 mb-1">{coachProfile.displayName}</h3>
                              <p className="text-sm text-gray-600 mb-2">元{coachProfile.formerGroup}</p>
                              <div className="inline-block bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-sm mb-4">
                                {coachProfile.specialty}
                              </div>
                              <p className="text-sm text-gray-700 mb-4">{coachProfile.introduction}</p>
                              <div className="text-sm text-gray-600 space-y-1">
                                <p>💰 {coachProfile.sessionPrice}</p>
                                <p>📅 対応曜日: {coachProfile.availableDays.join(', ')}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => alert('プロフィールを保存しました')}
                          className="w-full mt-6 px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors font-medium"
                        >
                          保存する
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 通知タブ */}
                  {settingsTab === 'notifications' && (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="font-bold text-gray-800 mb-1">通知</h3>
                            <p className="text-sm text-gray-600">
                              未読 {notifications.filter(n => !n.read).length}件
                            </p>
                          </div>
                          {notifications.filter(n => !n.read).length > 0 && (
                            <button
                              onClick={() => {
                                setNotifications(notifications.map(n => ({...n, read: true})));
                                alert('すべての通知を既読にしました');
                              }}
                              className="text-sm text-pink-600 hover:text-pink-700"
                            >
                              すべて既読にする
                            </button>
                          )}
                        </div>

                        {notifications.length === 0 ? (
                          <div className="text-center py-12">
                            <p className="text-gray-600">通知はありません</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {notifications.map(notification => (
                              <div
                                key={notification.id}
                                onClick={() => {
                                  // メッセージタイプの場合は該当クライアントのメッセージ画面に遷移
                                  if (notification.type === 'message') {
                                    const client = clients.find(c => c.id === notification.clientId);
                                    if (client) {
                                      setSelectedClient(client);
                                      setMemoText(client.memo);
                                      setClientDetailView('sessions');
                                      setCurrentView('dashboard');
                                      setSettingsTab('account');
                                      // 通知を既読にする
                                      setNotifications(notifications.map(n =>
                                        n.id === notification.id ? {...n, read: true} : n
                                      ));
                                    }
                                  }
                                }}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                  notification.read
                                    ? 'bg-white border-gray-200'
                                    : 'bg-pink-50 border-pink-300'
                                } ${notification.type === 'message' ? 'cursor-pointer hover:shadow-md' : ''}`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      {notification.type === 'application' && (
                                        <span className="bg-pink-500 text-white px-2 py-1 rounded text-xs font-medium">
                                          新規申し込み
                                        </span>
                                      )}
                                      {notification.type === 'message' && (
                                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                                          メッセージ
                                        </span>
                                      )}
                                      <span className="font-bold text-gray-800">{notification.clientName}</span>
                                      <span className="text-xs text-gray-500">{notification.date}</span>
                                    </div>
                                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200">
                                      {notification.message}
                                    </p>
                                    {notification.type === 'message' && (
                                      <p className="text-xs text-pink-600 mt-2">クリックしてメッセージを確認 →</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentView === 'calendar' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 mb-2">スケジュール管理</h2>
                      <p className="text-gray-600">クライアントとのセッション予定を管理</p>
                    </div>
                    <button
                      onClick={() => setShowAddScheduleModal(true)}
                      className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 flex items-center gap-2"
                    >
                      <Calendar className="w-4 h-4" />
                      新規予定を追加
                    </button>
                  </div>

                  {/* 予定リスト */}
                  <div className="space-y-3">
                    {scheduleEvents
                      .sort((a, b) => new Date(a.date + ' ' + a.time) - new Date(b.date + ' ' + b.time))
                      .map(event => {
                        const eventDate = new Date(event.date + ' ' + event.time);
                        const now = new Date();
                        const isPast = eventDate < now;
                        
                        return (
                          <div
                            key={event.id}
                            className={`bg-white rounded-xl p-6 shadow-sm border transition-all ${
                              isPast 
                                ? 'border-gray-200 opacity-60' 
                                : 'border-pink-200 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <div className={`w-3 h-3 rounded-full ${isPast ? 'bg-gray-400' : 'bg-pink-500'}`}></div>
                                  <h3 className="text-lg font-bold text-gray-800">{event.clientName}</h3>
                                  <span className="bg-pink-100 text-pink-600 px-2 py-1 rounded text-xs">
                                    {event.type}
                                  </span>
                                </div>
                                <div className="ml-6 space-y-1">
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4" />
                                    <span>{event.date} {event.time}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <span className="text-sm">所要時間: {event.duration}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    if (confirm('この予定を削除しますか?')) {
                                      setScheduleEvents(scheduleEvents.filter(e => e.id !== event.id));
                                    }
                                  }}
                                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {scheduleEvents.length === 0 && (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                      <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">まだ予定がありません</p>
                      <button
                        onClick={() => setShowAddScheduleModal(true)}
                        className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
                      >
                        最初の予定を追加
                      </button>
                    </div>
                  )}

                  {/* 予定追加モーダル */}
                  {showAddScheduleModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">新規予定を追加</h3>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              クライアント
                            </label>
                            <select
                              value={newSchedule.clientId}
                              onChange={(e) => setNewSchedule({...newSchedule, clientId: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            >
                              <option value="">選択してください</option>
                              {clients.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              日付
                            </label>
                            <input
                              type="date"
                              value={newSchedule.date}
                              onChange={(e) => setNewSchedule({...newSchedule, date: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              時間
                            </label>
                            <input
                              type="time"
                              value={newSchedule.time}
                              onChange={(e) => setNewSchedule({...newSchedule, time: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              所要時間
                            </label>
                            <select
                              value={newSchedule.duration}
                              onChange={(e) => setNewSchedule({...newSchedule, duration: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            >
                              <option value="30分">30分</option>
                              <option value="60分">60分</option>
                              <option value="90分">90分</option>
                              <option value="120分">120分</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              種類
                            </label>
                            <select
                              value={newSchedule.type}
                              onChange={(e) => setNewSchedule({...newSchedule, type: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            >
                              <option value="セッション">セッション</option>
                              <option value="相談">相談</option>
                              <option value="フォローアップ">フォローアップ</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                          <button
                            onClick={() => {
                              if (!newSchedule.clientId || !newSchedule.date || !newSchedule.time) {
                                alert('すべての項目を入力してください');
                                return;
                              }
                              
                              const client = clients.find(c => c.id === parseInt(newSchedule.clientId));
                              const newEvent = {
                                id: scheduleEvents.length + 1,
                                clientId: parseInt(newSchedule.clientId),
                                clientName: client.name,
                                date: newSchedule.date,
                                time: newSchedule.time,
                                duration: newSchedule.duration,
                                type: newSchedule.type
                              };
                              
                              setScheduleEvents([...scheduleEvents, newEvent]);
                              setShowAddScheduleModal(false);
                              setNewSchedule({
                                clientId: '',
                                date: '',
                                time: '',
                                duration: '60分',
                                type: 'セッション'
                              });
                              alert('予定を追加しました');
                            }}
                            className="flex-1 bg-pink-500 text-white py-2 rounded-lg hover:bg-pink-600"
                          >
                            追加
                          </button>
                          <button
                            onClick={() => {
                              setShowAddScheduleModal(false);
                              setNewSchedule({
                                clientId: '',
                                date: '',
                                time: '',
                                duration: '60分',
                                type: 'セッション'
                              });
                            }}
                            className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentView === 'dashboard' && !selectedClient && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">クライアント一覧</h2>
                    <p className="text-gray-600">現在 {clients.length} 名のクライアントをサポート中</p>
                  </div>

                  <div className="grid gap-4">
                    {clients.map(client => (
                      <div 
                        key={client.id}
                        onClick={() => {
                          setSelectedClient(client);
                          setMemoText(client.memo);
                        }}
                        className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 hover:border-pink-200"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center text-xl">
                              👤
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-800 text-lg">{client.name}</h3>
                              <p className="text-sm text-gray-600">登録日: {client.joinDate}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600 mb-1">セッション回数</p>
                            <p className="text-2xl font-bold text-pink-500">{client.sessions}回</p>
                          </div>
                        </div>

                        <div className="bg-pink-50 rounded-lg p-4 border-l-4 border-pink-400">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-4 h-4 text-pink-600" />
                            <p className="text-sm font-medium text-pink-900">次回セッション</p>
                          </div>
                          <p className="text-lg font-bold text-pink-700">{client.nextSession}</p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
                          <span>保存ファイル: {client.files.length}件</span>
                          <span>最終メッセージ: {client.lastMessage}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedClient && (
                <div>
                  <button
                    onClick={() => {
                      setSelectedClient(null);
                      setClientDetailView('overview');
                      setEditingMemo(false);
                    }}
                    className="mb-4 text-pink-600 hover:text-pink-700 flex items-center gap-2"
                  >
                    ← 一覧に戻る
                  </button>

                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    {/* クライアント情報ヘッダー */}
                    <div className="bg-gradient-to-r from-pink-50 to-white p-6 border-b border-pink-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center text-2xl">
                            👤
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-gray-800">{selectedClient.name}</h2>
                            <p className="text-gray-600">セッション回数: {selectedClient.sessions}回 | 登録日: {selectedClient.joinDate}</p>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-pink-200">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="w-5 h-5 text-pink-600" />
                            <p className="text-xs font-medium text-gray-600">次回セッション</p>
                          </div>
                          <p className="text-lg font-bold text-pink-600">{selectedClient.nextSession}</p>
                        </div>
                      </div>
                    </div>

                    {/* タブナビゲーション */}
                    <div className="border-b border-gray-200">
                      <div className="flex gap-4 px-6">
                        <button 
                          onClick={() => setClientDetailView('overview')}
                          className={`py-4 px-2 border-b-2 font-medium ${
                            clientDetailView === 'overview' 
                              ? 'border-pink-500 text-pink-600' 
                              : 'border-transparent text-gray-600 hover:text-pink-600'
                          }`}
                        >
                          概要・メモ
                        </button>
                        <button 
                          onClick={() => setClientDetailView('files')}
                          className={`py-4 px-2 border-b-2 font-medium ${
                            clientDetailView === 'files' 
                              ? 'border-pink-500 text-pink-600' 
                              : 'border-transparent text-gray-600 hover:text-pink-600'
                          }`}
                        >
                          ファイル管理 ({selectedClient.files.length})
                        </button>
                        <button 
                          onClick={() => setClientDetailView('sessions')}
                          className={`py-4 px-2 border-b-2 font-medium ${
                            clientDetailView === 'sessions' 
                              ? 'border-pink-500 text-pink-600' 
                              : 'border-transparent text-gray-600 hover:text-pink-600'
                          }`}
                        >
                          メッセージ
                        </button>
                      </div>
                    </div>

                    {/* コンテンツエリア */}
                    <div className="p-6">
                      {clientDetailView === 'overview' && (
                        <div className="space-y-6">
                          {/* メモエリア */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-lg font-bold text-gray-800">コーチングメモ</h3>
                              {!editingMemo ? (
                                <button
                                  onClick={() => setEditingMemo(true)}
                                  className="text-pink-600 hover:text-pink-700 text-sm font-medium"
                                >
                                  編集
                                </button>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      // 保存処理
                                      setEditingMemo(false);
                                      alert('メモを保存しました');
                                    }}
                                    className="px-4 py-1 bg-pink-500 text-white rounded-lg hover:bg-pink-600 text-sm"
                                  >
                                    保存
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingMemo(false);
                                      setMemoText(selectedClient.memo);
                                    }}
                                    className="px-4 py-1 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                                  >
                                    キャンセル
                                  </button>
                                </div>
                              )}
                            </div>
                            {editingMemo ? (
                              <textarea
                                value={memoText}
                                onChange={(e) => setMemoText(e.target.value)}
                                className="w-full h-40 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                                placeholder="このクライアントについてのメモや気づきを記録..."
                              />
                            ) : (
                              <div className="bg-gray-50 rounded-lg p-4 min-h-[100px] whitespace-pre-wrap">
                                {memoText || 'メモがまだありません。「編集」ボタンからメモを追加できます。'}
                              </div>
                            )}
                          </div>

                          {/* 基本情報 */}
                          <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-3">基本情報</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">登録日</p>
                                <p className="font-medium text-gray-800">{selectedClient.joinDate}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">セッション回数</p>
                                <p className="font-medium text-gray-800">{selectedClient.sessions}回</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">次回セッション</p>
                                <p className="font-medium text-gray-800">{selectedClient.nextSession}</p>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">保存ファイル数</p>
                                <p className="font-medium text-gray-800">{selectedClient.files.length}件</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {clientDetailView === 'files' && (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-gray-800">ファイル管理</h3>
                            <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" />
                              ファイルをアップロード
                            </button>
                            <input
                              ref={fileInputRef}
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const newFile = {
                                    id: selectedClient.files.length + 1,
                                    name: file.name,
                                    uploadDate: new Date().toISOString().split('T')[0],
                                    size: file.size < 1024 ? `${file.size}B` : 
                                          file.size < 1048576 ? `${Math.round(file.size / 1024)}KB` : 
                                          `${Math.round(file.size / 1048576)}MB`
                                  };
                                  
                                  // クライアントのファイルリストを更新
                                  const updatedClient = {
                                    ...selectedClient,
                                    files: [...selectedClient.files, newFile]
                                  };
                                  setSelectedClient(updatedClient);
                                  
                                  // 実際のファイルデータを保存（デモ用）
                                  setUploadedFiles({
                                    ...uploadedFiles,
                                    [newFile.id]: file
                                  });
                                  
                                  alert(`${file.name} をアップロードしました`);
                                  e.target.value = ''; // inputをリセット
                                }
                              }}
                              className="hidden"
                              accept=".xlsx,.xls,.pdf,.doc,.docx,.ppt,.pptx"
                            />
                          </div>

                          {selectedClient.files.length === 0 ? (
                            <div className="bg-gray-50 rounded-lg p-12 text-center">
                              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                              <p className="text-gray-600">まだファイルがアップロードされていません</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {selectedClient.files.map(file => (
                                <div 
                                  key={file.id}
                                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-pink-300 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-pink-600" />
                                      </div>
                                      <div>
                                        <p className="font-medium text-gray-800">{file.name}</p>
                                        <p className="text-sm text-gray-600">
                                          {file.uploadDate} · {file.size}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => {
                                          const fileData = uploadedFiles[file.id];
                                          if (fileData) {
                                            // 実際のファイルをダウンロード
                                            const url = URL.createObjectURL(fileData);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = file.name;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                          } else {
                                            alert('このファイルはサンプルデータのためダウンロードできません');
                                          }
                                        }}
                                        className="px-3 py-1 text-pink-600 hover:bg-pink-50 rounded-lg text-sm"
                                      >
                                        ダウンロード
                                      </button>
                                      <button 
                                        onClick={() => {
                                          if (confirm(`${file.name}を削除しますか？`)) {
                                            const updatedClient = {
                                              ...selectedClient,
                                              files: selectedClient.files.filter(f => f.id !== file.id)
                                            };
                                            setSelectedClient(updatedClient);
                                            
                                            // アップロードされたファイルデータも削除
                                            const newUploadedFiles = {...uploadedFiles};
                                            delete newUploadedFiles[file.id];
                                            setUploadedFiles(newUploadedFiles);
                                            
                                            alert('ファイルを削除しました');
                                          }
                                        }}
                                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                                      >
                                        削除
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                              <strong>対応ファイル形式:</strong> Excel (.xlsx, .xls), PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx)
                            </p>
                          </div>
                        </div>
                      )}

                      {clientDetailView === 'sessions' && (
                        <div>
                          <h3 className="text-lg font-bold text-gray-800 mb-4">メッセージ</h3>
                          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                            {messages.map(msg => (
                              <div key={msg.id} className={`flex ${msg.sender === 'coach' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs px-4 py-2 rounded-lg ${
                                  msg.sender === 'coach' 
                                    ? 'bg-pink-500 text-white' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  <p>{msg.text}</p>
                                  <p className={`text-xs mt-1 ${msg.sender === 'coach' ? 'text-pink-100' : 'text-gray-500'}`}>
                                    {msg.time}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="メッセージを入力..."
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                            <button className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600">
                              送信
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // クライアント側の画面 - ビュータイプ選択
  if (userType === 'client' && isLoggedIn && !clientViewType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-400" />
              <h1 className="text-xl font-bold text-gray-800">推しコーチング</h1>
            </div>
            <button 
              onClick={() => {
                setUserType(null);
                setIsLoggedIn(false);
                setAuthView(null);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">ようこそ!</h2>
            <p className="text-gray-600">どちらをご利用ですか?</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div 
              onClick={() => setClientViewType('search')}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-pink-300"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-10 h-10 text-pink-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">コーチをお探しの方</h2>
                <p className="text-gray-600">あなたにぴったりのコーチを見つけましょう</p>
              </div>
            </div>

            <div 
              onClick={() => {
                setClientViewType('mycoach');
                setSelectedCoach(coaches[0]); // デモ用に最初のコーチを選択
              }}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-pink-300"
            >
              <div className="text-center">
                <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-10 h-10 text-pink-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">コーチがいる方</h2>
                <p className="text-gray-600">担当コーチとのやり取りを確認</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // クライアント側 - コーチ検索画面（Tinder風）
  if (userType === 'client' && clientViewType === 'search') {
    const currentCoach = coaches[currentCoachIndex];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setClientViewType(null)}
              className="text-pink-600 hover:text-pink-700 flex items-center gap-2"
            >
              ← 戻る
            </button>
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-400" />
              <h1 className="text-xl font-bold text-gray-800">コーチを探す</h1>
            </div>
            <button 
              onClick={() => {
                setUserType(null);
                setIsLoggedIn(false);
                setAuthView(null);
                setClientViewType(null);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-md mx-auto px-4 py-8 relative">
          {currentCoachIndex < coaches.length ? (
            <div className="relative">
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* コーチカード */}
              <div className="relative">
                <div className="h-64 bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center">
                  <div className="text-9xl">{currentCoach.image}</div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6">
                  <h2 className="text-3xl font-bold text-white mb-1">{currentCoach.name}</h2>
                  <p className="text-white/90">元{currentCoach.former_group}</p>
                </div>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <div className="inline-block bg-pink-100 text-pink-600 px-4 py-2 rounded-full text-sm font-medium mb-3">
                    {currentCoach.specialty}
                  </div>
                  <p className="text-gray-700 leading-relaxed mb-4">
                    {currentCoach.introduction}
                  </p>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="font-medium">💰 料金:</span>
                    <span>{currentCoach.sessionPrice}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="font-medium">📅 対応曜日:</span>
                    <span>{currentCoach.availableDays.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <span className="font-medium">👥 サポート実績:</span>
                    <span>{currentCoach.clients}名</span>
                  </div>
                </div>

                {/* 申し込みフォーム */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    申し込みメッセージ
                  </label>
                  <textarea
                    value={applicationMessage}
                    onChange={(e) => setApplicationMessage(e.target.value)}
                    placeholder="コーチへのメッセージを入力してください（希望日時や相談内容など）"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500 h-32 mb-4"
                  />
                  <button
                    onClick={() => {
                      if (!applicationMessage.trim()) {
                        alert('メッセージを入力してください');
                        return;
                      }
                      
                      // 申し込みは管理画面に届く（コーチには直接届かない）
                      alert(`${currentCoach.name}さんへの申し込みを送信しました！\n\n運営による承認後、コーチに通知されます。\n承認までしばらくお待ちください。`);
                      setApplicationMessage('');
                      
                      // 次のコーチへ
                      if (currentCoachIndex < coaches.length - 1) {
                        setCurrentCoachIndex(currentCoachIndex + 1);
                      } else {
                        setCurrentCoachIndex(0);
                      }
                    }}
                    className="w-full bg-pink-500 text-white py-4 rounded-xl hover:bg-pink-600 transition-colors font-bold text-lg flex items-center justify-center gap-2"
                  >
                    <Heart className="w-6 h-6" />
                    申し込む
                  </button>
                </div>
              </div>
            </div>

            {/* 左右スワイプボタン */}
            <button
              onClick={() => {
                if (currentCoachIndex > 0) {
                  setCurrentCoachIndex(currentCoachIndex - 1);
                } else {
                  setCurrentCoachIndex(coaches.length - 1);
                }
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all z-10"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>

            <button
              onClick={() => {
                if (currentCoachIndex < coaches.length - 1) {
                  setCurrentCoachIndex(currentCoachIndex + 1);
                } else {
                  setCurrentCoachIndex(0);
                }
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all z-10"
            >
              <ChevronRight className="w-6 h-6 text-gray-700" />
            </button>
          </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600">すべてのコーチを確認しました</p>
              <button
                onClick={() => setCurrentCoachIndex(0)}
                className="mt-4 px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600"
              >
                最初から見る
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // クライアント側 - マイコーチ画面（コーチ側と同じようなUI）
  if (userType === 'client' && !selectedCoach) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-400" />
              <h1 className="text-xl font-bold text-gray-800">推しコーチング</h1>
            </div>
            <button 
              onClick={() => {
                setUserType(null);
                setIsLoggedIn(false);
                setAuthView(null);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">あなたのコーチを選んでください</h2>
            <p className="text-gray-600">一度選択したコーチとの継続的なサポートが始まります</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {coaches.map(coach => (
              <div 
                key={coach.id}
                onClick={() => setSelectedCoach(coach)}
                className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all cursor-pointer border-2 border-transparent hover:border-pink-300"
              >
                <div className="text-center">
                  <div className="w-24 h-24 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 text-5xl">
                    {coach.image}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-1">{coach.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">元{coach.former_group}</p>
                  <div className="inline-block bg-pink-50 text-pink-600 px-3 py-1 rounded-full text-sm mb-4">
                    {coach.specialty}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center justify-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>{coach.clients}名サポート中</span>
                  </div>
                </div>
                <button className="w-full mt-6 bg-pink-500 text-white py-2 rounded-lg hover:bg-pink-600 transition-colors">
                  このコーチを選ぶ
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // クライアント側のマイページ
  if (userType === 'client' && selectedCoach) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => {
                setClientViewType(null);
                setSelectedCoach(null);
              }}
              className="text-pink-600 hover:text-pink-700 flex items-center gap-2"
            >
              ← 戻る
            </button>
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-400" />
              <h1 className="text-xl font-bold text-gray-800">推しコーチング</h1>
            </div>
            <button 
              onClick={() => {
                setUserType(null);
                setIsLoggedIn(false);
                setAuthView(null);
                setClientViewType(null);
                setSelectedCoach(null);
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* コーチ情報カード */}
          <div className="bg-gradient-to-r from-pink-500 to-pink-400 rounded-2xl p-6 mb-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl">
                {selectedCoach.image}
              </div>
              <div>
                <p className="text-pink-100 text-sm mb-1">あなたのコーチ</p>
                <h2 className="text-2xl font-bold">{selectedCoach.name}</h2>
                <p className="text-pink-100">元{selectedCoach.former_group} / {selectedCoach.specialty}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* メニュー */}
            <div className="md:col-span-1">
              <div className="bg-white rounded-xl p-4 shadow-sm space-y-2">
                <button 
                  onClick={() => setClientMyCoachTab('messages')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                    clientMyCoachTab === 'messages' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>メッセージ</span>
                </button>
                <button 
                  onClick={() => setClientMyCoachTab('schedule')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                    clientMyCoachTab === 'schedule' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                  <span>セッション予約</span>
                </button>
                <button 
                  onClick={() => setClientMyCoachTab('files')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg ${
                    clientMyCoachTab === 'files' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>資料・記録</span>
                </button>
              </div>

              {/* 進捗カード */}
              <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
                <h3 className="font-bold text-gray-800 mb-3">あなたの進捗</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">セッション回数</span>
                      <span className="font-bold text-pink-600">5回</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">開始日</span>
                      <span className="font-bold text-gray-800">2024/01/15</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">次回セッション</span>
                      <span className="font-bold text-gray-800">2024/02/01</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* メインコンテンツエリア */}
            <div className="md:col-span-2">
              {clientMyCoachTab === 'messages' && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-pink-50 to-white p-4 border-b border-pink-100">
                    <h3 className="font-bold text-gray-800">メッセージ</h3>
                  </div>

                  <div className="p-6">
                    <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
                      {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.sender === 'client' 
                              ? 'bg-pink-500 text-white' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            <p>{msg.text}</p>
                            <p className={`text-xs mt-1 ${msg.sender === 'client' ? 'text-pink-100' : 'text-gray-500'}`}>
                              {msg.time}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="メッセージを入力..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                      />
                      <button className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600">
                        送信
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {clientMyCoachTab === 'schedule' && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-pink-50 to-white p-4 border-b border-pink-100">
                    <h3 className="font-bold text-gray-800">セッション予約</h3>
                  </div>

                  <div className="p-6">
                    <div className="space-y-4">
                      {/* 予約済みセッション */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">予約済みセッション</h4>
                        <div className="space-y-3">
                          <div className="bg-pink-50 p-4 rounded-lg border-l-4 border-pink-400">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-gray-800">次回セッション</p>
                                <p className="text-sm text-gray-600 mt-1">2024/02/01 10:00 - 11:00</p>
                              </div>
                              <span className="bg-pink-500 text-white px-3 py-1 rounded-full text-xs">
                                確定
                              </span>
                            </div>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-gray-300">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-700">前回セッション</p>
                                <p className="text-sm text-gray-600 mt-1">2024/01/25 14:00 - 15:00</p>
                              </div>
                              <span className="bg-gray-400 text-white px-3 py-1 rounded-full text-xs">
                                完了
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 新規予約リクエスト */}
                      <div className="border-t border-gray-200 pt-4 mt-6">
                        <h4 className="font-medium text-gray-700 mb-3">新規予約をリクエスト</h4>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">希望日</label>
                            <input 
                              type="date" 
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">希望時間</label>
                            <input 
                              type="time" 
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">メモ（任意）</label>
                            <textarea 
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500 h-20"
                              placeholder="相談したいことなど..."
                            />
                          </div>
                          <button className="w-full bg-pink-500 text-white py-2 rounded-lg hover:bg-pink-600">
                            予約リクエストを送信
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {clientMyCoachTab === 'files' && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-pink-50 to-white p-4 border-b border-pink-100">
                    <h3 className="font-bold text-gray-800">資料・記録</h3>
                  </div>

                  <div className="p-6">
                    <div className="mb-4">
                      <button 
                        onClick={() => clientFileInputRef.current?.click()}
                        className="w-full bg-pink-500 text-white py-3 rounded-lg hover:bg-pink-600 flex items-center justify-center gap-2"
                      >
                        <FileText className="w-5 h-5" />
                        ファイルをアップロード
                      </button>
                      <input
                        ref={clientFileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const newFile = {
                              id: clientFiles.length + 1,
                              name: file.name,
                              uploadDate: new Date().toISOString().split('T')[0],
                              size: file.size < 1024 ? `${file.size}B` : 
                                    file.size < 1048576 ? `${Math.round(file.size / 1024)}KB` : 
                                    `${Math.round(file.size / 1048576)}MB`
                            };
                            
                            setClientFiles([...clientFiles, newFile]);
                            
                            // 実際のファイルデータを保存
                            setUploadedFiles({
                              ...uploadedFiles,
                              [`client_${newFile.id}`]: file
                            });
                            
                            alert(`${file.name} をアップロードしました`);
                            e.target.value = ''; // inputをリセット
                          }
                        }}
                        className="hidden"
                        accept=".xlsx,.xls,.pdf,.doc,.docx,.ppt,.pptx"
                      />
                    </div>

                    {/* ファイルリスト */}
                    {clientFiles.length === 0 ? (
                      <div className="bg-gray-50 rounded-lg p-12 text-center">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">まだファイルがアップロードされていません</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientFiles.map(file => (
                          <div key={file.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-pink-300 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-pink-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-800">{file.name}</p>
                                  <p className="text-sm text-gray-600">{file.uploadDate} · {file.size}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                    const fileData = uploadedFiles[`client_${file.id}`];
                                    if (fileData) {
                                      const url = URL.createObjectURL(fileData);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = file.name;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } else {
                                      alert('このファイルはサンプルデータのためダウンロードできません');
                                    }
                                  }}
                                  className="px-3 py-1 text-pink-600 hover:bg-pink-50 rounded-lg text-sm"
                                >
                                  ダウンロード
                                </button>
                                <button 
                                  onClick={() => {
                                    if (confirm(`${file.name}を削除しますか？`)) {
                                      setClientFiles(clientFiles.filter(f => f.id !== file.id));
                                      
                                      // アップロードされたファイルデータも削除
                                      const newUploadedFiles = {...uploadedFiles};
                                      delete newUploadedFiles[`client_${file.id}`];
                                      setUploadedFiles(newUploadedFiles);
                                      
                                      alert('ファイルを削除しました');
                                    }
                                  }}
                                  className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>対応ファイル形式:</strong> Excel (.xlsx, .xls), PDF (.pdf), Word (.doc, .docx), PowerPoint (.ppt, .pptx)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
};

export default OshiCoachingApp;
// フッターコンポーネント
function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-8">
      <div className="max-w-7xl mx-auto py-6 px-4">
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>© 2026 推しコーチング運営事務局</p>
          <div className="flex justify-center space-x-4">
            <a href="/privacy" className="hover:text-pink-600">プライバシーポリシー</a>
            <span>|</span>
            <a href="/terms" className="hover:text-pink-600">利用規約</a>
            <span>|</span>
            <a href="mailto:oshicoaching.official@gmail.com" className="hover:text-pink-600">お問い合わせ</a>
          </div>
        </div>
      </div>
    </footer>
  );
}