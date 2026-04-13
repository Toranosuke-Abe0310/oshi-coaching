import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import { Heart, MessageCircle, Users, Calendar, FileText, Settings, LogOut, Menu, X, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
const OshiCoachingApp = () => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // デモモード: trueにするとログイン済みの画面が直接表示されます
  const [demoMode] = useState(false);
  const [userType, setUserType] = useState(null); // 'coach' or 'client'
  const [userData, setUserData] = useState(null); // usersテーブルのデータ

  const fetchUserData = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('user_type, name, email')
      .eq('id', userId)
      .single();
    if (data) {
      setUserType(data.user_type);
      setUserData(data);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)

      // ログインしている場合、usersテーブルからuser_typeとnameを取得
      if (session?.user) {
        fetchUserData(session.user.id);
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)

      // セッション変更時もuser_typeを取得
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setUserType(null)
        setUserData(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const [selectedCoach, setSelectedCoach] = useState(null);
  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [realClients, setRealClients] = useState([]); // Supabaseから取得した実際のクライアント

  // Supabaseからコーチ一覧を取得
  useEffect(() => {
    const fetchCoaches = async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) {
        setCoaches(data.map(c => ({
          id: c.id,
          user_id: c.user_id,
          name: c.display_name,
          former_group: c.former_group,
          specialty: c.specialty,
          image: c.image || '🌸',
          clients: c.clients_count || 0,
          introduction: c.introduction || '',
          sessionPrice: c.session_price || '',
          availableDays: c.available_days || []
        })));
      }
      setCoachesLoading(false);
    };
    fetchCoaches();
  }, []);

  // クライアント側: 承認済み申し込みからコーチを自動取得
  useEffect(() => {
    if (userType !== 'client' || !session?.user || coaches.length === 0) return;
    const fetchAssignedCoach = async () => {
      const { data } = await supabase
        .from('applications')
        .select('coach_id')
        .eq('client_id', session.user.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data?.coach_id) {
        const assignedCoach = coaches.find(c => c.user_id === data.coach_id);
        if (assignedCoach) setSelectedCoach(assignedCoach);
      }
    };
    fetchAssignedCoach();
  }, [userType, session, coaches]);

  // コーチ側: 承認済みクライアントのみ取得
  useEffect(() => {
    if (userType !== 'coach' || !session?.user) return;
    const fetchClients = async () => {
      // このコーチへの承認済み申込を取得
      const { data: apps } = await supabase
        .from('applications')
        .select('client_id')
        .eq('coach_id', session.user.id)
        .eq('status', 'approved');
      if (!apps || apps.length === 0) {
        setRealClients([]);
        return;
      }
      const clientIds = apps.map(a => a.client_id);
      const { data: users } = await supabase
        .from('users')
        .select('id, name, email, created_at')
        .in('id', clientIds);
      if (users) {
        setRealClients(users.map(u => ({
          id: u.id,
          name: u.name || u.email || '名前未設定',
          joinDate: u.created_at?.split('T')[0] || '-',
          sessions: 0,
          lastMessage: '-',
          nextSession: '-',
          memo: '',
          files: []
        })));
      }
    };
    fetchClients();
  }, [userType, session]);

  // コーチ側: 自分のコーチプロフィールをcoachesテーブルから取得して初期化
  useEffect(() => {
    if (userType !== 'coach' || !session?.user) return;
    const fetchCoachProfile = async () => {
      const { data } = await supabase
        .from('coaches')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      if (data) {
        setCoachProfile({
          displayName: data.display_name || '',
          formerGroup: data.former_group || '',
          specialty: data.specialty || '',
          introduction: data.introduction || '',
          sessionPrice: data.session_price || '',
          availableDays: data.available_days || [],
          image: data.image || '🌸'
        });
      }
    };
    fetchCoachProfile();
  }, [userType, session]);

  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingMemo, setEditingMemo] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [clientDetailView, setClientDetailView] = useState('overview'); // 'overview', 'files', 'sessions'
  
  // スケジュール管理用のstate
  const [scheduleEvents, setScheduleEvents] = useState([]);
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

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const seenMessageIds = useRef(new Set());

  // メッセージ取得
  const fetchMessages = async (userId) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    if (data) {
      // 取得済みIDをrefに登録
      data.forEach(m => seenMessageIds.current.add(m.id));
      setMessages(data.map(m => ({
        id: m.id,
        sender: m.sender_id === userId ? 'me' : 'other',
        text: m.text,
        time: new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        sender_id: m.sender_id,
        receiver_id: m.receiver_id
      })));
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    // 既存IDをリセットして初期取得
    seenMessageIds.current = new Set();
    fetchMessages(userId);

    // チャンネル名をユニークにして多重購読を防止
    const channelName = `msg-${userId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new;
        if (m.sender_id !== userId && m.receiver_id !== userId) return;
        // refで重複チェック（Reactの非同期stateより確実）
        if (seenMessageIds.current.has(m.id)) return;
        seenMessageIds.current.add(m.id);
        setMessages(prev => [...prev, {
          id: m.id,
          sender: m.sender_id === userId ? 'me' : 'other',
          text: m.text,
          time: new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          sender_id: m.sender_id,
          receiver_id: m.receiver_id
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // メッセージ送信（送信後すぐにstateに追加して二重表示を防ぐ）
  const sendMessage = async (receiverId) => {
    if (!newMessage.trim() || !session?.user) return;
    const msg = newMessage.trim();
    setNewMessage('');
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: session.user.id, receiver_id: receiverId, text: msg })
      .select()
      .single();
    if (!error && data) {
      seenMessageIds.current.add(data.id); // リアルタイムで重複しないようIDを登録
      setMessages(prev => [...prev, {
        id: data.id,
        sender: 'me',
        text: data.text,
        time: new Date(data.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        sender_id: data.sender_id,
        receiver_id: data.receiver_id
      }]);
    }
  };

  // ローディング中
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-16 h-16 text-pink-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  // ログインしていない場合
  if (!session) {
    return <Login />
  }

  // コーチ側のダッシュボード
  if (userType === 'coach') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-7 h-7 text-pink-400" />
              <h1 className="text-lg font-bold text-gray-800">推しコーチング</h1>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.reload()
              }}
              className="flex items-center gap-2 text-gray-500 hover:text-pink-500 text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">ログアウト</span>
            </button>
          </div>
        </header>

        {/* モバイル底部ナビゲーション */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 z-20 flex">
          {[
            { view: 'dashboard', icon: <Users className="w-5 h-5" />, label: 'クライアント' },
            { view: 'calendar', icon: <Calendar className="w-5 h-5" />, label: 'スケジュール' },
            { view: 'settings', icon: <Settings className="w-5 h-5" />, label: '設定' },
          ].map(item => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${
                currentView === item.view ? 'text-pink-600' : 'text-gray-400'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="max-w-5xl mx-auto px-4 py-6 pb-24 lg:pb-6">
          <div className="grid lg:grid-cols-4 gap-6">
            {/* サイドバー（PC専用） */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="bg-white rounded-xl p-4 shadow-sm sticky top-20">
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
                              <p className="text-sm text-gray-600">{session?.user?.email || '未設定'}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-800">名前</p>
                              <p className="text-sm text-gray-600">{userData?.name || coachProfile.displayName || '未設定'}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-800">元所属グループ</p>
                              <p className="text-sm text-gray-600">{coachProfile.formerGroup}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between py-3">
                            <div>
                              <p className="font-medium text-gray-800">専門分野</p>
                              <p className="text-sm text-gray-600">{coachProfile.specialty}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <h3 className="font-bold text-gray-800 mb-4">ログアウト</h3>
                        <button
                          onClick={async () => {
                            if (confirm('ログアウトしますか？')) {
                              await supabase.auth.signOut()
                              window.location.reload()
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
                              {realClients.map(client => (
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
                              
                              const client = realClients.find(c => c.id === newSchedule.clientId);
                              const newEvent = {
                                id: scheduleEvents.length + 1,
                                clientId: newSchedule.clientId,
                                clientName: client?.name || '不明',
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
                    <p className="text-gray-600">現在 {realClients.length} 名のクライアントをサポート中</p>
                  </div>

                  {realClients.length === 0 && (
                    <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600">まだクライアントがいません</p>
                    </div>
                  )}

                  <div className="grid gap-4">
                    {realClients.map(client => (
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
                            {messages
                              .filter(m => {
                                const myId = session?.user?.id;
                                const partnerId = selectedClient?.id;
                                return (m.sender_id === myId && m.receiver_id === partnerId) ||
                                       (m.sender_id === partnerId && m.receiver_id === myId);
                              })
                              .map(msg => (
                              <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs px-4 py-2 rounded-lg ${
                                  msg.sender === 'me'
                                    ? 'bg-pink-500 text-white'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  <p>{msg.text}</p>
                                  <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-pink-100' : 'text-gray-500'}`}>
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
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(selectedClient.id); }}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                            <button onClick={() => sendMessage(selectedClient.id)} className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600">
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
  if (userType === 'client' && session && !clientViewType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white">
        <header className="bg-white border-b border-pink-100 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-400" />
              <h1 className="text-xl font-bold text-gray-800">推しコーチング</h1>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.reload()
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-10">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-pink-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">ようこそ！</h2>
            <p className="text-gray-500 text-sm">どちらをご利用ですか？</p>
          </div>

          <div className="flex flex-col gap-4">
            <div
              onClick={() => setClientViewType('search')}
              className="bg-white rounded-2xl p-6 shadow-md active:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-pink-300 flex items-center gap-5"
            >
              <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center shrink-0">
                <Search className="w-7 h-7 text-pink-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">コーチをお探しの方</h2>
                <p className="text-gray-500 text-sm">あなたにぴったりのコーチを見つけましょう</p>
              </div>
              <span className="ml-auto text-gray-300 text-lg">›</span>
            </div>

            <div
              onClick={() => setClientViewType('mycoach')}
              className="bg-white rounded-2xl p-6 shadow-md active:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-pink-300 flex items-center gap-5"
            >
              <div className="w-14 h-14 bg-pink-100 rounded-full flex items-center justify-center shrink-0">
                <Heart className="w-7 h-7 text-pink-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-800 mb-1">コーチがいる方</h2>
                <p className="text-gray-500 text-sm">担当コーチとのやり取りを確認</p>
              </div>
              <span className="ml-auto text-gray-300 text-lg">›</span>
            </div>
          </div>
        </div>
        <Footer />
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
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.reload()
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
                    onClick={async () => {
                      if (!applicationMessage.trim()) {
                        alert('メッセージを入力してください');
                        return;
                      }
                      if (!currentCoach?.user_id) {
                        alert('コーチ情報が取得できませんでした');
                        return;
                      }
                      const { error } = await supabase.from('applications').insert({
                        client_id: session.user.id,
                        coach_id: currentCoach.user_id,
                        message: applicationMessage,
                        status: 'pending'
                      });
                      if (error) {
                        alert('送信に失敗しました: ' + error.message);
                        return;
                      }
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

  // クライアント側 - マイコーチ画面（コーチ未割り当て）
  if (userType === 'client' && !selectedCoach) {
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
              <h1 className="text-xl font-bold text-gray-800">推しコーチング</h1>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.reload()
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            🌸
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">コーチはまだ割り当てられていません</h2>
          <p className="text-gray-500 mb-8">運営からコーチが割り当てられるまでしばらくお待ちください。</p>
          <button
            onClick={() => setClientViewType(null)}
            className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            トップに戻る
          </button>
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
              onClick={() => setClientViewType(null)}
              className="text-pink-600 hover:text-pink-700 flex items-center gap-2"
            >
              ← 戻る
            </button>
            <div className="flex items-center gap-3">
              <Heart className="w-8 h-8 text-pink-400" />
              <h1 className="text-xl font-bold text-gray-800">推しコーチング</h1>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.reload()
              }}
              className="flex items-center gap-2 text-gray-600 hover:text-pink-500"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-4 pb-6">
          {/* コーチ情報カード */}
          <div className="bg-gradient-to-r from-pink-500 to-pink-400 rounded-2xl p-5 mb-4 text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl shrink-0">
                {selectedCoach.image}
              </div>
              <div>
                <p className="text-pink-100 text-xs mb-0.5">あなたのコーチ</p>
                <h2 className="text-xl font-bold">{selectedCoach.name}</h2>
                <p className="text-pink-100 text-sm">元{selectedCoach.former_group} / {selectedCoach.specialty}</p>
              </div>
            </div>
          </div>

          {/* タブ（モバイルではメッセージのみ表示） */}
          <div className="bg-white rounded-xl shadow-sm mb-4">
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setClientMyCoachTab('messages')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  clientMyCoachTab === 'messages' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                メッセージ
              </button>
            </div>
          </div>

          {/* メッセージエリア */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex flex-col h-[60vh] min-h-[400px]">
              {/* メッセージ一覧 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages
                  .filter(m => {
                    const myId = session?.user?.id;
                    const partnerId = selectedCoach?.user_id;
                    if (!partnerId) return false;
                    return (m.sender_id === myId && m.receiver_id === partnerId) ||
                           (m.sender_id === partnerId && m.receiver_id === myId);
                  })
                  .map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                        msg.sender === 'me'
                          ? 'bg-pink-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        <p>{msg.text}</p>
                        <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-pink-100' : 'text-gray-400'}`}>
                          {msg.time}
                        </p>
                      </div>
                    </div>
                  ))}
                {messages.filter(m => {
                  const myId = session?.user?.id;
                  const partnerId = selectedCoach?.user_id;
                  if (!partnerId) return false;
                  return (m.sender_id === myId && m.receiver_id === partnerId) ||
                         (m.sender_id === partnerId && m.receiver_id === myId);
                }).length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-400 text-sm">まだメッセージがありません。最初のメッセージを送ってみましょう！</p>
                  </div>
                )}
              </div>

              {/* 入力欄 */}
              <div className="border-t border-gray-100 p-3 flex gap-2">
                {!selectedCoach?.user_id && (
                  <p className="text-sm text-red-500 w-full text-center">コーチ情報が正しく読み込まれていません</p>
                )}
                {selectedCoach?.user_id && (
                  <>
                    <input
                      type="text"
                      placeholder="メッセージを入力..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(selectedCoach.user_id); }}
                      className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:bg-white focus:ring-2 focus:ring-pink-300 text-sm"
                    />
                    <button
                      onClick={() => sendMessage(selectedCoach.user_id)}
                      className="px-5 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 text-sm font-medium shrink-0"
                    >
                      送信
                    </button>
                  </>
                )}
              </div>
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