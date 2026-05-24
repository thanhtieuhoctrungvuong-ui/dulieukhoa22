import { useEffect, useState } from "react";
import { useParams, Link as RouterLink } from "react-router-dom";
import { collection, query, where, getDocs, doc, updateDoc, increment, getDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { Link, UserProfile } from "../types";
import * as Icons from "lucide-react";

export function PublicShare({ isRoot }: { isRoot?: boolean }) {
  const { userId } = useParams<{ userId: string }>();
  const [links, setLinks] = useState<Link[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let q;
        let loadedProfile: UserProfile = { slug: "", pageTitle: "KHO TÀI NGUYÊN AI HAY NHẤT KHÓA 22" };
        
        if (isRoot) {
          q = query(collection(db, "links"));
          loadedProfile.pageTitle = "KHO TÀI NGUYÊN AI HAY NHẤT KHÓA 22";
          loadedProfile.authorName = "Thầy Võ Châu Thanh";
        } else {
          if (!userId) return;
          let ownerId = userId; // Default fallback if userId param is a uid
          let userDocRefTarget = null;
          loadedProfile.slug = userId;

          // 1. Try to find user by slug
          const usersQ = query(collection(db, "users"), where("slug", "==", userId));
          const usersSnapshot = await getDocs(usersQ);
          
          if (!usersSnapshot.empty) {
            const userDoc = usersSnapshot.docs[0];
            ownerId = userDoc.id;
            loadedProfile = userDoc.data() as UserProfile;
            userDocRefTarget = doc(db, "users", ownerId);
          } else {
            // If not found by slug, maybe userId is just the UID and profile wasn't customized
            const userDocRef = doc(db, "users", userId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              loadedProfile = userDoc.data() as UserProfile;
              userDocRefTarget = userDocRef;
            }
          }
          
          q = query(collection(db, "links"), where("ownerId", "==", ownerId));

          if (userDocRefTarget) {
            // Setup pageview tracking
            updateDoc(userDocRefTarget, {
              pageViews: increment(1)
            }).catch(console.error);
            // Optimistically update local state for the view counter
            if (typeof loadedProfile.pageViews === 'number') {
               loadedProfile.pageViews += 1;
            } else {
               loadedProfile.pageViews = 1;
            }
          }
        }

        setProfile(loadedProfile);

        // 2. Fetch links
        const snapshot = await getDocs(q);
        const linksData: Link[] = [];
        snapshot.forEach((d) => {
          linksData.push({ id: d.id, ...(d.data() as any) } as Link);
        });
        
        linksData.sort((a, b) => {
          const at = a.createdAt?.toMillis() || 0;
          const bt = b.createdAt?.toMillis() || 0;
          return bt - at;
        });

        setLinks(linksData);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, "links");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId, isRoot]);

  const handleLinkClick = async (link: Link) => {
    try {
      // Increment clicks in firestore
      const linkRef = doc(db, "links", link.id);
      await updateDoc(linkRef, {
        clicks: increment(1)
      });
    } catch (error) {
      console.error("Failed to increment click", error);
      // We don't want to throw to the user on a public share page if tracking fails
    }
  };

  const IconComponent = (name: string) => {
    const Icon = Icons[name as keyof typeof Icons] as any;
    return Icon ? <Icon className="w-6 h-6" /> : <Icons.Link className="w-6 h-6" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
          <RouterLink to="/dashboard" className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white text-sm font-bold tracking-widest uppercase rounded-xl shadow-lg backdrop-blur-md transition-all flex items-center gap-2 border border-indigo-500/30">
            <Icons.LogIn className="w-4 h-4" /> <span className="hidden sm:inline">Trang Quản Trị</span>
          </RouterLink>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 backdrop-blur-xl flex flex-col items-center shadow-2xl max-w-md text-center mt-12 relative">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2">
            <div className="relative w-32 h-32 mx-auto">
              <img 
                src={profile?.avatarUrl || "/avatar.png"} 
                alt="Avatar" 
                onError={(e) => {
                  e.currentTarget.src = "https://ui-avatars.com/api/?name=Thanh&background=0D8ABC&color=fff&size=128";
                }}
                className="w-32 h-32 rounded-full object-cover border-4 border-transparent shadow-2xl relative z-10 mx-auto" 
              />
            </div>
          </div>

          <div className="pt-16">
            <h1 className="text-xl font-bold uppercase tracking-widest text-white mb-2">{profile?.pageTitle || "KHO TÀI NGUYÊN AI"}</h1>
            <p className="text-slate-400 text-sm">
              Người dùng này hiện chưa có dữ liệu liên kết nào.
            </p>
          </div>
          <div className="mt-8">
             <RouterLink to="/dashboard" className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 border border-indigo-500/50">
               <Icons.Plus className="w-5 h-5" /> Thêm Liên Kết Mới
             </RouterLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 flex flex-col">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        {!isRoot && (
          <RouterLink to="/" className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-sm font-bold tracking-widest uppercase rounded-xl shadow-lg backdrop-blur-md transition-all flex items-center gap-2 border border-white/10">
            <Icons.Home className="w-4 h-4" /> <span className="hidden sm:inline">Trang chủ</span>
          </RouterLink>
        )}
        <RouterLink to="/dashboard" className="px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white text-sm font-bold tracking-widest uppercase rounded-xl shadow-lg backdrop-blur-md transition-all flex items-center gap-2 border border-indigo-500/30">
          <Icons.LogIn className="w-4 h-4" /> <span className="hidden sm:inline">Đăng nhập Quản trị</span>
        </RouterLink>
      </div>

      <div className="max-w-3xl w-full mx-auto space-y-10 flex-1">
        <div className="text-center space-y-4">
          <div className="relative w-32 h-32 mx-auto">
            <img 
              src={profile?.avatarUrl || "/avatar.png"} 
              alt="Avatar" 
              onError={(e) => {
                // Fallback to placeholder if image not uploaded yet
                e.currentTarget.src = "https://ui-avatars.com/api/?name=Thanh&background=0D8ABC&color=fff&size=128";
              }}
              className="w-32 h-32 rounded-full object-cover border-4 border-transparent shadow-2xl relative z-10 mx-auto" 
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase relative z-10">{profile?.pageTitle || "KHO TÀI NGUYÊN AI HAY NHẤT KHÓA 22"}</h1>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-medium pt-2">
             <div className="flex items-center gap-2 bg-indigo-500/10 py-1.5 px-4 rounded-full border border-indigo-500/20 text-indigo-200">
                <Icons.User className="w-4 h-4 text-pink-400" />
                <span>Tác giả: {profile?.authorName || "Thầy Võ Châu Thanh"}</span>
             </div>
             {!isRoot && (
               <div className="flex items-center gap-2 bg-indigo-500/10 py-1.5 px-4 rounded-full border border-indigo-500/20 text-indigo-200">
                  <Icons.Eye className="w-4 h-4 text-blue-400" />
                  <span>{profile?.pageViews || 0} lượt truy cập</span>
               </div>
             )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {links.map((link, idx) => {
             // Rotate through a few accent colors based on index
             const colors = [
               { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
               { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
               { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
               { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
             ];
             const color = colors[idx % colors.length];

             const hasUrl = Boolean(link.url);
             const CardElementType = hasUrl ? "a" : "div";
             let hostName = "";
             try {
                if (hasUrl) hostName = new URL(link.url!).hostname;
             } catch (e) {}

             return (
              <CardElementType
                key={link.id}
                href={hasUrl ? link.url : undefined}
                target={hasUrl ? "_blank" : undefined}
                rel={hasUrl ? "noopener noreferrer" : undefined}
                onClick={() => { if (hasUrl) handleLinkClick(link); }}
                className={`group bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md transition-all shadow-lg ${hasUrl ? 'hover:border-indigo-500/50 hover:bg-indigo-500/10 hover:-translate-y-1 block' : 'block'}`}
              >
                <div className="flex gap-4 items-center">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border transition-colors ${color.bg} ${color.text} ${color.border} group-hover:bg-indigo-500/40 group-hover:text-white group-hover:border-indigo-500`}>
                    {IconComponent(link.iconName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-white truncate text-base group-hover:text-indigo-300 transition-colors">{link.title}</h2>
                    {hostName && <p className="text-xs text-slate-400 truncate">{hostName}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-white">{link.clicks}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Lượt</p>
                  </div>
                </div>
                {link.subLinks && link.subLinks.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/5 pt-3">
                    {link.subLinks.map((sl, sIdx) => {
                       const slColor = colors[(idx + sIdx + 1) % colors.length];
                       return (
                        <a key={sl.id} href={sl.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 bg-black/20 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 p-2 rounded-xl transition-colors">
                           <div className={`w-8 h-8 rounded-lg ${slColor.bg} flex items-center justify-center`}>
                              <Icons.Link className={`w-3 h-3 ${slColor.text}`} />
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="text-sm font-medium text-slate-200 truncate">{sl.title}</div>
                           </div>
                        </a>
                      );
                    })}
                  </div>
                )}
              </CardElementType>
            );
          })}
        </div>
      </div>
      
      <footer className="mt-12 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-500 uppercase tracking-widest max-w-3xl mx-auto w-full px-4 border-t border-white/10 pt-6">
        <RouterLink to="/dashboard" className="hover:text-indigo-400 transition-colors flex items-center gap-2 mb-4 md:mb-0">
          <Icons.Zap className="w-3 h-3" />
          Tạo trang Chia Sẻ của riêng bạn
        </RouterLink>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Live Session Active</span>
        </div>
      </footer>
    </div>
  );
}
