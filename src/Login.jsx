import React, { useState } from 'react'
import { supabase } from './supabaseClient'
import { Heart, Mail, Lock, User } from 'lucide-react'

const Login = () => {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [userType, setUserType] = useState('client') // 'coach' or 'client'
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
              {isLogin ? 'ログイン' : '新規登録'}
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
          <form onSubmit={isLogin ? handleLogin : handleSignup} className="space-y-4">
            {/* ユーザータイプ選択と名前入力（新規登録時のみ） */}
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    登録タイプ
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setUserType('client')}
                      className={`flex-1 py-3 rounded-lg border-2 transition-colors ${
                        userType === 'client'
                          ? 'border-pink-500 bg-pink-50 text-pink-600 font-medium'
                          : 'border-gray-300 text-gray-600 hover:border-pink-300'
                      }`}
                    >
                      ファンとして登録
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserType('coach')}
                      className={`flex-1 py-3 rounded-lg border-2 transition-colors ${
                        userType === 'coach'
                          ? 'border-pink-500 bg-pink-50 text-pink-600 font-medium'
                          : 'border-gray-300 text-gray-600 hover:border-pink-300'
                      }`}
                    >
                      コーチとして登録
                    </button>
                  </div>
                </div>
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

            {/* パスワード */}
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
            </div>

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
              {loading ? '処理中...' : isLogin ? 'ログイン' : '新規登録'}
            </button>
          </form>

          {/* 切り替えリンク */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin)
                setMessage({ type: '', text: '' })
              }}
              className="text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              {isLogin ? '新規登録はこちら' : 'ログインはこちら'}
            </button>
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
