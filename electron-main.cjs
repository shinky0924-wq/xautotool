// electron-main.cjs
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const { GoogleGenAI } = require('@google/genai');

let mainWindow;
let serverInstance;

// Setup a minimal local express server inside Electron to handle API requests locally without external server requirements!
function startLocalServer() {
  const localApp = express();
  localApp.use(express.json());

  // Support local static assets in both dev and production
  const distPath = __dirname.endsWith('dist') ? __dirname : path.join(__dirname, 'dist');
  localApp.use(express.static(distPath));

  // Handle fetching tweet by URL
  localApp.post('/api/fetch-tweet', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "X(Twitter)のURLを入力してください。" });
      }

      let cleanUrl = url.trim();
      if (cleanUrl.includes("x.com/")) {
        cleanUrl = cleanUrl.replace("x.com/", "twitter.com/");
      }

      if (!cleanUrl.includes("twitter.com/") || !cleanUrl.includes("/status/")) {
        return res.status(400).json({ error: "有効なX(Twitter)のポストURLではありません。" });
      }

      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
      const fetchResponse = await fetch(oembedUrl);
      
      if (!fetchResponse.ok) {
        return res.status(404).json({ error: "ポスト情報の取得に失敗しました。非公開か、削除された可能性があります。" });
      }

      const data = await fetchResponse.json();
      if (!data || !data.html) {
        return res.status(500).json({ error: "ポストのHTMLデータの解析に失敗しました。" });
      }

      const match = data.html.match(/<p\b[^>]*>(.*?)<\/p>/i);
      if (!match || !match[1]) {
        return res.status(500).json({ error: "ポストの本文テキストが見つかりませんでした。" });
      }

      let tweetText = match[1]
        .replace(/<a\b[^>]*>.*?<\/a>/ig, "")
        .replace(/<[^>]+>/g, "");

      tweetText = tweetText
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        .trim();

      res.json({
        text: tweetText,
        author: data.author_name || "Xユーザー"
      });
    } catch (error) {
      res.status(500).json({ error: "ポスト情報を取得できませんでした: " + error.message });
    }
  });

  // Handle local AI requests
  localApp.post('/api/generate-replies', async (req, res) => {
    try {
      const { tweet, staffInfo, rules, count = 3 } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!tweet) {
        return res.status(400).json({ error: "相手のポスト内容を入力してください。" });
      }

      if (!apiKey) {
        const localReplies = [];
        const empathies = [
          "ポスト見ました、本当にお疲れ様です。主さんの気持ち、すごく分かります…。",
          "お疲れ様です。少しでもお力になれたらと思ってリプしちゃいました。",
          "ツイート拝見しました。毎日色々と考え込んじゃうことありますよね…。",
          "お疲れ様です！頑張りすぎて疲れないでくださいね。無理しないでくださいね。",
          "はじめまして。ツイート読んで、なんだか他人事とは思えなくて…。",
          "毎日本当にお疲れ様です。少しでも心が軽くなればいいなと思ってます。",
          "お疲れ様です。色々大変な時期ですよね、あまり自分を責めすぎないでね。",
          "ツイート見て勝手ながら心配になっちゃいました。無理は禁物ですよ。"
        ];

        const bodies = [
          "周りの状況と比べたりすると、焦っちゃうこともありますよね。",
          "出稼ぎや短期でサクッと稼いで、一旦リセットするのも全然ありだと思います。",
          "うちのお店にも同じような悩みからスタートして、今しっかり自分のペースで稼げてる子がたくさんいますよ。",
          "人生一度きりだし、短期間で目標額を決めて集中してやるのも一つの選択肢です。",
          "昼職との両立とか、自分の体調やスケジュールを最優先にできる環境って意外と大事だったりします。",
          "私の周りでも、最初は不安だったけど一歩踏み出して生活が激変した子が本当に多いです。",
          "まずは無理のない範囲で、少しずつ自分のペースで進めていくのが一番だと思います。",
          "やっぱり自分を一番大切にしてほしいです。もし息詰まったら、違う環境を覗いてみるのも手ですよ。"
        ];

        const suggests = [
          "焦らずにまずは美味しいものでも食べて、ゆっくり休んでくださいね。",
          "選択肢の一つとして、いつでも気軽に相談乗るので、息抜きにでもDMくださいね。",
          "こういう働き方もあるんだなーって知っておくだけでも、少し気持ちが楽になるかもしれません。",
          "もし何か気になることや、誰にも言えない愚痴があれば、いつでもDMでお話ししましょう！",
          "無理にとは言いませんが、一歩踏み出したい時は全力でサポートしますからね。",
          "主さんのペースで、無理なくやれる方法を一緒に探すこともできますよ。",
          "いつでもここにいるので、話だけでも聞かせてくれたら嬉しいです！",
          "一回今の環境から離れてみて、リフレッシュする時間を作ってみるのもおすすめです。"
        ];

        const explanations = [
          "まずは相手の今の頑張りや疲労を温かく労い、押し付けがましくない距離感から安心感と信頼感を与えるアプローチです。",
          "具体的な選択肢があることを優しく匂わせつつ、逃げ道や別の手段があることで、精神的な焦りを和らげるように寄り添っています。",
          "過度な勧誘を一切排除し、いつでも相談に乗れる存在（味方）であることを示し、自発的にDMを送りたくなるような関係性を構築します。"
        ];

        const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
          const emp = shuffle(empathies)[i % empathies.length];
          const bdy = shuffle(bodies)[(i + 1) % bodies.length];
          const sug = shuffle(suggests)[(i + 2) % suggests.length];

          let fullText = `${emp} ${bdy} ${sug}`;
          if (fullText.length > 110) {
            fullText = `${emp}${bdy}${sug}`;
          }
          if (fullText.length > 120) {
            fullText = fullText.substring(0, 110) + "…";
          }

          localReplies.push({
            text: fullText,
            explanation: `【APIオフライン生成】${explanations[i % explanations.length]}`
          });
        }

        return res.json({ replies: localReplies });
      }

      const ai = new GoogleGenAI({ apiKey });
      const role = staffInfo?.role || "";
      const purpose = staffInfo?.purpose || "";

      const rulesList = rules && rules.length > 0 ? rules : [];
      const rulesPrompt = rulesList.map((r, i) => `${i + 1}. ${r}`).join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `以下の相手のポストに対して、設定とルールに沿った自然な返信を ${count} パターン作成してください。\n\n【相手のポスト】\n${tweet}`,
        config: {
          systemInstruction: `あなたはX（Twitter）の投稿に対して、設定されたロールと目的に基づき、自然な返信を作成するアシスタントです。\n` +
            (role ? `【あなたのアカウント設定】\n- ロール: ${role}\n` : "") +
            (purpose ? `- 目的: ${purpose}\n` : "") +
            (rulesPrompt ? `\n以下のルールを絶対に厳守してください:\n${rulesPrompt}` : ""),
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              replies: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    text: { type: "STRING" },
                    explanation: { type: "STRING" }
                  },
                  required: ["text", "explanation"]
                }
              }
            },
            required: ["replies"]
          }
        }
      });

      res.json(JSON.parse(response.text));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Serve index.html for SPA router
  localApp.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  serverInstance = localApp.listen(3000, '127.0.0.1', () => {
    console.log('Local Electron Express Server listening on port 3000');
  });
}

function createWindow() {
  let iconPath = path.join(__dirname, 'assets', 'icon.png');
  if (!fs.existsSync(iconPath)) {
    // If running in packaged app and __dirname is 'dist', the icon might be one level up or under public folder
    const fallbackPath = path.join(__dirname, '..', 'assets', 'icon.png');
    if (fs.existsSync(fallbackPath)) {
      iconPath = fallbackPath;
    } else {
      iconPath = undefined;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "X Recruitment Reply Assistant",
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load local express server url
  mainWindow.loadURL('http://127.0.0.1:3000');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startLocalServer();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    if (serverInstance) serverInstance.close();
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
