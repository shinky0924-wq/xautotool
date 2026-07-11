import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import AdmZip from "adm-zip";
import fs from "fs";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini AI
  let apiKey = process.env.GEMINI_API_KEY;

  // Windows-friendly fallback: check for alternative, easy-to-see files in the root
  const keyFiles = ["api_key.txt", "apikey.txt", "key.txt", "env.txt"];
  for (const file of keyFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf-8").trim();
        if (content) {
          // If the file contains something like "GEMINI_API_KEY=AIzaSy..."
          const match = content.match(/GEMINI_API_KEY\s*=\s*(.+)/i);
          if (match && match[1]) {
            apiKey = match[1].trim().replace(/['"`;]/g, "");
            console.log(`[API Key Fallback] Successfully loaded Gemini API key from standard file ${file} (parsed format)`);
            break;
          } else if (content.startsWith("AIzaSy")) {
            apiKey = content;
            console.log(`[API Key Fallback] Successfully loaded Gemini API key from standard file ${file} (raw key format)`);
            break;
          }
        }
      } catch (err) {
        console.warn(`[API Key Fallback] Failed to read ${file}:`, err);
      }
    }
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API endpoint to download the project files as a Web-ready ZIP
  app.get("/api/download-zip", (req, res) => {
    try {
      const zip = new AdmZip();

      // Directories and files to include for the full-stack Web app
      const filesToInclude = [
        "package.json",
        "index.html",
        "tsconfig.json",
        "vite.config.ts",
        "wrangler.toml",
        ".env.example",
        ".gitignore",
        "server.ts",
        "api_key.txt",
        "apikey.txt",
        "key.txt",
        "env.txt",
        "build-windows.bat"
      ];

      // Add simple files
      filesToInclude.forEach(file => {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          zip.addLocalFile(filePath);
        }
      });

      // Add src directory recursively
      const srcPath = path.join(process.cwd(), "src");
      if (fs.existsSync(srcPath)) {
        zip.addLocalFolder(srcPath, "src");
      }

      // Add functions directory recursively (crucial for Cloudflare Pages/Workers)
      const functionsPath = path.join(process.cwd(), "functions");
      if (fs.existsSync(functionsPath)) {
        zip.addLocalFolder(functionsPath, "functions");
      }

      // Add assets directory recursively (if any assets exist)
      const assetsPath = path.join(process.cwd(), "assets");
      if (fs.existsSync(assetsPath)) {
        zip.addLocalFolder(assetsPath, "assets");
      }

      // Generate ZIP buffer
      const zipBuffer = zip.toBuffer();

      // Set download headers
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=X_Recruitment_Assistant_Web.zip");
      res.send(zipBuffer);
    } catch (error: any) {
      console.error("ZIP Generation Error:", error);
      res.status(500).send("ZIPファイルの生成に失敗しました: " + error.message);
    }
  });

  // API endpoint to fetch tweet text from URL
  app.post("/api/fetch-tweet", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "X(Twitter)のURLを入力してください。" });
      }

      const inputUrl = url.trim();
      // Extract numeric status ID from any X/Twitter URL (e.g., mobile.x.com, x.com, twitter.com, with query params or photo subpaths)
      const statusMatch = inputUrl.match(/\/status\/(\d+)/i);
      if (!statusMatch) {
        return res.status(400).json({ error: "有効なX(Twitter)のポストURLではありません。「https://x.com/ユーザー名/status/数値」の形式であることを確認してください。" });
      }

      const tweetId = statusMatch[1];
      let tweetText = "";
      let authorName = "Xユーザー";
      let fetchedSuccessfully = false;

      // Method 1: Try api.fxtwitter.com which handles premium long-tweets and media flawlessly without truncation
      try {
        console.log(`Attempting to fetch full tweet using fxtwitter API for tweet ID: ${tweetId}`);
        const fxResponse = await fetch(`https://api.fxtwitter.com/i/status/${tweetId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
          }
        });

        if (fxResponse.ok) {
          const fxData: any = await fxResponse.json();
          if (fxData && fxData.tweet && fxData.tweet.text) {
            tweetText = fxData.tweet.text.trim();
            authorName = fxData.tweet.author?.name || "Xユーザー";
            fetchedSuccessfully = true;
            console.log(`Successfully retrieved full tweet text (${tweetText.length} chars) via fxtwitter API`);
          }
        } else {
          console.warn(`fxtwitter API returned non-ok status: ${fxResponse.status}`);
        }
      } catch (fxErr: any) {
        console.warn("fxtwitter API fetch failed, falling back to oEmbed. Error:", fxErr.message);
      }

      // Method 2 (Fallback): Standard publish.twitter.com/oembed
      if (!fetchedSuccessfully) {
        const cleanUrl = `https://twitter.com/i/status/${tweetId}`;
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
        
        console.log(`Executing fallback oEmbed fetch for URL: ${oembedUrl}`);
        const fetchResponse = await fetch(oembedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
          }
        });
        
        if (!fetchResponse.ok) {
          console.warn(`oEmbed fetch returned status: ${fetchResponse.status}`);
          return res.status(404).json({ 
            error: "ポスト情報の取得に失敗しました。X側のアクセス制限（サーバー保護）、非公開アカウント（鍵垢）、または削除済みの可能性があります。恐れ入りますが、該当ポストの本文をコピーして、下の「ターゲットポスト本文」入力欄に直接貼り付けてご使用ください。" 
          });
        }

        const data: any = await fetchResponse.json();
        if (!data || !data.html) {
          return res.status(500).json({ error: "ポストのHTMLデータの解析に失敗しました。本文をコピーして直接貼り付けてください。" });
        }

        // Use [\s\S]*? to allow multi-line matching inside <p> tag
        const match = data.html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
        if (!match || !match[1]) {
          return res.status(404).json({ error: "ポストの本文テキストを抽出できませんでした。本文をコピーして直接貼り付けてください。" });
        }

        // Replace <br> tags with actual newlines to preserve multiline structure
        let rawHtmlText = match[1].replace(/<br\s*\/?>/gi, "\n");

        // Clean HTML tags and entities
        tweetText = rawHtmlText
          .replace(/<a\b[^>]*>.*?<\/a>/ig, "") // remove links/hashtags/usernames links
          .replace(/<[^>]+>/g, ""); // remove other html tags

        // Decode HTML entities
        tweetText = tweetText
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          .trim();

        authorName = data.author_name || "Xユーザー";
      }

      res.json({
        text: tweetText,
        author: authorName
      });
    } catch (error: any) {
      console.error("Fetch Tweet Error:", error);
      res.status(500).json({ error: "サーバーエラーによりポスト情報を取得できませんでした。ポスト本文をコピーして、直接貼り付けてご使用ください。エラー内容: " + error.message });
    }
  });

  // API endpoint for generating replies
  app.post("/api/generate-replies", async (req, res) => {
    try {
      const { tweet, staffInfo, rules, count = 3, customApiKey, customModel } = req.body;
      
      if (!tweet) {
        return res.status(400).json({ error: "相手のポスト内容を入力してください。" });
      }

      const role = staffInfo?.role || "";
      const purpose = staffInfo?.purpose || "";

      const activeApiKey = customApiKey || apiKey;

      // If API Key is missing (neither custom nor env is present), use the local offline generator
      if (!activeApiKey) {
        const localReplies = [];
        
        // Define rich components for building varied realistic replies (40-100 chars)
        const empathies = [
          "ポスト見ました、本当にお疲れ様です。主さんの気持ち、すごく分かります…。",
          "お疲れ様です。少しでもお力になれたらと思ってリプしちゃいました。",
          "ツイート拝見しました。毎日色々と考え込んじゃうことありますよね…。",
          "お疲れ様です！頑張りすぎて疲れてないですか？無理しないでくださいね。",
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
          "15分5000円からスタートできて、高単価でシンプルなサービスだから未経験でもみんなすぐ馴染めてますよ。",
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

        // Shuffle utility
        const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
          const emp = shuffle(empathies)[i % empathies.length];
          const bdy = shuffle(bodies)[(i + 1) % bodies.length];
          const sug = shuffle(suggests)[(i + 2) % suggests.length];

          // Build a natural combination and truncate if it exceeds bounds slightly, ensuring human readability
          let fullText = `${emp} ${bdy} ${sug}`;
          if (fullText.length > 110) {
            fullText = `${emp}${bdy}${sug}`; // remove spaces
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

      const customRules = rules && rules.length > 0 ? rules : [
        "返信は40〜100文字程度（厳守）",
        "毎回文章構成・語尾・表現を変え、コピペと分かる定型文や同じフレーズを繰り返さない",
        "AIっぽい不自然な丁寧語やビジネス表現は避け、自然で人間味のある会話調にする",
        "営業色・勧誘色を極力なくし、自然な雑談やアドバイスに留める",
        "相手のポスト内容（出稼ぎの時期、目標金額、悩みなど）に必ず触れる",
        "まず共感や温かいリアクション、相槌から入る",
        "必要以上に求人の話へ誘導しない。求人を匂わせる場合も「選択肢としてある」程度の軽いニュアンスにする",
        "DMへの誘導は相手の投稿内容と自然につながる場合のみにし、無理に誘わない",
        "「絶対」「必ず」「誰でも」「高収入保証」「稼げる」などの断定表現や誇大表現は禁止",
        "絵文字は使っても1〜2個程度とし、過度な絵文字や特殊記号は使わない",
        "ハッシュタグ（#）は一切付けない",
        "URLや連絡先リンクは貼らない",
        "親しみやすく温かい、相手に安心感を与えるトーンを最優先する"
      ];

      const rulesPrompt = customRules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n");

      // System instruction for the generator
      const systemInstruction = `あなたはX（Twitter）でユーザーと自然に会話をしながら、安心感を与える求人スタッフ・オーナーです。
あなたの設定：
${role ? `- ロール：${role}` : ""}
${purpose ? `- 目的：${purpose}` : ""}

以下のルールを絶対に厳守して、相手のポストに対する返信文章を ${count} パターン作成してください。
全て異なるアプローチ、文章構成、語尾で、絶対に定型文に見えないようにしてください。

【厳格なルール】
${rulesPrompt}

返信文章は必ずJSON形式で、以下のスキーマに従って出力してください。`;

      const prompt = `以下の相手のポストに対して、ルールに沿った自然な返信を ${count} パターン作成してください。

【相手のポスト】
${tweet}

返信パターンを作成する際は、親しみやすさ、共感、そして相手の具体的な悩みや状況（出稼ぎの時期や希望額など）に優しく寄り添うことを心がけてください。`;

      const activeAiClient = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const requestedModel = customModel || "gemini-3.5-flash";
      const candidateModels = [
        requestedModel,
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-2.0-flash"
      ];
      // De-duplicate while preserving requested model first
      const uniqueModels = Array.from(new Set(candidateModels));

      let lastError: any = null;
      let success = false;
      let responseText = "";
      let usedModelName = "";

      for (const modelName of uniqueModels) {
        try {
          console.log(`[API Generate] Attempting generation with model: ${modelName}`);
          const response = await activeAiClient.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  replies: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { 
                          type: Type.STRING, 
                          description: "返信文章本体。40〜100文字程度。" 
                        },
                        explanation: { 
                          type: Type.STRING, 
                          description: "このパターンの意図や工夫したポイント（共感の置き方、条件の匂わせ方など）" 
                        }
                      },
                      required: ["text", "explanation"]
                    }
                  }
                },
                required: ["replies"]
              }
            }
          });

          responseText = response.text;
          if (responseText) {
            success = true;
            usedModelName = modelName;
            console.log(`[API Generate] Successfully generated content using model: ${modelName}`);
            break;
          } else {
            throw new Error(`Empty response text from model ${modelName}`);
          }
        } catch (err: any) {
          console.warn(`[API Generate Warning] Model ${modelName} failed:`, err.message || err);
          lastError = err;
        }
      }

      if (!success) {
        throw lastError || new Error("All candidate Gemini models failed to generate content.");
      }

      const parsedData = JSON.parse(responseText);
      // Injected key to inform frontend about the model that actually succeeded
      parsedData.modelUsed = usedModelName;
      res.json(parsedData);
    } catch (error: any) {
      console.error("API Error:", error);
      res.status(500).json({ 
        error: "返信の生成中にエラーが発生しました。", 
        details: error.message 
      });
    }
  });

  // Serve static assets
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
