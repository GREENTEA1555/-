import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Gamepad2, 
  Settings, 
  Plus, 
  Edit3, 
  Trash2, 
  X, 
  Sparkles,
  Save,
  ShoppingBag,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Package,
  Wrench,
  Upload,
  FileText,
  List,
  LayoutGrid,
  ShoppingCart,
  Minus,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Cloud,
  Loader2,
  ShieldAlert,
  Lock,
  LogOut,
  User,
  LogIn,
  UserPlus,
  History
} from 'lucide-react';
import { Part, DEFAULT_CATEGORIES, CartItem } from './types';
import { generatePartDescription } from './services/geminiService';
// 引入我們剛剛建立的連線設定
import { db, auth } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';

// --- Helpers ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0
  }).format(amount);
};

const getCategoryColor = (category: string) => {
  const upper = category.toUpperCase();
  if (upper.includes('PS')) return 'text-blue-400 border-blue-400 bg-blue-500/10';
  if (upper.includes('XBOX')) return 'text-green-400 border-green-400 bg-green-500/10';
  if (upper.includes('SWITCH') || upper.includes('NINTENDO')) return 'text-red-400 border-red-400 bg-red-500/10';
  return 'text-purple-400 border-purple-400 bg-purple-500/10';
};

// --- LocalStorage for Cart ONLY ---
// 購物車依然存在使用者自己的瀏覽器裡，不佔用雲端空間
const STORAGE_KEYS = {
  CART: 'gamepart_cart_v1'
};

const loadCartFromStorage = (): CartItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CART);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error(`Error loading cart:`, error);
    return [];
  }
};

// --- Components ---

const PermissionErrorModal = ({ isOpen }: { isOpen: boolean }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#1e293b] rounded-2xl w-full max-w-xl p-6 border-2 border-red-500/50 shadow-2xl flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">資料庫權限不足</h2>
        <h3 className="text-lg text-red-400 mb-6 font-mono">FirebaseError: permission-denied</h3>
        
        <div className="text-slate-300 text-left w-full space-y-4 mb-6 text-sm">
          <p>
            您的網站目前無法讀取 Firebase 資料庫。這是因為新建立的 Firebase 專案預設規則是鎖定的。
          </p>
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <p className="font-bold text-white mb-2">請依照以下步驟修復：</p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-400">
              <li>前往 <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Firebase Console</a></li>
              <li>進入專案 <strong>Firestore Database</strong> 分頁</li>
              <li>點選上方的 <strong>Rules (規則)</strong> 標籤</li>
              <li>將規則修改為允許讀寫 (測試用)：</li>
            </ol>
          </div>
          
          <div className="relative group">
            <pre className="bg-black/50 p-4 rounded-lg border border-slate-700 font-mono text-xs text-emerald-400 overflow-x-auto">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
            </pre>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            注意：這會將資料庫設為公開。正式營運時建議設定更嚴格的權限。
          </p>
        </div>

        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 w-full sm:w-auto"
        >
          我已經修改規則了，重新整理
        </button>
      </div>
    </div>
  );
};

// --- User Auth Modal (For Customers) ---
const UserAuthModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('此 Email 已經註冊過了');
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('帳號或密碼錯誤');
      } else if (err.code === 'auth/weak-password') {
        setError('密碼長度不足 (至少6位)');
      } else {
        setError('發生錯誤，請稍後再試');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm p-8 border border-slate-700 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mb-4 border border-purple-500/30">
            {isRegister ? <UserPlus className="w-8 h-8 text-purple-400" /> : <LogIn className="w-8 h-8 text-purple-400" />}
          </div>
          <h2 className="text-2xl font-bold text-white">{isRegister ? '註冊會員' : '會員登入'}</h2>
          <p className="text-slate-400 text-sm mt-1">{isRegister ? '建立您的帳戶以追蹤訂單' : '歡迎回來 GamePart Hub'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Email</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">密碼</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] mt-2 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegister ? '立即註冊' : '登入')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-slate-400 hover:text-white text-sm hover:underline transition-colors"
          >
            {isRegister ? '已經有帳號？點此登入' : '還沒有帳號？點此註冊'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Admin Login Modal ---
const LoginModal = ({ 
  isOpen, 
  onClose, 
  onLogin 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onLogin: () => void; 
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // 重置狀態
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 硬編碼的帳號密碼
    if (username === 'admin' && password === '8888') {
      onLogin();
      onClose();
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm p-8 border border-slate-700 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mb-4 border border-blue-500/30">
            <Lock className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">後台登入</h2>
          <p className="text-slate-400 text-sm mt-1">請輸入管理員憑證</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">帳號</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="輸入帳號"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">密碼</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="password"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-2 rounded-lg border border-red-500/20">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] mt-2"
          >
            登入系統
          </button>
        </form>
      </div>
    </div>
  );
};

const SimpleRenameModal = ({
    isOpen,
    onClose,
    initialValue,
    onConfirm,
    title
}: {
    isOpen: boolean;
    onClose: () => void;
    initialValue: string;
    onConfirm: (val: string) => void;
    title: string;
}) => {
    const [value, setValue] = useState(initialValue);
    
    React.useEffect(() => {
        setValue(initialValue);
    }, [initialValue, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm p-6 border border-slate-700 shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
                <input 
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white mb-6 focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') onConfirm(value);
                    }}
                />
                <div className="flex gap-3 justify-end">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">取消</button>
                    <button onClick={() => onConfirm(value)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">確認</button>
                </div>
            </div>
        </div>
    );
};

const SubcategoryManager = ({
    isOpen,
    onClose,
    mainCategory,
    subcategories,
    onRename,
    onDelete,
    getPartCount
  }: {
    isOpen: boolean;
    onClose: () => void;
    mainCategory: string;
    subcategories: string[];
    onRename: (oldName: string, newName: string) => void;
    onDelete: (name: string) => void;
    getPartCount: (sub: string) => number;
  }) => {
    const [editingName, setEditingName] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
  
    if (!isOpen) return null;
  
    const startEdit = (name: string) => {
      setEditingName(name);
      setEditValue(name);
    };
  
    const saveEdit = () => {
      if (editingName && editValue.trim() && editValue.trim() !== editingName) {
        onRename(editingName, editValue.trim());
      }
      setEditingName(null);
    };
  
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm p-6 border border-slate-700 shadow-2xl flex flex-col max-h-[70vh]">
              <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-400" />
                        子分類管理
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                        管理 {mainCategory} 下的零件分類
                    </p>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white">
                      <X className="w-5 h-5" />
                  </button>
              </div>
  
              <div className="overflow-y-auto custom-scrollbar space-y-2 pr-2 flex-1">
                  {subcategories.length === 0 ? (
                      <div className="text-center text-slate-500 py-8 text-sm">
                          此分類下尚無子分類
                      </div>
                  ) : subcategories.map(sub => (
                      <div key={sub} className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700 group hover:border-slate-600 transition-colors">
                          {editingName === sub ? (
                              <>
                                  <input 
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="flex-1 bg-slate-900 border border-purple-500 rounded px-2 py-1 text-sm outline-none text-white"
                                      autoFocus
                                      onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                  />
                                  <button onClick={saveEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
                                      <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => setEditingName(null)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors">
                                      <X className="w-4 h-4" />
                                  </button>
                              </>
                          ) : (
                              <>
                                  <div className="flex-1 flex items-center justify-between">
                                      <span className="font-medium text-slate-200 text-sm">{sub}</span>
                                      <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
                                          {getPartCount(sub)}
                                      </span>
                                  </div>
                                  <button 
                                      onClick={() => startEdit(sub)} 
                                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                      title="更名"
                                  >
                                      <Edit3 className="w-4 h-4" />
                                  </button>
                                  <button 
                                      onClick={() => onDelete(sub)} 
                                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                      title="刪除"
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      </div>
    );
  };

const CategoryManager = ({
  isOpen,
  onClose,
  categories,
  onRename,
  onDelete,
  onAdd,
  getCategoryCount
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  onRename: (oldName: string, newName: string) => void;
  onDelete: (name: string) => void;
  onAdd: (name: string) => void;
  getCategoryCount: (name: string) => number;
}) => {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newCategoryValue, setNewCategoryValue] = useState('');

  if (!isOpen) return null;

  const startEdit = (name: string) => {
    setEditingName(name);
    setEditValue(name);
  };

  const saveEdit = () => {
    if (editingName && editValue.trim() && editValue.trim() !== editingName) {
      onRename(editingName, editValue.trim());
    }
    setEditingName(null);
  };

  const handleAdd = () => {
    if (newCategoryValue.trim()) {
      onAdd(newCategoryValue.trim());
      setNewCategoryValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div className="bg-[#1e293b] rounded-2xl w-full max-w-md p-6 border border-slate-700 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-blue-400" />
                    分類管理
                </h2>
                <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex gap-2 mb-4">
                <input 
                    value={newCategoryValue}
                    onChange={(e) => setNewCategoryValue(e.target.value)}
                    placeholder="新增主分類..."
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-slate-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
                <button 
                    onClick={handleAdd}
                    disabled={!newCategoryValue.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors"
                >
                    新增
                </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar space-y-2 pr-2">
                {categories.map(cat => (
                    <div key={cat} className="flex items-center gap-2 bg-slate-800/50 p-3 rounded-lg border border-slate-700 group hover:border-slate-600 transition-colors">
                        {editingName === cat ? (
                            <>
                                <input 
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="flex-1 bg-slate-900 border border-blue-500 rounded px-2 py-1 text-sm outline-none text-white"
                                    autoFocus
                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                />
                                <button onClick={saveEdit} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors">
                                    <CheckCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingName(null)} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="flex-1 flex items-center justify-between">
                                    <span className="font-medium text-slate-200">{cat}</span>
                                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full">
                                        {getCategoryCount(cat)} 商品
                                    </span>
                                </div>
                                <button 
                                    onClick={() => startEdit(cat)} 
                                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="編輯名稱"
                                >
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onDelete(cat)} 
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="刪除分類"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-700 text-xs text-slate-500 text-center">
                提示：刪除分類將會一併刪除該分類下的所有商品
            </div>
        </div>
    </div>
  );
};

const PriceListView = ({ 
  parts, 
  categories, 
  activeCategory, 
  onCategoryChange,
  onAddToCart,
  isAdmin,
  onEdit,
  onAdd
}: { 
  parts: Part[], 
  categories: string[],
  activeCategory: string | 'ALL',
  onCategoryChange: (cat: string | 'ALL') => void,
  onAddToCart: (part: Part) => void,
  isAdmin: boolean,
  onEdit: (part: Part) => void,
  onAdd: () => void
}) => {
  const filteredParts = activeCategory === 'ALL' 
    ? parts 
    : parts.filter(p => p.category === activeCategory);

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden shadow-xl animate-fadeIn flex flex-col h-full">
      <div className="p-6 bg-slate-800 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-emerald-400" />
              {activeCategory === 'ALL' ? '綜合報價單 (總覽)' : `${activeCategory} 報價單`}
            </h2>
            <span className="text-sm text-slate-400 mt-1 block">
              共 {filteredParts.length} 項商品
            </span>
          </div>
          
          {isAdmin && (
            <button
                onClick={onAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
            >
                <Plus className="w-4 h-4" />
                新增零件
            </button>
          )}
        </div>
        
        <div className="flex gap-1 bg-slate-900/50 p-1 rounded-lg overflow-x-auto max-w-full">
             <button
                onClick={() => onCategoryChange('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                   activeCategory === 'ALL' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
             >
                全部
             </button>
             {categories.map(cat => (
                <button
                    key={cat}
                    onClick={() => onCategoryChange(cat)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                        activeCategory === cat ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                >
                    {cat}
                </button>
             ))}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium">
            <tr>
              <th className="px-6 py-4">圖片</th>
              <th className="px-6 py-4">商品名稱</th>
              <th className="px-6 py-4">分類</th>
              <th className="px-6 py-4">子分類</th>
              <th className="px-6 py-4 text-right">價格</th>
              <th className="px-6 py-4 text-center">狀態</th>
              <th className="px-6 py-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredParts.length > 0 ? filteredParts.map((part) => (
              <tr key={part.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-900 border border-slate-700">
                    <img src={part.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                </td>
                <td className="px-6 py-3 font-medium text-slate-200">{part.name}</td>
                <td className="px-6 py-3 text-slate-400">
                  <span className={`px-2 py-1 rounded text-xs border ${getCategoryColor(part.category).replace('text-', 'text-').replace('bg-', 'bg-')}`}>
                    {part.category}
                  </span>
                </td>
                <td className="px-6 py-3 text-blue-400">{part.subcategory}</td>
                <td className="px-6 py-3 text-right font-bold text-emerald-400">{formatCurrency(part.price)}</td>
                <td className="px-6 py-3 text-center">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${part.inStock ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {part.inStock ? '有現貨' : '缺貨'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {isAdmin && (
                        <button 
                            onClick={() => onEdit(part)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="快速編輯"
                        >
                            <Edit3 className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => onAddToCart(part)}
                        disabled={!part.inStock}
                        className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                            part.inStock 
                            ? 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300' 
                            : 'text-slate-600 cursor-not-allowed'
                        }`}
                        title="加入購物車"
                    >
                        <ShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                   此分類下尚無商品
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- Cart Drawer Component ---
const CartDrawer = ({ 
  isOpen, 
  onClose, 
  cartItems, 
  onUpdateQuantity, 
  onRemove,
  onCheckout 
}: { 
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
}) => {
  const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-[70] w-full max-w-md bg-[#1e293b] shadow-2xl border-l border-slate-700 flex flex-col animate-slideInRight">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-700 flex items-center justify-between bg-slate-900/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-400" />
            購物車 ({cartItems.length})
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <ShoppingBag className="w-16 h-16 opacity-20" />
              <p>購物車是空的</p>
              <button onClick={onClose} className="text-blue-400 hover:underline text-sm">
                繼續瀏覽商品
              </button>
            </div>
          ) : (
            cartItems.map(item => (
              <div key={item.id} className="flex gap-4 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 shrink-0">
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-200 line-clamp-1">{item.name}</h3>
                    <p className="text-xs text-blue-400 mt-0.5">{item.category} - {item.subcategory}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="font-bold text-emerald-400">{formatCurrency(item.price)}</div>
                    <div className="flex items-center gap-3 bg-slate-900 rounded-lg p-1 border border-slate-700">
                      <button 
                        onClick={() => onUpdateQuantity(item.id, -1)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button 
                         onClick={() => onUpdateQuantity(item.id, 1)}
                         className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <button 
                    onClick={() => onRemove(item.id)}
                    className="self-start p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="p-6 border-t border-slate-700 bg-slate-900/50">
            <div className="flex justify-between items-center mb-4 text-lg font-bold">
              <span className="text-slate-400">總金額</span>
              <span className="text-emerald-400 text-2xl">{formatCurrency(total)}</span>
            </div>
            <button 
                onClick={onCheckout}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
                <CreditCard className="w-5 h-5" />
                前往結帳
            </button>
          </div>
        )}
      </div>
    </>
  );
};

const CheckoutModal = ({
    isOpen,
    onClose,
    onConfirm,
    totalAmount,
    isProcessing
}: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    totalAmount: number;
    isProcessing: boolean;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#1e293b] rounded-2xl w-full max-w-md p-6 border border-slate-700 shadow-2xl">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-blue-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">確認結帳</h2>
                    <p className="text-slate-400 mt-2">將會建立訂單並通知管理員。</p>
                </div>
                
                <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-slate-400">訂單小計</span>
                        <span className="text-white font-medium">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-slate-400">運費</span>
                        <span className="text-emerald-400 font-medium">免運費</span>
                    </div>
                    <div className="border-t border-slate-700 my-2 pt-2 flex justify-between items-center text-lg font-bold">
                        <span className="text-white">總計</span>
                        <span className="text-emerald-400">{formatCurrency(totalAmount)}</span>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button 
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button 
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-500/25 transition-all flex justify-center items-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                處理中...
                            </>
                        ) : '確認付款'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Main App ---

export default function App() {
  const [inventory, setInventory] = useState<Part[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);

  // Cart remains local
  const [cart, setCart] = useState<CartItem[]>(() => loadCartFromStorage());

  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeCategory, setActiveCategory] = useState<string | 'ALL'>('ALL');
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isSubcategoryManagerOpen, setIsSubcategoryManagerOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  
  // Login Modal States
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); // Admin
  const [isUserAuthOpen, setIsUserAuthOpen] = useState(false); // Customer
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPart, setCurrentPart] = useState<Partial<Part> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Error State for Firebase Permissions
  const [permissionError, setPermissionError] = useState(false);
  
  // Checkout Processing
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);

  // --- Firestore Real-time Listeners ---

  // 0. Listen for Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 1. Listen for Inventory Changes
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'parts'), (snapshot) => {
      const partsData: Part[] = [];
      snapshot.forEach((doc) => {
        partsData.push({ id: doc.id, ...doc.data() } as Part);
      });
      setInventory(partsData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching parts:", error);
      setIsLoading(false);
      // @ts-ignore
      if (error.code === 'permission-denied') {
        setPermissionError(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen for Categories Changes
  useEffect(() => {
    // We store categories in a dedicated 'settings' collection, document 'general'
    const unsubscribe = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.categories) {
          setCategories(data.categories);
        }
      } else {
        // Initialize default categories if not exists
        setDoc(doc(db, 'settings', 'general'), { categories: DEFAULT_CATEGORIES });
      }
    }, (error) => {
      console.error("Error fetching categories:", error);
      // @ts-ignore
      if (error.code === 'permission-denied') {
        setPermissionError(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Save Cart to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  }, [cart]);


  // --- Derived Data ---
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);

  const availableSubcategories = useMemo(() => {
    if (activeCategory === 'ALL') return [];
    const subcats = new Set(
      inventory
        .filter(p => p.category === activeCategory)
        .map(p => p.subcategory)
    );
    return Array.from(subcats);
  }, [inventory, activeCategory]);

  const displayedParts = useMemo(() => {
    return inventory.filter(part => {
      const matchesSearch = part.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          part.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          part.subcategory.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategory === 'ALL' || part.category === activeCategory;
      const matchesSubcategory = activeSubcategory === null || part.subcategory === activeSubcategory;

      return matchesSearch && matchesCategory && matchesSubcategory;
    });
  }, [inventory, searchQuery, activeCategory, activeSubcategory]);

  const modalSubcategories = useMemo(() => {
    if (!currentPart?.category) return [];
    const subcats = new Set(
      inventory
        .filter(p => p.category === currentPart.category)
        .map(p => p.subcategory)
    );
    return Array.from(subcats);
  }, [inventory, currentPart?.category]);

  const getCategoryCount = (name: string) => inventory.filter(p => p.category === name).length;
  const getSubcategoryCount = (sub: string) => {
      const cat = currentPart?.category || (activeCategory !== 'ALL' ? activeCategory : null);
      if(!cat) return 0;
      return inventory.filter(p => p.subcategory === sub && p.category === cat).length;
  };

  // --- Handlers ---

  const handleAdminToggle = () => {
    if (isAdmin) {
      // Logout
      setIsAdmin(false);
    } else {
      // Open Login Modal
      setIsLoginModalOpen(true);
    }
  };
  
  const handleUserAuthToggle = () => {
    if (currentUser) {
        if(window.confirm('確定要登出會員嗎？')) {
            signOut(auth);
        }
    } else {
        setIsUserAuthOpen(true);
    }
  };

  const handleLoginSuccess = () => {
    setIsAdmin(true);
    setIsLoginModalOpen(false);
  };

  const handleCategoryChange = (cat: string | 'ALL') => {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  };

  const handlePriceListClick = () => {
    setActiveCategory('ALL');
    setViewMode('LIST');
  };

  // Update Category in Firestore
  const updateCategoriesInDb = async (newCategories: string[]) => {
    try {
      await setDoc(doc(db, 'settings', 'general'), { categories: newCategories }, { merge: true });
    } catch (e) {
      console.error("Error updating categories:", e);
      alert("更新分類失敗");
    }
  };

  const handleAddCategory = (newCat: string) => {
    if (newCat && !categories.includes(newCat)) {
      updateCategoriesInDb([...categories, newCat]);
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || categories.includes(newName)) return;
    
    // 1. Update Categories List
    const newCategories = categories.map(c => c === oldName ? newName : c);
    await updateCategoriesInDb(newCategories);
    
    // 2. Update ALL items in that category (Batch update is better but loop is fine for small scale)
    const itemsToUpdate = inventory.filter(p => p.category === oldName);
    itemsToUpdate.forEach(item => {
        updateDoc(doc(db, 'parts', item.id), { category: newName });
    });

    if (activeCategory === oldName) setActiveCategory(newName);
  };

  const handleDeleteCategory = async (catName: string) => {
    const partsCount = getCategoryCount(catName);
    if (window.confirm(`確定要刪除「${catName}」分類嗎？\n將會一併刪除該分類下的 ${partsCount} 個商品。`)) {
      // 1. Update Categories List
      const newCategories = categories.filter(c => c !== catName);
      await updateCategoriesInDb(newCategories);

      // 2. Delete ALL items in that category
      const itemsToDelete = inventory.filter(p => p.category === catName);
      itemsToDelete.forEach(item => {
        deleteDoc(doc(db, 'parts', item.id));
      });

      if (activeCategory === catName) setActiveCategory('ALL');
    }
  };

  const handleRenameSubcategory = (oldName: string, newName: string) => {
    const targetCategory = currentPart?.category || (activeCategory !== 'ALL' ? activeCategory : null);
    if (!targetCategory) return;

    // Update all parts with this subcategory
    const itemsToUpdate = inventory.filter(p => p.category === targetCategory && p.subcategory === oldName);
    itemsToUpdate.forEach(item => {
        updateDoc(doc(db, 'parts', item.id), { subcategory: newName });
    });

    if (currentPart && currentPart.subcategory === oldName) {
        setCurrentPart(prev => prev ? ({ ...prev, subcategory: newName }) : null);
    }
    
    if (activeSubcategory === oldName && activeCategory === targetCategory) {
        setActiveSubcategory(newName);
    }
  };

  const handleDeleteSubcategory = (subName: string) => {
    const targetCategory = currentPart?.category || (activeCategory !== 'ALL' ? activeCategory : null);
    if (!targetCategory) return;
    
    const count = getSubcategoryCount(subName);

    if (window.confirm(`確定要刪除「${targetCategory} > ${subName}」分類嗎？\n將會刪除此分類下的 ${count} 個商品。`)) {
        const itemsToDelete = inventory.filter(p => p.category === targetCategory && p.subcategory === subName);
        itemsToDelete.forEach(item => {
            deleteDoc(doc(db, 'parts', item.id));
        });
        
        if (currentPart && currentPart.subcategory === subName) {
            setCurrentPart(prev => prev ? ({ ...prev, subcategory: '' }) : null);
        }
        
        if (activeSubcategory === subName && activeCategory === targetCategory) {
            setActiveSubcategory(null);
        }
    }
  };

  const handleEdit = (part: Part) => {
    setCurrentPart(part);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setCurrentPart({
      category: activeCategory === 'ALL' ? categories[0] : activeCategory,
      subcategory: activeSubcategory || '', 
      inStock: true,
      imageUrl: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?auto=format&fit=crop&q=80&w=600'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('確定要刪除這個項目嗎?')) {
      await deleteDoc(doc(db, 'parts', id));
      // Remove from cart locally
      setCart(prev => prev.filter(item => item.id !== id));
    }
  };

  const addToCart = (part: Part) => {
    if (!part.inStock) return;
    setCart(prev => {
        const existing = prev.find(item => item.id === part.id);
        if (existing) {
            return prev.map(item => item.id === part.id ? { ...item, quantity: item.quantity + 1 } : item);
        }
        return [...prev, { ...part, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
        if (item.id === id) {
            return { ...item, quantity: Math.max(1, item.quantity + delta) };
        }
        return item;
    }));
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const confirmCheckout = async () => {
    setIsProcessingCheckout(true);
    try {
        const orderData = {
            userId: currentUser ? currentUser.uid : 'guest',
            userEmail: currentUser ? currentUser.email : 'guest',
            items: cart,
            totalAmount: cartTotal,
            status: 'pending',
            createdAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'orders'), orderData);
        
        alert("訂單已送出！管理員將會盡快處理。");
        setCart([]);
        setIsCheckoutOpen(false);
    } catch (error) {
        console.error("Checkout failed:", error);
        alert("訂單建立失敗，請檢查網路連線。");
    } finally {
        setIsProcessingCheckout(false);
    }
  };


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentPart) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentPart({ ...currentPart, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Firestore Save Logic ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPart) return;

    if (!currentPart.subcategory) {
        alert("請輸入或選擇一個子分類");
        return;
    }

    try {
      const partData = {
          name: currentPart.name,
          category: currentPart.category,
          subcategory: currentPart.subcategory,
          price: currentPart.price,
          description: currentPart.description || '',
          imageUrl: currentPart.imageUrl || '',
          inStock: currentPart.inStock || false
      };

      if (currentPart.id) {
        // Update existing doc
        await updateDoc(doc(db, 'parts', currentPart.id), partData);
      } else {
        // Create new doc
        await addDoc(collection(db, 'parts'), partData);
      }
      
      setIsModalOpen(false);
      setCurrentPart(null);
    } catch (error) {
      console.error("Error saving part:", error);
      alert("儲存失敗，請檢查網路連線");
    }
  };

  const generateDescription = async () => {
    if (!currentPart?.name || !currentPart?.category) {
      alert("請先填寫名稱與類別");
      return;
    }
    setIsGenerating(true);
    const desc = await generatePartDescription(
        currentPart.name, 
        currentPart.category,
        currentPart.subcategory
    );
    setCurrentPart(prev => prev ? ({ ...prev, description: desc }) : null);
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans pb-20">
      
      <PermissionErrorModal isOpen={permissionError} />

      <LoginModal 
        isOpen={isLoginModalOpen} 
        onClose={() => setIsLoginModalOpen(false)} 
        onLogin={handleLoginSuccess}
      />
      
      <UserAuthModal
        isOpen={isUserAuthOpen}
        onClose={() => setIsUserAuthOpen(false)}
      />

      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
      />

      <CheckoutModal 
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onConfirm={confirmCheckout}
        totalAmount={cartTotal}
        isProcessing={isProcessingCheckout}
      />

      <CategoryManager 
        isOpen={isCategoryManagerOpen}
        onClose={() => setIsCategoryManagerOpen(false)}
        categories={categories}
        onAdd={handleAddCategory}
        onRename={handleRenameCategory}
        onDelete={handleDeleteCategory}
        getCategoryCount={getCategoryCount}
      />

      <SubcategoryManager 
        isOpen={isSubcategoryManagerOpen}
        onClose={() => setIsSubcategoryManagerOpen(false)}
        mainCategory={currentPart?.category || ''}
        subcategories={modalSubcategories}
        onRename={handleRenameSubcategory}
        onDelete={handleDeleteSubcategory}
        getPartCount={getSubcategoryCount}
      />

      <SimpleRenameModal
        isOpen={!!renameTarget}
        title="重新命名分類"
        initialValue={renameTarget || ''}
        onClose={() => setRenameTarget(null)}
        onConfirm={(newName) => {
            if(renameTarget) {
                handleRenameSubcategory(renameTarget, newName);
                setRenameTarget(null);
            }
        }}
      />

      {/* --- Top Navigation --- */}
      <nav className="sticky top-0 z-40 bg-[#0f172a]/95 backdrop-blur-sm border-b border-slate-700 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div 
              className="flex items-center gap-3 cursor-pointer shrink-0" 
              onClick={() => { handleCategoryChange('ALL'); setViewMode('GRID'); }}
            >
              <div className="bg-gradient-to-tr from-blue-500 to-purple-600 p-2 rounded-lg">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                  GamePart Hub
                </h1>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                    專業主機維修料件商 
                    <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-500/10 px-1.5 rounded-full text-[10px] border border-emerald-500/20">
                        <Cloud className="w-3 h-3" /> 雲端連線中
                    </span>
                </p>
              </div>
            </div>

            {/* Main Category Tabs */}
            <div className="hidden lg:flex gap-1 overflow-x-auto max-w-3xl custom-scrollbar pb-1">
              <button
                 onClick={handlePriceListClick}
                 className={`px-3 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1 shrink-0 ${
                    viewMode === 'LIST' && activeCategory === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'text-emerald-400 hover:bg-slate-800'
                 }`}
              >
                <List className="w-4 h-4" /> 綜合報價單
              </button>
              
              <div className="w-px h-6 bg-slate-700 mx-2 self-center"></div>

              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryChange(cat)}
                  className={`px-3 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
                    activeCategory === cat && viewMode === 'GRID'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : activeCategory === cat && viewMode === 'LIST'
                      ? 'bg-blue-600/50 text-white border border-blue-500' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
              
              {isAdmin && (
                <button 
                  onClick={() => setIsCategoryManagerOpen(true)}
                  className="px-3 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 border border-dashed border-slate-700 hover:border-slate-500 shrink-0"
                  title="管理分類"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3 shrink-0">
               <button 
                  onClick={() => setIsCartOpen(true)}
                  className="relative p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700 mr-1"
               >
                  <ShoppingCart className="w-5 h-5" />
                  {cart.length > 0 && (
                     <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg border-2 border-[#0f172a]">
                        {cart.length}
                     </span>
                  )}
               </button>
               
              {/* Member Auth Button */}
              <button
                onClick={handleUserAuthToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all mr-1 ${
                  currentUser
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                }`}
                title={currentUser ? `已登入: ${currentUser.email}` : "會員登入/註冊"}
              >
                {currentUser ? <User className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span className="hidden sm:inline">
                    {currentUser ? '會員專區' : '會員登入'}
                </span>
              </button>

              <button
                onClick={handleAdminToggle}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                  isAdmin 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                }`}
                title="網站管理員後台"
              >
                {isAdmin ? <LogOut className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Sub-Header / Toolbar --- */}
      <div className="bg-slate-900 border-b border-slate-800">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 shrink-0">
                        <button
                            onClick={() => setViewMode('GRID')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            title="網格模式"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('LIST')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                            title="列表/報價單模式"
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="h-4 w-px bg-slate-700"></div>

                    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                        <button 
                            onClick={() => { handleCategoryChange('ALL'); }}
                            className="text-slate-500 hover:text-white flex items-center text-sm"
                        >
                            首頁 <ChevronRight className="w-3 h-3 mx-1" />
                        </button>
                        
                        {viewMode === 'LIST' && (
                             <span className="font-bold text-emerald-400 text-sm">報價單模式</span>
                        )}

                        {activeCategory !== 'ALL' && (
                            <>
                                {viewMode === 'LIST' && <ChevronRight className="w-3 h-3 text-slate-600 mx-1" />}
                                <span className={`font-bold text-sm ${!activeSubcategory ? 'text-blue-400' : 'text-slate-500 hover:text-white cursor-pointer'}`}
                                        onClick={() => setActiveSubcategory(null)}
                                >
                                    {activeCategory}
                                </span>
                            </>
                        )}

                        {activeSubcategory && viewMode === 'GRID' && (
                            <>
                                <ChevronRight className="w-3 h-3 text-slate-600 mx-1" />
                                <span className="font-bold text-blue-400 text-sm">{activeSubcategory}</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="relative w-full md:w-80 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg leading-5 placeholder-slate-500 focus:outline-none focus:bg-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
                        placeholder="搜尋全站零件..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="lg:hidden flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                 <button
                    onClick={handlePriceListClick}
                    className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap flex items-center gap-1 ${
                        viewMode === 'LIST' && activeCategory === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400'
                    }`}
                 >
                    <List className="w-3 h-3" /> 報價單
                 </button>
                 {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => handleCategoryChange(cat)}
                        className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                            activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                    >
                        {cat}
                    </button>
                 ))}
            </div>
         </div>
      </div>

      {/* --- Main Content Area --- */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                <p>正在從雲端載入庫存資料...</p>
            </div>
        ) : (
        <>
            {/* Admin Actions */}
            {isAdmin && (
                <div className="mb-6 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                        <Wrench className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-amber-100">管理員控制台 (已連線雲端)</h3>
                        <p className="text-xs text-amber-400/70">您現在的所有修改都會即時同步到 Google Firebase</p>
                    </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setIsCategoryManagerOpen(true)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-lg transition-all font-medium text-sm"
                        >
                            <Settings className="w-4 h-4" />
                            管理分類
                        </button>
                        <button
                            onClick={handleCreate}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-lg shadow-amber-500/20 transition-all font-medium text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            新增零件
                        </button>
                    </div>
                </div>
            )}
            
            {/* User Logged In Info */}
            {currentUser && !isAdmin && (
                <div className="mb-6 bg-purple-500/10 border border-purple-500/20 p-4 rounded-xl flex items-center gap-3 animate-fadeIn">
                    <div className="p-2 bg-purple-500/20 rounded-full">
                        <User className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-purple-100">歡迎回來, {currentUser.email}</h3>
                        <p className="text-xs text-purple-400/70">您提交的訂單將會自動記錄到您的帳戶中。</p>
                    </div>
                </div>
            )}

            {/* --- VIEW MODE: LIST (Price List) --- */}
            {viewMode === 'LIST' ? (
                <PriceListView 
                    parts={inventory} 
                    categories={categories}
                    activeCategory={activeCategory}
                    onCategoryChange={handleCategoryChange}
                    onAddToCart={addToCart}
                    isAdmin={isAdmin}
                    onEdit={handleEdit}
                    onAdd={handleCreate}
                />
            ) : (
                // --- VIEW MODE: GRID ---
                <>
                    {activeCategory === 'ALL' && !searchQuery && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {categories.map(cat => (
                                <div 
                                    key={cat}
                                    onClick={() => handleCategoryChange(cat)}
                                    className="group cursor-pointer bg-slate-800 hover:bg-slate-700 rounded-2xl p-6 border border-slate-700 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-500/10"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`p-3 rounded-xl ${getCategoryColor(cat)}`}>
                                            <Gamepad2 className="w-8 h-8" />
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-100 group-hover:text-blue-400 transition-colors">{cat}</h3>
                                    <p className="text-slate-400 text-sm mt-2">
                                        {inventory.filter(i => i.category === cat).length} 個零件在庫
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeCategory !== 'ALL' && !activeSubcategory && !searchQuery && (
                        <div>
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <FolderOpen className="w-6 h-6 text-blue-400" />
                                選擇 {activeCategory} 零件分類
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {availableSubcategories.length > 0 ? availableSubcategories.map(subcat => (
                                    <div 
                                        key={subcat}
                                        onClick={() => setActiveSubcategory(subcat)}
                                        className="relative bg-slate-800/50 hover:bg-slate-700 cursor-pointer p-4 rounded-xl border border-slate-700 hover:border-blue-400 transition-all flex flex-col items-center text-center gap-3 group"
                                    >
                                        {isAdmin && (
                                            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRenameTarget(subcat);
                                                    }}
                                                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg transition-colors"
                                                    title="更名"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSubcategory(subcat);
                                                    }}
                                                    className="p-1.5 bg-red-600 hover:bg-red-500 text-white rounded shadow-lg transition-colors"
                                                    title="刪除"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Package className="w-6 h-6 text-slate-400 group-hover:text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-200 group-hover:text-white">{subcat}</h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {inventory.filter(i => i.category === activeCategory && i.subcategory === subcat).length} 個項目
                                            </p>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="col-span-full py-10 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-slate-800 border-dashed">
                                        此主機分類下目前沒有零件。
                                        {isAdmin && <p className="mt-2 text-amber-400 cursor-pointer hover:underline" onClick={handleCreate}>點擊新增第一個零件</p>}
                                    </div>
                                )}
                                
                                {isAdmin && (
                                    <div 
                                        onClick={handleCreate}
                                        className="bg-slate-800/30 hover:bg-slate-800 cursor-pointer p-4 rounded-xl border border-dashed border-slate-600 hover:border-emerald-500 transition-all flex flex-col items-center justify-center text-center gap-2 group h-full min-h-[140px]"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                            <Plus className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <span className="text-sm font-medium text-emerald-500">新增零件</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {(activeSubcategory || searchQuery) && (
                        <div className="animate-fadeIn">
                            {!searchQuery && (
                                <div className="flex items-center gap-4 mb-6">
                                    <button 
                                        onClick={() => setActiveSubcategory(null)}
                                        className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                                        title="返回分類"
                                    >
                                        <ArrowLeft className="w-5 h-5 text-slate-400" />
                                    </button>
                                    <h2 className="text-2xl font-bold text-white">
                                        {activeSubcategory}
                                        <span className="ml-3 text-sm font-normal text-slate-500 bg-slate-800 px-3 py-1 rounded-full">
                                            {displayedParts.length} 個商品
                                        </span>
                                    </h2>
                                </div>
                            )}

                            {displayedParts.length === 0 ? (
                                <div className="text-center py-20 bg-slate-800/30 rounded-3xl border border-slate-800 border-dashed">
                                    <Gamepad2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                    <h3 className="text-xl font-medium text-slate-300">沒有找到零件</h3>
                                    <p className="text-slate-500 mt-2">嘗試搜尋其他關鍵字或返回上頁</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {displayedParts.map((part) => (
                                    <div 
                                        key={part.id} 
                                        className="group relative bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50 hover:border-slate-600 hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-300 flex flex-col h-full"
                                    >
                                        <div className="relative aspect-square overflow-hidden bg-slate-900">
                                            <img
                                                src={part.imageUrl}
                                                alt={part.name}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                            />
                                            <div className="absolute top-2 left-2 flex gap-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border backdrop-blur-md ${getCategoryColor(part.category)}`}>
                                                {part.category}
                                                </span>
                                            </div>

                                            {isAdmin && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(part); }}
                                                    className="absolute top-2 right-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded shadow-lg z-10 transition-colors"
                                                    title="快速編輯"
                                                >
                                                    <Edit3 className="w-3 h-3" />
                                                </button>
                                            )}

                                            {!part.inStock && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[2px]">
                                                <span className="px-3 py-1 bg-red-500/90 text-white text-xs font-bold rounded shadow-xl">
                                                    缺貨中
                                                </span>
                                                </div>
                                            )}
                                            
                                            {isAdmin && (
                                                <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(part.id); }}
                                                        className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg shadow-lg"
                                                        title="刪除商品"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-3 flex flex-col flex-grow">
                                            <div className="flex-grow">
                                                <div className="text-[10px] text-blue-400 mb-1 font-medium truncate">
                                                    {part.subcategory}
                                                </div>
                                                <h3 className="text-sm font-bold text-slate-100 mb-1 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                                                {part.name}
                                                </h3>
                                            </div>
                                        
                                            <div className="mt-2 pt-2 border-t border-slate-700/50 flex items-center justify-between">
                                                <span className="text-lg font-bold text-emerald-400 tracking-tight">
                                                    {formatCurrency(part.price)}
                                                </span>
                                                
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); addToCart(part); }}
                                                    disabled={!part.inStock}
                                                    className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                                                        part.inStock 
                                                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/20' 
                                                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                    }`}
                                                    title={part.inStock ? "加入購物車" : "缺貨中"}
                                                >
                                                    {part.inStock ? <ShoppingCart className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </>
        )}
      </main>

      {/* --- Edit/Create Modal --- */}
      {isModalOpen && currentPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e293b] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-700 animate-fadeIn flex flex-col">
            <form onSubmit={handleSave} className="flex flex-col h-full">
              <div className="sticky top-0 bg-[#1e293b] p-6 border-b border-slate-700 flex justify-between items-center z-10 shrink-0">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                    {currentPart.id ? <Edit3 className="w-5 h-5 text-blue-400" /> : <Plus className="w-5 h-5 text-emerald-400" />}
                    {currentPart.id ? '編輯零件資料' : '新增零件'}
                    </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">商品名稱 (Name)</label>
                    <input
                      required
                      type="text"
                      className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      value={currentPart.name || ''}
                      onChange={e => setCurrentPart({ ...currentPart, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">價格 (Price)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500">$</span>
                      <input
                        required
                        type="number"
                        min="0"
                        className="w-full bg-slate-800/50 border border-slate-600 rounded-lg pl-8 pr-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        value={currentPart.price || ''}
                        onChange={e => setCurrentPart({ ...currentPart, price: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50 space-y-4">
                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <FolderOpen className="w-4 h-4" /> 分類設定
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500">主機平台</label>
                            <select
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={currentPart.category}
                                onChange={e => setCurrentPart({ ...currentPart, category: e.target.value })}
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Chips Selection Area */}
                        <div className="space-y-2">
                            <label className="text-xs text-slate-500 flex justify-between items-center">
                                零件分類 (點選或輸入)
                                <button
                                    type="button"
                                    onClick={() => setIsSubcategoryManagerOpen(true)}
                                    className="text-[10px] text-blue-400 hover:underline hover:text-blue-300"
                                >
                                    [管理分類]
                                </button>
                            </label>
                            
                            <div className="flex flex-wrap gap-2 p-3 bg-slate-900/50 rounded-lg border border-slate-700 max-h-32 overflow-y-auto custom-scrollbar">
                                {modalSubcategories.length > 0 ? modalSubcategories.map(sub => (
                                    <button
                                        type="button"
                                        key={sub}
                                        onClick={() => setCurrentPart({ ...currentPart, subcategory: sub })}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                            currentPart.subcategory === sub
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-600 hover:border-slate-500'
                                        }`}
                                    >
                                        {sub}
                                    </button>
                                )) : (
                                    <span className="text-xs text-slate-600 italic">尚無可選分類，請直接輸入</span>
                                )}
                            </div>

                            <input
                                type="text"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none placeholder-slate-600 text-sm"
                                value={currentPart.subcategory || ''}
                                onChange={e => setCurrentPart({ ...currentPart, subcategory: e.target.value })}
                                placeholder="或是手動輸入新分類..."
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">庫存狀態</label>
                    <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-slate-800 transition-colors">
                        <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/50"
                            checked={currentPart.inStock || false}
                            onChange={e => setCurrentPart({ ...currentPart, inStock: e.target.checked })}
                        />
                        <span className={currentPart.inStock ? "text-emerald-400 font-medium" : "text-slate-400"}>
                            {currentPart.inStock ? '目前有現貨' : '目前缺貨中'}
                        </span>
                    </label>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-400">詳細說明</label>
                    <button
                      type="button"
                      onClick={generateDescription}
                      disabled={isGenerating || !currentPart.name}
                      className="flex items-center gap-1.5 text-xs bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-500/30 transition-all disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <span className="animate-pulse">AI 思考中...</span>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          AI 自動撰寫 (繁中)
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm leading-relaxed"
                    value={currentPart.description || ''}
                    onChange={e => setCurrentPart({ ...currentPart, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">商品圖片</label>
                  
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2"
                    >
                       <Upload className="w-4 h-4" /> 從電腦上傳圖片
                    </button>
                    <input 
                       type="file" 
                       ref={fileInputRef} 
                       className="hidden" 
                       accept="image/*"
                       onChange={handleImageUpload}
                    />
                  </div>

                  <input
                    type="text"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-xs text-slate-500"
                    value={currentPart.imageUrl || ''}
                    onChange={e => setCurrentPart({ ...currentPart, imageUrl: e.target.value })}
                    placeholder="或貼上圖片 URL..."
                  />

                  {currentPart.imageUrl && (
                    <div className="mt-4 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 h-48 w-full relative group">
                      <img 
                        src={currentPart.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-[#1e293b] rounded-b-2xl shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-slate-300 hover:bg-slate-700 font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all hover:scale-105"
                >
                  <Save className="w-4 h-4" />
                  確認儲存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-[#0f172a] py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-center text-slate-500 text-sm">
          <p>© 2024 GamePart Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}