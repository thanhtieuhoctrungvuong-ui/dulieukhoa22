import React, { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Link, ICONS, UserProfile } from "../types";
import { db, auth, storage, handleFirestoreError, OperationType } from "../lib/firebase";
import { Button } from "./Button";
import * as Icons from "lucide-react";
import { Link as RouterLink } from "react-router-dom";

export function Dashboard() {
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newIcon, setNewIcon] = useState("Link");
  const [newSubLinks, setNewSubLinks] = useState<{id: string; title: string; url: string}[]>([]);
  
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editLinkTitle, setEditLinkTitle] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editLinkIcon, setEditLinkIcon] = useState("Link");
  const [editLinkSubLinks, setEditLinkSubLinks] = useState<{id: string; title: string; url: string}[]>([]);
  
  const user = auth.currentUser;

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ slug: user?.uid || "", pageTitle: "KHO TÀI NGUYÊN AI HAY NHẤT KHÓA 22", authorName: "Thầy Võ Châu Thanh", pageViews: 0 });
  const [editSlug, setEditSlug] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [profileError, setProfileError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          if (!data.authorName) data.authorName = "Thầy Võ Châu Thanh";
          if (data.pageViews === undefined) data.pageViews = 0;
          setProfile(data);
        } else {
          const defaultProfile = { slug: user.uid, pageTitle: "KHO TÀI NGUYÊN AI HAY NHẤT KHÓA 22", authorName: "Thầy Võ Châu Thanh", pageViews: 0 };
          await setDoc(doc(db, "users", user.uid), defaultProfile);
          setProfile(defaultProfile);
        }
      } catch (e) {
        console.error("Failed to load profile", e);
      }
    };
    fetchProfile();

    const q = query(collection(db, "links"), where("ownerId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksData: Link[] = [];
      snapshot.forEach((d) => {
        linksData.push({ id: d.id, ...d.data() } as Link);
      });
      // Sort by creation time desc (client-side since we didn't index createdAt yet)
      linksData.sort((a, b) => {
        const at = a.createdAt?.toMillis() || 0;
        const bt = b.createdAt?.toMillis() || 0;
        return bt - at;
      });
      setLinks(linksData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "links");
    });

    return () => unsubscribe();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editSlug.trim() || !editTitle.trim()) return;
    
    // Convert string to a clean URL slug format
    const cleanSlug = editSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!cleanSlug) {
      setProfileError("Đường dẫn (Slug) không hợp lệ.");
      return;
    }

    try {
      setIsUploading(true);
      let uploadedAvatarUrl = profile.avatarUrl;

      if (avatarFile) {
        // Resize and convert image to base64 to avoid needing Firebase Storage rules
        uploadedAvatarUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(avatarFile);
          reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              const maxWidth = 512;
              let { width, height } = img;
              
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
              
              canvas.width = width;
              canvas.height = height;
              ctx?.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL("image/jpeg", 0.85));
            };
            img.onerror = (error) => reject(error);
          };
          reader.onerror = (error) => reject(error);
        });
      }

      const newProfile = { ...profile, slug: cleanSlug, pageTitle: editTitle.trim(), authorName: editAuthor.trim(), avatarUrl: uploadedAvatarUrl };
      await setDoc(doc(db, "users", user.uid), newProfile, { merge: true });
      setProfile(newProfile);
      setIsEditingProfile(false);
      setProfileError("");
      setAvatarFile(null);
    } catch (e) {
      console.error("Failed to save profile", e);
      setProfileError("Cập nhật thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!newTitle.trim())) return;

    try {
      await addDoc(collection(db, "links"), {
        title: newTitle.trim(),
        url: newUrl.trim() || "",
        iconName: newIcon,
        ownerId: user.uid,
        clicks: 0,
        createdAt: serverTimestamp(),
        subLinks: newSubLinks.filter(sl => sl.title.trim() && sl.url.trim())
      });
      setNewTitle("");
      setNewUrl("");
      setNewIcon("Link");
      setNewSubLinks([]);
      setIsAdding(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "links");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "links", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `links/${id}`);
    }
  };

  const startEdit = (link: Link) => {
    setEditingLinkId(link.id);
    setEditLinkTitle(link.title);
    setEditLinkUrl(link.url || "");
    setEditLinkIcon(link.iconName);
    setEditLinkSubLinks(link.subLinks || []);
    setIsAdding(false);
  };

  const cancelEdit = () => {
    setEditingLinkId(null);
  };

  const handleUpdateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLinkId || !editLinkTitle.trim()) return;

    try {
      await updateDoc(doc(db, "links", editingLinkId), {
        title: editLinkTitle.trim(),
        url: editLinkUrl.trim() || "",
        iconName: editLinkIcon,
        subLinks: editLinkSubLinks.filter(sl => sl.title.trim() && sl.url.trim())
      });
      setEditingLinkId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `links/${editingLinkId}`);
    }
  };

  const IconComponent = (name: string) => {
    const Icon = Icons[name as keyof typeof Icons] as any;
    return Icon ? <Icon className="w-5 h-5" /> : <Icons.Link className="w-5 h-5" />;
  };

  const renderSubLinksEditor = (isEditing: boolean) => {
    const subLinks = isEditing ? editLinkSubLinks : newSubLinks;
    return (
      <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
        <div className="flex justify-between items-center">
          <label className="text-sm font-medium text-slate-300">Liên kết con (Tùy chọn)</label>
          <Button type="button" variant="ghost" size="sm" onClick={() => {
            const newSub = { id: Math.random().toString(36).substring(2, 9), title: "", url: "" };
            if (isEditing) setEditLinkSubLinks([...editLinkSubLinks, newSub]);
            else setNewSubLinks([...newSubLinks, newSub]);
          }} className="text-indigo-400 hover:bg-indigo-500/20 text-xs">
            <Icons.Plus className="w-3 h-3 mr-1" /> Thêm liên kết con
          </Button>
        </div>
        {subLinks.map(sl => (
          <div key={sl.id} className="flex gap-2 items-center bg-black/20 p-2 rounded-xl border border-white/5">
            <input type="text" placeholder="Tiêu đề (VD: AI tạo nhạc)" value={sl.title} onChange={e => {
              const val = e.target.value;
              if (isEditing) setEditLinkSubLinks(editLinkSubLinks.map(s => s.id === sl.id ? { ...s, title: val } : s));
              else setNewSubLinks(newSubLinks.map(s => s.id === sl.id ? { ...s, title: val } : s));
            }} className="w-1/3 rounded-lg bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white placeholder:text-slate-600" />
            <input type="url" placeholder="https://..." value={sl.url} onChange={e => {
              const val = e.target.value;
              if (isEditing) setEditLinkSubLinks(editLinkSubLinks.map(s => s.id === sl.id ? { ...s, url: val } : s));
              else setNewSubLinks(newSubLinks.map(s => s.id === sl.id ? { ...s, url: val } : s));
            }} className="flex-1 rounded-lg bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 text-white placeholder:text-slate-600" />
            <Button type="button" variant="ghost" size="icon" onClick={() => {
              if (isEditing) setEditLinkSubLinks(editLinkSubLinks.filter(s => s.id !== sl.id));
              else setNewSubLinks(newSubLinks.filter(s => s.id !== sl.id));
            }} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 w-8 h-8 rounded-lg shrink-0">
               <Icons.X className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Icons.Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>;
  }

  const shareUrl = `${window.location.origin}/share/${profile.slug || user?.uid}`;

  return (
    <div className="space-y-6">
      {!isEditingProfile ? (
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 flex flex-col items-start gap-4">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/30 shrink-0">
               <Icons.Link className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">{profile.pageTitle}</h2>
          </div>
          <div className="flex flex-col gap-1 w-full bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Tác giả:</span>
              <span className="font-medium text-white">{profile.authorName}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400">Lượt truy cập:</span>
              <span className="font-bold text-indigo-400 font-mono">{profile.pageViews || 0}</span>
            </div>
          </div>
          <p className="text-sm text-indigo-300 break-all bg-indigo-500/20 px-4 py-2 rounded-xl border border-indigo-500/30 font-mono w-full leading-relaxed">{shareUrl}</p>
          <div className="flex flex-wrap items-center gap-3 mt-2 w-full">
            <Button variant="outline" onClick={() => {
                  setEditTitle(profile.pageTitle);
                  setEditSlug(profile.slug);
                  setEditAuthor(profile.authorName || "Thầy Võ Châu Thanh");
                  setIsEditingProfile(true);
                }} 
                className="flex-1 md:flex-none border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 hover:text-white bg-indigo-500/10">
              <Icons.Settings className="w-4 h-4 mr-2" /> Tùy chỉnh URL
            </Button>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(shareUrl)} className="flex-1 md:flex-none border-white/10 text-white hover:bg-white/10 hover:text-white bg-transparent">
              <Icons.Copy className="w-4 h-4 mr-2" /> Sao chép
            </Button>
            <RouterLink to={`/share/${profile.slug || user?.uid}`} target="_blank" className="flex-1 md:flex-none block w-full md:w-auto">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 border border-indigo-500/50">
                Xem trang <Icons.ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </RouterLink>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveProfile} className="bg-white/5 border border-indigo-500/30 backdrop-blur-xl rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-indigo-300 tracking-widest uppercase">Tùy chỉnh trang chia sẻ</h3>
            <button type="button" onClick={() => setIsEditingProfile(false)} className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-colors">
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
          {profileError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm font-medium">
              {profileError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-300">Ảnh đại diện (Avatar)</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-black/20 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar Preview" className="w-full h-full object-cover" />
                  ) : profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Current Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Icons.Image className="w-6 h-6 text-slate-500" />
                  )}
                </div>
                <div className="flex-1">
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef}
                    className="hidden" 
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setAvatarFile(e.target.files[0]);
                        setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                      }
                    }} 
                  />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="text-sm bg-black/20 border-white/10 hover:bg-white/5">
                    <Icons.Upload className="w-4 h-4 mr-2" /> Chọn ảnh
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tiêu đề trang</label>
              <input type="text" required value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
                <span>Đường dẫn liên kết (Slug)</span>
                <span className="text-[10px] text-slate-500 font-normal">Sẽ được thay vào cuối URL</span>
              </label>
              <input type="text" required value={editSlug} onChange={e => setEditSlug(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tên tác giả</label>
              <input type="text" value={editAuthor} onChange={e => setEditAuthor(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white" />
            </div>
          </div>
          <div className="pt-2 flex gap-3">
            <Button type="submit" disabled={isUploading} className="bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-lg shadow-indigo-500/20">
              {isUploading ? <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Lưu thay đổi
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditingProfile(false)} className="text-slate-300 hover:text-white">Đóng</Button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Quản lý Liên Kết</h3>
        <Button onClick={() => setIsAdding(!isAdding)} className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/50 shadow-lg shadow-emerald-500/20 text-white rounded-xl">
          {isAdding ? "Hủy" : <><Icons.Plus className="w-4 h-4 mr-2" /> Thêm Mới</>}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Tiêu đề</label>
              <input type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="VD: Tài liệu học tập, Facebook của tôi..." className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Đường dẫn (URL)</label>
              <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Tùy chọn nếu có liên kết con..." className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white placeholder:text-slate-500" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Chọn Icon</label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setNewIcon(icon)}
                  className={`p-3 rounded-xl border ${newIcon === icon ? 'bg-indigo-500/40 border-indigo-500/50 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                >
                  {IconComponent(icon)}
                </button>
              ))}
            </div>
          </div>
          {renderSubLinksEditor(false)}
          <div className="pt-4">
            <Button type="submit" className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-lg shadow-indigo-500/20 rounded-xl px-8">Lưu liên kết</Button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {links.length === 0 && !isAdding && (
          <div className="text-center py-12 text-slate-400 bg-white/5 border border-white/10 rounded-3xl border-dashed backdrop-blur-md">
            Chưa có liên kết nào. Hãy thêm ngay!
          </div>
        )}
        {links.map((link) => (
          editingLinkId === link.id ? (
            <form key={link.id} onSubmit={handleUpdateLink} className="bg-white/5 border border-blue-500/30 backdrop-blur-xl rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-blue-300 tracking-widest uppercase">Chỉnh sửa liên kết</h3>
                <button type="button" onClick={cancelEdit} className="text-slate-400 hover:text-white">
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Tiêu đề</label>
                  <input type="text" required value={editLinkTitle} onChange={e => setEditLinkTitle(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-slate-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Đường dẫn (URL)</label>
                  <input type="url" value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)} placeholder="Tùy chọn..." className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-slate-500" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Chọn Icon</label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setEditLinkIcon(icon)}
                      className={`p-3 rounded-xl border ${editLinkIcon === icon ? 'bg-blue-500/40 border-blue-500/50 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                    >
                      {IconComponent(icon)}
                    </button>
                  ))}
                </div>
              </div>
              {renderSubLinksEditor(true)}
              <div className="pt-4 flex gap-3">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 shadow-lg shadow-blue-500/20 rounded-xl px-8">Lưu thay đổi</Button>
                <Button type="button" variant="ghost" onClick={cancelEdit} className="text-slate-300 hover:text-white">Hủy</Button>
              </div>
            </form>
          ) : (
            <div key={link.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex gap-4 backdrop-blur-md items-center shadow-lg transition-transform hover:-translate-y-0.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                {IconComponent(link.iconName)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold truncate">{link.title}</h4>
                {link.url && (
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-indigo-400 hover:underline truncate block">
                    {link.url}
                  </a>
                )}
                {link.subLinks && link.subLinks.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {link.subLinks.map(sl => (
                      <a key={sl.id} href={sl.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-black/20 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 p-2 rounded-xl transition-colors">
                         <div className="w-6 h-6 rounded-md bg-indigo-500/20 flex items-center justify-center">
                            <Icons.Link className="w-3 h-3 text-indigo-400" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <div className="text-sm font-medium text-slate-200 truncate">{sl.title}</div>
                         </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end shrink-0 pr-4">
                <span className="text-base font-bold">{link.clicks}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest">Lượt nhấn</span>
              </div>
              <div className="shrink-0 pl-4 border-l border-white/10 flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => startEdit(link)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-xl">
                  <Icons.Pencil className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(link.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-xl">
                  <Icons.Trash2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
