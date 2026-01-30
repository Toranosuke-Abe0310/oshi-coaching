import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-pink-600 hover:text-pink-700 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          戻る
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">利用規約</h1>
          <p className="text-sm text-gray-600 mb-8">最終更新日: 2026年1月30日</p>

          <div className="prose max-w-none space-y-6 text-gray-700">
            <p>
              この利用規約(以下、「本規約」といいます。)は、推しコーチング運営事務局(以下、「当事務局」といいます。)がこのウェブサイト上で提供するサービス(以下、「本サービス」といいます。)の利用条件を定めるものです。
            </p>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第1条(適用)</h2>
              <p>
                本規約は、ユーザーと当事務局との間の本サービスの利用に関わる一切の関係に適用されるものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第2条(ベータ版について)</h2>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>本サービスは現在、ベータ版(無料テスト運用)として提供されています。</li>
                <li>ベータ版期間中、本サービスは無料で提供されます。</li>
                <li>ベータ版期間中、以下の点にご留意ください:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>サービスの機能や仕様は予告なく変更される場合があります</li>
                    <li>データの保存について完全性を保証するものではありません</li>
                    <li>サービスが予告なく中断または終了する場合があります</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第3条(利用登録)</h2>
              <p>
                本サービスにおいては、登録希望者が本規約に同意の上、当事務局の定める方法によって利用登録を申請し、当事務局がこれを承認することによって、利用登録が完了するものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第4条(禁止事項)</h2>
              <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>法令または公序良俗に違反する行為</li>
                <li>犯罪行為に関連する行為</li>
                <li>当事務局のサービスの運営を妨害するおそれのある行為</li>
                <li>他のユーザーに関する個人情報等を収集または蓄積する行為</li>
                <li>他のユーザーまたはその他の第三者に不利益、損害、不快感を与える行為</li>
                <li>面識のない異性との出会いを目的とした行為</li>
                <li>その他、当事務局が不適切と判断する行為</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第5条(本サービスの提供の停止等)</h2>
              <p>
                当事務局は、システムの保守点検、不可抗力、その他の理由により、ユーザーに事前に通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第6条(保証の否認および免責事項)</h2>
              <p>
                当事務局は、本サービスに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しておりません。当事務局は、本サービスに起因してユーザーに生じたあらゆる損害について、当事務局の故意又は重過失による場合を除き、一切の責任を負いません。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第7条(個人情報の取扱い)</h2>
              <p>
                当事務局は、本サービスの利用によって取得する個人情報については、当事務局「プライバシーポリシー」に従い適切に取り扱うものとします。
              </p>
            </section>

            <section className="mt-12 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4">お問い合わせ</h2>
              <p className="mb-2"><strong>運営者:</strong> 推しコーチング運営事務局</p>
              <p className="mb-2"><strong>Eメールアドレス:</strong> oshicoaching.official@gmail.com</p>
              <p><strong>サービスURL:</strong> https://oshi-coaching-web-app.vercel.app</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
