import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl font-bold text-gray-800 mb-6">プライバシーポリシー</h1>
          <p className="text-sm text-gray-600 mb-8">最終更新日: 2026年1月30日</p>

          <div className="prose max-w-none space-y-6 text-gray-700">
            <p>
              推しコーチング運営事務局(以下、「当事務局」といいます。)は、本ウェブサイト上で提供するサービス(以下、「本サービス」といいます。)における、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー(以下、「本ポリシー」といいます。)を定めます。
            </p>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第1条(個人情報)</h2>
              <p>
                「個人情報」とは、個人情報保護法にいう「個人情報」を指すものとし、生存する個人に関する情報であって、当該情報に含まれる氏名、生年月日、住所、電話番号、連絡先その他の記述等により特定の個人を識別できる情報及び容貌、指紋、声紋にかかるデータ、及び健康保険証の保険者番号などの当該情報単体から特定の個人を識別できる情報(個人識別情報)を指します。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第2条(個人情報の収集方法)</h2>
              <p>
                当事務局は、ユーザーが利用登録をする際に氏名、メールアドレス、その他の個人情報をお尋ねすることがあります。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第3条(個人情報を収集・利用する目的)</h2>
              <p>当事務局が個人情報を収集・利用する目的は、以下のとおりです。</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>本サービスの提供・運営のため</li>
                <li>ユーザーからのお問い合わせに回答するため(本人確認を行うことを含む)</li>
                <li>メンテナンス、重要なお知らせなど必要に応じたご連絡のため</li>
                <li>利用規約に違反したユーザーや、不正・不当な目的でサービスを利用しようとするユーザーの特定をし、ご利用をお断りするため</li>
                <li>本サービスの改善、新サービスの開発のため</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第4条(個人情報の第三者提供)</h2>
              <p>
                当事務局は、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第5条(個人情報の開示)</h2>
              <p>
                当事務局は、本人から個人情報の開示を求められたときは、本人に対し、遅滞なくこれを開示します。
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4">第6条(ベータ版に関する特記事項)</h2>
              <p>本サービスは現在ベータ版(無料テスト運用)として提供されています。</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>本サービスは予告なく変更、中断、終了する場合があります</li>
                <li>データの保存について完全性を保証するものではありません</li>
                <li>本格運用開始時には、改めてユーザーの同意を取得する場合があります</li>
              </ol>
            </section>

            <section className="mt-12 pt-6 border-t border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4">お問い合わせ窓口</h2>
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
