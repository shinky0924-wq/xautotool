interface Env {}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: any = await context.request.json();
    const { url } = body;
    if (!url) {
      return new Response(JSON.stringify({ error: "X(Twitter)のURLを入力してください。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const inputUrl = url.trim();
    // Extract numeric status ID from any X/Twitter URL
    const statusMatch = inputUrl.match(/\/status\/(\d+)/i);
    if (!statusMatch) {
      return new Response(JSON.stringify({ error: "有効なX(Twitter)のポストURLではありません。「https://x.com/ユーザー名/status/数値」の形式であることを確認してください。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tweetId = statusMatch[1];
    const cleanUrl = `https://twitter.com/i/status/${tweetId}`;
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}`;

    const fetchResponse = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });

    if (!fetchResponse.ok) {
      return new Response(JSON.stringify({ 
        error: "ポスト情報の取得に失敗しました。X側のアクセス制限（サーバー保護）、非公開アカウント（鍵垢）、または削除済みの可能性があります。恐れ入りますが、該当ポストの本文をコピーして、下の「ターゲットポスト本文」入力欄に直接貼り付けてご使用ください。" 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data: any = await fetchResponse.json();
    if (!data || !data.html) {
      return new Response(JSON.stringify({ error: "ポストのHTMLデータの解析に失敗しました。本文をコピーして直接貼り付けてください。" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const match = data.html.match(/<p\b[^>]*>(.*?)<\/p>/i);
    if (!match || !match[1]) {
      return new Response(JSON.stringify({ error: "ポストの本文テキストを抽出できませんでした。本文をコピーして直接貼り付けてください。" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Clean HTML tags and entities
    let tweetText = match[1]
      .replace(/<a\b[^>]*>.*?<\/a>/ig, "") // remove links/hashtags/usernames
      .replace(/<[^>]+>/g, ""); // remove other html tags

    tweetText = tweetText
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .trim();

    return new Response(JSON.stringify({
      text: tweetText,
      author: data.author_name || "Xユーザー"
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: "サーバーエラーによりポスト情報を取得できませんでした。エラー内容: " + error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
