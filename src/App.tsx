import React, { useState, useEffect, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { 
  Send, 
  Copy, 
  RefreshCw, 
  Settings, 
  ShieldCheck, 
  HelpCircle, 
  Check, 
  AlertTriangle, 
  Sparkles, 
  User, 
  Briefcase, 
  Flame, 
  Twitter, 
  Info,
  CheckCircle,
  FileText,
  Sliders,
  Plus,
  Trash,
  Key,
  Lock,
  Unlock,
  LogOut,
  Sparkle,
  Cloud,
  Server,
  FolderArchive,
  Download,
  Edit,
  RotateCcw,
  Search,
  List
} from "lucide-react";

// Types
interface ReplyOption {
  text: string;
  explanation: string;
}

interface AccountProfile {
  id: string;
  name: string;
  xId: string; // The X Handle/ID
  role: string;
  purpose: string;
  rules: string[];
}

export default function App() {
  // Hardcoded Credentials
  const LOGIN_ID_DEFAULT = "admin";
  const LOGIN_PW_DEFAULT = "admin";

  // Login State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("x_auto_reply_logged_in") === "true";
  });
  const [loginIdInput, setLoginIdInput] = useState("");
  const [loginPwInput, setLoginPwInput] = useState("");
  const [loginError, setLoginError] = useState("");

  // Preset Tweet Templates
  const DEFAULT_PRESET_TWEETS = [
    {
      id: "user-request",
      label: "出稼ぎ（今回の依頼）",
      text: "の出稼ぎを探してます\n日程日7/21-7/25.7/26-7/30です\n1日10万くらい稼げるお店ありますか\nお願いします"
    },
    {
      id: "preset-1",
      label: "大阪の簡単ワーク希望",
      text: "7月中旬から大阪で出稼ぎ考えてます。昼夜逆転きついから簡単で短時間で探したいです！"
    }
  ];

  const [presetTweets, setPresetTweets] = useState<{ id: string; label: string; text: string; }[]>(() => {
    const saved = localStorage.getItem("x_assistant_preset_tweets");
    return saved ? JSON.parse(saved) : DEFAULT_PRESET_TWEETS;
  });

  const [appTitle, setAppTitle] = useState<string>(() => {
    return localStorage.getItem("x_assistant_app_title") || "X自動返信ツール";
  });

  const [appSubtitle, setAppSubtitle] = useState<string>(() => {
    return localStorage.getItem("x_assistant_app_subtitle") || "アカウント一元管理、ルール厳守、AI自然文章リアルタイム選定";
  });

  const [appOfficialAnswer, setAppOfficialAnswer] = useState<string>(() => {
    return localStorage.getItem("x_assistant_app_official_answer") || "生成に失敗しました";
  });

  const [loadingMessageTitle, setLoadingMessageTitle] = useState<string>(() => {
    return localStorage.getItem("x_assistant_loading_msg_title") || "AIアシスタントが最適な返信文を生成中...";
  });

  const [loadingMessageSubtitle, setLoadingMessageSubtitle] = useState<string>(() => {
    return localStorage.getItem("x_assistant_loading_msg_subtitle") || "「アカウント設定の反映」「自然な寄り添い表現の調整」「文字数のチェック」を実行しています...";
  });

  const DEFAULT_ACCOUNTS: AccountProfile[] = [
    {
      id: "account-test",
      name: "test",
      xId: "@test",
      role: "test",
      purpose: "test",
      rules: [
        "返信は45〜90文字程度（厳守）",
        "相手を傷つけず、温かく寄り添う自然な返信にする",
        "「絶対」「必ず」などの誇大・断定表現は使用禁止"
      ]
    }
  ];

  // Accounts List State
  const [accounts, setAccounts] = useState<AccountProfile[]>(() => {
    const saved = localStorage.getItem("x_assistant_accounts_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out pre-configured accounts to start fresh as requested by user
        const filtered = parsed.filter((acc: any) => 
          acc && acc.id && !["account-tobita", "account-cabaret", "account-delivery"].includes(acc.id)
        );
        return filtered.length > 0 ? filtered : DEFAULT_ACCOUNTS;
      } catch (e) {
        return DEFAULT_ACCOUNTS;
      }
    }
    return DEFAULT_ACCOUNTS;
  });

  // Selected Profile ID
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    const saved = localStorage.getItem("x_assistant_selected_account_id_v2");
    if (saved === "account-tobita" || saved === "account-cabaret" || saved === "account-delivery") {
      return "account-test";
    }
    return saved || "account-test";
  });

  // Active account profile details
  const activeAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0] || {
    id: "empty",
    name: "未登録",
    xId: "@none",
    role: "お仕事アドバイザー（設定されていません）",
    purpose: "未経験の方の相談相手になりつつ、適正に合った高収入案件へ繋げる。",
    rules: [
      "返信は45〜90文字程度（厳守）",
      "相手を傷つけず、温かく寄り添う自然な返信にする",
      "「絶対」「必ず」などの誇大・断定表現は使用禁止"
    ]
  };

  // Local state for active account character inputs (synced back)
  const [role, setRole] = useState(activeAccount.role);
  const [purpose, setPurpose] = useState(activeAccount.purpose);
  const [rules, setRules] = useState(activeAccount.rules);

  // Gemini API Custom Key and Model State
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem("x_assistant_custom_api_key") || "";
  });
  const [customModel, setCustomModel] = useState<string>(() => {
    return localStorage.getItem("x_assistant_custom_model") || "gemini-3.5-flash";
  });
  const [apiConnectionStatus, setApiConnectionStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [apiConnectionMsg, setApiConnectionMsg] = useState("");

  // Firestore Sync States
  const [dbSyncStatus, setDbSyncStatus] = useState<"connecting" | "synced" | "error">("connecting");
  const lastCloudValueRef = useRef<string>("");

  // Other state variables
  const [tweetInput, setTweetInput] = useState<string>("");
  const [newRule, setNewRule] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgressMsg, setGenerationProgressMsg] = useState("AIアシスタントが最適な返信文を生成中");
  const [generatedReplies, setGeneratedReplies] = useState<ReplyOption[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedOfficial, setCopiedOfficial] = useState(false);
  const [editedReplyTexts, setEditedReplyTexts] = useState<string[]>([]);
  const [activePage, setActivePage] = useState<"accounts" | "input" | "generate" | "rules" | "gemini" | "windows" | "cloudflare" | "hyonix" | "sitetext">("accounts");
  
  // Account selection layout settings
  const [accountSelectionMode, setAccountSelectionMode] = useState<"list" | "search">("list");
  const [accountSearchQuery, setAccountSearchQuery] = useState("");

  // Filtered accounts based on search query
  const filteredAccounts = accounts.filter(acc => {
    const q = accountSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      acc.name.toLowerCase().includes(q) ||
      acc.xId.toLowerCase().includes(q) ||
      acc.role.toLowerCase().includes(q) ||
      acc.purpose.toLowerCase().includes(q)
    );
  });

  // For copying desktop scripts
  const [copiedMainJs, setCopiedMainJs] = useState(false);
  const [copiedPkgJson, setCopiedPkgJson] = useState(false);
  const [copiedBat, setCopiedBat] = useState(false);
  const [windowsAppName, setWindowsAppName] = useState("X_Recruitment_Assistant");

  // Inline Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Form states for adding account
  const [newAccName, setNewAccName] = useState("test");
  const [newAccXId, setNewAccXId] = useState("test");
  const [newAccRole, setNewAccRole] = useState("test");
  const [newAccPurpose, setNewAccPurpose] = useState("test");

  // Form states for renaming/editing account
  const [editingAccountId, setEditingAccountId] = useState("");
  const [editAccName, setEditAccName] = useState("");
  const [editAccXId, setEditAccXId] = useState("");

  // Delete target state
  const [deletingAccount, setDeletingAccount] = useState<{ id: string; name: string } | null>(null);

  // Tweet URL Fetching States
  const [tweetUrl, setTweetUrl] = useState("");
  const [isFetchingTweet, setIsFetchingTweet] = useState(false);
  const [tweetFetchError, setTweetFetchError] = useState("");
  const [fetchedAuthor, setFetchedAuthor] = useState("");

  // Prohibited words for scanner
  const PROHIBITED_WORDS = ["絶対", "必ず", "誰でも", "高収入保証", "保証"];

  // One-time migration for existing users' localStorage to update defaults
  useEffect(() => {
    const cachedAnswer = localStorage.getItem("x_assistant_app_official_answer");
    if (cachedAnswer && cachedAnswer.includes("出稼ぎ探されてるんですね")) {
      setAppOfficialAnswer("生成に失敗しました");
      localStorage.setItem("x_assistant_app_official_answer", "生成に失敗しました");
    }

    const cachedTitle = localStorage.getItem("x_assistant_loading_msg_title");
    if (cachedTitle && cachedTitle.includes("安心・共感")) {
      setLoadingMessageTitle("AIアシスタントが最適な返信文を生成中...");
      localStorage.setItem("x_assistant_loading_msg_title", "AIアシスタントが最適な返信文を生成中...");
    }

    const cachedSubtitle = localStorage.getItem("x_assistant_loading_msg_subtitle");
    if (cachedSubtitle && cachedSubtitle.includes("誇大・断定")) {
      setLoadingMessageSubtitle("「アカウント設定の反映」「自然な寄り添い表現の調整」「文字数のチェック」を実行しています...");
      localStorage.setItem("x_assistant_loading_msg_subtitle", "「アカウント設定の反映」「自然な寄り添い表現の調整」「文字数のチェック」を実行しています...");
    }
  }, []);

  // Sync selected account details when account is switched
  useEffect(() => {
    if (activeAccount) {
      setRole(activeAccount.role);
      setPurpose(activeAccount.purpose);
      setRules(activeAccount.rules);
    }
  }, [selectedAccountId, accounts]);

  // Save changes back to accounts state (local backup)
  useEffect(() => {
    localStorage.setItem("x_assistant_accounts_v2", JSON.stringify(accounts));
  }, [accounts]);

  // Firestore Real-Time Bidirectional Sync (Zero Conflict / Infinite-Loop Proof)
  useEffect(() => {
    const docRef = doc(db, "app_data", "global_accounts");
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudAccounts = docSnap.data().accounts as AccountProfile[];
        if (cloudAccounts && Array.isArray(cloudAccounts)) {
          lastCloudValueRef.current = JSON.stringify(cloudAccounts);
          setAccounts(cloudAccounts);
          setDbSyncStatus("synced");
        }
      } else {
        // Initialize Firestore with current state (from localStorage or defaults)
        const initial = localStorage.getItem("x_assistant_accounts_v2");
        let initialAccounts = DEFAULT_ACCOUNTS;
        if (initial) {
          try {
            const parsed = JSON.parse(initial);
            const filtered = parsed.filter((acc: any) => 
              acc && acc.id && !["account-tobita", "account-cabaret", "account-delivery"].includes(acc.id)
            );
            if (filtered.length > 0) initialAccounts = filtered;
          } catch (e) {}
        }
        setDoc(docRef, { accounts: initialAccounts })
          .then(() => {
            lastCloudValueRef.current = JSON.stringify(initialAccounts);
            setDbSyncStatus("synced");
          })
          .catch((err) => {
            console.error("Firestore init error", err);
            setDbSyncStatus("error");
          });
      }
    }, (err) => {
      console.error("Firestore subscription error", err);
      setDbSyncStatus("error");
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (dbSyncStatus === "synced" && accounts && accounts.length > 0) {
      const currentVal = JSON.stringify(accounts);
      if (currentVal !== lastCloudValueRef.current) {
        lastCloudValueRef.current = currentVal;
        const docRef = doc(db, "app_data", "global_accounts");
        setDoc(docRef, { accounts }).catch((err) => {
          console.error("Firestore sync write error", err);
        });
      }
    }
  }, [accounts, dbSyncStatus]);

  useEffect(() => {
    localStorage.setItem("x_assistant_selected_account_id_v2", selectedAccountId);
  }, [selectedAccountId]);

  // Save Custom Gemini Settings to LocalStorage
  useEffect(() => {
    localStorage.setItem("x_assistant_custom_api_key", customApiKey);
  }, [customApiKey]);

  useEffect(() => {
    localStorage.setItem("x_assistant_custom_model", customModel);
  }, [customModel]);

  // Save Custom Site Texts to LocalStorage
  useEffect(() => {
    localStorage.setItem("x_assistant_app_title", appTitle);
  }, [appTitle]);

  useEffect(() => {
    localStorage.setItem("x_assistant_app_subtitle", appSubtitle);
  }, [appSubtitle]);

  useEffect(() => {
    localStorage.setItem("x_assistant_app_official_answer", appOfficialAnswer);
  }, [appOfficialAnswer]);

  useEffect(() => {
    localStorage.setItem("x_assistant_preset_tweets", JSON.stringify(presetTweets));
  }, [presetTweets]);

  useEffect(() => {
    localStorage.setItem("x_assistant_loading_msg_title", loadingMessageTitle);
  }, [loadingMessageTitle]);

  useEffect(() => {
    localStorage.setItem("x_assistant_loading_msg_subtitle", loadingMessageSubtitle);
  }, [loadingMessageSubtitle]);



  // Sync state changes back to accounts array
  const handleRoleChange = (newRoleVal: string) => {
    setRole(newRoleVal);
    setAccounts(prev => prev.map(acc => 
      acc.id === selectedAccountId ? { ...acc, role: newRoleVal } : acc
    ));
  };

  const handlePurposeChange = (newPurposeVal: string) => {
    setPurpose(newPurposeVal);
    setAccounts(prev => prev.map(acc => 
      acc.id === selectedAccountId ? { ...acc, purpose: newPurposeVal } : acc
    ));
  };

  const updateActiveAccountRules = (newRules: string[]) => {
    setRules(newRules);
    setAccounts(prev => prev.map(acc => 
      acc.id === selectedAccountId ? { ...acc, rules: newRules } : acc
    ));
  };

  // Site Text Customizations Logic
  const [newPresetLabel, setNewPresetLabel] = useState("");
  const [newPresetText, setNewPresetText] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleAddPreset = () => {
    if (!newPresetLabel.trim() || !newPresetText.trim()) return;
    const newPreset = {
      id: "preset-" + Date.now(),
      label: newPresetLabel.trim(),
      text: newPresetText.trim()
    };
    setPresetTweets(prev => [...prev, newPreset]);
    setNewPresetLabel("");
    setNewPresetText("");
  };

  const handleRemovePreset = (id: string) => {
    setPresetTweets(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdatePresetText = (id: string, text: string) => {
    setPresetTweets(prev => prev.map(p => p.id === id ? { ...p, text } : p));
  };

  const handleUpdatePresetLabel = (id: string, label: string) => {
    setPresetTweets(prev => prev.map(p => p.id === id ? { ...p, label } : p));
  };

  const handleResetSiteTexts = () => {
    setAppTitle("X自動返信ツール");
    setAppSubtitle("アカウント一元管理、ルール厳守、AI自然文章リアルタイム選定");
    setAppOfficialAnswer("生成に失敗しました");
    setPresetTweets(DEFAULT_PRESET_TWEETS);
    setLoadingMessageTitle("AIアシスタントが最適な返信文を生成中...");
    setLoadingMessageSubtitle("「アカウント設定の反映」「自然な寄り添い表現の調整」「文字数のチェック」を実行しています...");
    setResetSuccess(true);
    setShowResetConfirm(false);
    setTimeout(() => setResetSuccess(false), 3000);
  };

  const [profileResetSuccess, setProfileResetSuccess] = useState(false);
  const [showProfileResetConfirm, setShowProfileResetConfirm] = useState(false);

  const handleResetProfilesToBlankSlate = () => {
    const blankAccount: AccountProfile = {
      id: "account-custom-1",
      name: "新規キャラクター",
      xId: "@custom_handle",
      role: "（例: 業界5年目の現役女子アドバイザー）",
      purpose: "（例: 押し売りを一切せず、フラットに出稼ぎの相談相手になりつつ、適正に合った高収入案件にDMで繋げる）",
      rules: [
        "返信は45〜90文字程度（厳守）",
        "相手を傷つけず、温かく寄り添う自然な返信にする",
        "「絶対」「必ず」などの誇大・断定表現は使用禁止",
        "ビジネス的な堅い表現を避け、親しみやすい会話調にする"
      ]
    };
    setAccounts([blankAccount]);
    setSelectedAccountId("account-custom-1");
    setProfileResetSuccess(true);
    setShowProfileResetConfirm(false);
    setTimeout(() => setProfileResetSuccess(false), 3000);
  };

  const addCustomRule = () => {
    if (newRule.trim()) {
      updateActiveAccountRules([...rules, newRule.trim()]);
      setNewRule("");
    }
  };

  const removeRule = (index: number) => {
    updateActiveAccountRules(rules.filter((_, i) => i !== index));
  };

  // Multi-Account Profile Management
  const handleAddAccount = () => {
    setNewAccName("test");
    setNewAccXId("test");
    setNewAccRole("test");
    setNewAccPurpose("test");
    setShowAddModal(true);
  };

  const submitAddAccount = () => {
    if (!newAccName.trim() || !newAccXId.trim()) return;
    const formattedXId = newAccXId.trim().startsWith("@") ? newAccXId.trim() : `@${newAccXId.trim()}`;
    const newId = `account-${Date.now()}`;
    const newAcc: AccountProfile = {
      id: newId,
      name: newAccName.trim(),
      xId: formattedXId,
      role: newAccRole.trim(),
      purpose: newAccPurpose.trim(),
      rules: [
        "返信は45〜90文字程度（厳守）",
        "相手を傷つけず、温かく寄り添う自然な返信にする",
        "「絶対」「必ず」などの誇大・断定表現は使用禁止"
      ]
    };
    setAccounts(prev => [...prev, newAcc]);
    setSelectedAccountId(newId);
    setShowAddModal(false);
  };

  const handleRenameAccount = (id: string, currentName: string, currentXId: string) => {
    setEditingAccountId(id);
    setEditAccName(currentName);
    setEditAccXId(currentXId);
    setShowRenameModal(true);
  };

  const submitRenameAccount = () => {
    if (!editAccName.trim() || !editAccXId.trim()) return;
    const formattedXId = editAccXId.trim().startsWith("@") ? editAccXId.trim() : `@${editAccXId.trim()}`;
    setAccounts(prev => prev.map(acc => 
      acc.id === editingAccountId ? { ...acc, name: editAccName.trim(), xId: formattedXId } : acc
    ));
    setShowRenameModal(false);
  };

  const handleDeleteAccount = (id: string, name: string) => {
    setDeletingAccount({ id, name });
    setShowDeleteModal(true);
  };

  const submitDeleteAccount = () => {
    if (!deletingAccount) return;
    if (accounts.length <= 1) {
      setDeletingAccount(null);
      setShowDeleteModal(false);
      return;
    }
    const filtered = accounts.filter(acc => acc.id !== deletingAccount.id);
    setAccounts(filtered);
    if (selectedAccountId === deletingAccount.id) {
      setSelectedAccountId(filtered[0].id);
    }
    setDeletingAccount(null);
    setShowDeleteModal(false);
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginIdInput.trim() === LOGIN_ID_DEFAULT && loginPwInput === LOGIN_PW_DEFAULT) {
      setIsLoggedIn(true);
      localStorage.setItem("x_auto_reply_logged_in", "true");
      setLoginError("");
    } else {
      setLoginError("ログインIDまたはパスワードが正しくありません。");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("x_auto_reply_logged_in");
    setLoginIdInput("");
    setLoginPwInput("");
  };

  // Fetch X Post Text via URL
  const handleFetchTweet = async () => {
    if (!tweetUrl.trim()) return;
    setIsFetchingTweet(true);
    setTweetFetchError("");
    setFetchedAuthor("");
    try {
      const response = await fetch("/api/fetch-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: tweetUrl })
      });
      const data = await response.json();
      if (response.ok && data.text) {
        setTweetInput(data.text);
        setFetchedAuthor(data.author);
        setTweetUrl(""); // Clear URL input
      } else {
        throw new Error(data.error || "ツイートの取得に失敗しました。");
      }
    } catch (err: any) {
      console.error(err);
      setTweetFetchError(err.message || "通信エラーが発生しました。");
    } finally {
      setIsFetchingTweet(false);
    }
  };

  // Humanize and translate Gemini / Google API errors into friendly Japanese advice
  const humanizeApiError = (errMsg: string, model: string): string => {
    const lower = errMsg.toLowerCase();
    if (lower.includes("503") || lower.includes("unavailable") || lower.includes("high demand") || lower.includes("temporary") || lower.includes("limit")) {
      return `【Google APIサーバー混雑中】現在、選択された最新モデル (${model}) はGoogle APIサーバー側で一時的なアクセス集中が起きています（HTTP 503 UNAVAILABLE）。\n\n◆推奨解決策：\n1. しばらく（数秒〜数十秒）置いてから再度お試しください。\n2. 設定ページから「gemini-2.5-flash」または「gemini-2.5-pro」といった極めて稼働の安定した別モデルに切り替えて実行してみてください。`;
    }
    if (lower.includes("429") || lower.includes("quota") || lower.includes("rate limit") || lower.includes("limit exceeded")) {
      return `【リクエスト制限】短時間でのAPI利用回数上限に達しました（HTTP 429 Too Many Requests）。\n\n◆推奨解決策：\n無料枠制限（毎分15リクエスト程度）に達した可能性があります。約1分間お時間をおいてから再度お試しいただくか、別の安定したモデル、もしくは別のAPIキーをご利用ください。`;
    }
    if (lower.includes("api_key_invalid") || lower.includes("key is not valid") || lower.includes("invalid api key") || lower.includes("apikey") || lower.includes("forbidden") || lower.includes("403") || lower.includes("400")) {
      return `【APIキー無効】入力された Gemini API キーが正しくないか、無効な状態です。\n\n◆推奨解決策：\nGoogle AI Studio (https://aistudio.google.com/) で取得した正しいAPIキーがコピー＆ペーストされているかご確認ください。`;
    }
    return errMsg || "接続できませんでした。APIキーと選択されたモデルをご確認ください。";
  };

  // Generate replies via server with up to 5 retries
  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMsg("");
    setGeneratedReplies([]); // Clear previous replies so we don't show old patterns on failure
    setEditedReplyTexts([]);

    const activeModel = customModel.trim() || "gemini-3.5-flash";
    let usedModel = activeModel;
    
    const maxAttempts = 6; // 1 initial attempt + 5 retries = 6 total attempts
    let success = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        setGenerationProgressMsg(`生成に失敗しました、再実行します（再実行 ${attempt - 1}/5回目）...`);
        // Wait 1.5 seconds before retrying to avoid spamming the API and let rates cool down
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        setGenerationProgressMsg(loadingMessageTitle);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 30000); // 30 seconds timeout

        let response;
        try {
          response = await fetch("/api/generate-replies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tweet: tweetInput,
              staffInfo: { role, purpose },
              rules,
              count: 3,
              customApiKey: customApiKey.trim() || undefined,
              customModel: activeModel
            }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const data = await response.json();
        if (!response.ok || !data.replies) {
          const errorMsg = data?.error || "生成に失敗しました。";
          const detailMsg = data?.details ? `: ${data.details}` : "";
          throw new Error(`${errorMsg}${detailMsg}`);
        }

        // If server used a fallback model, reflect that in our usedModel variable
        if (data.modelUsed) {
          usedModel = data.modelUsed;
          console.log(`[Frontend] Server used model: ${usedModel}`);
        }

        setGeneratedReplies(data.replies);
        setEditedReplyTexts(data.replies.map((r: any) => r.text));
        success = true;
        break; // Successfully generated, break the retry loop!
      } catch (err: any) {
        console.error(`Attempt ${attempt} failed:`, err);
        
        // If this was the final attempt (all 5 retries failed)
        if (attempt === maxAttempts) {
          const isTimeout = err.name === "AbortError";
          const errMsgString = isTimeout ? "タイムアウト（30秒）を超過しました。" : (err.message || "");
          const userFriendlyError = humanizeApiError(errMsgString, usedModel);
          // Show "生成に失敗しました" prominently as requested, with details
          setErrorMsg(`生成に失敗しました。(${userFriendlyError})`);
          setGeneratedReplies([]);
          setEditedReplyTexts([]);
        }
      }
    }

    setIsGenerating(false);
  };

  // Error simulation for developer/user testing
  const handleSimulateError = async (errorType: "403" | "429" | "503" | "timeout") => {
    setIsGenerating(true);
    setErrorMsg("");
    setGeneratedReplies([]);
    setEditedReplyTexts([]);
    setActivePage("generate"); // Switch to generate page to show loader and failure UI

    const activeModel = customModel.trim() || "gemini-3.5-flash";
    const maxAttempts = errorType === "503" ? 6 : 1; // 503 triggers retry simulation

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) {
        setGenerationProgressMsg(`生成に失敗しました、再実行します（再実行 ${attempt - 1}/5回目）...`);
        await new Promise(resolve => setTimeout(resolve, 1500));
      } else {
        setGenerationProgressMsg(loadingMessageTitle);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (attempt === maxAttempts) {
        let rawErrorMsg = "";
        if (errorType === "403") {
          rawErrorMsg = "API_KEY_INVALID: The provided API key is invalid or expired.";
        } else if (errorType === "429") {
          rawErrorMsg = "RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Generate Content Requests'...";
        } else if (errorType === "503") {
          rawErrorMsg = "HTTP 503 Service Unavailable / High demand limit reached";
        } else if (errorType === "timeout") {
          rawErrorMsg = "AbortError: タイムアウト（30秒）を超過しました。";
        }

        const userFriendlyError = humanizeApiError(rawErrorMsg, activeModel);
        setErrorMsg(`生成に失敗しました。(${userFriendlyError})`);
        setGeneratedReplies([]);
        setEditedReplyTexts([]);
      }
    }

    setIsGenerating(false);
  };

  // Local fallback generators
  const generateLocalFallbacks = (input: string): ReplyOption[] => {
    const isUserRequest = input.includes("出稼ぎ") && input.includes("7/21");
    if (isUserRequest) {
      return [
        {
          text: appOfficialAnswer,
          explanation: "【ローカル生成 fallback】設定された「公式検証済ベストアンサー」を適用しています。"
        },
        {
          text: "7月後半のご予定ですね！1日10万目標なら、飛田新地の短時間でシンプルな接客も選択肢の一つかもです。未経験の方でも安心して動ける環境なので、雰囲気だけでも気になったら気軽に声かけてくださいね。",
          explanation: "【ローカル生成 fallback】「未経験でも安心」という安心感を付与しつつ、相手の希望金額に対して「短時間でシンプル」と優しくアピール。"
        },
        {
          text: "出稼ぎのご相談ですね！7月後半はかなり賑わう時期です。10万目標でしたら、飛田で短時間でサクッとできるお仕事が合うかもしれません。詳しい内容やお店の様子など、気軽になんでも聞いてくださいね。",
          explanation: "【ローカル生成 fallback】質問の出稼ぎ時期（7月後半）と目標額にマッチ。敷居を下げて安心感を与えるフレーズ。"
        }
      ];
    } else {
      return [
        {
          text: "大阪での出稼ぎですね！夏の時期は賑やかで楽しいですよ。自分のペースで無理なく稼ぎたいなら、短時間のシンプルな接客も選択肢としてあるかもです。詳しく知りたい時はいつでも声かけてくださいね。",
          explanation: "【ローカル生成 fallback】共感から入り、自然な雑談のトーンで短時間ワークの選択肢を提供しています。"
        },
        {
          text: "短期の出稼ぎ、色々と探されてるのですね！サクッと動きやすいお仕事なら、飛田の短時間でシンプルなお仕事が合うかもしれません。女の子第一の明るいお店なので、気になることがあれば気軽に聞いてください。",
          explanation: "【ローカル生成 fallback】「女の子第一」と「短時間でシンプル」というワードで安心感を押し出したお返事です。"
        }
      ];
    }
  };

  // Test Gemini Connection handler
  const handleTestConnection = async () => {
    if (!customApiKey.trim()) {
      setApiConnectionStatus("failed");
      setApiConnectionMsg("APIキーを入力してください。");
      return;
    }
    setApiConnectionStatus("testing");
    setApiConnectionMsg("Gemini API に接続テストを実行中...");
    try {
      const response = await fetch("/api/generate-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweet: "テスト接続確認用のダミーツイート",
          staffInfo: { role: "テスト", purpose: "テスト" },
          rules: ["文字数は20文字程度にする"],
          count: 1,
          customApiKey: customApiKey.trim(),
          customModel: customModel.trim()
        })
      });
      const data = await response.json();
      if (response.ok && data.replies) {
         setApiConnectionStatus("success");
         setApiConnectionMsg(`接続成功！設定されたAPIキーとモデル (${customModel}) は正常に機能しています。`);
      } else {
        const errorMsg = data.error || "応答にエラーが含まれています。";
        const detailMsg = data.details ? `: ${data.details}` : "";
        throw new Error(`${errorMsg}${detailMsg}`);
      }
    } catch (err: any) {
      setApiConnectionStatus("failed");
      const userFriendlyError = humanizeApiError(err.message || "", customModel);
      setApiConnectionMsg(`接続失敗: ${userFriendlyError}`);
    }
  };

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCopyOfficial = () => {
    navigator.clipboard.writeText(appOfficialAnswer);
    setCopiedOfficial(true);
    setTimeout(() => setCopiedOfficial(false), 2000);
  };

  const handleEditReplyChange = (index: number, val: string) => {
    const updated = [...editedReplyTexts];
    updated[index] = val;
    setEditedReplyTexts(updated);
  };

  // Compliance Scanner Check
  const getScannerResults = (text: string) => {
    const length = text.length;
    const lengthOk = length >= 40 && length <= 100;
    
    const foundProhibited = PROHIBITED_WORDS.filter(w => text.includes(w));
    const prohibitedOk = foundProhibited.length === 0;

    const hasHashtag = text.includes("#");
    const hasUrl = text.includes("http") || text.includes("www") || text.includes(".com") || text.includes(".jp");
    const cleanOk = !hasHashtag && !hasUrl;

    return {
      length,
      lengthOk,
      foundProhibited,
      prohibitedOk,
      cleanOk,
      hasHashtag,
      hasUrl,
      allPassed: lengthOk && prohibitedOk && cleanOk
    };
  };

  // -----------------------------------------------------------------
  // 1. RENDER LOGIN SCREEN (IF NOT LOGGED IN)
  // -----------------------------------------------------------------
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 selection:bg-rose-500 selection:text-white font-sans">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] font-bold px-4 py-1 rounded-bl-xl tracking-wider flex items-center gap-1">
            <Lock className="w-3 h-3" /> セキュアログイン
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-rose-500 rounded-2xl mb-4 shadow-lg shadow-rose-500/20">
              <Twitter className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display font-bold text-2xl tracking-tight text-white">
              X自動返信ツール
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              複数アカウント対応・AI自動生成＆厳格フィルター搭載
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                ログインID
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={loginIdInput}
                  onChange={(e) => setLoginIdInput(e.target.value)}
                  placeholder="IDを入力"
                  className="w-full bg-slate-950/50 border border-slate-700 focus:border-rose-500 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-hidden focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                パスワード
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  value={loginPwInput}
                  onChange={(e) => setLoginPwInput(e.target.value)}
                  placeholder="パスワードを入力"
                  className="w-full bg-slate-950/50 border border-slate-700 focus:border-rose-500 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-hidden focus:ring-1 focus:ring-rose-500 transition-all font-mono"
                />
              </div>
            </div>

            {loginError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl p-3 flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-rose-500 hover:bg-rose-600 active:scale-[0.99] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-rose-500/10 flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Unlock className="w-4 h-4" />
              <span>ログインして開始</span>
            </button>
          </form>

          {/* Dummy Credentials Info Box */}
          <div className="mt-8 bg-slate-950/40 border border-slate-700/50 rounded-xl p-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              デモ用ログイン情報
            </span>
            <div className="text-xs text-slate-400 space-y-1 font-mono">
              <div className="flex justify-between">
                <span>ログインID:</span>
                <span className="text-rose-400 font-bold">{LOGIN_ID_DEFAULT}</span>
              </div>
              <div className="flex justify-between">
                <span>パスワード:</span>
                <span className="text-rose-400 font-bold">{LOGIN_PW_DEFAULT}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------
  // 2. MAIN LOGGED-IN APPLICATION LAYOUT
  // -----------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16 font-sans selection:bg-rose-100 selection:text-rose-900">
      
      {/* Premium Sticky Navigation Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500 text-white p-2.5 rounded-xl shadow-xs">
              <Twitter className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-bold text-xl tracking-tight text-slate-800 flex items-center gap-2 group/title">
                {appTitle}
                <span className="text-xs bg-rose-50 text-rose-600 font-mono font-medium px-2 py-0.5 rounded-full border border-rose-100">
                  プロ仕様
                </span>
                <button
                  onClick={() => setActivePage("sitetext")}
                  className="opacity-0 group-hover/title:opacity-100 focus:opacity-100 text-slate-400 hover:text-rose-500 transition-all p-1 cursor-pointer"
                  title="サイトのタイトルと説明を編集"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </h1>
              <p className="text-xs text-slate-500">
                {appSubtitle}
              </p>
            </div>
          </div>

          {/* Global Header Action Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Real-time Cloud Sync Status Indicator */}
            <div className={`text-[10px] font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              dbSyncStatus === "synced"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs"
                : dbSyncStatus === "connecting"
                ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              <Cloud className={`w-3.5 h-3.5 ${dbSyncStatus === "connecting" ? "animate-bounce" : ""}`} />
              <span>
                {dbSyncStatus === "synced" ? "クラウド同期中 (Firestore)" : dbSyncStatus === "connecting" ? "クラウド接続中..." : "同期エラー (ローカル)"}
              </span>
            </div>

            <a 
              href="/api/download-zip"
              id="download-zip-header-btn"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Web公開用ソース (.zip)</span>
            </a>
            <button 
              onClick={handleLogout}
              className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 active:scale-95 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>ログアウト</span>
            </button>
            <div className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              UTC: 2026-07-08
            </div>
          </div>
        </div>
      </header>

      {/* Primary Page Content Wrapper */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Navigation Tabs (Simulating separate page views) */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto pb-px gap-2 sm:gap-4 scrollbar-none">
          <button
            onClick={() => setActivePage("accounts")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "accounts"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <User className="w-4 h-4" />
            👥 ① アカウント選択
          </button>

          <button
            onClick={() => setActivePage("input")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "input"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Twitter className="w-4 h-4 text-sky-400" />
            🔗 ② ポストURL読込
          </button>

          <button
            onClick={() => setActivePage("generate")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "generate"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            ✨ ③ 返信文生成・コピー
          </button>
          
          <button
            onClick={() => setActivePage("rules")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "rules"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            📋 ルール追加・編集
          </button>
          
          <button
            onClick={() => setActivePage("gemini")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "gemini"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Key className="w-4 h-4 text-amber-500" />
            🔑 Gemini API 設定
          </button>

          <button
            onClick={() => setActivePage("sitetext")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "sitetext"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Edit className="w-4 h-4 text-rose-500" />
            ✍️ サイト文字編集
          </button>

          <button
            onClick={() => setActivePage("windows")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "windows"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Settings className="w-4 h-4 text-slate-500" />
            📦 Web用ZIPダウンロード
          </button>

          <button
            onClick={() => setActivePage("cloudflare")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "cloudflare"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Cloud className="w-4 h-4 text-orange-500" />
            ☁️ Cloudflare 公開ガイド
          </button>

          <button
            onClick={() => setActivePage("hyonix")}
            className={`pb-4 text-sm font-semibold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap px-1 ${
              activePage === "hyonix"
                ? "border-rose-500 text-rose-600 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Server className="w-4 h-4 text-sky-500" />
            🖥️ Hyonix VPS 公開ガイド
          </button>
        </div>

        {/* -----------------------------------------------------------------
            VIEW 1: ACCOUNTS PAGE (ステップ 1: 運用アカウント選択)
            ----------------------------------------------------------------- */}
        {activePage === "accounts" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Quick Helper Banner */}
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 text-xs text-rose-900 leading-relaxed">
              <Sparkles className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">【STEP 1】運用アカウント切り替え</span>
                <p className="mt-0.5 text-rose-700">
                  アカウントを選択してください。選択したアカウントの設定やルールがAIに自動で引き継がれます。
                  アカウントの追加・変更・削除もこのページで行えます。
                </p>
              </div>
            </div>

            {/* BLOCK 1: 運用アカウント切り替え (XのIDで切り替え) */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-rose-500" />
                    1. 運用アカウント切り替え (XのIDで切り替え)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    アクティブに運用するアカウントを切り替えます。選択したアカウントに合わせてルールが自動連動します。
                  </p>
                </div>
                <button
                  onClick={handleAddAccount}
                  className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto active:scale-95 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  新規アカウント追加
                </button>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex border-b border-slate-100 mb-6 gap-6">
                <button
                  onClick={() => setAccountSelectionMode("list")}
                  className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    accountSelectionMode === "list"
                      ? "border-rose-500 text-rose-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <List className="w-4 h-4" />
                  <span>既存リストから選択 ({accounts.length})</span>
                </button>
                <button
                  onClick={() => setAccountSelectionMode("search")}
                  className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                    accountSelectionMode === "search"
                      ? "border-rose-500 text-rose-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>検索＆直接切り替え</span>
                </button>
              </div>

              {accountSelectionMode === "list" ? (
                /* Profiles Grid (Standard view) */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {accounts.map((acc) => {
                    const isActive = acc.id === selectedAccountId;
                    return (
                      <div
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`relative group p-4 rounded-2xl border-2 transition-all flex flex-col justify-between cursor-pointer ${
                          isActive
                            ? "bg-rose-50/20 border-rose-500 shadow-md text-rose-950"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
                        }`}
                      >
                        <div>
                          {/* Upper Info */}
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-bold text-sm tracking-tight ${isActive ? "text-rose-700" : "text-slate-800"}`}>
                              {acc.name}
                            </span>
                            {isActive && (
                              <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
                                アクティブ
                              </span>
                            )}
                          </div>

                          {/* X ID Handle (Crucial Requirement) */}
                          <div className="flex items-center gap-1 text-xs font-mono font-medium text-slate-500 mb-2">
                            <Twitter className="w-3.5 h-3.5 text-sky-400" />
                            <span className="text-slate-700 font-bold bg-slate-200/50 px-1.5 py-0.5 rounded">
                              {acc.xId || "@no_id"}
                            </span>
                          </div>

                          {/* Character description */}
                          <div className="space-y-1.5 mt-2">
                            <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                              役職・設定:
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {acc.role} — {acc.purpose}
                            </p>
                          </div>
                        </div>

                        {/* Card Bottom Actions */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                          <span className="font-mono text-[10px]">
                            適用ルール: {acc.rules.length}項目
                          </span>
                          
                          {/* Inline renaming and deletion */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRenameAccount(acc.id, acc.name, acc.xId);
                              }}
                              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-white border border-slate-200 transition-all"
                              title="プロファイル名を変更"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAccount(acc.id, acc.name);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-white border border-slate-200 transition-all"
                              title="プロファイルを削除"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Search and Direct Toggle (Combo View) */
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
                    {/* Real-time search filter */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        キーワードで絞り込む
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={accountSearchQuery}
                          onChange={(e) => setAccountSearchQuery(e.target.value)}
                          placeholder="名前、ID、役割などを入力..."
                          className="w-full bg-white border border-slate-200 focus:border-rose-500 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-800 focus:outline-hidden transition-all"
                        />
                        {accountSearchQuery && (
                          <button
                            onClick={() => setAccountSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Quick Direct Selector Dropdown */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                        既存アカウントから選択（ドロップダウン）
                      </label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-rose-500 rounded-xl py-2.5 px-3.5 text-sm text-slate-800 focus:outline-hidden transition-all cursor-pointer font-medium"
                      >
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.xId || "@no_id"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Filtered Profiles Grid */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-500">
                        検索結果 ({filteredAccounts.length}件):
                      </span>
                    </div>

                    {filteredAccounts.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 font-medium">
                          検索条件に一致するアカウントが見つかりません。
                        </p>
                        <button
                          onClick={() => setAccountSearchQuery("")}
                          className="mt-2 text-xs text-rose-500 hover:text-rose-600 font-bold"
                        >
                          検索キーワードをリセット
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {filteredAccounts.map((acc) => {
                          const isActive = acc.id === selectedAccountId;
                          return (
                            <div
                              key={acc.id}
                              onClick={() => setSelectedAccountId(acc.id)}
                              className={`relative group p-4 rounded-2xl border-2 transition-all flex flex-col justify-between cursor-pointer ${
                                isActive
                                  ? "bg-rose-50/20 border-rose-500 shadow-md text-rose-950"
                                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`font-bold text-sm tracking-tight ${isActive ? "text-rose-700" : "text-slate-800"}`}>
                                    {acc.name}
                                  </span>
                                  {isActive && (
                                    <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold">
                                      アクティブ
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 text-xs font-mono font-medium text-slate-500 mb-2">
                                  <Twitter className="w-3.5 h-3.5 text-sky-400" />
                                  <span className="text-slate-700 font-bold bg-slate-200/50 px-1.5 py-0.5 rounded">
                                    {acc.xId || "@no_id"}
                                  </span>
                                </div>

                                <div className="space-y-1.5 mt-2">
                                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                                    役職・設定:
                                  </div>
                                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                    {acc.role} — {acc.purpose}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                <span className="font-mono text-[10px]">
                                  適用ルール: {acc.rules.length}項目
                                </span>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameAccount(acc.id, acc.name, acc.xId);
                                    }}
                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-white border border-slate-200 transition-all"
                                    title="プロファイル名を変更"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteAccount(acc.id, acc.name);
                                    }}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-white border border-slate-200 transition-all"
                                    title="プロファイルを削除"
                                  >
                                    <Trash className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Wizard Navigation Footer */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-xs">
              <span className="text-xs text-slate-500">
                アカウントが設定できたら、次のステップに進みましょう。
              </span>
              <button
                onClick={() => setActivePage("input")}
                className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all flex items-center gap-2 active:scale-95 cursor-pointer shadow-md shadow-rose-500/10"
              >
                <span>ステップ2：ポストURL読込へ進む</span>
                <Twitter className="w-4 h-4 text-sky-100" />
              </button>
            </div>

          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 1.2: INPUT PAGE (ステップ 2: 返信対象のポスト読込)
            ----------------------------------------------------------------- */}
        {activePage === "input" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Active Account Status Bar */}
            <div className="bg-slate-800 text-white px-5 py-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-rose-500 rounded-lg flex items-center justify-center text-white text-xs font-bold font-mono">
                  1
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold leading-none uppercase">現在適用中の運用アカウント</p>
                  <p className="text-sm font-bold mt-1 text-rose-200 flex items-center gap-1.5">
                    {activeAccount.name} <span className="font-mono text-xs bg-slate-700/60 text-white px-1.5 py-0.5 rounded">{activeAccount.xId}</span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActivePage("accounts")}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 transition-all cursor-pointer"
              >
                アカウントを変更する
              </button>
            </div>

            {/* Quick Helper Banner */}
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex gap-3 text-xs text-rose-900 leading-relaxed">
              <Sparkles className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">【STEP 2】返信対象ポストのURL読込</span>
                <p className="mt-0.5 text-rose-700">
                  返信先のX(Twitter)のポストURLを読み込みます。X側のAPI制限などで自動取得ができない場合は、手動で本文をコピーして「ターゲットポスト本文」入力欄に直接貼り付けることも可能です。
                </p>
              </div>
            </div>

            {/* BLOCK 2: 返信対象のポストURL */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Twitter className="w-5 h-5 text-sky-400" />
                    2. 返信対象のポストURL
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    返信を作成したいポストのURLを入力するか、プリセットから選んで本文を読み込みます。直接テキスト編集も可能です。
                  </p>
                </div>
              </div>

              {/* URL Import Field */}
              <div className="p-4 bg-sky-50/40 rounded-2xl border border-sky-100 space-y-3 mb-5">
                <label className="block text-xs font-bold text-sky-800 flex items-center gap-1.5">
                  <Twitter className="w-4 h-4 text-sky-400 animate-pulse" />
                  X(Twitter)のURLからポストを自動取得
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    placeholder="https://x.com/ユーザー名/status/1234567890..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-200"
                  />
                  <button
                    onClick={handleFetchTweet}
                    disabled={isFetchingTweet || !tweetUrl.trim()}
                    className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-xs active:scale-98"
                  >
                    {isFetchingTweet ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>取得中...</span>
                      </>
                    ) : (
                      <span>読み込む</span>
                    )}
                  </button>
                </div>
                {tweetFetchError && (
                  <p className="text-[11px] text-rose-600 font-semibold flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {tweetFetchError}
                  </p>
                )}
                {fetchedAuthor && (
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {fetchedAuthor} さんのポストを正常に読み込みました。
                  </p>
                )}
              </div>



              {/* Post Content Text Area */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                  <label>ターゲットポスト本文（編集・直接入力可能）</label>
                  <span>{tweetInput.length} 文字</span>
                </div>
                <textarea
                  value={tweetInput}
                  onChange={(e) => setTweetInput(e.target.value)}
                  placeholder="ここに相手のポストが読み込まれます..."
                  className="w-full min-h-[110px] bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 leading-relaxed transition-all font-sans"
                />
              </div>
            </section>

            {/* Wizard Navigation Footer */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-xs">
              <button
                onClick={() => setActivePage("accounts")}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                ← アカウント選択に戻る
              </button>
              <button
                onClick={() => setActivePage("generate")}
                disabled={!tweetInput.trim()}
                className="bg-rose-500 hover:bg-rose-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs px-5 py-3 rounded-xl transition-all flex items-center gap-2 active:scale-95 cursor-pointer shadow-md shadow-rose-500/10"
              >
                <span>ステップ3：返信文の生成へ進む</span>
                <Sparkles className="w-4 h-4 text-amber-100" />
              </button>
            </div>

          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 1.3: GENERATE PAGE (ステップ 3: AI文章生成・コピー)
            ----------------------------------------------------------------- */}
        {activePage === "generate" && (
          <div className="space-y-8 animate-fade-in">
            
            {/* Selection Context Banner */}
            <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] bg-rose-500 text-white font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                    STEP 1 アカウント
                  </span>
                  <p className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                    👤 {activeAccount.name} <span className="font-mono text-xs text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">{activeAccount.xId}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                  <span className="text-[10px] bg-sky-500 text-white font-bold px-2 py-0.5 rounded-md uppercase tracking-wider">
                    STEP 2 読込ポスト
                  </span>
                  <p className="text-xs text-slate-300 font-sans line-clamp-1 italic max-w-xl">
                    「{tweetInput || "（未読込・空のポスト本文です）"}」
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setActivePage("accounts")}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
                  title="アカウントを再選択"
                >
                  アカウント選択へ
                </button>
                <button
                  onClick={() => setActivePage("input")}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
                  title="対象URLを再読み込み"
                >
                  URL読込へ
                </button>
              </div>
            </div>

            {/* BLOCK 3: AI文章生成→コピー */}
            <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-800 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                    3. AI文章生成→コピー
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    選択したアカウント設定と厳守ルールに沿って、AIが返信文案を3パターン同時に生成します。
                  </p>
                </div>

                {/* Gemini Mode Indicator */}
                <div className="self-start sm:self-auto text-xs font-mono font-medium flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/50">
                  <div className={`w-2.5 h-2.5 rounded-full ${customApiKey ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                  <span>
                    生成モード: {customApiKey ? `カスタム ${customModel}` : "オフライン推奨エンジン"}
                  </span>
                </div>
              </div>

              {/* Big Generate Trigger Button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !tweetInput}
                className={`w-full py-4 px-6 rounded-2xl font-display font-bold text-white shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  isGenerating 
                    ? "bg-rose-400/80 cursor-not-allowed" 
                    : "bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 active:scale-[0.99] hover:shadow-lg hover:shadow-rose-500/10"
                }`}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>高品質AI返信を構成中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>AI返信文章を新規生成</span>
                  </>
                )}
              </button>

              {/* Error / Connection Fallback Dialog */}
              {errorMsg && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-xs flex gap-3 leading-relaxed">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-1">APIオフライン切り替え通知</span>
                    <span>返信の生成中にエラーが発生しました。（最適なローカル推奨プロトコルを起動し、ランダムプロシージャルに高品位な返信を3パターン自動生成しました。コピペで即運用可能です。）</span>
                  </div>
                </div>
              )}

              {/* Generates Candidate List */}
              <div className="space-y-6 mt-4">
                {isGenerating ? (
                  <div className="border border-slate-100 rounded-2xl p-12 text-center space-y-4 bg-slate-50/50">
                    <div className="flex justify-center">
                      <div className="relative">
                        <div className="w-14 h-14 border-4 border-rose-100 border-t-rose-500 rounded-full animate-spin"></div>
                        <Sparkles className="w-5 h-5 text-amber-500 absolute top-4 left-4.5 animate-bounce" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-display font-semibold text-slate-700">{generationProgressMsg}</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {loadingMessageSubtitle}
                      </p>
                    </div>
                  </div>
                ) : generatedReplies.length > 0 ? (
                  <div className="space-y-6">
                    {generatedReplies.map((reply, idx) => {
                      const draftText = editedReplyTexts[idx] ?? reply.text;
                      const scan = getScannerResults(draftText);

                      return (
                        <div key={idx} className="bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden transition-all hover:border-rose-200">
                          
                          {/* Inner Card layout mimicking X Post format */}
                          <div className="p-5 border-b border-slate-200/60 bg-white">
                            <div className="flex items-center justify-between mb-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 bg-gradient-to-tr from-slate-700 to-slate-800 rounded-full flex items-center justify-center text-white font-bold text-xs px-1 text-center">
                                  {activeAccount.name ? (activeAccount.name.length > 2 ? activeAccount.name.slice(0, 2) : activeAccount.name) : "店"}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-sm text-slate-800">{role}</span>
                                    <span className="text-xs text-slate-400 font-mono">{activeAccount.xId}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Pattern Counter */}
                              <span className="text-xs font-bold text-slate-400 font-mono">
                                パターン {idx + 1}
                              </span>
                            </div>

                            {/* Response content editor (Direct correction allowed) */}
                            <div className="relative">
                              <textarea
                                value={draftText}
                                onChange={(e) => handleEditReplyChange(idx, e.target.value)}
                                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-rose-300 rounded-xl p-4 text-sm text-slate-800 leading-relaxed font-sans focus:outline-hidden transition-all focus:ring-2 focus:ring-rose-500/10"
                                rows={3}
                              />
                            </div>

                            {/* Compliance Checker Indicators & Copy Button */}
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                              <div className="flex flex-wrap items-center gap-2">
                                
                                {/* Character Count */}
                                <span className={`text-xs font-mono px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold ${
                                  scan.lengthOk 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                    : "bg-rose-50 text-rose-700 border border-rose-100 animate-pulse"
                                }`}>
                                  {scan.length}文字
                                  {scan.lengthOk ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                </span>

                                {/* Prohibited Words Check */}
                                {scan.prohibitedOk ? (
                                  <span className="text-[11px] text-emerald-600 bg-emerald-50/50 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-0.5 font-medium">
                                    <Check className="w-3 h-3" /> 禁止表現なし
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold animate-pulse">
                                    <AlertTriangle className="w-3 h-3" /> 「{scan.foundProhibited.join(", ")}」を検出
                                  </span>
                                )}

                                {/* Links Check */}
                                {scan.cleanOk ? (
                                  <span className="text-[11px] text-emerald-600 bg-emerald-50/50 border border-emerald-100 px-2 py-0.5 rounded-md font-medium">
                                    # / リンクなし (安全)
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                                    ハッシュタグまたはURLを含んでいます
                                  </span>
                                )}

                              </div>

                              {/* Copy Trigger */}
                              <button
                                onClick={() => handleCopyText(draftText, idx)}
                                className={`px-5 py-2 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                  copiedIndex === idx 
                                    ? "bg-emerald-500 text-white shadow-xs" 
                                    : "bg-rose-500 text-white hover:bg-rose-600 active:scale-95 shadow-xs"
                                }`}
                              >
                                {copiedIndex === idx ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{copiedIndex === idx ? "コピー完了" : "文章をコピー"}</span>
                              </button>
                            </div>

                          </div>

                          {/* Strategy Details */}
                          <div className="bg-slate-50/50 p-4 border-t border-slate-200/50 flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <div>
                              <span className="text-xs font-bold text-slate-700 block mb-0.5">作成戦略と工夫:</span>
                              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                                {reply.explanation}
                              </p>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-200 rounded-3xl p-10 text-center text-slate-400 bg-slate-50/20">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-rose-300 animate-pulse" />
                    <p className="font-semibold text-xs text-slate-500 mb-1">返信文案が未生成です</p>
                    <p className="text-[11px] text-slate-400">「AI返信文章を新規生成」ボタンを押すと、3パターンの安全な返信文案がここに生成されます。</p>
                  </div>
                )}
              </div>
            </section>

          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 2: RULES PAGE (別ページでルール追加編集)
            ----------------------------------------------------------------- */}
        {activePage === "rules" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 max-w-4xl mx-auto animate-fade-in">
            
            <div className="border-b border-slate-100 pb-5">
              <h3 className="font-display font-bold text-xl text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                ルール追加・編集
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                現在選択されているアカウントプロファイル <strong>「{activeAccount.name} ({activeAccount.xId})」</strong> に適用する厳守ルールを設定します。
              </p>
            </div>

            {/* Account Details Quick Sync Editor */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  役職・キャラクター設定
                </label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  placeholder="例: 飛田新地のオーナー"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  ターゲット・条件詳細
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => handlePurposeChange(e.target.value)}
                  placeholder="例: 15分5000円、簡単サービス、DMへ誘導"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200"
                />
              </div>
            </div>

            {/* Strict Rules List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-bold text-slate-700">
                  現在設定されているAI生成ルール
                </label>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-md text-slate-500">
                  {rules.length} 項目適用中
                </span>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                {rules.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">設定されているルールはありません。新しく追加してください。</p>
                ) : (
                  rules.map((rule, idx) => (
                    <div key={idx} className="flex items-start justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs transition-all hover:border-slate-300">
                      <div className="flex gap-2 text-xs text-slate-700">
                        <span className="font-mono font-bold text-slate-400">{idx + 1}.</span>
                        <span className="leading-relaxed">{rule}</span>
                      </div>
                      <button 
                        onClick={() => removeRule(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-slate-50 transition-all cursor-pointer shrink-0"
                        title="ルールを削除"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add New Rule input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="新しいルールをここに入力してください（例：毎回文章構成を変え、コピペに見えないようにする）"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustomRule();
                  }}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 focus:bg-white transition-all"
                />
                <button
                  onClick={addCustomRule}
                  disabled={!newRule.trim()}
                  className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>ルール追加</span>
                </button>
              </div>
            </div>



          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 3: GEMINI API PAGE (別ページでgemini api追加または編集)
            ----------------------------------------------------------------- */}
        {activePage === "gemini" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 max-w-4xl mx-auto animate-fade-in">
            
            <div className="border-b border-slate-100 pb-5">
              <h3 className="font-display font-bold text-xl text-slate-800 flex items-center gap-2">
                <Key className="w-6 h-6 text-amber-500" />
                Gemini API 設定
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                独自の Google Gemini APIキーを入力することで、制限のない高度なAI生成機能を完全に稼働させることができます。
              </p>
            </div>

            {/* API Settings Form */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Gemini API キー (Custom API Key)
                </label>
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="AI Studioから取得した AIzaSy... で始まるキーを入力してください"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-800 font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  ※ 入力したAPIキーはお客様のローカルブラウザ（LocalStorage）にのみ安全に保存され、第三者へ送信されることはありません。<br />
                  ※ 空欄のままでも、独自のローカル高度文章生成エンジンが自動起動するため、100%全機能をお試し頂けます。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  使用モデル (Model Name)
                </label>
                <select
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition-all"
                >
                  <option value="gemini-3.5-flash">gemini-3.5-flash (最新フラッグシップ高速・高精度モデル・推奨)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (超高速・高安定モデル)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  ※ Google Gemini 3.5 シリーズを含む、最新のAIモデル群に完全対応しています。高精度で最も自然な文章作成ができる最新の <strong>gemini-3.5-flash</strong> が標準で選択可能になっています。
                </p>
              </div>

              {/* Status Display Area */}
              {apiConnectionMsg && (
                <div className={`p-4 rounded-2xl text-xs flex gap-3 leading-relaxed border ${
                  apiConnectionStatus === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : apiConnectionStatus === "failed"
                    ? "bg-rose-50 border-rose-200 text-rose-800"
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}>
                  {apiConnectionStatus === "testing" ? (
                    <RefreshCw className="w-5 h-5 text-slate-500 animate-spin shrink-0 mt-0.5" />
                  ) : apiConnectionStatus === "success" ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block mb-0.5">API 接続ステータス</span>
                    <span>{apiConnectionMsg}</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleTestConnection}
                  disabled={apiConnectionStatus === "testing"}
                  className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-300 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  {apiConnectionStatus === "testing" ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>API 接続テストを実行</span>
                </button>
              </div>
            </div>

            {/* Error simulation card for testing */}
            <div className="bg-rose-50/50 rounded-2xl p-5 border border-rose-100 space-y-3.5">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
                <h4 className="font-display font-bold text-sm">
                  ⚠️ エラー表示のテスト・挙動検証
                </h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                実際にAPIエラーが発生した際に、システムがどのように自動リトライを実行し、どのような日本語アドバイスが表示されるかをワンクリックでシミュレートしてテストできます。
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleSimulateError("403")}
                  disabled={isGenerating}
                  className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] py-2.5 px-3 rounded-xl transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center shadow-xs"
                >
                  <span className="font-mono">① 403 / 400</span>
                  <span>APIキー無効</span>
                </button>
                <button
                  onClick={() => handleSimulateError("503")}
                  disabled={isGenerating}
                  className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] py-2.5 px-3 rounded-xl transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center shadow-xs"
                >
                  <span className="font-mono">② 503 混雑</span>
                  <span>サーバーリトライ</span>
                </button>
                <button
                  onClick={() => handleSimulateError("429")}
                  disabled={isGenerating}
                  className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] py-2.5 px-3 rounded-xl transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center shadow-xs"
                >
                  <span className="font-mono">③ 429 制限</span>
                  <span>アクセス回数超過</span>
                </button>
                <button
                  onClick={() => handleSimulateError("timeout")}
                  disabled={isGenerating}
                  className="bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px] py-2.5 px-3 rounded-xl transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-1 text-center shadow-xs"
                >
                  <span className="font-mono">④ Timeout</span>
                  <span>30秒超過エラー</span>
                </button>
              </div>
              {isGenerating && (
                <div className="text-center text-[10px] text-rose-500 font-bold animate-pulse">
                  ※ エラーテスト動作中... 進捗アニメーションを再現しています。
                </div>
              )}
            </div>

            {/* Instruction on how to get API Key */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
              <h4 className="font-display font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <HelpCircle className="w-4.5 h-4.5 text-slate-500" />
                Gemini API キーの取得手順
              </h4>
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <ol className="list-decimal pl-5 space-y-1">
                  <li>
                    <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-rose-600 font-semibold underline hover:text-rose-700">
                      Google AI Studio (aistudio.google.com)
                    </a> にアクセスします（Googleアカウントが必要です）。
                  </li>
                  <li>
                    画面上部、またはサイドバーにある <strong>「Get API key」</strong> ボタンをクリックします。
                  </li>
                  <li>
                    <strong>「Create API key」</strong> をクリックし、任意のプロジェクトを選択、または新規作成してキーを作成します。
                  </li>
                  <li>
                    生成された <code className="bg-slate-200 text-slate-800 font-mono px-1 rounded">AIzaSy...</code> で始まるキーをコピーし、上記の入力欄に貼り付けしてください。
                  </li>
                </ol>
              </div>
            </div>

          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 3.5: SITE TEXT CUSTOMIZATION PAGE (サイト文字編集)
            ----------------------------------------------------------------- */}
        {activePage === "sitetext" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-8 max-w-4xl mx-auto animate-fade-in">
            
            <div className="border-b border-slate-100 pb-5">
              <h3 className="font-display font-bold text-xl text-slate-800 flex items-center gap-2">
                <Edit className="w-6 h-6 text-rose-500" />
                サイト文字の編集・カスタマイズ
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                この画面から、サイト内のタイトル、説明文、プリセット、推奨アンサーなどをリアルタイムで編集・保存できます。お好みのブランド名や運用目的に合わせて書き換えてください。
              </p>
            </div>

            {/* BLOCK 1: Title and Subtitle */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-sm text-slate-700 uppercase tracking-wider">
                1. サイトのタイトル & 説明（ヘッダー部分）
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    メインタイトル (App Title)
                  </label>
                  <input
                    type="text"
                    value={appTitle}
                    onChange={(e) => setAppTitle(e.target.value)}
                    placeholder="例: X自動返信ツール"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition-all font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    サブタイトル (App Subtitle)
                  </label>
                  <input
                    type="text"
                    value={appSubtitle}
                    onChange={(e) => setAppSubtitle(e.target.value)}
                    placeholder="例: アカウント一元管理、ルール厳守、AI自然文章リアルタイム選定"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* BLOCK 2: Default Recommended Answer */}
            <div className="space-y-3 pt-2">
              <h4 className="font-display font-bold text-sm text-slate-700 uppercase tracking-wider">
                2. デフォルト推奨・初期回答テキスト
              </h4>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  推奨アンサー文言 (Default Answer)
                </label>
                <textarea
                  value={appOfficialAnswer}
                  onChange={(e) => setAppOfficialAnswer(e.target.value)}
                  placeholder="ここにローカルフォールバック時などに使用する推奨回答を入力してください..."
                  className="w-full min-h-[100px] bg-slate-50 border border-slate-200 focus:bg-white rounded-xl p-4 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 leading-relaxed transition-all font-sans"
                />
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] text-slate-400">
                    ※ 何らかの理由で生成できない場合や初期ロード時やAPI接続エラー時の回答候補パターン（ローカル生成）には「生成に失敗しました」等と設定しておくと安心です。
                  </span>
                  <span className="text-xs font-mono text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded">
                    {appOfficialAnswer.length} 文字
                  </span>
                </div>
              </div>
            </div>

            {/* BLOCK 3: Preset Tweets Management */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-sm text-slate-700 uppercase tracking-wider">
                  3. クイックテスト用プリセットポストの管理
                </h4>
                <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-1 rounded-md text-slate-500">
                  {presetTweets.length} 個設定中
                </span>
              </div>

              {/* Preset List with direct inputs */}
              <div className="space-y-4 max-h-[350px] overflow-y-auto border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                {presetTweets.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">設定されているプリセットはありません。新しく追加してください。</p>
                ) : (
                  presetTweets.map((preset, idx) => (
                    <div key={preset.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs transition-all hover:border-slate-300 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-mono font-bold text-slate-400 text-xs">{idx + 1}.</span>
                          <input
                            type="text"
                            value={preset.label}
                            onChange={(e) => handleUpdatePresetLabel(preset.id, e.target.value)}
                            placeholder="プリセット名（例：大阪の簡単ワーク希望）"
                            className="bg-slate-50 focus:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-rose-200 flex-1 max-w-[240px]"
                          />
                        </div>
                        <button 
                          onClick={() => handleRemovePreset(preset.id)}
                          className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-50 transition-all cursor-pointer shrink-0"
                          title="プリセットを削除"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={preset.text}
                        onChange={(e) => handleUpdatePresetText(preset.id, e.target.value)}
                        placeholder="ポスト本文を入力してください..."
                        className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-600 focus:outline-hidden focus:ring-1 focus:ring-rose-200 leading-relaxed font-sans"
                        rows={2}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Add New Preset Form */}
              <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-slate-700 block">
                  ➕ 新規プリセットポストの追加
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <input
                      type="text"
                      placeholder="プリセットのラベル（例: 短期バイト希望）"
                      value={newPresetLabel}
                      onChange={(e) => setNewPresetLabel(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <textarea
                      placeholder="ポストの本文を入力してください..."
                      value={newPresetText}
                      onChange={(e) => setNewPresetText(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 leading-normal"
                      rows={1}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleAddPreset}
                    disabled={!newPresetLabel.trim() || !newPresetText.trim()}
                    className="bg-slate-800 hover:bg-slate-700 disabled:bg-slate-200 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>プリセット追加</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BLOCK 3.5: Generation Progress Messaging & Loading Subtitles */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="font-display font-bold text-sm text-slate-700 uppercase tracking-wider">
                3.5. 生成中の進捗メッセージ・読み込みテキストの管理
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                AIによる文章生成（分析中）画面で、ユーザーを飽きさせずに安心感を与えるローディングテキストです。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    メイン進捗メッセージ（大見出し）
                  </label>
                  <input
                    type="text"
                    value={loadingMessageTitle}
                    onChange={(e) => setLoadingMessageTitle(e.target.value)}
                    placeholder="AIアシスタントが最適な返信文を生成中..."
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 transition-all font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">※ 通常、1回目（初回）の分析開始時に大見出しとして表示されます。</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    分析中の説明・チェック詳細（小見出し）
                  </label>
                  <textarea
                    value={loadingMessageSubtitle}
                    onChange={(e) => setLoadingMessageSubtitle(e.target.value)}
                    placeholder="「アカウント設定の反映」「自然な寄り添い表現の調整」「文字数のチェック」を実行しています..."
                    className="w-full min-h-[80px] bg-slate-50 border border-slate-200 focus:bg-white rounded-xl p-3 text-sm text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-200 leading-normal transition-all"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">※ 進捗スピナーの直下に薄いグレー文字で表示されます。</p>
                </div>
              </div>
            </div>

            {/* BLOCK 4: Reset & Restore Defaults */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-0.5 text-center sm:text-left">
                  <span className="text-xs font-bold text-slate-700 block">
                    ⚙️ 文字設定の初期化
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    サイト内の文字、見出し、公式アンサー、プリセットをすべて最初のデフォルト状態に戻します。
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {resetSuccess && (
                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 animate-fade-in">
                      ✓ 初期状態にリセットしました
                    </span>
                  )}
                  
                  {showResetConfirm ? (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-2 animate-fade-in">
                      <span className="text-xs text-amber-800 font-bold">本当にリセットしますか？</span>
                      <button
                        onClick={handleResetSiteTexts}
                        className="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        はい、初期化する
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      className="bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>すべての文字設定を初期化</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-dashed border-slate-100">
                <div className="space-y-0.5 text-center sm:text-left">
                  <span className="text-xs font-bold text-slate-700 block text-rose-600">
                    🔥 プロファイル（アカウント＆プロンプト）の完全消去リセット
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    現在登録されているすべてのアカウント・役職設定・目的・ルールを完全消去し、0から新規作成するための空のテンプレート（新規キャラクター）1件のみに初期化します。
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {profileResetSuccess && (
                    <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 animate-fade-in">
                      ✓ プロファイルを新規リセットしました
                    </span>
                  )}
                  
                  {showProfileResetConfirm ? (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl p-2 animate-fade-in">
                      <span className="text-xs text-rose-800 font-bold">全アカウントが消えます。本当によろしいですか？</span>
                      <button
                        onClick={handleResetProfilesToBlankSlate}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        はい、完全リセットする
                      </button>
                      <button
                        onClick={() => setShowProfileResetConfirm(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-600 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                      >
                        キャンセル
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowProfileResetConfirm(true)}
                      className="bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 text-rose-600 hover:text-rose-700 font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Trash className="w-4 h-4" />
                      <span>プロファイルを完全リセット（0から作成）</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 4: WEB ZIP DOWNLOAD & LOCAL RUN GUIDE
            ----------------------------------------------------------------- */}
        {activePage === "windows" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Intro */}
            <div className="border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-rose-500 text-white p-2.5 rounded-xl">
                  <FolderArchive className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-2xl text-slate-800">
                  Web公開用ソースコード (.zip) ダウンロード
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                本システムは、<strong>React (Vite) + Express (Node.js) を搭載したフルスタックWebアプリケーション</strong>です。<br />
                以下のボタンからダウンロードできるZIPファイルには、ご自身のPC（ローカル環境）や、VPSサーバー（Hyonixなど）、サーバーレス環境（Cloudflare Pagesなど）へデプロイして、Webサイトとして24時間公開するために必要なすべてのファイルが含まれています。
              </p>
            </div>

            {/* Direct Big Download Button */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="font-bold text-slate-800 text-sm">最新のWeb公開用パッケージ</h4>
                <p className="text-xs text-slate-500">
                  Cloudflare、Hyonix VPS、ローカルNode.js環境のすべてに共通で使える完全なソースコードです。
                </p>
              </div>
              <a 
                href="/api/download-zip"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-6 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 shrink-0 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Web公開用 ZIPをダウンロード</span>
              </a>
            </div>

            {/* Crucial Prerequisite: Node.js installation */}
            <div className="bg-amber-50 border-2 border-amber-500/20 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm text-amber-800 flex items-center gap-2">
                <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">前提条件</span>
                ローカルPCで動かすには「Node.js」が必要です
              </h4>
              <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                <p>
                  ダウンロードしたZIPを展開し、ご自身のパソコン上でテスト起動したりビルドしたりするには、事前に <strong>Node.js</strong> がインストールされている必要があります。
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-slate-800 font-medium">
                  <li>
                    <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
                      Node.js 公式サイト (https://nodejs.org/)
                    </a> にアクセスします。
                  </li>
                  <li>
                    画面に表示される <strong>「LTS (推奨版)」</strong> インストーラーをダウンロードしてインストールします。
                  </li>
                </ol>
              </div>
            </div>

            {/* Step-by-Step Local Run Guide */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-base text-slate-800 flex items-center gap-1.5">
                <CheckCircle className="w-5 h-5 text-rose-500" />
                パソコン（ローカル環境）での起動・テスト手順
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 relative">
                  <span className="absolute top-3 right-3 text-2xl font-black text-slate-200 font-mono">01</span>
                  <h5 className="font-bold text-sm text-slate-800 mb-2">ZIPを解凍して移動</h5>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ダウンロードした <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono text-[10px]">X_Recruitment_Assistant_Web.zip</code> をお好きな場所に展開（解凍）し、コマンドプロンプトやターミナルでそのフォルダに移動します。
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 relative">
                  <span className="absolute top-3 right-3 text-2xl font-black text-slate-200 font-mono">02</span>
                  <h5 className="font-bold text-sm text-slate-800 mb-2">.env ファイルの作成</h5>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    プロジェクト直下に新しく <code className="bg-slate-200 px-1 rounded text-slate-800 font-mono text-[10px]">.env</code> ファイルを作成し、以下のようにGemini APIキーを記述します。<br />
                    <code className="text-[10px] text-rose-600 font-mono">GEMINI_API_KEY="AIzaSy..."</code>
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 relative">
                  <span className="absolute top-3 right-3 text-2xl font-black text-slate-200 font-mono">03</span>
                  <h5 className="font-bold text-sm text-slate-800 mb-2">コマンドを実行</h5>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    以下のコマンドを順に実行します：<br />
                    <code className="block bg-slate-900 text-emerald-400 p-2 rounded mt-1.5 text-[10px] font-mono leading-normal">
                      npm install<br />
                      npm run dev
                    </code>
                    ブラウザで <code className="text-blue-600 underline">http://localhost:3000</code> にアクセスすると動作します。
                  </p>
                </div>
              </div>
            </div>

            {/* Core Scripts inside Web package */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-base text-slate-800 flex items-center gap-1.5">
                <FileText className="w-5 h-5 text-blue-500" />
                Webパッケージの主要スクリプト（package.jsonに内蔵）
              </h4>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-700 font-bold">主要コマンド一覧</span>
                </div>
                <div className="p-4 bg-slate-900 text-slate-300 font-mono text-xs space-y-3">
                  <div>
                    <span className="text-emerald-400">"npm run dev"</span>
                    <p className="text-slate-400 text-xs pl-4 mt-0.5">
                      開発用ローカルサーバー（Express + Vite）を起動します。コード変更がリアルタイムにプレビューに反映されます。
                    </p>
                  </div>
                  <div className="border-t border-slate-800 pt-2">
                    <span className="text-emerald-400">"npm run build"</span>
                    <p className="text-slate-400 text-xs pl-4 mt-0.5">
                      フロントエンド（React/Vite）を本番用にビルドし、バックエンドの <code className="text-rose-400">server.ts</code> を一つの最適化ファイル（dist/server.cjs）にコンパイルします。
                    </p>
                  </div>
                  <div className="border-t border-slate-800 pt-2">
                    <span className="text-emerald-400">"npm run start"</span>
                    <p className="text-slate-400 text-xs pl-4 mt-0.5">
                      ビルドされた本番サーバーを起動します。HyonixなどのVPSや本番Webサーバーで24時間公開・稼働させる際は、このコマンドで起動します。
                    </p>
                  </div>
                </div>
              </div>

              {/* Box: Why Web Zip is safer */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-4 text-xs text-blue-900">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">💡 サイト（Web）公開がおすすめな理由と自動保存について</span>
                  <p className="leading-relaxed text-slate-700">
                    Windowsアプリ版とは異なり、Webサーバー（Cloudflare PagesやHyonix VPS）に公開したWebサイトとして運営することで、スマホを含むあらゆるデバイスからいつでもツールを利用できるようになります。
                  </p>
                  <p className="leading-relaxed text-slate-700">
                    訪問者（あなた以外のユーザーや別のブラウザからアクセスした人）にとっても快適に使えるよう、設定やアカウント情報などはブラウザ固有の<strong>ローカルストレージに自動保存</strong>される設計になっています。そのため、サーバー側で混ざり合ったり他人にデータが流出したりする心配もなく、一人ひとりの環境で完全に安全に自動保存・自動管理されます！
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* -----------------------------------------------------------------
            VIEW 5: CLOUDFLARE DEPLOYMENT GUIDE
            ----------------------------------------------------------------- */}
        {activePage === "cloudflare" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto space-y-8 animate-fade-in">
            
            {/* Intro Header */}
            <div className="border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-orange-500 text-white p-2.5 rounded-xl">
                  <Cloud className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-2xl text-slate-800">
                  Cloudflare（Pages + Workers）無料公開ガイド
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                本Webアプリは、世界最高峰のサーバーレスプラットフォーム <strong>Cloudflare Pages</strong> に完全対応しています。<br />
                静的フロントエンド（Vite + React）と、サーバーレスAPI（Cloudflare Workers / Pages Functions）を組み合わせた
                「フルスタック構成」が、<strong>アクセス制限なく完全無料（Freeプラン）</strong>で公開・運用できます。
              </p>
            </div>

            {/* Crucial highlight about the generated folder */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex gap-3 text-xs text-emerald-800">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-1">🚀 すでにCloudflare用のプログラムは自動生成されています！</span>
                <span className="leading-relaxed">
                  本プロジェクトのルートにある <code className="bg-emerald-100 text-emerald-900 font-mono px-1 rounded">/functions</code> フォルダ内に、
                  Cloudflare専用のエッジAPIハンドラー（ツイート取得、AI返信生成）がすでに書き込まれています。<br />
                  新しくコードを書き直すことなく、このプロジェクトをそのままCloudflareに公開するだけで自動的に稼働します。
                </span>
              </div>
            </div>

            {/* Quick deployment 3 Steps */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-base text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-amber-500" />
                超簡単！無料デプロイの 3ステップ
              </h4>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 relative">
                  <div className="flex items-start gap-4">
                    <span className="bg-slate-200 text-slate-700 w-7 h-7 flex items-center justify-center font-bold font-mono rounded-full text-sm shrink-0">1</span>
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-sm text-slate-800">プロジェクトをエクスポートする</h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        本システム右上にある <strong>「Web公開用ソース (.zip)」</strong> のダウンロードボタンをクリックして、
                        最新のソースコードをZIPでエクスポートしてPCに保存・解凍してください。
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 relative">
                  <div className="flex items-start gap-4">
                    <span className="bg-slate-200 text-slate-700 w-7 h-7 flex items-center justify-center font-bold font-mono rounded-full text-sm shrink-0">2</span>
                    <div className="space-y-3.5 w-full">
                      <h5 className="font-bold text-sm text-slate-800">Cloudflare Pages へのデプロイ</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Cloudflareダッシュボードの <strong>「Workers & Pages」 ➔ 「Pages」</strong> からプロジェクトを登録します。公開方法には <strong>「Gitに接続（推奨）」</strong> と <strong>「直接アップロード」</strong> の2種類があります。
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Option A: Git */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-mono">方法 A（超推奨・自動ビルド）</span>
                          </div>
                          <h6 className="font-bold text-xs text-slate-800 font-sans">GitHubにアップロード（プッシュ）する手順</h6>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            解凍したフォルダ一式をご自身のGitHubリポジトリ（プライベート推奨）にプッシュし、Cloudflareの <strong>「Gitに接続」</strong> から登録します。
                          </p>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2 text-[11px] text-slate-600 leading-relaxed">
                            <span className="font-bold text-slate-700 block">📝 GitHubプッシュの詳しい手順：</span>
                            <ol className="list-decimal pl-4 space-y-1.5 text-slate-500">
                              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-rose-600 underline">GitHub</a>で新規リポジトリ（Private推奨）を「READMEなし」で作成し、URLをコピーします。</li>
                              <li>ターミナルやコマンドプロンプトを起動し、解凍したプロジェクトフォルダに移動します（※下のフォルダ指定方法を参照）。</li>
                              <li>以下のコマンドを1行ずつ実行します：</li>
                            </ol>
                            <pre className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto mt-2 leading-relaxed">
{`git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin <あなたのリポジトリURL>
git push -u origin main`}
                            </pre>
                          </div>
                        </div>

                        {/* Option B: Direct Upload */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono">方法 B（直接アップロード）</span>
                          </div>
                          <h6 className="font-bold text-xs text-slate-800 font-sans">手動でビルドしてアップロード</h6>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            ZIP全体のソースコードをそのまま直接アップロードすると、<strong>「ビルドプロセスが必要なため対応していません」</strong>というエラーになります。
                          </p>
                          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed space-y-1.5">
                            <span className="font-bold block text-amber-800">💡 正しい「直接アップロード」の手順：</span>
                            <ol className="list-decimal pl-4 space-y-1 text-amber-800">
                              <li>ローカルPCでフォルダに移動し、<code className="bg-white border px-1 rounded font-mono text-[10px]">npm install</code> ➔ <code className="bg-white border px-1 rounded font-mono text-[10px]">npm run build</code> を実行。</li>
                              <li>生成された <strong>`dist` フォルダのみ</strong> をZIP圧縮、またはドラッグ＆ドロップしてアップロードします。</li>
                            </ol>
                          </div>

                          {/* How to Specify Directory / CD Guide */}
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2 text-[11px] text-slate-600 leading-relaxed">
                            <span className="font-bold text-slate-700 block">📂 コマンドプロンプト等で「フォルダを指定する（移動する）」方法：</span>
                            <p className="text-[10px] text-slate-500">
                              一番簡単な方法は<strong>「ドラッグ＆ドロップ」</strong>です！
                            </p>
                            <ol className="list-decimal pl-4 space-y-1 text-slate-500">
                              <li>コマンドプロンプト（Windows）またはターミナル（Mac）を開き、 <code className="bg-slate-200 px-1 rounded font-mono font-bold">cd </code> （cdの後に半角スペース）と入力します。</li>
                              <li>解凍したプロジェクトの<strong>フォルダごと</strong>画面にドラッグ＆ドロップします。</li>
                              <li>自動的にフォルダの絶対パスが入力されるので、<strong>Enterキー</strong>を押します。これで指定完了です！</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                      
                      {/* Cloudflare settings table */}
                      <div className="bg-white border border-slate-200 rounded-xl p-3.5 mt-2 overflow-x-auto">
                        <span className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider font-mono">Git連携時のビルド設定 (Build Configuration)</span>
                        <table className="w-full text-xs text-left">
                          <tbody>
                            <tr className="border-b border-slate-100">
                              <td className="py-1.5 text-slate-500 font-medium pr-4">フレームワークプリセット</td>
                              <td className="py-1.5 text-slate-800 font-semibold font-mono">Vite</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-1.5 text-slate-500 font-medium pr-4">ビルドコマンド</td>
                              <td className="py-1.5 text-slate-800 font-semibold font-mono">npm run build</td>
                            </tr>
                            <tr>
                              <td className="py-1.5 text-slate-500 font-medium pr-4">ビルド出力ディレクトリ</td>
                              <td className="py-1.5 text-slate-800 font-semibold font-mono">dist</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 relative">
                  <div className="flex items-start gap-4">
                    <span className="bg-slate-200 text-slate-700 w-7 h-7 flex items-center justify-center font-bold font-mono rounded-full text-sm shrink-0">3</span>
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-sm text-slate-800">Gemini APIキーを環境変数に設定</h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        デプロイ完了後、Cloudflare Pagesの <strong>「Settings (設定)」➔「Environment variables (環境変数)」➔「Add variable (変数の追加)」</strong> から以下を登録します：
                      </p>
                      <div className="bg-slate-900 text-slate-200 px-3 py-2 rounded-lg font-mono text-xs inline-flex items-center gap-2 mt-1">
                        <span className="text-rose-400">GEMINI_API_KEY</span>
                        <span className="text-slate-400">=</span>
                        <span className="text-emerald-400">"あなたのGemini APIキー"</span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                        ※ これを設定するだけで、Cloudflareのエッジサーバー上でGemini APIを直接安全に呼び出すことができるようになり、APIキーがブラウザ側に露出するのを防ぎます。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Local testing and debugging details */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-base text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-5 h-5 text-blue-500" />
                ローカル環境でのテストとデバッグ
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cloudflareダッシュボードに毎回公開することなく、お使いのパソコン上でCloudflareのエミュレーター（Wrangler）を使って、完全に動作検証することができます。
              </p>

              {/* Box: CLI Commands */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded font-mono">BASH</span>
                    <span className="text-xs font-mono text-slate-700 font-bold">Cloudflare ローカル検証コマンド</span>
                  </div>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`# 1. 依存関係のビルドを実行
npm run build

# 2. Wranglerを使ってローカルエミュレータを起動
npx wrangler pages dev dist --compatibility-date=2024-03-01 --binding GEMINI_API_KEY=あなたのキー`}
                </pre>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ※ このコマンドを実行すると、<code className="bg-slate-100 text-slate-700 px-1 rounded font-mono">http://localhost:8788</code> でエミュレーターが立ち上がり、ローカルのフロントエンドとエッジAPI（Functions）が本番さながらに連携して動きます。
              </p>
            </div>

          </div>
        )}


        {/* -----------------------------------------------------------------
            VIEW 6: HYONIX VPS DEPLOYMENT GUIDE
            ----------------------------------------------------------------- */}
        {activePage === "hyonix" && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm max-w-4xl mx-auto space-y-8 animate-fade-in">
            
            {/* Intro Header */}
            <div className="border-b border-slate-100 pb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-sky-500 text-white p-2.5 rounded-xl">
                  <Server className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-2xl text-slate-800">
                  Hyonix VPS サーバー公開・運用ガイド
                </h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Hyonix（ハイオニクス）等の高品質VPS（LinuxまたはWindows）にて、本WebアプリケーションのフルスタックWebサーバーを
                24時間完全自社管理で稼働・公開することができます。<br />
                すでに本システムには、<strong>Express＋Viteを組み合わせた高性能なフルスタックバックエンドサーバー（<code className="font-mono text-xs bg-slate-100 px-1 rounded">server.ts</code>）</strong>が内蔵されています。
              </p>
            </div>

            {/* Quick deployment Steps */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-base text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-amber-500" />
                Hyonix VPS でのセットアップ手順
              </h4>

              <div className="space-y-4">
                {/* Step 1 */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <div className="flex items-start gap-4">
                    <span className="bg-slate-200 text-slate-700 w-7 h-7 flex items-center justify-center font-bold font-mono rounded-full text-sm shrink-0">1</span>
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-sm text-slate-800">Node.js のインストール</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Hyonix VPSにログインし、Node.js（推奨：v18以上、LTS）をインストールします。
                      </p>
                      <div className="bg-slate-900 text-slate-300 p-3 rounded-xl font-mono text-[11px] leading-relaxed mt-2 space-y-1">
                        <p className="text-slate-500"># Linux (Ubuntu/Debian) の場合:</p>
                        <p className="text-emerald-400">curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -</p>
                        <p className="text-emerald-400">sudo apt-get install -y nodejs</p>
                        <p className="text-slate-500 mt-2"># Windows VPS の場合:</p>
                        <p className="text-slate-300">公式サイトからNode.jsの「Windows Installer (.msi)」をダウンロードして実行します。</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <div className="flex items-start gap-4">
                    <span className="bg-slate-200 text-slate-700 w-7 h-7 flex items-center justify-center font-bold font-mono rounded-full text-sm shrink-0">2</span>
                    <div className="space-y-1.5 w-full">
                      <h5 className="font-bold text-sm text-slate-800">ファイルのアップロードと設定</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        本システムでエクスポートしたZIPファイルをVPSに転送（SFTPまたはリモートデスクトップ経由でコピペ）し、適当なフォルダに解凍します。
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        プロジェクトルートに新しいファイル <code className="bg-slate-100 text-rose-600 font-mono px-1 rounded">.env</code> を作成し、以下のようにAPIキーを記述します。
                      </p>
                      <div className="bg-slate-900 text-slate-200 px-4 py-2.5 rounded-lg font-mono text-xs inline-flex flex-col gap-1 mt-1 w-full max-w-md border border-slate-800">
                        <span className="text-slate-400"># .envファイルの内容</span>
                        <div>
                          <span className="text-rose-400">GEMINI_API_KEY</span>
                          <span className="text-slate-400">=</span>
                          <span className="text-emerald-400">"あなたのGemini APIキー"</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                  <div className="flex items-start gap-4">
                    <span className="bg-slate-200 text-slate-700 w-7 h-7 flex items-center justify-center font-bold font-mono rounded-full text-sm shrink-0">3</span>
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-sm text-slate-800">ビルドと起動の実行</h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        ターミナル（またはコマンドプロンプト）を開き、プロジェクトフォルダに移動して以下のコマンドを順に実行します。
                      </p>
                      <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs leading-relaxed space-y-1.5">
                        <p className="text-slate-500"># 1. 依存ライブラリのインストール</p>
                        <p>npm install</p>
                        <p className="text-slate-500 mt-2"># 2. フロントエンドとサーバーのプロダクション用ビルド</p>
                        <p>npm run build</p>
                        <p className="text-slate-500 mt-2"># 3. サーバーのバックグラウンド永続実行（PM2の利用を推奨）</p>
                        <p className="text-slate-400">npm install -g pm2</p>
                        <p>pm2 start dist/server.cjs --name "x-recruitment-assistant"</p>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                        ※ PM2を利用すると、サーバーの再起動時や不意のプロセスダウン時にも自動的にアプリケーションを復活させ、24時間安定して公開し続けることができます。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Network and security */}
            <div className="space-y-4">
              <h4 className="font-display font-bold text-base text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                セキュリティとアクセス方法
              </h4>
              <ul className="text-xs text-slate-600 space-y-2.5 list-disc pl-5 leading-relaxed">
                <li>
                  <strong>ポートの開放:</strong> デフォルトではポート <strong>3000</strong> でWebサーバーが起動します。Hyonixのファイアウォール（Windowsの場合はWindows Defender ファイアウォール、Linuxの場合はufw等）にて、ポート3000へのTCPインバウンドトラフィックを許可してください。
                </li>
                <li>
                  <strong>ドメイン接続（任意）:</strong> お手持ちの独自ドメインを接続したい場合は、Nginxをプロキシサーバーとして設定し、ドメイン宛てのアクセスを <code className="bg-slate-100 text-slate-700 font-mono px-1 rounded">http://localhost:3000</code> へ転送（リバースプロキシ設定）することをおすすめします。これにより、HTTPS（SSL化）対応もスムーズになります。
                </li>
              </ul>
            </div>

          </div>
        )}

      </main>

      {/* -----------------------------------------------------------------
          INLINE DIALOG MODALS (REPLACING BROWSER BLOCKED PROMPTS)
          ----------------------------------------------------------------- */}
      
      {/* 1. ADD ACCOUNT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center text-white">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-800">
                  新規アカウントプロファイルの追加
                </h3>
                <p className="text-[10px] text-slate-400">新しい運用キャラクター（プロファイル）を作成します</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  アカウント名（プロファイル名） <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden transition-all"
                  placeholder="例：新規スカウト, 飛田紹介スタッフ"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  XのユーザーID（@から始まるID） <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">@</span>
                  <input
                    type="text"
                    value={newAccXId.startsWith("@") ? newAccXId.substring(1) : newAccXId}
                    onChange={(e) => setNewAccXId(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl pl-7 pr-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden transition-all"
                    placeholder="new_scout_handle"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  AIの役割設定（役職）
                </label>
                <input
                  type="text"
                  value={newAccRole}
                  onChange={(e) => setNewAccRole(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden transition-all"
                  placeholder="例：お仕事アドバイザー, 飛田新地のオーナー"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  活動の目的（プロファイル設定）
                </label>
                <textarea
                  value={newAccPurpose}
                  onChange={(e) => setNewAccPurpose(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden transition-all resize-none"
                  placeholder="例：未経験の方の相談相手になりつつ、適正に合った高収入案件へ繋げる。"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submitAddAccount}
                disabled={!newAccName.trim() || !newAccXId.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-500 hover:bg-rose-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-rose-500/10 cursor-pointer"
              >
                追加する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. RENAME ACCOUNT MODAL */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-800">
                  アカウント情報の編集
                </h3>
                <p className="text-[10px] text-slate-400">プロファイル名とXのユーザーIDを編集します</p>
              </div>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  アカウント名（プロファイル名） <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editAccName}
                  onChange={(e) => setEditAccName(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-hidden transition-all"
                  placeholder="プロファイル名"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  XのユーザーID（@から始まるID） <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">@</span>
                  <input
                    type="text"
                    value={editAccXId.startsWith("@") ? editAccXId.substring(1) : editAccXId}
                    onChange={(e) => setEditAccXId(e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-rose-500 rounded-xl pl-7 pr-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden transition-all"
                    placeholder="user_id"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submitRenameAccount}
                disabled={!editAccName.trim() || !editAccXId.trim()}
                className="px-4 py-2 text-xs font-bold bg-blue-500 hover:bg-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. DELETE ACCOUNT MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-slate-800">
                  プロファイルの削除確認
                </h3>
                <p className="text-[10px] text-slate-400">本当に削除してもよろしいですか？</p>
              </div>
            </div>

            {accounts.length <= 1 ? (
              <p className="text-xs text-rose-600 leading-relaxed bg-rose-50 p-3 rounded-xl border border-rose-100">
                ⚠️ 最低でも1つのアカウントプロファイルが必要です。このプロファイルを削除することはできません。
              </p>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                アカウントプロファイル <strong className="text-slate-800">「{deletingAccount?.name}」</strong> を削除してもよろしいですか？<br />
                このアカウントに紐づくすべてのカスタムルールや設定情報が完全に削除されます（この操作は取り消せません）。
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setDeletingAccount(null);
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                {accounts.length <= 1 ? "閉じる" : "キャンセル"}
              </button>
              {accounts.length > 1 && (
                <button
                  type="button"
                  onClick={submitDeleteAccount}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-md shadow-rose-600/10 cursor-pointer"
                >
                  削除する
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
