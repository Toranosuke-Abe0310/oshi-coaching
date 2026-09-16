import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import Login from './Login'
import { Heart, MessageCircle, Users, Calendar, FileText, Settings, LogOut, Menu, X, Search, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

/*
  Supabase Storage の「キー」（保存先のパス）には英数字と一部の記号しか使えない。
  日本語のファイル名をそのまま渡すと Invalid key エラーでアップロードが失敗するため、
  保存先の名前だけ安全な文字に置き換える。
  画面に出す名前・ダウンロード時の名前は元のまま（files.file_name に保持）。
*/
const toStorageSafeName = (originalName) => {
  const name = String(originalName || 'file');
  const dot = name.lastIndexOf('.');
  // 先頭のドット（.gitignore のような名前）は拡張子とみなさない
  const hasExt = dot > 0;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot + 1) : '';

  const clean = (s) => s
    .replace(/[^A-Za-z0-9._-]/g, '_')  // 使える文字以外は _ に
    .replace(/_+/g, '_')               // _ の連続はまとめる
    .replace(/^[._-]+|[._-]+$/g, '');  // 前後の記号は落とす

  const safeBase = clean(base).slice(0, 80) || 'file';
  const safeExt = clean(ext).slice(0, 10);
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
};

const OshiCoachingApp = () => {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  // デモモード: trueにするとログイン済みの画面が直接表示されます
  const [demoMode] = useState(false);
  const [userType, setUserType] = useState(null); // 'coach' or 'client'
  const [userData, setUserData] = useState(null); // usersテーブルのデータ

  // パスワード再設定メールのリンクから来た場合、通常の画面ではなく再設定フォームを出す
  const [recoveryMode, setRecoveryMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hash.includes('type=recovery') ||
      new URLSearchParams(window.location.search).get('type') === 'recovery'
    );
  });
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'パスワードは6文字以上で設定してください' });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setPasswordMessage({ type: 'error', text: '確認用のパスワードが一致しません' });
      return;
    }

    setPasswordSaving(true);
    setPasswordMessage({ type: '', text: '' });
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordMessage({
        type: 'error',
        text: error.message || 'パスワードの変更に失敗しました。リンクの有効期限が切れている可能性があります。',
      });
      return;
    }

    setNewPassword('');
    setNewPasswordConfirm('');
    setPasswordMessage({ type: 'success', text: 'パスワードを変更しました。' });
    // URLに残った recovery の印を消して、再読み込みでこの画面に戻らないようにする
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      // 消せなくても動作に影響はない
    }
    setTimeout(() => setRecoveryMode(false), 1500);
  };

  const fetchUserData = async (userId) => {
    const { data } = await supabase
      .from('users')
      .select('user_type, name, email')
      .eq('id', userId)
      .single();
    if (data) {
      // user_typeがNULLのケースもあるので、その場合も状態を確定させる
      setUserType(data.user_type || 'unknown');
      setUserData(data);
    } else {
      // usersテーブルに行が無い場合、userTypeをnullのままにすると
      // ローディング表示が永久に続くので状態を確定させる
      setUserType('unknown');
      setUserData(null);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // パスワード再設定リンクから戻ってきたとき
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)

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
  const [approvedApps, setApprovedApps] = useState([]); // 承認済み申込（通知の生成に使う）
  // 予定の実施済み/キャンセルを切り替えたときに、クライアント一覧の集計を取り直すためのキー
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0);

  // Supabaseからコーチ一覧を取得
  useEffect(() => {
    const fetchCoaches = async () => {
      const { data, error } = await supabase
        .from('coaches')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) {
        // コーチごとの有効申し込み数を取得（pending + approved）
        const coachIds = data.map(c => c.user_id).filter(Boolean);
        let appCountMap = {};
        if (coachIds.length > 0) {
          const { data: apps } = await supabase
            .from('applications')
            .select('coach_id')
            .in('coach_id', coachIds)
            .in('status', ['pending', 'approved']);
          (apps || []).forEach(a => {
            appCountMap[a.coach_id] = (appCountMap[a.coach_id] || 0) + 1;
          });
        }
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
          availableDays: c.available_days || [],
          maxClients: c.max_clients ?? null,
          currentApplications: appCountMap[c.user_id] || 0,
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

  // クライアント側: コーチから共有されたファイルを取得
  useEffect(() => {
    if (userType !== 'client' || !session?.user) return;
    const fetchClientFiles = async () => {
      const { data } = await supabase
        .from('files')
        .select('*')
        .eq('client_id', session.user.id)
        .order('created_at', { ascending: false });
      if (data) {
        setClientFiles(data.map(f => ({
          id: f.id,
          name: f.file_name,
          uploadDate: f.created_at?.split('T')[0],
          size: f.file_size,
          path: f.file_path
        })));
      }
    };
    fetchClientFiles();
  }, [userType, session]);

  // コーチ側: 承認済みクライアントのみ取得
  useEffect(() => {
    if (userType !== 'coach' || !session?.user) return;
    const fetchClients = async () => {
      // このコーチへの承認済み申込を取得
      const { data: apps } = await supabase
        .from('applications')
        .select('id, client_id, created_at')
        .eq('coach_id', session.user.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      setApprovedApps(apps || []);
      if (!apps || apps.length === 0) {
        setRealClients([]);
        return;
      }
      const clientIds = apps.map(a => a.client_id);
      const [{ data: users }, { data: schedules }, { data: sentMsgs }, { data: recvMsgs }] = await Promise.all([
        supabase.from('users').select('id, name, email, created_at').in('id', clientIds),
        // 次回セッションと実施済み回数の両方を出すため、日付で絞らず全件取得する
        supabase.from('schedules')
          .select('client_id, date, time, status')
          .eq('coach_id', session.user.id)
          .order('date', { ascending: true })
          .order('time', { ascending: true }),
        // 最終メッセージ日の算出用（送信ぶん）
        supabase.from('messages').select('receiver_id, created_at')
          .eq('sender_id', session.user.id).in('receiver_id', clientIds)
          .order('created_at', { ascending: false }),
        // 最終メッセージ日の算出用（受信ぶん）
        supabase.from('messages').select('sender_id, created_at')
          .eq('receiver_id', session.user.id).in('sender_id', clientIds)
          .order('created_at', { ascending: false })
      ]);
      if (users) {
        const now = new Date();
        const toDateTime = (s) => new Date(`${s.date}T${(s.time || '00:00').slice(0, 5)}:00`);
        const nextSessionMap = {};   // これから行う直近の予定
        const sessionCountMap = {};  // statusが'completed'の件数 ＝ 実施済みセッション回数
        (schedules || []).forEach(s => {
          // 実施済みはコーチが明示的に押したものだけを数える。
          // 日時が過ぎただけの予定は、ドタキャンや延期の可能性があるので数えない
          if (s.status === 'completed') {
            sessionCountMap[s.client_id] = (sessionCountMap[s.client_id] || 0) + 1;
            return;
          }
          // 次回セッションの候補は、まだ日時が来ていない'scheduled'のものだけ
          if (s.status !== 'scheduled') return;
          const dt = toDateTime(s);
          if (isNaN(dt.getTime()) || dt < now) return;
          if (!nextSessionMap[s.client_id]) {
            nextSessionMap[s.client_id] = `${s.date} ${s.time}`;
          }
        });

        // クライアントごとの最終メッセージ日（送信・受信のうち新しいほう）
        const lastMessageMap = {};
        const noteLatest = (partnerId, createdAt) => {
          if (!partnerId || !createdAt) return;
          if (!lastMessageMap[partnerId] || createdAt > lastMessageMap[partnerId]) {
            lastMessageMap[partnerId] = createdAt;
          }
        };
        (sentMsgs || []).forEach(m => noteLatest(m.receiver_id, m.created_at));
        (recvMsgs || []).forEach(m => noteLatest(m.sender_id, m.created_at));

        setRealClients(users.map(u => ({
          id: u.id,
          name: u.name || u.email || '名前未設定',
          joinDate: u.created_at?.split('T')[0] || '-',
          sessions: sessionCountMap[u.id] || 0,
          lastMessage: lastMessageMap[u.id] ? lastMessageMap[u.id].split('T')[0] : '-',
          nextSession: nextSessionMap[u.id] || '-',
          memo: '',
          files: []
        })));
      }
    };
    fetchClients();
  }, [userType, session, clientsRefreshKey]);

  // コーチ側: 申込の承認をリアルタイムに拾う。
  // これが無いと、運営が承認してもコーチがページを再読み込みするまで
  // 新しいクライアントも通知も出てこない。
  useEffect(() => {
    if (userType !== 'coach' || !session?.user?.id) return;
    const coachId = session.user.id;
    const channel = supabase
      .channel(`coach-apps-${coachId}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, (payload) => {
        const row = payload.new || payload.old;
        if (!row || row.coach_id !== coachId) return;
        // 一覧と通知を組み立て直す（fetchClients が走る）
        setClientsRefreshKey(k => k + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userType, session?.user?.id]);

  // コーチ側: Supabaseからスケジュール取得
  useEffect(() => {
    if (userType !== 'coach' || !session?.user) return;
    const fetchSchedules = async () => {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('coach_id', session.user.id)
        .order('date', { ascending: true });
      if (data) {
        setScheduleEvents(data.map(s => ({
          id: s.id,
          clientId: s.client_id,
          clientName: s.client_name,
          date: s.date,
          time: s.time,
          duration: s.duration,
          type: s.type,
          status: s.status || 'scheduled'
        })));
      }
    };
    fetchSchedules();
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
          image: data.image || '🌸',
          maxClients: data.max_clients != null ? String(data.max_clients) : ''
        });
      }
      // 行が無かった場合も含めて、取得を試み終えたら保存を解禁する
      setCoachProfileLoaded(true);
    };
    fetchCoachProfile();
  }, [userType, session]);

  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedClient, setSelectedClient] = useState(null);

  // 運営チャット用のstate（コーチ側）
  const [adminUserId, setAdminUserId] = useState(null);
  const [adminChatMessages, setAdminChatMessages] = useState([]);
  const [adminChatNewMessage, setAdminChatNewMessage] = useState('');
  const adminSeenIds = useRef(new Set());

  // 運営ユーザーIDを取得 & メッセージ購読
  // 購読解除は必ずuseEffectのcleanupで行う。setup内でcleanupをreturnしても
  // その戻り値は捨てられるため、チャンネルが解除されず溜まり続けてしまう
  useEffect(() => {
    if (userType !== 'coach' || !session?.user?.id) return;
    let channel = null;
    let cancelled = false;
    const setup = async () => {
      // adminユーザーを取得
      const { data: adminUser } = await supabase
        .from('users').select('id').eq('user_type', 'admin').single();
      if (!adminUser || cancelled) return;
      setAdminUserId(adminUser.id);
      const coachId = session.user.id;
      // メッセージ取得
      const { data: msgs } = await supabase
        .from('messages').select('*')
        .or(`and(sender_id.eq.${coachId},receiver_id.eq.${adminUser.id}),and(sender_id.eq.${adminUser.id},receiver_id.eq.${coachId})`)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (msgs) {
        msgs.forEach(m => adminSeenIds.current.add(m.id));
        setAdminChatMessages(msgs.map(m => ({
          id: m.id, sender: m.sender_id === coachId ? 'me' : 'admin',
          text: m.text,
          time: new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
        })));
      }
      // リアルタイム購読
      channel = supabase.channel(`coach-admin-chat-${coachId}-${Date.now()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const m = payload.new;
          if (adminSeenIds.current.has(m.id)) return;
          const relevant = (m.sender_id === coachId && m.receiver_id === adminUser.id) ||
                           (m.sender_id === adminUser.id && m.receiver_id === coachId);
          if (!relevant) return;
          adminSeenIds.current.add(m.id);
          setAdminChatMessages(prev => [...prev, {
            id: m.id, sender: m.sender_id === coachId ? 'me' : 'admin',
            text: m.text,
            time: new Date(m.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
          }]);
        }).subscribe();
      // 購読完了前にアンマウント/再実行された場合はここで後始末
      if (cancelled) { supabase.removeChannel(channel); channel = null; }
    };
    setup();
    return () => {
      cancelled = true;
      if (channel) { supabase.removeChannel(channel); channel = null; }
    };
    // sessionオブジェクトはトークン更新のたびに別物になるため、user.idで比較する
  }, [userType, session?.user?.id]);
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
    type: 'コーチング',
    url: ''
  });
  
  // ファイルアップロード用のstate
  const [uploadedFiles, setUploadedFiles] = useState({});
  const fileInputRef = React.useRef(null);
  const clientFileInputRef = React.useRef(null); // クライアント側用
  
  // 設定画面用のstate
  const [settingsTab, setSettingsTab] = useState('account'); // 'account', 'profile', 'notifications'
  // 初期値は空。ダミーの実名を入れておくと、DBからの読み込みが終わる前に
  // 「保存する」を押されたときに他人の名前で自分のプロフィールを上書きしてしまう
  const [coachProfile, setCoachProfile] = useState({
    displayName: '',
    formerGroup: '',
    specialty: '',
    introduction: '',
    sessionPrice: '',
    availableDays: [],
    image: '🌸',
    maxClients: ''
  });
  // 読み込みが終わるまで保存させないためのフラグ
  const [coachProfileLoaded, setCoachProfileLoaded] = useState(false);
  // 通知は承認済み申込とクライアントからの新着メッセージから組み立てる（下のuseEffect）
  const [notifications, setNotifications] = useState([]);
  // 既読状態は notification_reads テーブルに保存する（null = まだ読み込んでいない）
  const [notifReadIds, setNotifReadIds] = useState(null);
  
  // クライアント（ファン）側の画面分岐用
  const [clientViewType, setClientViewType] = useState(null); // 'search' or 'mycoach'
  const [currentCoachIndex, setCurrentCoachIndex] = useState(0);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [appliedCoachIds, setAppliedCoachIds] = useState(new Set()); // 申し込み済みコーチID

  // ログイン済みクライアントが申し込み済みのコーチIDを取得
  useEffect(() => {
    if (!session?.user) return;
    const fetchMyApplications = async () => {
      const { data } = await supabase
        .from('applications')
        .select('coach_id')
        .eq('client_id', session.user.id)
        .in('status', ['pending', 'approved']);
      if (data) setAppliedCoachIds(new Set(data.map(a => a.coach_id)));
    };
    fetchMyApplications();
  }, [session]);
  const [clientMyCoachTab, setClientMyCoachTab] = useState('messages'); // 'messages', 'schedule', 'files'
  const [clientFiles, setClientFiles] = useState([]);



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
        created_at: m.created_at,
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
          created_at: m.created_at,
          sender_id: m.sender_id,
          receiver_id: m.receiver_id
        }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  // メッセージ一覧のスクロールコンテナ用ref
  // ファン側・コーチ側・「運営とチャット」の3箇所で使うが、同時にマウントされるのは
  // 常に1つなのでrefは1つで足りる
  const messagesScrollRef = useRef(null);

  // メッセージは古い→新しい（最新が下）の順で描画するため、
  // 表示切り替え時・メッセージ追加時に最下部へ自動スクロールする
  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, adminChatMessages, selectedClient, selectedCoach, clientDetailView, clientMyCoachTab]);

  // ===== 通知 =====
  const notifStorageKey = session?.user?.id ? `oshi-notif-read-${session.user.id}` : null;

  // 既読IDをDBから読み込む（旧バージョンがブラウザに残した既読は一度だけDBへ引き継ぐ）
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    let cancelled = false;

    const loadReadIds = async () => {
      const { data, error } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        // 読めなくても通知自体は表示できるようにする（全部未読扱い）
        console.error('既読の読み込みに失敗しました:', error);
        setNotifReadIds(new Set());
        return;
      }

      const ids = new Set((data || []).map(r => r.notification_id));

      // 旧バージョンがブラウザに保存していた既読を拾う
      let legacy = [];
      if (notifStorageKey) {
        try {
          const raw = window.localStorage.getItem(notifStorageKey);
          const parsed = raw ? JSON.parse(raw) : [];
          legacy = Array.isArray(parsed) ? parsed : [];
        } catch {
          legacy = [];
        }
      }
      const missing = legacy.filter(id => typeof id === 'string' && !ids.has(id));
      if (missing.length > 0) {
        const { error: migrateError } = await supabase
          .from('notification_reads')
          .upsert(
            missing.map(id => ({ user_id: userId, notification_id: id })),
            { onConflict: 'user_id,notification_id' }
          );
        if (!migrateError) missing.forEach(id => ids.add(id));
      }
      if (notifStorageKey && legacy.length > 0) {
        try {
          window.localStorage.removeItem(notifStorageKey);
        } catch {
          // 消せなくても動作に影響はない
        }
      }

      if (!cancelled) setNotifReadIds(ids);
    };

    loadReadIds();
    return () => { cancelled = true; };
  }, [session?.user?.id, notifStorageKey]);

  const markNotificationsRead = async (ids) => {
    const userId = session?.user?.id;
    if (!ids || ids.length === 0 || !userId) return;
    const unread = ids.filter(id => !(notifReadIds && notifReadIds.has(id)));
    if (unread.length === 0) return;

    // 画面はすぐ既読にして、保存はそのあと
    setNotifications(prev => prev.map(n => (unread.includes(n.id) ? { ...n, read: true } : n)));
    setNotifReadIds(prev => {
      const next = new Set(prev || []);
      unread.forEach(id => next.add(id));
      return next;
    });

    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        unread.map(id => ({ user_id: userId, notification_id: id })),
        { onConflict: 'user_id,notification_id' }
      );
    if (error) console.error('既読の保存に失敗しました:', error);
  };

  // 通知の組み立て
  useEffect(() => {
    if (userType !== 'coach' || !session?.user?.id || notifReadIds === null) return;
    const myId = session.user.id;
    const nameOf = (id) => realClients.find(c => c.id === id)?.name || 'クライアント';
    const items = [];

    // 1) 運営に承認された新しいクライアント
    approvedApps.forEach(a => {
      items.push({
        id: `app-${a.id}`,
        type: 'application',
        clientId: a.client_id,
        clientName: nameOf(a.client_id),
        date: a.created_at?.split('T')[0] || '',
        sortKey: a.created_at || '',
        message: `${nameOf(a.client_id)}さんの申し込みが承認されました。コーチングを開始できます。`,
      });
    });

    // 2) クライアントからの新着メッセージ（相手ごとに最新の1件だけ）
    const latestInbound = {};
    messages.forEach(m => {
      if (m.sender_id === myId) return;
      if (!realClients.some(c => c.id === m.sender_id)) return;
      const cur = latestInbound[m.sender_id];
      if (!cur || (m.created_at || '') > (cur.created_at || '')) latestInbound[m.sender_id] = m;
    });
    Object.values(latestInbound).forEach(m => {
      items.push({
        id: `msg-${m.id}`,
        type: 'message',
        clientId: m.sender_id,
        clientName: nameOf(m.sender_id),
        date: m.created_at?.split('T')[0] || '',
        sortKey: m.created_at || '',
        message: m.text && m.text.length > 60 ? `${m.text.slice(0, 60)}…` : (m.text || ''),
      });
    });

    items.sort((a, b) => String(b.sortKey).localeCompare(String(a.sortKey)));
    setNotifications(items.map(n => ({ ...n, read: notifReadIds.has(n.id) })));
  }, [userType, session?.user?.id, approvedApps, realClients, messages, notifReadIds]);

  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  // クライアント詳細を開く（一覧からも通知からも使う）
  const openClient = async (client) => {
    if (!client || !session?.user) return;
    setSelectedClient(client);
    const [{ data: memoData }, { data: filesData }] = await Promise.all([
      supabase.from('coach_memos').select('memo')
        .eq('coach_id', session.user.id).eq('client_id', client.id).single(),
      supabase.from('files').select('*')
        .eq('coach_id', session.user.id).eq('client_id', client.id)
        .order('created_at', { ascending: false })
    ]);
    setMemoText(memoData?.memo || '');
    setSelectedClient({
      ...client,
      files: (filesData || []).map(f => ({
        id: f.id,
        name: f.file_name,
        uploadDate: f.created_at?.split('T')[0],
        size: f.file_size,
        path: f.file_path
      }))
    });
  };

  // クライアント一覧を取り直したら、開きっぱなしの詳細画面の数値も追従させる。
  // これが無いと、詳細を開いたままスケジュールを「実施済み」にしても
  // 詳細ヘッダーのセッション回数だけ古い値のまま残ってしまう。
  // ※ selectedClient の宣言より後ろに置くこと（前に置くと初期化前参照でクラッシュする）
  useEffect(() => {
    if (!selectedClient) return;
    const fresh = realClients.find(c => c.id === selectedClient.id);
    if (!fresh) return;
    setSelectedClient(prev => {
      if (!prev) return prev;
      // 値が変わっていなければ同じオブジェクトを返す（再レンダリングの無限ループ防止）
      if (
        prev.sessions === fresh.sessions &&
        prev.nextSession === fresh.nextSession &&
        prev.lastMessage === fresh.lastMessage
      ) return prev;
      // memo と files は詳細画面で読み込んだものなので引き継ぐ
      return {
        ...prev,
        sessions: fresh.sessions,
        nextSession: fresh.nextSession,
        lastMessage: fresh.lastMessage
      };
    });
  }, [realClients, selectedClient]);

  // メッセージ内のURLをリンクに変換して表示
  const renderMessageText = (text, isMine) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return (
      <span className="whitespace-pre-wrap">
        {parts.map((part, i) =>
          urlRegex.test(part) ? (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline break-all ${isMine ? 'text-pink-100' : 'text-blue-600'}`}
            >
              {part}
            </a>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

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
        created_at: data.created_at,
        sender_id: data.sender_id,
        receiver_id: data.receiver_id
      }]);
    }
  };

  // 運営へのメッセージ送信（コーチ側）
  const sendAdminMessage = async () => {
    if (!adminChatNewMessage.trim() || !adminUserId || !session?.user) return;
    const text = adminChatNewMessage.trim();
    setAdminChatNewMessage('');
    const { data: sent } = await supabase
      .from('messages')
      .insert({ sender_id: session.user.id, receiver_id: adminUserId, text })
      .select().single();
    if (sent) {
      adminSeenIds.current.add(sent.id);
      setAdminChatMessages(prev => [...prev, {
        id: sent.id, sender: 'me', text: sent.text,
        time: new Date(sent.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
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

  // パスワード再設定メールのリンクから来た場合
  if (recoveryMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full mb-4">
                <Heart className="w-8 h-8 text-white" fill="white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">推しコーチング</h1>
              <p className="text-gray-600">新しいパスワードの設定</p>
            </div>

            {passwordMessage.text && (
              <div
                className={`mb-4 p-3 rounded-lg text-sm ${
                  passwordMessage.type === 'error'
                    ? 'bg-red-50 text-red-600 border border-red-200'
                    : 'bg-green-50 text-green-600 border border-green-200'
                }`}
              >
                {passwordMessage.text}
              </div>
            )}

            {!session && (
              <div className="mb-4 p-3 rounded-lg text-sm bg-yellow-50 text-yellow-700 border border-yellow-200">
                リンクの有効期限が切れているようです。お手数ですが、ログイン画面から再度お手続きください。
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">新しいパスワード</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  required
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">※ 6文字以上で設定してください</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">確認のためもう一度</label>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={passwordSaving || !session}
                className={`w-full py-3 rounded-lg font-medium text-white transition-all ${
                  passwordSaving || !session
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg hover:shadow-xl'
                }`}
              >
                {passwordSaving ? '保存中...' : 'パスワードを変更する'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={async () => {
                  try {
                    window.history.replaceState({}, '', window.location.pathname);
                  } catch {
                    // 消せなくても動作に影響はない
                  }
                  setRecoveryMode(false);
                  if (!session) await supabase.auth.signOut();
                }}
                className="text-pink-600 hover:text-pink-700 text-sm font-medium"
              >
                ログイン画面に戻る
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">© 2026 推しコーチング運営事務局</p>
        </div>
      </div>
    )
  }

  // ログインしていない場合
  if (!session) {
    return <Login />
  }

  // usersテーブルからuser_typeを取得中（確定するまでの一瞬の白画面を防ぐ）
  if (userType === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-16 h-16 text-pink-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  // 運営(admin)アカウントでログインしている場合
  if (userType === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full mb-4">
                <Heart className="w-8 h-8 text-white" fill="white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">推しコーチング</h1>
              <p className="text-gray-600">運営アカウントでログイン中です</p>
            </div>

            <div className="mb-6 p-3 rounded-lg text-sm bg-pink-50 text-pink-600 border border-pink-200 text-center">
              こちらはファン・コーチ向けの画面です。<br />
              運営の操作は管理画面から行ってください。
            </div>

            <a
              href="/admin"
              className="block w-full py-3 rounded-lg font-medium text-white text-center transition-all bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg hover:shadow-xl"
            >
              管理画面へ
            </a>

            <div className="mt-6 text-center">
              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  window.location.reload()
                }}
                className="text-pink-600 hover:text-pink-700 text-sm font-medium"
              >
                ログアウト
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            © 2026 推しコーチング運営事務局
          </p>
        </div>
      </div>
    )
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
        {/* paddingBottom: iPhone下端のホームバー（セーフエリア）にボタンが重ならないようにする */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 flex" style={{ backgroundColor: '#fff', borderTop: '1px solid #fce7f3', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {[
            { view: 'dashboard', icon: <Users className="w-5 h-5" />, label: 'クライアント' },
            { view: 'calendar', icon: <Calendar className="w-5 h-5" />, label: 'スケジュール' },
            { view: 'admin_chat', icon: <MessageCircle className="w-5 h-5" />, label: '運営' },
            { view: 'settings', icon: <Settings className="w-5 h-5" />, label: '設定' },
          ].map(item => (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '10px 0',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                borderTop: currentView === item.view ? '2px solid #ec4899' : '2px solid transparent',
                color: currentView === item.view ? '#ec4899' : '#9ca3af',
                cursor: 'pointer',
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* 下部ナビとセーフエリアのぶん、最後のカードが隠れないように余白を取る */}
        <div className="max-w-5xl mx-auto px-4 py-6 pb-[calc(6rem_+_env(safe-area-inset-bottom))] lg:pb-6">
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
                    onClick={() => setCurrentView('admin_chat')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'admin_chat' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>運営とチャット</span>
                  </button>
                  <button
                    onClick={() => setCurrentView('settings')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      currentView === 'settings' ? 'bg-pink-50 text-pink-600' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Settings className="w-5 h-5" />
                    <span>設定</span>
                    {unreadNotificationCount > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {unreadNotificationCount}
                      </span>
                    )}
                  </button>
                </nav>
              </div>
            </div>

            {/* メインコンテンツ */}
            <div className="lg:col-span-3">

              {/* 運営とチャット */}
              {currentView === 'admin_chat' && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-2xl font-bold text-gray-800 mb-1">運営とチャット</h2>
                    <p className="text-gray-500 text-sm">推しコーチング運営事務局とのやり取り</p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-pink-50">
                      <div className="w-9 h-9 bg-pink-200 rounded-full flex items-center justify-center text-lg">🛡️</div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">推しコーチング運営</p>
                        <p className="text-xs text-gray-500">運営事務局</p>
                      </div>
                    </div>
                    <div ref={messagesScrollRef} style={{ overflowY: 'auto', maxHeight: '420px', minHeight: '200px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overscrollBehavior: 'contain' }}>
                      {adminChatMessages.length === 0 && (
                        <p className="text-gray-400 text-sm text-center py-8">まだメッセージがありません。運営へのご連絡はこちらからどうぞ！</p>
                      )}
                      {adminChatMessages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                            msg.sender === 'me' ? 'bg-pink-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                            <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-pink-100' : 'text-gray-400'}`}>{msg.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px', display: 'flex', gap: '8px', backgroundColor: '#fff' }}>
                      <input
                        type="text"
                        placeholder="運営へのメッセージを入力..."
                        value={adminChatNewMessage}
                        onChange={e => setAdminChatNewMessage(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendAdminMessage(); }}
                        className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:bg-white focus:ring-2 focus:ring-pink-300 text-sm"
                      />
                      <button
                        onClick={sendAdminMessage}
                        style={{ backgroundColor: '#ec4899', color: '#fff', padding: '8px 20px', borderRadius: '999px', fontSize: '14px', fontWeight: '600' }}
                      >
                        送信
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'settings' && (
                <div>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">設定</h2>
                    <p className="text-gray-600">アカウント・プロフィール・通知の管理</p>
                  </div>

                  {/* タブナビゲーション */}
                  <div className="bg-white rounded-xl shadow-sm mb-6 p-3">
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {[
                        { key: 'account', label: 'アカウント' },
                        { key: 'profile', label: 'プロフィール' },
                        { key: 'notifications', label: '通知' },
                      ].map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setSettingsTab(tab.key)}
                          style={{
                            flexShrink: 0,
                            padding: '8px 18px',
                            borderRadius: '999px',
                            fontSize: '13px',
                            fontWeight: 500,
                            border: 'none',
                            cursor: 'pointer',
                            position: 'relative',
                            backgroundColor: settingsTab === tab.key ? '#ec4899' : '#fdf2f8',
                            color: settingsTab === tab.key ? '#fff' : '#9ca3af',
                            transition: 'all 0.2s',
                          }}
                        >
                          {tab.label}
                          {tab.key === 'notifications' && unreadNotificationCount > 0 && (
                            <span style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {unreadNotificationCount}
                            </span>
                          )}
                        </button>
                      ))}
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
                              <p className="text-sm text-gray-600 break-all">{session?.user?.email || '未設定'}</p>
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
                              最大クライアント数 <span className="text-gray-400 font-normal">（空欄=無制限）</span>
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={coachProfile.maxClients}
                              onChange={(e) => setCoachProfile({...coachProfile, maxClients: e.target.value})}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                              placeholder="例: 10"
                            />
                            <p className="text-sm text-gray-500 mt-1">申し込み可能な最大人数を設定します</p>
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
                          disabled={!coachProfileLoaded}
                          onClick={async () => {
                            if (!coachProfileLoaded) return;
                            const { error } = await supabase.from('coaches').update({
                              display_name: coachProfile.displayName,
                              former_group: coachProfile.formerGroup,
                              specialty: coachProfile.specialty,
                              introduction: coachProfile.introduction,
                              session_price: coachProfile.sessionPrice,
                              available_days: coachProfile.availableDays,
                              image: coachProfile.image,
                              max_clients: coachProfile.maxClients ? parseInt(coachProfile.maxClients) : null,
                            }).eq('user_id', session.user.id);
                            if (error) { alert('保存に失敗しました: ' + error.message); return; }
                            alert('プロフィールを保存しました');
                          }}
                          className={`w-full mt-6 px-6 py-3 text-white rounded-lg transition-colors font-medium ${
                            coachProfileLoaded
                              ? 'bg-pink-500 hover:bg-pink-600'
                              : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {coachProfileLoaded ? '保存する' : '読み込み中...'}
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
                              未読 {unreadNotificationCount}件
                            </p>
                          </div>
                          {unreadNotificationCount > 0 && (
                            <button
                              onClick={() => {
                                markNotificationsRead(notifications.map(n => n.id));
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
                                onClick={async () => {
                                  markNotificationsRead([notification.id]);
                                  // 該当クライアントの画面へ移動する
                                  const client = realClients.find(c => c.id === notification.clientId);
                                  if (!client) return;
                                  setClientDetailView(notification.type === 'message' ? 'sessions' : 'overview');
                                  setCurrentView('dashboard');
                                  setSettingsTab('account');
                                  await openClient(client);
                                }}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                  notification.read
                                    ? 'bg-white border-gray-200'
                                    : 'bg-pink-50 border-pink-300'
                                } cursor-pointer hover:shadow-md`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      {notification.type === 'application' && (
                                        <span className="bg-pink-500 text-white px-2 py-1 rounded text-xs font-medium">
                                          新規クライアント
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
                                    <p className="text-xs text-pink-600 mt-2">
                                      {notification.type === 'message'
                                        ? 'クリックしてメッセージを確認 →'
                                        : 'クリックしてクライアント情報を確認 →'}
                                    </p>
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
                        const status = event.status || 'scheduled';
                        const isDone = status === 'completed';
                        const isCancelled = status === 'cancelled';
                        // 状態を変えて画面とDBの両方を更新する
                        const changeStatus = async (next) => {
                          const { error } = await supabase
                            .from('schedules').update({ status: next }).eq('id', event.id);
                          if (error) { alert('更新に失敗しました: ' + error.message); return; }
                          setScheduleEvents(prev => prev.map(e =>
                            e.id === event.id ? { ...e, status: next } : e));
                          // セッション回数と次回セッションの表示を作り直す
                          setClientsRefreshKey(k => k + 1);
                        };

                        return (
                          <div
                            key={event.id}
                            className={`bg-white rounded-xl p-6 shadow-sm border transition-all ${
                              isCancelled
                                ? 'border-gray-200 opacity-50'
                                : isDone
                                  ? 'border-green-200'
                                  : isPast
                                    ? 'border-gray-200 opacity-60'
                                    : 'border-pink-200 hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2 flex-wrap">
                                  <div className={`w-3 h-3 rounded-full ${
                                    isCancelled ? 'bg-gray-300' : isDone ? 'bg-green-500' : isPast ? 'bg-gray-400' : 'bg-pink-500'
                                  }`}></div>
                                  <h3 className="text-lg font-bold text-gray-800">{event.clientName}</h3>
                                  <span className="bg-pink-100 text-pink-600 px-2 py-1 rounded text-xs">
                                    {event.type}
                                  </span>
                                  {isDone && (
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">
                                      実施済み
                                    </span>
                                  )}
                                  {isCancelled && (
                                    <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded text-xs font-medium">
                                      キャンセル
                                    </span>
                                  )}
                                  {!isDone && !isCancelled && isPast && (
                                    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-medium">
                                      未記録
                                    </span>
                                  )}
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
                              <div className="flex gap-2 items-start shrink-0">
                                {/* 実施済み/キャンセルは、日時が過ぎた予定にだけ出す */}
                                {isPast && !isDone && !isCancelled && (
                                  <>
                                    <button
                                      onClick={() => changeStatus('completed')}
                                      className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600"
                                    >
                                      実施済み
                                    </button>
                                    <button
                                      onClick={() => changeStatus('cancelled')}
                                      className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-lg text-sm border border-gray-300"
                                    >
                                      キャンセル
                                    </button>
                                  </>
                                )}
                                {(isDone || isCancelled) && (
                                  <button
                                    onClick={() => changeStatus('scheduled')}
                                    className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                                  >
                                    戻す
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    if (confirm('この予定を削除しますか?')) {
                                      await supabase.from('schedules').delete().eq('id', event.id);
                                      setScheduleEvents(prev => prev.filter(e => e.id !== event.id));
                                      setClientsRefreshKey(k => k + 1);
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
                              <option value="お試し">お試し</option>
                              <option value="初回">初回</option>
                              <option value="コーチング">コーチング</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              URL（任意）
                            </label>
                            <input
                              type="url"
                              value={newSchedule.url}
                              onChange={(e) => setNewSchedule({...newSchedule, url: e.target.value})}
                              placeholder="https://zoom.us/j/..."
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                          </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                          <button
                            onClick={async () => {
                              if (!newSchedule.clientId || !newSchedule.date || !newSchedule.time) {
                                alert('すべての項目を入力してください');
                                return;
                              }

                              const client = realClients.find(c => c.id === newSchedule.clientId);
                              const nextSessionStr = `${newSchedule.date} ${newSchedule.time}`;

                              // Supabaseに保存
                              const { data: savedSchedule, error: schedErr } = await supabase
                                .from('schedules')
                                .insert({
                                  coach_id: session.user.id,
                                  client_id: newSchedule.clientId,
                                  client_name: client?.name || '不明',
                                  date: newSchedule.date,
                                  time: newSchedule.time,
                                  duration: newSchedule.duration,
                                  type: newSchedule.type,
                                  url: newSchedule.url || null
                                })
                                .select()
                                .single();

                              if (schedErr) {
                                alert('予定の保存に失敗しました');
                                return;
                              }

                              // stateに追加（SupabaseのUUIDを使用）
                              const newEvent = {
                                id: savedSchedule.id,
                                clientId: savedSchedule.client_id,
                                clientName: savedSchedule.client_name,
                                date: savedSchedule.date,
                                time: savedSchedule.time,
                                duration: savedSchedule.duration,
                                type: savedSchedule.type,
                                status: savedSchedule.status || 'scheduled'
                              };
                              setScheduleEvents(prev => [...prev, newEvent]);

                              // クライアント一覧の次回セッションを更新
                              setRealClients(prev => prev.map(c =>
                                c.id === newSchedule.clientId
                                  ? { ...c, nextSession: nextSessionStr }
                                  : c
                              ));
                              if (selectedClient?.id === newSchedule.clientId) {
                                setSelectedClient(prev => ({ ...prev, nextSession: nextSessionStr }));
                              }

                              // クライアントにチャットで予定を通知
                              const urlLine = newSchedule.url ? `\nURL: ${newSchedule.url}` : '';
                              const msgText = `【セッション予約のお知らせ】\n種類: ${newSchedule.type}\n日時: ${newSchedule.date} ${newSchedule.time}\n所要時間: ${newSchedule.duration}${urlLine}\nよろしくお願いします！`;
                              const { data: sentMsg, error: msgError } = await supabase
                                .from('messages')
                                .insert({
                                  sender_id: session.user.id,
                                  receiver_id: newSchedule.clientId,
                                  text: msgText
                                })
                                .select()
                                .single();
                              // コーチ側のチャットにも即時反映
                              if (!msgError && sentMsg) {
                                seenMessageIds.current.add(sentMsg.id);
                                setMessages(prev => [...prev, {
                                  id: sentMsg.id,
                                  sender: 'me',
                                  text: sentMsg.text,
                                  time: new Date(sentMsg.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
                                  sender_id: sentMsg.sender_id,
                                  receiver_id: sentMsg.receiver_id
                                }]);
                              }

                              setShowAddScheduleModal(false);
                              setNewSchedule({
                                clientId: '',
                                date: '',
                                time: '',
                                duration: '60分',
                                type: 'コーチング',
                                url: ''
                              });
                              alert(`予定を追加し、${client?.name || 'クライアント'}にチャットで通知しました`);
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
                                type: 'コーチング',
                                url: ''
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
                        onClick={() => openClient(client)}
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

              {/* クライアント詳細はクライアント一覧タブ専用。
                  currentViewで絞らないと、詳細を開いたまま他のタブに切り替えたときに
                  そのタブの内容と詳細が同時に表示され、メッセージ一覧のスクロール
                  コンテナも2つ同時にマウントされてしまう */}
              {currentView === 'dashboard' && selectedClient && (
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
                                    onClick={async () => {
                                      // stateを更新（selectedClient + realClients）
                                      const updatedClient = { ...selectedClient, memo: memoText };
                                      setSelectedClient(updatedClient);
                                      setRealClients(prev => prev.map(c => c.id === selectedClient.id ? updatedClient : c));
                                      setEditingMemo(false);
                                      // Supabaseに保存
                                      await supabase.from('coach_memos').upsert({
                                        coach_id: session.user.id,
                                        client_id: selectedClient.id,
                                        memo: memoText,
                                        updated_at: new Date().toISOString()
                                      }, { onConflict: 'coach_id,client_id' });
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
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const fileSize = file.size < 1024 ? `${file.size}B` :
                                  file.size < 1048576 ? `${Math.round(file.size / 1024)}KB` :
                                  `${Math.round(file.size / 1048576)}MB`;
                                // 保存先のパスは英数字だけにする（日本語名だと Invalid key で失敗するため）
                                const filePath = `${session.user.id}/${selectedClient.id}/${Date.now()}-${toStorageSafeName(file.name)}`;
                                // Supabase Storageにアップロード
                                const { error: uploadError } = await supabase.storage
                                  .from('coach-files').upload(filePath, file);
                                if (uploadError) {
                                  alert('アップロードに失敗しました: ' + uploadError.message);
                                  return;
                                }
                                // DBにメタデータ保存
                                const { data: fileRecord, error: dbError } = await supabase
                                  .from('files').insert({
                                    coach_id: session.user.id,
                                    client_id: selectedClient.id,
                                    file_name: file.name,
                                    file_path: filePath,
                                    file_size: fileSize
                                  }).select().single();
                                if (!dbError && fileRecord) {
                                  const newFile = { id: fileRecord.id, name: fileRecord.file_name, uploadDate: fileRecord.created_at?.split('T')[0], size: fileRecord.file_size, path: fileRecord.file_path };
                                  setSelectedClient(prev => ({ ...prev, files: [newFile, ...prev.files] }));
                                  alert(`${file.name} をアップロードしました。クライアントが確認できます。`);
                                }
                                e.target.value = '';
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
                                          if (file.path) {
                                            // 保存先のパスは英数字化しているので、落とすときは元のファイル名に戻す
                                            const { data } = supabase.storage
                                              .from('coach-files')
                                              .getPublicUrl(file.path, { download: file.name });
                                            window.open(data.publicUrl, '_blank');
                                          }
                                        }}
                                        className="px-3 py-1 text-pink-600 hover:bg-pink-50 rounded-lg text-sm"
                                      >
                                        ダウンロード
                                      </button>
                                      <button 
                                        onClick={async () => {
                                          if (confirm(`${file.name}を削除しますか？`)) {
                                            if (file.path) {
                                              await supabase.storage.from('coach-files').remove([file.path]);
                                            }
                                            await supabase.from('files').delete().eq('id', file.id);
                                            setSelectedClient(prev => ({ ...prev, files: prev.files.filter(f => f.id !== file.id) }));
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
                          <div ref={messagesScrollRef} style={{ overflowY: 'auto', maxHeight: '420px', minHeight: '200px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overscrollBehavior: 'contain' }}>
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
                                  <p>{renderMessageText(msg.text, msg.sender === 'me')}</p>
                                  <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-pink-100' : 'text-gray-500'}`}>
                                    {msg.time}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px', display: 'flex', gap: '8px', backgroundColor: '#fff' }}>
                            <input
                              type="text"
                              placeholder="メッセージを入力..."
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage(selectedClient.id); }}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-pink-500"
                            />
                            <button onClick={() => sendMessage(selectedClient.id)} style={{ backgroundColor: '#ec4899', color: '#fff', padding: '8px 24px', borderRadius: '8px' }}>
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
                  {currentCoach.maxClients != null && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">🎫 残り枠:</span>
                      {(() => {
                        const remaining = currentCoach.maxClients - currentCoach.currentApplications;
                        if (remaining <= 0) return <span className="text-red-500 font-bold">満員</span>;
                        return <span className={`font-bold ${remaining <= 3 ? 'text-orange-500' : 'text-green-600'}`}>残り{remaining}名</span>;
                      })()}
                      <span className="text-gray-400 text-sm">/ {currentCoach.maxClients}名</span>
                    </div>
                  )}
                </div>

                {/* 申し込みフォーム */}
                <div className="border-t border-gray-200 pt-4">
                  {appliedCoachIds.has(currentCoach.user_id) ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl py-4 px-4 text-center">
                      <p className="text-green-700 font-medium">✅ 申し込み済みです</p>
                      <p className="text-green-600 text-sm mt-1">運営の承認をお待ちください</p>
                    </div>
                  ) : currentCoach.maxClients != null && currentCoach.currentApplications >= currentCoach.maxClients ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl py-4 px-4 text-center">
                      <p className="text-red-600 font-medium">🈵 現在満員です</p>
                      <p className="text-red-500 text-sm mt-1">空き枠が出るまでお待ちください</p>
                    </div>
                  ) : (
                    <>
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
                          if (!applicationMessage.trim()) { alert('メッセージを入力してください'); return; }
                          if (!currentCoach?.user_id) { alert('コーチ情報が取得できませんでした'); return; }
                          // 画面を開いてから他の人が申し込んで満員になっている可能性があるため、
                          // 送信直前に最新の申し込み数を取り直して上限を再チェックする
                          const { data: latestCoach } = await supabase
                            .from('coaches').select('max_clients')
                            .eq('user_id', currentCoach.user_id).single();
                          const limit = latestCoach?.max_clients ?? null;
                          if (limit != null) {
                            const { count } = await supabase
                              .from('applications')
                              .select('id', { count: 'exact', head: true })
                              .eq('coach_id', currentCoach.user_id)
                              .in('status', ['pending', 'approved']);
                            if ((count ?? 0) >= limit) {
                              alert('申し訳ありません。このコーチは満員になりました。');
                              setCoaches(prev => prev.map(c => c.user_id === currentCoach.user_id
                                ? { ...c, maxClients: limit, currentApplications: count ?? 0 }
                                : c));
                              return;
                            }
                          }
                          const { error } = await supabase.from('applications').insert({
                            client_id: session.user.id,
                            coach_id: currentCoach.user_id,
                            message: applicationMessage,
                            status: 'pending'
                          });
                          if (error) { alert('送信に失敗しました: ' + error.message); return; }
                          setAppliedCoachIds(prev => new Set([...prev, currentCoach.user_id]));
                          alert(`${currentCoach.name}さんへの申し込みを送信しました！\n\n運営による承認後、コーチに通知されます。\n承認までしばらくお待ちください。`);
                          setApplicationMessage('');
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
                    </>
                  )}
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
              <button
                onClick={() => setClientMyCoachTab('files')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-colors ${
                  clientMyCoachTab === 'files' ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500'
                }`}
              >
                <FileText className="w-4 h-4" />
                ファイル ({clientFiles.length})
              </button>
            </div>
          </div>

          {/* ファイルエリア */}
          {clientMyCoachTab === 'files' && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4">コーチから共有されたファイル</h3>
              {clientFiles.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">まだファイルが共有されていません</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-pink-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{file.name}</p>
                          <p className="text-xs text-gray-500">{file.uploadDate} · {file.size}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (file.path) {
                            const { data } = supabase.storage.from('coach-files').getPublicUrl(file.path);
                            window.open(data.publicUrl, '_blank');
                          }
                        }}
                        className="px-4 py-1.5 bg-pink-500 text-white rounded-lg hover:bg-pink-600 text-sm"
                      >
                        開く
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* メッセージエリア */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ display: clientMyCoachTab === 'files' ? 'none' : 'block' }}>
            {/* メッセージ一覧（固定高さ・安定スクロール） */}
            <div ref={messagesScrollRef} style={{ overflowY: 'auto', maxHeight: '420px', minHeight: '200px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overscrollBehavior: 'contain' }}>
              {(() => {
                const myId = session?.user?.id;
                const partnerId = selectedCoach?.user_id;
                const filtered = messages.filter(m =>
                  partnerId && ((m.sender_id === myId && m.receiver_id === partnerId) ||
                  (m.sender_id === partnerId && m.receiver_id === myId))
                );
                if (filtered.length === 0) return (
                  <p className="text-gray-400 text-sm text-center py-8">まだメッセージがありません。最初のメッセージを送ってみましょう！</p>
                );
                return filtered.map(msg => (
                  <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                      msg.sender === 'me'
                        ? 'bg-pink-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      <p>{renderMessageText(msg.text, msg.sender === 'me')}</p>
                      <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-pink-100' : 'text-gray-400'}`}>
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* 入力欄（常に下に固定） */}
            <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px', display: 'flex', gap: '8px', backgroundColor: '#fff' }}>
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
        <Footer />
      </div>
    );
  }

  // どの分岐にも当てはまらない場合のフォールバック
  // （undefinedを返して画面が真っ白になる経路をなくすのが目的）
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full mb-4">
              <Heart className="w-8 h-8 text-white" fill="white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">推しコーチング</h1>
            <p className="text-gray-600">アカウント情報を読み込めませんでした</p>
          </div>

          <div className="mb-6 p-3 rounded-lg text-sm bg-red-50 text-red-600 border border-red-200 text-center">
            お手数ですが、再読み込みをお試しください。<br />
            解決しない場合は運営までお問い合わせください。
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 rounded-lg font-medium text-white transition-all bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg hover:shadow-xl"
          >
            再読み込み
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.reload()
              }}
              className="text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              ログアウト
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 推しコーチング運営事務局
        </p>
      </div>
    </div>
  );
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