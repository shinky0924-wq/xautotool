export const onRequestGet: PagesFunction = async (context) => {
  return new Response("ZIPファイルのダウンロードは、AI Studioの開発環境内でのみ実行可能です。Cloudflareの本番環境では、すでにすべてのソースコードがデプロイされているため不要です。Windowsデスクトップ版をご利用の場合は、AI Studioの管理画面からエクスポートしてご使用ください。", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
};
