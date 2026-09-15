import React, { useState } from 'react'
import { supabase } from './supabaseClient'
import { Heart, Mail, Lock, User } from 'lucide-react'

const Login = () => {
  const [isLogin, setIsLogin] = useState(true)
  const [isReset, setIsReset] = useState(false) // パスワード再設定メールの送信画面
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [userType] = useState('client') // 新規登録は常にclient（コーチはAdmin経由で作成）
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // ログイン成功
      console.log('ログイン成功:', data)
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'ログインに失敗しました'
      })
    } finally {
      setLoading(false)
    }
  }

  // パスワード再設定メールを送る
  const handleResetRequest = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      // メール内のリンクからこのアプリに戻ってくるようにする
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?type=recovery`,
      })

      if (error) throw error

      // 登録が無いアドレスかどうかは、あえて区別しない（総当たりでアカウントの有無を調べられないようにするため）
      setMessage({
        type: 'success',
        text: 'パスワード再設定用のメールを送りました。メールのリンクから新しいパスワードを設定してください。',
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'メールの送信に失敗しました',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage({ type: '', text: '' })

    try {
      // 1. Supabase Authでユーザー登録
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          }
        }
      })

      if (authError) throw authError

      // 2. usersテーブルにユーザー情報を保存
      if (authData.user) {
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: authData.user.id,
              email: email,
              name: name,
              user_type: userType,
              created_at: new Date().toISOString()
            }
          ])

        if (insertError) {
          console.error('ユーザー情報の保存エラー:', insertError)
        }
      }

      // 登録後、自動ログインを防ぐためにログアウト
      await supabase.auth.signOut()

      // 登録成功後、すぐにログイン画面に切り替え
      setIsLogin(true)
      setMessage({
        type: 'success',
        text: '登録完了！ログインしてください。'
      })

      // フォームをリセット
      setEmail('')
      setPassword('')
      setName('')
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || '登録に失敗しました'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* ヘッダー */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full mb-4">
              <Heart className="w-8 h-8 text-white" fill="white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">推しコーチング</h1>
            <p className="text-gray-600">
              {isReset ? 'パスワードの再設定' : isLogin ? 'ログイン' : '新規登録'}
            </p>
          </div>

          {/* メッセージ表示 */}
          {message.text && (
            <div className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === 'error'
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-green-50 text-green-600 border border-green-200'
            }`}>
              {message.text}
            </div>
          )}

          {/* フォーム */}
          <form
            onSubmit={isReset ? handleResetRequest : isLogin ? handleLogin : handleSignup}
            className="space-y-4"
          >
            {/* 再設定画面の説明 */}
            {isReset && (
              <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                ご登録のメールアドレスを入力してください。パスワードを再設定するためのリンクをお送りします。
              </p>
            )}

            {/* 名前入力（新規登録時のみ） */}
            {!isLogin && !isReset && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    お名前
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="山田太郎"
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            {/* メールアドレス */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            {/* パスワード（再設定メールの送信時は不要） */}
            {!isReset && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>
              {!isLogin && (
                <p className="text-xs text-gray-500 mt-1">
                  ※ 6文字以上で設定してください
                </p>
              )}
              {isLogin && (
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReset(true)
                      setPassword('')
                      setMessage({ type: '', text: '' })
                    }}
                    className="text-xs text-gray-500 hover:text-pink-600 underline"
                  >
                    パスワードをお忘れですか？
                  </button>
                </div>
              )}
            </div>
            )}

            {/* ログイン/登録ボタン */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium text-white transition-all ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-lg hover:shadow-xl'
              }`}
            >
              {loading
                ? '処理中...'
                : isReset
                ? '再設定メールを送る'
                : isLogin
                ? 'ログイン'
                : '新規登録'}
            </button>
          </form>

          {/* 切り替えリンク */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                if (isReset) {
                  setIsReset(false)
                  setIsLogin(true)
                } else {
                  setIsLogin(!isLogin)
                }
                setMessage({ type: '', text: '' })
              }}
              className="text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              {isReset ? 'ログイン画面に戻る' : isLogin ? '新規登録はこちら' : 'ログインはこちら'}
            </button>
          </div>

          {/* コーチ申請リンク */}
          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500 mb-2">コーチとして活動したい方</p>
            <a
              href="https://forms.gle/MuzB8gahuZbz5KhJ6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:text-purple-700 font-medium underline"
            >
              コーチ申請フォームはこちら →
            </a>
          </div>
        </div>

        {/* フッター */}
        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 推しコーチング運営事務局
        </p>
      </div>
    </div>
  )
}

export default Login
