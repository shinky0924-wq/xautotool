interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body: any = await context.request.json();
    const { tweet, staffInfo, rules, count = 3, customApiKey, customModel } = body;

    if (!tweet) {
      return new Response(JSON.stringify({ error: "相手のポスト内容を入力してください。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const role = staffInfo?.role || "";
    const purpose = staffInfo?.purpose || "";

    // Obtain API key: custom key from request body, or environment variable configured in Cloudflare Pages Dashboard
    const activeApiKey = customApiKey || context.env.GEMINI_API_KEY;

    // If no API key is available, run offline fallback generator
    if (!activeApiKey) {
      const localReplies = [];
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

      const shuffle = (arr: any[]) => [...arr].sort(() => Math.random() - 0.5);

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

      return new Response(JSON.stringify({ replies: localReplies }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const customRules = rules && rules.length > 0 ? rules : [];

    const rulesPrompt = customRules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n");

    const systemInstruction = `あなたはX（Twitter）の投稿に対して、設定されたロールと目的に基づき、自然な返信を作成するアシスタントです。
${role ? `【あなたのアカウント設定】\n- ロール：${role}` : ""}
${purpose ? `- 目的：${purpose}` : ""}

以下のルールを厳守して、相手のポストに対する返信文章を ${count} パターン作成してください。
全て異なるアプローチ、文章構成、語尾で、絶対に定型文に見えないようにしてください。

${rulesPrompt ? `【厳格なルール】\n${rulesPrompt}` : ""}

返信文章は必ずJSON形式で、以下のスキーマに従って出力してください。`;

    const prompt = `以下の相手のポストに対して、設定とルールに沿った自然な返信を ${count} パターン作成してください。

【相手のポスト】
${tweet}`;

    const modelName = customModel || "gemini-3.5-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemInstruction
            }
          ]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              replies: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    text: {
                      type: "STRING",
                      description: "返信文章本体。40〜100文字程度。"
                    },
                    explanation: {
                      type: "STRING",
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
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${errText}`);
    }

    const data: any = await geminiResponse.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      throw new Error("Gemini API returned an empty response.");
    }

    const parsedData = JSON.parse(resultText);
    return new Response(JSON.stringify(parsedData), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ 
      error: "返信の生成中にエラーが発生しました。", 
      details: error.message 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
