import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { User, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Button } from "./Button";
import { Loader2 } from "lucide-react";

export function AuthBlock({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [authError, setAuthError] = useState("");

  const login = async () => {
    try {
      setAuthError("");
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        setAuthError("Pop-up xác thực bị chặn hoặc đã bị hủy. Nếu bạn đang xem ứng dụng trong iframe, vui lòng mở ứng dụng trong Tab Mới hoặc cho phép pop-up trên trình duyệt rồi thử lại.");
      } else {
        setAuthError("Đăng nhập thất bại: " + error.message);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl shadow-xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight uppercase">Chia sẻ tài liệu</h1>
          <p className="text-slate-400">Đăng nhập để quản lý và tạo các liên kết chia sẻ của bạn.</p>
          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl text-sm font-medium text-left leading-relaxed">
              {authError}
              {window.self !== window.top && (
                 <a href={window.location.href} target="_blank" rel="noopener noreferrer" className="block mt-2 underline font-bold hover:text-red-300">
                    Mở ứng dụng ở Tab mới
                 </a>
              )}
            </div>
          )}
          <Button onClick={login} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors border border-indigo-500/50 shadow-lg shadow-indigo-500/20">
            Đăng nhập với Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/5 border-b border-white/10 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">KHO TÀI NGUYÊN AI HAY NHẤT KHÓA 22</h1>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user.email}</span>
            </div>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 p-0.5 cursor-pointer hover:shadow-lg hover:shadow-indigo-500/20 transition-all active:scale-95" onClick={() => setShowUserMenu(!showUserMenu)} title="Tài khoản">
                <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold uppercase">
                  {user.email?.substring(0,2)}
                </div>
              </div>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-slate-900/90 border border-white/10 backdrop-blur-xl rounded-2xl shadow-2xl py-2 z-50 overflow-hidden">
                  <button onClick={logout} className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-white/5 transition-colors flex items-center gap-3 font-medium active:bg-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    Đăng xuất tài khoản
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

